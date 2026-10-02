// Synthetic catalog checks only, executed inside the disposable test database.
import {workerPreflight} from '../src/server/drive/worker';
process.stdout.write(`\\set ON_ERROR_STOP on
begin;
create function pg_temp.worker_ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create role kg_drive_test_connection login nosuperuser nocreatedb nocreaterole nobypassrls inherit;
grant kg_drive_worker to kg_drive_test_connection with inherit true;
grant kg_drive_worker to kg_drive_test_connection with set false;
set session authorization kg_drive_test_connection;
select pg_temp.worker_ok((select login='kg_drive_test_connection' and session_login=login and worker_usage and not (elevated or owner_member or app_member or extra_membership or delegable_role or excessive_schema or table_access or extra_definer) from (${workerPreflight}) guard),'worker catalog preflight accepts actual narrow connection identity');
reset session authorization;
grant pg_read_all_data to kg_drive_test_connection with inherit false;
grant pg_read_all_data to kg_drive_test_connection with set true;
set session authorization kg_drive_test_connection;
select pg_temp.worker_ok((select extra_membership and delegable_role from (${workerPreflight}) guard),'worker preflight rejects non-inherited privileged role with SET option');
reset session authorization;
revoke pg_read_all_data from kg_drive_test_connection;
grant select on public.document_receipts to kg_drive_test_connection;
set session authorization kg_drive_test_connection;
select pg_temp.worker_ok((select table_access from (${workerPreflight}) guard),'worker catalog preflight detects accidental direct table grant');
reset session authorization;
rollback;
`);
