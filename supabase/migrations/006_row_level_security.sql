-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 006: Row Level Security
--
-- Design: all mutations to transactional tables (orders, order_items,
-- payments, inventory_transactions, activity_logs, notifications) happen
-- exclusively through the SECURITY DEFINER functions in migration 005,
-- which are owned by a superuser role and therefore bypass RLS internally.
-- Client roles (anon/authenticated) are only ever granted SELECT here,
-- which keeps every write path centralized, validated and auditable.

alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table ingredients enable row level security;
alter table product_ingredients enable row level security;
alter table locations enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table payments enable row level security;
alter table inventory_transactions enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;
alter table printer_settings enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;

-- ==========================================================================
-- PROFILES
-- ==========================================================================
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_staff());

create policy profiles_update_admin on profiles for update
  using (is_admin()) with check (is_admin());

-- ==========================================================================
-- CATEGORIES
-- ==========================================================================
create policy categories_select on categories for select
  using (active = true or is_admin());

create policy categories_write_admin on categories for insert
  with check (is_admin());
create policy categories_update_admin on categories for update
  using (is_admin()) with check (is_admin());
create policy categories_delete_admin on categories for delete
  using (is_admin());

-- ==========================================================================
-- PRODUCTS
-- ==========================================================================
create policy products_select on products for select
  using (available = true or is_staff());

create policy products_insert_admin on products for insert
  with check (is_admin());
create policy products_update_admin on products for update
  using (is_admin()) with check (is_admin());
create policy products_delete_admin on products for delete
  using (is_admin());

-- ==========================================================================
-- INGREDIENTS
-- ==========================================================================
create policy ingredients_select_staff on ingredients for select
  using (is_staff());

create policy ingredients_insert_admin on ingredients for insert
  with check (is_admin());
create policy ingredients_update_admin on ingredients for update
  using (is_admin()) with check (is_admin());
create policy ingredients_delete_admin on ingredients for delete
  using (is_admin());

-- ==========================================================================
-- PRODUCT_INGREDIENTS (recipes)
-- ==========================================================================
create policy product_ingredients_select_staff on product_ingredients for select
  using (is_staff());

create policy product_ingredients_insert_admin on product_ingredients for insert
  with check (is_admin());
create policy product_ingredients_update_admin on product_ingredients for update
  using (is_admin()) with check (is_admin());
create policy product_ingredients_delete_admin on product_ingredients for delete
  using (is_admin());

-- ==========================================================================
-- LOCATIONS (QR seats) — public readable when active so the customer menu
-- page can resolve a scanned QR code without authentication.
-- ==========================================================================
create policy locations_select on locations for select
  using (active = true or is_staff());

create policy locations_insert_admin on locations for insert
  with check (is_admin());
create policy locations_update_admin on locations for update
  using (is_admin()) with check (is_admin());
create policy locations_delete_admin on locations for delete
  using (is_admin());

-- ==========================================================================
-- ORDERS / ORDER_ITEMS / ORDER_STATUS_HISTORY / PAYMENTS / INVENTORY_TXNS
-- Staff can read; all writes happen via SECURITY DEFINER RPCs only.
-- Anonymous customers never get direct table access — they use
-- get_order_tracking(access_token) instead.
-- ==========================================================================
create policy orders_select_staff on orders for select
  using (is_staff());
create policy orders_update_admin on orders for update
  using (is_admin()) with check (is_admin());

create policy order_items_select_staff on order_items for select
  using (is_staff());

create policy order_status_history_select_staff on order_status_history for select
  using (is_staff());

create policy payments_select_staff on payments for select
  using (is_staff());

create policy inventory_transactions_select_staff on inventory_transactions for select
  using (is_staff());

-- ==========================================================================
-- NOTIFICATIONS — visible to the targeted user or role
-- ==========================================================================
create policy notifications_select on notifications for select
  using (user_id = auth.uid() or role = current_profile_role());

create policy notifications_update_own on notifications for update
  using (user_id = auth.uid() or role = current_profile_role())
  with check (user_id = auth.uid() or role = current_profile_role());

-- ==========================================================================
-- ACTIVITY LOGS — admin only
-- ==========================================================================
create policy activity_logs_select_admin on activity_logs for select
  using (is_admin());

-- ==========================================================================
-- PRINTER SETTINGS
-- ==========================================================================
create policy printer_settings_select_staff on printer_settings for select
  using (is_staff());
create policy printer_settings_insert_admin on printer_settings for insert
  with check (is_admin());
create policy printer_settings_update_admin on printer_settings for update
  using (is_admin()) with check (is_admin());
create policy printer_settings_delete_admin on printer_settings for delete
  using (is_admin());

-- ==========================================================================
-- EXPENSES — admin only
-- ==========================================================================
create policy expenses_select_admin on expenses for select
  using (is_admin());
create policy expenses_insert_admin on expenses for insert
  with check (is_admin());
create policy expenses_update_admin on expenses for update
  using (is_admin()) with check (is_admin());
create policy expenses_delete_admin on expenses for delete
  using (is_admin());

-- ==========================================================================
-- SETTINGS — publicly readable (cafeteria name/currency shown on customer
-- menu), only admin can write
-- ==========================================================================
create policy settings_select_all on settings for select
  using (true);
create policy settings_update_admin on settings for update
  using (is_admin()) with check (is_admin());

-- ==========================================================================
-- REALTIME — publish change events for the tables that need live updates
-- ==========================================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table order_status_history;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table ingredients;
