-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 011: Storage bucket for product images (public read, admin write)

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product_images_admin_write"
on storage.objects for insert
with check (bucket_id = 'product-images' and is_admin());

create policy "product_images_admin_update"
on storage.objects for update
using (bucket_id = 'product-images' and is_admin());

create policy "product_images_admin_delete"
on storage.objects for delete
using (bucket_id = 'product-images' and is_admin());
