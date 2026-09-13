-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 009: Tighten staff-only RPC grants
--
-- `grant execute ... to authenticated` alone does not remove the default
-- PUBLIC grant, so anon could still call these. Revoke from public/anon
-- explicitly, keep authenticated only.

revoke execute on function create_staff_order(uuid, jsonb, text, order_source) from public, anon;
revoke execute on function advance_order_status(uuid, order_status, text) from public, anon;
revoke execute on function record_payment(uuid, payment_method, numeric) from public, anon;
revoke execute on function adjust_stock(uuid, numeric, stock_txn_type, text) from public, anon;
revoke execute on function mark_notification_read(uuid) from public, anon;

grant execute on function create_staff_order(uuid, jsonb, text, order_source) to authenticated;
grant execute on function advance_order_status(uuid, order_status, text) to authenticated;
grant execute on function record_payment(uuid, payment_method, numeric) to authenticated;
grant execute on function adjust_stock(uuid, numeric, stock_txn_type, text) to authenticated;
grant execute on function mark_notification_read(uuid) to authenticated;

-- place_qr_order and get_order_tracking intentionally remain callable by anon
-- (that's the whole point of QR ordering with no login), so no change there.
