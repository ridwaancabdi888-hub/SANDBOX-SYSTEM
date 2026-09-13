-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 004: Helper functions + triggers

-- ==========================================================================
-- ROLE HELPERS (security definer to avoid RLS recursion on profiles)
-- ==========================================================================
create or replace function current_profile_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active = true;
$$;

create or replace function current_profile_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from profiles where id = auth.uid()), false);
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and active = true
      and role in ('admin', 'cashier', 'kitchen', 'waiter')
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and active = true and role = 'admin'
  );
$$;

-- ==========================================================================
-- updated_at TRIGGER HELPER
-- ==========================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

create trigger trg_ingredients_updated_at before update on ingredients
  for each row execute function set_updated_at();

create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- ==========================================================================
-- NEW AUTH USER -> PROFILE ROW
-- Admin creates users via the server-side Admin API which sets
-- raw_user_meta_data.full_name and raw_user_meta_data.role.
-- ==========================================================================
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'cashier'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ==========================================================================
-- ACTIVITY LOG HELPER
-- ==========================================================================
create or replace function log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_logs (user_id, action, entity_type, entity_id, description)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_description);
end;
$$;

-- ==========================================================================
-- NOTIFICATION HELPER
-- ==========================================================================
create or replace function notify_role(
  p_role app_role,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (role, title, message, entity_type, entity_id)
  values (p_role, p_title, p_message, p_entity_type, p_entity_id);
end;
$$;
