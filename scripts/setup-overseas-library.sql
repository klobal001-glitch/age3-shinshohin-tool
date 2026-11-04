-- Run once in the existing Supabase project's SQL editor as an administrator.
-- Keep this dedicated bucket PRIVATE. No anon access policy is required.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'overseas-guides', 'overseas-guides', false, 5242880,
  array['application/octet-stream', 'application/json']
)
on conflict (id) do nothing;

-- Verify public=false. If this name already exists as a public bucket, choose
-- another unused name rather than changing unrelated access permissions.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'overseas-guides';
