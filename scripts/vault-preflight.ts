import {vaultPreflight} from '../src/server/drive/vault';
process.stdout.write(`begin;
create role kg_vault_test login nosuperuser nocreatedb nocreaterole nobypassrls inherit;
grant kg_vault_worker to kg_vault_test with inherit true,set false;
set session authorization kg_vault_test;
do $$begin if not (select login='kg_vault_test' and session_login=login and worker_usage and not(elevated or owner_member or app_member or extra_membership or delegable_role or excessive_schema or table_access or extra_definer) from (${vaultPreflight}) g) then raise exception 'FAIL vault preflight';end if;raise notice 'PASS: actual vault worker passes catalog guard';end$$;
reset session authorization;
rollback;`);
