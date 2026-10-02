#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable PostgreSQL only: no network, host ports, bind mounts or real data.
kg_container=$(docker run --rm -d --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=bootstrap_admin -e POSTGRES_DB=postgres -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17)
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
