#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable synthetic PostgreSQL, loopback-only random port for real node-pg pool regression. No mounts or real data.
kg_container=$(docker run --rm -d -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=bootstrap_admin -e POSTGRES_DB=postgres -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17)
trap 'docker rm -f "$kg_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 30); do
 if docker exec "$kg_container" pg_isready -U bootstrap_admin -d postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/db-bootstrap.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres <<'SQL'
create role postgres login nosuperuser createrole bypassrls;
alter database postgres owner to postgres;
grant usage on schema public to postgres;
grant usage on schema auth to postgres;
grant references,select on auth.users to postgres;
-- auth.uid has PUBLIC EXECUTE, but postgres has no grant option.
grant authenticated,anon to postgres;
create role service_role nologin bypassrls;
create role authenticator nologin;
grant authenticated,anon,service_role to authenticator;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres grant execute on functions to service_role;
alter role postgres set createrole_self_grant='';
alter default privileges for role postgres in schema public grant all on tables to anon,authenticated;
alter default privileges for role postgres grant execute on functions to anon,authenticated;
SQL
# Migration connection really is a NOSUPERUSER session, not SET ROLE in a superuser session.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/managed-preflight.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/202610020001_c1_baseline.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/c1-rls.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/202610020002_project_paper_workflow.sql
# Assertions deliberately exercise SET ROLE as bootstrap only; the migration actor
# has already lost its temporary writer SET bridge.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/task2-workflow.sql
python scripts/test-db-concurrency.py "$kg_container"

# Task 4 bounded draft research core.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002045414_research_case_core.sql
node --import tsx scripts/research-case-fixture.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres
python scripts/test-research-concurrency.py "$kg_container"

# Task 5: provider-neutral receipt bridge, without superseded Storage migration.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002060000_drive_receipts.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/task5-drive.sql
python scripts/test-drive-concurrency.py "$kg_container"
node --conditions=react-server --import tsx scripts/drive-worker-preflight.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres
# Local encrypted vault candidate, never applied to hosted database by this script.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002071500_drive_vault.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/task5-vault.sql
node --conditions=react-server --import tsx scripts/vault-preflight.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres <<'SQL'
create role kg_pool_test login nosuperuser nocreaterole nocreatedb nobypassrls inherit;
grant kg_vault_worker to kg_pool_test with inherit true,set false;
SQL
kg_test_port=$(docker port "$kg_container" 5432/tcp | cut -d: -f2)
node --conditions=react-server --import tsx scripts/test-vault-pool.ts "$kg_test_port"
# Draft source reference path: receipt → immutable locator → structured evidence import.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002080000_draft_source_anchors.sql
node --import tsx scripts/source-flow-fixture.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres
# Literature search snapshots and RQ-linked acquisition planning.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002090000_literature_acquisition.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres < tests/task6-literature.sql
# Project-wide explicit identity mapping and independent human review records.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002100000_project_reaction_reviews.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002110000_compound_identity_links.sql
node --import tsx scripts/project-review-fixture.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres

# Bounded research request/result and question lifecycle.
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261002140245_research_handoff.sql
node --import tsx scripts/handoff-fixture.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres

# Explicit opt-in local SQL review proposal, not part of migration history or hosted rollout.
if [ "${KG_CHEMICAL_PROPOSAL:-0}" = "1" ]; then
 docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/proposals/chemical-fields.sql
 node --import tsx scripts/chemical-fields-fixture.ts | docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U bootstrap_admin -d postgres
fi
