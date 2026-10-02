-- Test-only Storage metadata interface. Does NOT emulate the Storage HTTP/object service.
create schema storage authorization postgres;
create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,anon;
grant select,insert,update,delete on storage.objects to authenticated,anon;
-- Adversarial unrelated permissive policy: restrictive research bucket guards must win.
create policy test_broad on storage.objects for all to authenticated,anon using(true) with check(true);
