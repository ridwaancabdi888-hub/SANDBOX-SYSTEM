-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 008: Lock down internal helper functions
--
-- Postgres grants EXECUTE to PUBLIC by default on new functions. These
-- functions are only meant to be called from inside other SECURITY DEFINER
-- functions (owned by the table-owning role) — never directly by a client.
-- Revoking here does not break internal calls: inside a SECURITY DEFINER
-- function, subsequent calls are privilege-checked as the definer, not the
-- original caller.

revoke execute on function _create_order_internal(uuid, jsonb, text, order_source, uuid) from public, anon, authenticated;
revoke execute on function notify_role(app_role, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function log_activity(text, text, uuid, text) from public, anon, authenticated;
revoke execute on function handle_new_auth_user() from public, anon, authenticated;

-- fix mutable search_path lint
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
