-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 005: Order workflow RPC functions (creation, status transitions, payment, stock deduction)
-- All order mutations go through these SECURITY DEFINER functions so that
-- pricing, permissions and stock deduction are enforced server-side and
-- cannot be bypassed or tampered with from the client.

-- ==========================================================================
-- Internal helper: validate + price a jsonb cart, insert order + order_items
-- items shape: [{ "product_id": "uuid", "quantity": 1, "note": "no onion" }]
-- ==========================================================================
create or replace function _create_order_internal(
  p_location_id uuid,
  p_items jsonb,
  p_note text,
  p_source order_source,
  p_created_by uuid
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product products%rowtype;
  v_qty int;
  v_subtotal numeric(10,2) := 0;
  v_order orders%rowtype;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  insert into orders (location_id, source, customer_note, created_by, subtotal, total)
  values (p_location_id, p_source, nullif(trim(p_note), ''), p_created_by, 0, 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for order item';
    end if;

    select * into v_product from products
      where id = (v_item->>'product_id')::uuid and available = true;

    if not found then
      raise exception 'Product % is not available', (v_item->>'product_id');
    end if;

    insert into order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, note)
    values (
      v_order.id, v_product.id, v_product.name, v_product.price, v_qty,
      v_product.price * v_qty, nullif(trim(v_item->>'note'), '')
    );

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  update orders set subtotal = v_subtotal, total = v_subtotal
    where id = v_order.id
    returning * into v_order;

  insert into order_status_history (order_id, status, changed_by, note)
  values (v_order.id, 'NEW', p_created_by, 'Order created');

  perform notify_role('kitchen', 'New order #' || v_order.order_number,
    'A new order has been placed' || coalesce(' at ' || (select name from locations where id = p_location_id), ''),
    'order', v_order.id);
  perform notify_role('cashier', 'New order #' || v_order.order_number,
    'A new order has been placed', 'order', v_order.id);
  perform notify_role('waiter', 'New order #' || v_order.order_number,
    'A new order has been placed', 'order', v_order.id);
  perform notify_role('admin', 'New order #' || v_order.order_number,
    'A new order has been placed (' || p_source || ')', 'order', v_order.id);

  insert into activity_logs (user_id, action, entity_type, entity_id, description)
  values (p_created_by, 'order_created', 'order', v_order.id,
    'Order #' || v_order.order_number || ' created via ' || p_source);

  return v_order;
end;
$$;

-- ==========================================================================
-- place_qr_order: called by anonymous customers scanning a seat QR code
-- ==========================================================================
create or replace function place_qr_order(
  p_location_code text,
  p_items jsonb,
  p_note text
)
returns table (order_id uuid, order_number int, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location locations%rowtype;
  v_order orders%rowtype;
begin
  select * into v_location from locations
    where code = p_location_code and active = true;

  if not found then
    raise exception 'This location is not available. Please ask staff for assistance.';
  end if;

  v_order := _create_order_internal(v_location.id, p_items, p_note, 'QR_CUSTOMER', null);

  return query select v_order.id, v_order.order_number, v_order.access_token;
end;
$$;

grant execute on function place_qr_order(text, jsonb, text) to anon, authenticated;

-- ==========================================================================
-- create_staff_order: waiter / cashier / admin manually create an order
-- ==========================================================================
create or replace function create_staff_order(
  p_location_id uuid,
  p_items jsonb,
  p_note text,
  p_source order_source
)
returns table (order_id uuid, order_number int, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_order orders%rowtype;
begin
  v_role := current_profile_role();

  if v_role is null then
    raise exception 'Only active staff members can create orders';
  end if;

  if v_role = 'kitchen' then
    raise exception 'Kitchen staff cannot create orders';
  end if;

  if v_role <> 'admin' and p_source::text <> upper(v_role::text) then
    raise exception 'Invalid order source for role %', v_role;
  end if;

  v_order := _create_order_internal(p_location_id, p_items, p_note, p_source, auth.uid());

  return query select v_order.id, v_order.order_number, v_order.access_token;
end;
$$;

grant execute on function create_staff_order(uuid, jsonb, text, order_source) to authenticated;

-- ==========================================================================
-- get_order_tracking: secure read-only lookup for customers via access_token
-- ==========================================================================
create or replace function get_order_tracking(p_access_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'source', o.source,
    'customer_note', o.customer_note,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'total', o.total,
    'created_at', o.created_at,
    'location_name', l.name,
    'location_code', l.code,
    'items', (
      select coalesce(json_agg(json_build_object(
        'id', oi.id, 'product_name', oi.product_name, 'quantity', oi.quantity,
        'unit_price', oi.unit_price, 'subtotal', oi.subtotal, 'note', oi.note
      )), '[]'::json)
      from order_items oi where oi.order_id = o.id
    ),
    'history', (
      select coalesce(json_agg(json_build_object('status', h.status, 'changed_at', h.changed_at) order by h.changed_at), '[]'::json)
      from order_status_history h where h.order_id = o.id
    )
  )
  from orders o
  left join locations l on l.id = o.location_id
  where o.access_token = p_access_token;
$$;

grant execute on function get_order_tracking(uuid) to anon, authenticated;

-- ==========================================================================
-- advance_order_status: kitchen/waiter/cashier/admin transition an order,
-- deducting or restoring ingredient stock transactionally where relevant.
-- ==========================================================================
create or replace function advance_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_note text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_order orders%rowtype;
  v_allow_negative boolean;
  v_rec record;
  v_before numeric(12,3);
  v_after numeric(12,3);
  v_allowed boolean := false;
begin
  v_role := current_profile_role();
  if v_role is null then
    raise exception 'Only active staff members can update orders';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'CANCELLED' or v_order.status = 'COMPLETED' then
    raise exception 'Order is already %', v_order.status;
  end if;

  -- role-based transition rules
  if v_role = 'admin' then
    v_allowed := true;
  elsif v_role = 'kitchen' then
    v_allowed := (v_order.status = 'NEW' and p_new_status = 'PREPARING')
              or (v_order.status = 'PREPARING' and p_new_status = 'READY')
              or (p_new_status = 'CANCELLED' and v_order.status in ('NEW', 'PREPARING'));
  elsif v_role = 'waiter' then
    v_allowed := (v_order.status = 'READY' and p_new_status = 'SERVED');
  elsif v_role = 'cashier' then
    v_allowed := (p_new_status = 'CANCELLED' and v_order.status in ('NEW', 'PREPARING', 'READY'))
              or (p_new_status = 'COMPLETED');
  end if;

  if not v_allowed then
    raise exception 'Role % cannot change order from % to %', v_role, v_order.status, p_new_status;
  end if;

  -- deduct ingredient stock the first time an order enters PREPARING
  if p_new_status = 'PREPARING' and not v_order.stock_deducted then
    select allow_negative_stock into v_allow_negative from settings where id = 1;

    for v_rec in (
      select pi.ingredient_id, sum(pi.quantity * oi.quantity) as needed
      from order_items oi
      join product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id
      group by pi.ingredient_id
    ) loop
      select current_quantity into v_before from ingredients where id = v_rec.ingredient_id for update;
      v_after := v_before - v_rec.needed;
      if v_after < 0 and not v_allow_negative then
        raise exception 'Insufficient stock for ingredient % (need %, have %)',
          (select name from ingredients where id = v_rec.ingredient_id), v_rec.needed, v_before;
      end if;
      update ingredients set current_quantity = v_after where id = v_rec.ingredient_id;
      insert into inventory_transactions (ingredient_id, type, quantity, before_quantity, after_quantity, user_id, reason, order_id)
      values (v_rec.ingredient_id, 'SALE', -v_rec.needed, v_before, v_after, auth.uid(), 'Order #' || v_order.order_number, p_order_id);
    end loop;

    v_order.stock_deducted := true;
  end if;

  -- restore ingredient stock if a prepared order is cancelled
  if p_new_status = 'CANCELLED' and v_order.stock_deducted then
    for v_rec in (
      select pi.ingredient_id, sum(pi.quantity * oi.quantity) as needed
      from order_items oi
      join product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id
      group by pi.ingredient_id
    ) loop
      select current_quantity into v_before from ingredients where id = v_rec.ingredient_id for update;
      v_after := v_before + v_rec.needed;
      update ingredients set current_quantity = v_after where id = v_rec.ingredient_id;
      insert into inventory_transactions (ingredient_id, type, quantity, before_quantity, after_quantity, user_id, reason, order_id)
      values (v_rec.ingredient_id, 'RETURN', v_rec.needed, v_before, v_after, auth.uid(), 'Order #' || v_order.order_number || ' cancelled', p_order_id);
    end loop;
    v_order.stock_deducted := false;
  end if;

  update orders set status = p_new_status, stock_deducted = v_order.stock_deducted
    where id = p_order_id
    returning * into v_order;

  insert into order_status_history (order_id, status, changed_by, note)
  values (p_order_id, p_new_status, auth.uid(), p_note);

  if p_new_status = 'READY' then
    perform notify_role('waiter', 'Order #' || v_order.order_number || ' is ready',
      'Ready for pickup and delivery', 'order', v_order.id);
    perform notify_role('admin', 'Order #' || v_order.order_number || ' is ready', 'Ready', 'order', v_order.id);
    perform notify_role('cashier', 'Order #' || v_order.order_number || ' is ready', 'Ready', 'order', v_order.id);
  elsif p_new_status = 'SERVED' then
    perform notify_role('cashier', 'Order #' || v_order.order_number || ' served', 'Ready for payment', 'order', v_order.id);
    perform notify_role('admin', 'Order #' || v_order.order_number || ' served', 'Served', 'order', v_order.id);
  elsif p_new_status = 'CANCELLED' then
    perform notify_role('admin', 'Order #' || v_order.order_number || ' cancelled', coalesce(p_note, ''), 'order', v_order.id);
    perform notify_role('kitchen', 'Order #' || v_order.order_number || ' cancelled', coalesce(p_note, ''), 'order', v_order.id);
    perform notify_role('cashier', 'Order #' || v_order.order_number || ' cancelled', coalesce(p_note, ''), 'order', v_order.id);
  elsif p_new_status = 'COMPLETED' then
    perform notify_role('admin', 'Order #' || v_order.order_number || ' completed', 'Completed', 'order', v_order.id);
  end if;

  insert into activity_logs (user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'order_status_changed', 'order', p_order_id,
    'Order #' || v_order.order_number || ' -> ' || p_new_status);

  return v_order;
end;
$$;

grant execute on function advance_order_status(uuid, order_status, text) to authenticated;

-- ==========================================================================
-- record_payment: cashier/admin process payment for an order
-- ==========================================================================
create or replace function record_payment(
  p_order_id uuid,
  p_method payment_method,
  p_amount_paid numeric
)
returns table (payment_id uuid, change_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_order orders%rowtype;
  v_change numeric(10,2);
  v_payment_id uuid;
begin
  v_role := current_profile_role();
  if v_role not in ('cashier', 'admin') then
    raise exception 'Only cashiers or admins can record payments';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'Cannot pay a cancelled order';
  end if;

  if exists (select 1 from payments where order_id = p_order_id) then
    raise exception 'Order already paid';
  end if;

  if p_amount_paid < v_order.total then
    raise exception 'Amount paid (%) is less than order total (%)', p_amount_paid, v_order.total;
  end if;

  v_change := round(p_amount_paid - v_order.total, 2);

  insert into payments (order_id, method, amount, amount_paid, change_amount, cashier_id)
  values (p_order_id, p_method, v_order.total, p_amount_paid, v_change, auth.uid())
  returning id into v_payment_id;

  update orders set status = 'COMPLETED' where id = p_order_id;

  insert into order_status_history (order_id, status, changed_by, note)
  values (p_order_id, 'COMPLETED', auth.uid(), 'Payment received (' || p_method || ')');

  perform notify_role('admin', 'Order #' || v_order.order_number || ' completed',
    'Paid via ' || p_method, 'order', p_order_id);

  insert into activity_logs (user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'payment_received', 'order', p_order_id,
    'Order #' || v_order.order_number || ' paid via ' || p_method || ' amount ' || v_order.total);

  return query select v_payment_id, v_change;
end;
$$;

grant execute on function record_payment(uuid, payment_method, numeric) to authenticated;

-- ==========================================================================
-- adjust_stock: admin manual inventory adjustment (purchase/adjustment/waste/return)
-- ==========================================================================
create or replace function adjust_stock(
  p_ingredient_id uuid,
  p_quantity_delta numeric,
  p_type stock_txn_type,
  p_reason text
)
returns ingredients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric(12,3);
  v_after numeric(12,3);
  v_allow_negative boolean;
  v_ingredient ingredients%rowtype;
begin
  if not is_admin() then
    raise exception 'Only admins can adjust stock';
  end if;

  select allow_negative_stock into v_allow_negative from settings where id = 1;

  select * into v_ingredient from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Ingredient not found';
  end if;

  v_before := v_ingredient.current_quantity;
  v_after := v_before + p_quantity_delta;

  if v_after < 0 and not v_allow_negative then
    raise exception 'Adjustment would result in negative stock for %', v_ingredient.name;
  end if;

  update ingredients set current_quantity = v_after where id = p_ingredient_id returning * into v_ingredient;

  insert into inventory_transactions (ingredient_id, type, quantity, before_quantity, after_quantity, user_id, reason)
  values (p_ingredient_id, p_type, p_quantity_delta, v_before, v_after, auth.uid(), p_reason);

  insert into activity_logs (user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'stock_adjusted', 'ingredient', p_ingredient_id,
    v_ingredient.name || ' ' || p_type || ' ' || p_quantity_delta);

  return v_ingredient;
end;
$$;

grant execute on function adjust_stock(uuid, numeric, stock_txn_type, text) to authenticated;

-- ==========================================================================
-- mark_notifications_read
-- ==========================================================================
create or replace function mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read = true
  where id = p_notification_id
    and (user_id = auth.uid() or role = current_profile_role());
$$;

grant execute on function mark_notification_read(uuid) to authenticated;
