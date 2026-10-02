# Task 2 handoff — 2026-10-02

Task 2 is complete locally and saved as a local-only milestone commit; the verified commit hash is in the task handoff. Phase 1 recovery commit `411cf95405feef595f9588225e78732fa8465690` and original RAG baseline `71809f49637f5a43bd666ef9a17db962d1ad316b` remain ancestors. No push, PR, deploy, hosted migration, real credential configuration, account provisioning or email operation occurred. Root reported a selected dedicated project; this executor did not access or change it.

## Delivered changes

- `src/application/models.ts`: strict metadata schemas, DOI normalization, DTOs and safe error vocabulary.
- `src/server/research.ts`, `dal.ts`: individually verified/authorized DAL operations and user-scoped Supabase gateway.
- `src/server/supabase/config.ts`, `client.ts`, `src/proxy.ts`: fail-closed public configuration, request-local SSR cookies, verified claims, refresh and private/no-store caching.
- `src/server/actions.ts`: individually validated project/paper mutations, archive/restore, password sign-in and sign-out. No signup or admin/service-role client.
- `src/components/access.tsx`, `forms.tsx`: configuration/auth/error screens, pending submission, draft retention and mobile forms.
- `src/app/page.tsx`, `login/page.tsx`, `projects/**`, `globals.css`: project and paper create/list/detail/edit/archive routes. Phase 1 synthetic page moved to `src/app/demo/page.tsx`.
- `supabase/migrations/202610020002_project_paper_workflow.sql`: metadata revision/idempotency fields, atomic RPCs, restricted RLS-bound writer role and revoked direct metadata write grants. C1 migration filename/content unchanged.
- `tests/app/*`, `tests/task2-workflow.sql`, `scripts/test-db-concurrency.py`: injected-client tests, real SQL boundary tests and concurrent create/edit checks.
- `tests/browser/*`, `scripts/serve-form-harness.ts`, `playwright.config.ts`: desktop/mobile app and isolated real-component testing; no production auth bypass.
- `scripts/smoke.ts`, `scripts/test-db.sh`: expanded smoke/database verification. Removed one unused test import from `tests/domain.test.ts` for clean lint.
- `.env.example`, `.gitignore`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `README.md`, `docs/task2-setup.md`, this report: public setting names, test output ignores, lint, pinned packages and setup/handoff.

## Final checks

| Check | Result | Limits |
|---|---|---|
| `npm run lint` | PASS, no errors/warnings | Includes new source/tests and existing domain tests |
| `npm run typecheck` | PASS | Strict TypeScript |
| `npm test` | PASS: 43 domain tests | Phase 1 scientific invariants preserved |
| `npm run test:app` | PASS: 24 tests | Injected gateway/claims, strict inputs, tenant scope, safe errors and unconfigured actions; not hosted Auth |
| `npm run test:db` | PASS: 81 SQL assertions + 2 concurrent transaction checks | 45 C1 + 36 Task2; real isolated PostgreSQL grants/RLS/triggers/transactions with identity shim |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | PASS | All private routes dynamic; proxy builds |
| `npm run test:smoke` | PASS: 3 checks | Unconfigured no-store page and two synthetic demo modes |
| `npm run test:browser` | PASS: 8 tests | Chromium desktop and 390px mobile; no horizontal overflow; screenshots inspected |
| `git diff --check` | PASS | No whitespace errors |
| Hosted Auth/REST/refresh/revocation/cross-user browser E2E | NOT RUN | No configured client or authorized live setup |
| Managed Supabase migration-role permissions | NOT RUN | Local superuser DDL tests do not prove hosted CREATE ROLE/ownership permissions |
| PDF/Storage, real research, signup emails, provider search | NOT IMPLEMENTED / NOT RUN | Outside Task 2 |

The browser harness uses the actual form components but substitutes test-only actions/navigation in a separately compiled localhost page. It verifies pending disable, one submission and preservation of title/notes after a conflict. It does not establish that a real authenticated app update succeeds, cookies refresh correctly, or server-driven revision remounts work end-to-end. Real unconfigured app routes and the synthetic demo were tested without fakes. Mobile screenshots of both the real unconfigured page and form harness were visually inspected.

## Independent review and corrections

The independent reviewer found direct authenticated C1 metadata writes could bypass new RPC checks. Corrected by revoking those writes and assigning the five metadata mutation functions to a NOLOGIN/NOBYPASSRLS/non-table-owner role with narrow grants and applicable RLS policies. Explicit owner checks remain. Direct table bypass, cross-user reads/writes and writer-role isolation now have real SQL tests. Reviewer rechecked and found no remaining material security defect in the inspected fix.

SQL DOI prefix normalization was corrected to trim first, matching application behavior. Concurrent duplicate submissions return the same ID; concurrent edits with the same expected revision produce exactly one success and one conflict. The direct action unit test initially could not import Next navigation under a standalone react-server test runtime; a test-only navigation stub corrected the test setup without modifying production authentication. Final test reruns pass.

## Remaining concerns and required human work

See [Task 2 setup](task2-setup.md) for the precise owner-account, public configuration, migration privilege and hosted validation steps. No secrets should be supplied in chat. Public project selection is not authorization to apply migrations. In particular, validate managed PostgreSQL role creation/ownership transfer before approving the SQL; do not work around failure with an RLS-bypassing metadata writer. The root-controlled review bundle includes both exact migration files and hashes.

The initial DOI is read-only after creation in this slice; identifier correction requires a future provenance-aware workflow. Lists target small owner-only projects and do not yet expose pagination. Bootstrap is a narrow authenticated definer operation; metadata CRUD remains RLS-bound and never uses a service-role client. Full session lifecycle, password-sign-in behavior, auth errors, post-login empty states and successful metadata navigation need live synthetic E2E verification before real research use.
