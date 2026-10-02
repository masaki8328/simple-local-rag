#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable PostgreSQL only: no host ports, bind mounts, real data, or credentials.
kg_container=$(docker run --rm -d --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17)
trap 'docker rm -f "$kg_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 30); do
 if docker exec "$kg_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres < tests/db-bootstrap.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres < supabase/migrations/202610020001_c1_baseline.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres < tests/c1-rls.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres < supabase/migrations/202610020002_project_paper_workflow.sql
docker exec -i "$kg_container" psql -X -v ON_ERROR_STOP=1 -U postgres < tests/task2-workflow.sql
python scripts/test-db-concurrency.py "$kg_container"
