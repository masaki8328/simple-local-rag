-- Test-only Supabase identity interface; actual PostgreSQL roles/RLS, no Supabase Auth service.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
-- Adversarial inherited defaults: migration must revoke explicit role grants too.
-- These defaults intentionally exceed our desired privileges; not a hosted-config claim.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges grant execute on functions to anon, authenticated;
