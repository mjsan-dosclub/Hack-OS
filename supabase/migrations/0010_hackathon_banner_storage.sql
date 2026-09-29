-- Public event banners can be rendered in the directory. Uploads are performed
-- server-side after the admin API verifies the signed-in moderator.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hackathon-banners',
  'hackathon-banners',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read hackathon banners" on storage.objects;
create policy "Public can read hackathon banners"
on storage.objects for select
using (bucket_id = 'hackathon-banners');
