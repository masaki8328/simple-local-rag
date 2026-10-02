-- LOCAL CANDIDATE ONLY. Encrypted ciphertext; encryption key never enters PostgreSQL.
begin;
create role kg_vault_owner nologin nosuperuser nobypassrls noinherit;
create role kg_vault_worker nologin nosuperuser nobypassrls noinherit;
grant usage on schema kg_private to kg_vault_owner,kg_vault_worker;
grant execute on function kg_private.caller_uid() to kg_vault_owner;
create table kg_private.drive_secrets(user_id uuid not null,secret_key text not null,ciphertext text not null check(length(ciphertext)<=32768),expires_at timestamptz not null,primary key(user_id,secret_key));
alter table kg_private.drive_secrets enable row level security;
revoke all on kg_private.drive_secrets from public,anon,authenticated,service_role,kg_drive_worker,kg_vault_worker;
grant select,insert,update,delete on kg_private.drive_secrets to kg_vault_owner;
create policy vault_user on kg_private.drive_secrets to kg_vault_owner using(user_id=kg_private.caller_uid()) with check(user_id=kg_private.caller_uid());
create function kg_private.vault_access(k text,operation text,payload text default null,expiry timestamptz default null) returns text language plpgsql security definer set search_path='' as $$declare u uuid:=kg_private.caller_uid();result text;begin
 if u is null or k is null or k !~ '^(state|token|session):[a-zA-Z0-9_-]{1,128}$' then raise exception 'KG_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||k,17));
 if operation='read' then select ciphertext into result from kg_private.drive_secrets where user_id=u and secret_key=k and expires_at>now();return result;
 elsif operation='put' then
  if payload is null or expiry is null or expiry<=now() or expiry>now()+interval '366 days' then raise exception 'KG_INVALID';end if;
  insert into kg_private.drive_secrets values(u,k,payload,expiry) on conflict(user_id,secret_key) do update set ciphertext=excluded.ciphertext,expires_at=excluded.expires_at;
 elsif operation='delete' then delete from kg_private.drive_secrets where user_id=u and secret_key=k;
 else raise exception 'KG_INVALID';end if;return null;
end$$;
revoke all on function kg_private.vault_access(text,text,text,timestamptz) from public,anon,authenticated,service_role,kg_drive_worker;
grant execute on function kg_private.vault_access(text,text,text,timestamptz) to kg_vault_worker;
grant kg_vault_owner to current_user with inherit false,set true;
grant create on schema kg_private to kg_vault_owner;
alter function kg_private.vault_access(text,text,text,timestamptz) owner to kg_vault_owner;
revoke create on schema kg_private from kg_vault_owner;
grant kg_vault_owner to current_user with set false;
commit;
