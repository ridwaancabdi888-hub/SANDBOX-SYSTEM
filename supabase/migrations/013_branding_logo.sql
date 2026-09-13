-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 013: Cafeteria branding — logo stored in Supabase Storage.
--
-- Only the public object PATH lives in the database; the image bytes live in
-- the `branding` bucket. Storing binaries in a text column would bloat every
-- settings read (the customer menu, the login page and each receipt read this
-- row) for no benefit.

alter table settings
  add column if not exists logo_url text;

comment on column settings.logo_url is
  'Public URL of the cafeteria logo in the `branding` storage bucket. NULL falls back to the built-in SANDBOX mark.';

-- ==========================================================================
-- STORAGE — public read (the logo appears on unauthenticated pages: login,
-- customer QR menu, order tracking), admin-only write.
-- ==========================================================================
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_public_read'
  ) then
    create policy "branding_public_read"
      on storage.objects for select
      using (bucket_id = 'branding');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_admin_write'
  ) then
    create policy "branding_admin_write"
      on storage.objects for insert
      with check (bucket_id = 'branding' and is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_admin_update'
  ) then
    create policy "branding_admin_update"
      on storage.objects for update
      using (bucket_id = 'branding' and is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_admin_delete'
  ) then
    create policy "branding_admin_delete"
      on storage.objects for delete
      using (bucket_id = 'branding' and is_admin());
  end if;
end $$;
