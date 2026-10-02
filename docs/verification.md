# Phase 1 verification and handoff — 2026-10-02

## Delivered

Repository `masaki8328/simple-local-rag`, local branch `phase0/research-knowledge-graph`. Next.js application is at repository root. The reviewed milestone is preserved by a local-only commit (its verified hash is recorded in the task handoff). Baseline `71809f49637f5a43bd666ef9a17db962d1ad316b` remains an ancestor and recovery source; Git history is intact.

Removed recoverable RAG paths: `00-simple-local-rag.ipynb`, `human-nutrition-text.pdf`, `images/simple-local-rag-workflow-flowchart.png`, `requirements.txt`, both tracked notebooks under `video_notebooks/`. The original README was removed then replaced with the new project README (seven old files removed/replaced in total). Extended existing `.gitignore`; retained existing `.github/workflows/run-notebook.yml` unchanged and did not run it. No untracked/ignored data was found or deleted.

New files:

- `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`: pinned application/development setup.
- `src/app/layout.tsx`, `page.tsx`, `globals.css`: Japanese/English-labelled responsive synthetic shell; all-temperature/≤120°C demonstration.
- `src/domain/contracts.ts`, `graph.ts`, `import.ts`: strict types/validators, pure condition/evidence classification and import staging decisions.
- `contracts/analysis-v0.1.schema.json`, `scripts/generate-contract.ts`: versioned generated JSON structure; semantic validation remains TypeScript.
- `supabase/migrations/202610020001_c1_baseline.sql`: exactly eight C1 tables, tenant FKs, scoped paths, provenance immutability, audit and grants/RLS.
- `tests/domain.test.ts`, `tests/fixtures/synthetic.ts`: fabricated scientific-contract fixtures and tests.
- `scripts/test-db.sh`, `tests/db-bootstrap.sql`, `tests/c1-rls.sql`: disposable PostgreSQL migration and real RLS/constraint checks.
- `scripts/smoke.ts`: production HTTP check.
- `scripts/verify-recovery.py`: byte-identical recovery verification of all seven old RAG blobs in a temporary directory.
- `docs/phase1-review.md`: independent review findings, corrections and exact critical code/SQL excerpts.
- `docs/architecture.md`, `erd.md`, `data-dictionary.md`, this report: approved decisions, future invariants and implementation limits.

## Checks

| Command/check | Result | What it establishes |
|---|---|---|
| `npm --cache /tmp/kg-npm-cache install --ignore-scripts` | PASS | Dependencies/lockfile installed without cloud credentials |
| `npm run contract:generate` | PASS | Generated schema matches Zod (also asserted by test) |
| `npm run typecheck` | PASS | Strict TypeScript checks |
| `npm test` | PASS: 43 tests | Scope, multiparty reactions, conditions/ranges/unknowns, contradictions, independence, review forgery, imports/hash/replay/conflicts |
| `npm run test:db` | PASS: 45 assertions | C1 migration applied to disposable PostgreSQL 17; actual grants, RLS, composite FKs and triggers exercised |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | PASS | Optimized Next.js 16.3.8 build |
| `npm run test:smoke` | PASS: 2 routes | Production HTML returns 200 with labelled synthetic data, expected solid/dashed style and complete participants |
| `npm --cache /tmp/kg-npm-cache audit --omit=dev` | PASS: 0 reported vulnerabilities | Registry audit of production dependency tree at check time |
| `python scripts/verify-recovery.py` | PASS: 7 files | Extracted baseline blobs to temporary files and matched Git object hashes; temporary files removed |
| `git diff --check` | PASS | No whitespace errors |
| Current source filename inventory | PASS | No current PDF or .env/.pem/.key files; original tutorial PDF remains only in historical commit |
| Hosted Supabase Auth/JWT, REST, Storage, signed URLs | NOT RUN | No configured service, credentials or endpoints |
| Browser/mobile visual and accessibility checks | NOT RUN | HTTP smoke tests are not browser-layout verification |
| Persistent C2 imports, concurrent transactions, rollback/idempotency, backup restore | NOT RUN | C2 persistence and actual object service are not implemented |

The SQL tests create actual PostgreSQL `authenticated`/`anon` roles and a test-only `auth.uid()` function reading a session setting. RLS is genuinely executed by PostgreSQL. This does **not** test JWT validation or claim that a mock identity proves hosted authentication. Docker runs without network or exposed ports, uses tmpfs, and is removed on exit. No live Supabase migration occurred.

Two implementation-time failures were corrected: an audit trigger accessed a non-existent project_id field on projects (fixed with explicit branch), and the HTTP smoke script initially used unsupported CommonJS top-level await (wrapped in an async function). Final relevant reruns pass.

Independent review found and fixed inconsistent independence-group assignment for one original experiment, cyclic citation dependencies, adopted citations with mismatched origin identity, and promotion of unresolved studies to confirmed independence. Parent review also hardened malformed condition matching and the unknown-evidence review badge. An adversarial database-default-grant test also caught residual explicit function grants after PUBLIC-only revocation; the migration now revokes PUBLIC/anon/authenticated before granting the intended narrow execution rights. Exact fragments and adversarial results are in [the review report](phase1-review.md).

## Security and functional gaps before real research use

- Shell has no Auth/DAL/API data path and no private research data. C1 policies are not deployed. Actual Supabase default grants, JWT handling, REST/RPC and cross-user integration need validation before connection.
- No storage bucket or policies, upload intent, byte verifier, download/signed-URL endpoint or recovery worker exists. Asset metadata is unverified; clients cannot mark it verified. A reviewed future verifier transition must preserve immutable content/path identity. No signed URL security test is claimed.
- C1 member writes are bootstrap-only; no invitations/role-management endpoint exists. Paper edits require callers to use expected-revision predicates; the database requires an increment and audits changes but does not replace caller concurrency discipline.
- C2 scientific tables and durable import application are absent. The JSON profile intentionally covers reaction claims and interval/controlled-term/composition conditions; other reviewed types are future contract extensions, rejected rather than silently coerced. No inference engine or automatic app writes exists.
- Pure import tests establish replay/conflict *decisions*, not durable transaction idempotency. A future import must validate existing project/PDF/anchor ownership, lock revision targets, persist batch mappings atomically and retain human correction conflicts.
- `.gitignore` and synthetic labels are guardrails, not a full secret/data-loss scanner. Do not add actual research inputs to tracked directories. Historical public tutorial PDF was not purged from Git history.
- Audit snapshots are append-only and project-scoped; production retention, actor handling for import jobs, correction reasons and restore procedures need later operational review.

## Accepted role decision and next narrow task

Dot owns cloud literature research, PDF reading, grounded structured extraction and scientific coordination. Human obtains inaccessible PDFs and makes important scientific decisions; Codex owns implementation/tests. Initial analysis-provider transport is `dot_manual_json`, with future authenticated API/MCP transport separate. No standalone Work connection or external LLM API is required or configured.

Stop for PM review of these contracts and C1 SQL. The next narrow implementation task should be authenticated project creation and paper list/create/edit through a server-only, user-scoped DAL, with expected-revision concurrency and cross-tenant integration tests in a disposable Supabase environment. Review the pending→verified asset lifecycle before starting PDF upload. Production credentials, external access, live migrations and deployment require a later authorized step. No push or PR is authorized.
