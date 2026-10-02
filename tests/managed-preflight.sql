-- Synthetic hosted-role simulation, not a query of the hosted project.
do $$
begin
 if current_user<>'postgres' or session_user<>'postgres' then raise exception 'Wrong migration identity'; end if;
 if not exists(select from pg_roles where rolname=current_user and not rolsuper and rolcreaterole and rolbypassrls) then raise exception 'Wrong migration capabilities'; end if;
 if current_setting('createrole_self_grant')<>'' then raise exception 'Unexpected automatic role grants'; end if;
 if (select nspowner from pg_namespace where nspname='public')<>'pg_database_owner'::regrole then raise exception 'Wrong public schema owner'; end if;
 if not has_schema_privilege(current_user,'public','CREATE') then raise exception 'Missing database-owner CREATE'; end if;
 raise notice 'PASS: real non-superuser session, CREATEROLE/BYPASSRLS, empty self-grant, pg_database_owner public schema';
end $$;
select current_user,session_user,current_setting('createrole_self_grant'),nspname,nspowner::regrole,nspacl from pg_namespace where nspname='public';
