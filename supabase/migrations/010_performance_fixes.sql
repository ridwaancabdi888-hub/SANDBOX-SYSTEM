-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 010: Performance fixes (missing FK indexes, RLS initplan)

create index idx_expenses_created_by on expenses(created_by);
create index idx_inventory_txn_order on inventory_transactions(order_id);
create index idx_inventory_txn_user on inventory_transactions(user_id);
create index idx_order_items_product on order_items(product_id);
create index idx_order_status_history_changed_by on order_status_history(changed_by);
create index idx_orders_created_by on orders(created_by);
create index idx_payments_cashier on payments(cashier_id);
create index idx_product_ingredients_ingredient on product_ingredients(ingredient_id);

drop policy profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = (select auth.uid()) or is_staff());

drop policy notifications_select on notifications;
create policy notifications_select on notifications for select
  using (user_id = (select auth.uid()) or role = current_profile_role());

drop policy notifications_update_own on notifications;
create policy notifications_update_own on notifications for update
  using (user_id = (select auth.uid()) or role = current_profile_role())
  with check (user_id = (select auth.uid()) or role = current_profile_role());
