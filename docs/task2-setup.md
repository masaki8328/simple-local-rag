# Task 2 — Auth-ready project/paper workflow

Status: local implementation and synthetic verification. PM has reported a selected dedicated Supabase project. This executor has not queried, configured or migrated it; the application remains unconfigured. No actual account, signup email, Storage bucket or deployment has been created.

## Architecture and security

The browser submits strict, bounded form inputs to Next.js Server Actions. Each read/write reaches the server-only DAL, verifies the Supabase access token with `getClaims()` and checks project ownership. Queries use a request-local SSR client configured with the public/publishable key and the user's cookies; no service-role client exists. Authorization never reads `user_metadata` or trusts `getSession()` alone. `proxy.ts` refreshes/verifies sessions, forwards refreshed cookies and applies private/no-store headers, including SSR-provided cache headers. DAL/action verification is still required; proxy is not the authorization boundary.

Research data returned to client components is a minimal project/paper DTO (metadata needed for forms), not raw database rows, sessions, tokens, audit snapshots, creation hashes or source passages. There is no shared data cache. The `/projects` tree and login are dynamic. React renders metadata as text; no raw HTML rendering. Raw database/auth errors are not logged or returned. Configuration accepts only HTTPS URLs and `sb_publishable_` keys; legacy JWT keys, secret keys or missing settings fail closed. This implementation intentionally requires the modern publishable key and does not support a local HTTP Auth endpoint yet.

The shared application schemas define input shapes; executable DAL, Supabase client and gateway modules import `server-only`. Client form imports of DTOs are type-only. Production has no environment switch or request parameter for a fake identity. Unit and component harness fakes live under tests; the browser harness runs on a separate test-only localhost server, never as a Next.js route.

## Database workflow

Migration `202610020002_project_paper_workflow.sql` extends only C1 metadata. It adds project revision and scoped creation request ID/hash columns, then narrowly validates/executes project create/edit/archive and paper create/edit/archive. Request IDs make identical create retries return the original record; same key/different payload is a conflict. Project-scoped transaction advisory locks serialize paper writes; metadata edit/archive compares expected revision before incrementing. Paper and DOI insert together in one transaction. Duplicate DOI or normalized title is reported without merging or overwriting. Title checks are workflow-level checks, not a scientific identity UNIQUE constraint.

An independent review identified that retaining C1 direct metadata write grants would bypass the workflow's validation. Task 2 revokes authenticated INSERT/UPDATE for projects, papers and paper_identifiers. Five metadata RPCs execute as `kg_metadata_writer`, a NOLOGIN, NOINHERIT, NOBYPASSRLS role that owns no tables. It has only the necessary table/helper privileges and remains subject to tenant RLS. Explicit auth.uid owner checks remain inside every RPC. Authenticated users are not members of this role. The narrow project bootstrap retains SECURITY DEFINER rights to atomically create the caller's project/membership; caller identity cannot be supplied in inputs. All function search paths are fixed empty and inherited PUBLIC/anon/authenticated execution privileges are revoked before narrow regrants.

The application never supplies review, correction, actor, analysis-status or normalization fields. The database derives actor/audit/normalized-title fields; existing scientific review/correction contracts remain unchanged. C1 document/anchor metadata policies are not an implemented upload service and remain out of this workflow.

Archive is reversible and never deletes records. An archived project blocks paper changes until restored. Task 2 deliberately keeps an existing DOI read-only to preserve C1 identifier provenance; a future reviewed identifier-correction workflow is needed to change it. Initial DOI entry is optional. Restoring an archived project does not silently restore every archived paper.

## Human steps before live validation

1. PM has reported selection of the dedicated research project. Confirm that exact target and separately authorize setup/migration; selection alone does not authorize applying SQL or incurring charges. No service credentials are needed in chat.
2. Review both migration files against that target. Use an authorized administrative migration session/CLI workflow only after approval. Existing filenames are retained; generate future migrations with the current Supabase CLI. Do not run migrations automatically on app startup or from Vercel build scripts.
3. Verify managed-project privileges needed to create the restricted writer role and transfer function ownership. Disposable PostgreSQL tests run as the test administrator and do not prove managed Supabase DDL permissions. If ownership/role setup fails, stop and review the required minimal grants; do not make metadata RPCs owned by a role that bypasses RLS as a workaround.
4. Provision one confirmed email/password owner account through approved administrator tooling, without invitations/signup emails. Keep public registration disabled for this private MVP. The app has password sign-in only, no signup/invite/reset-email flow. Do not commit credentials, put them in chat, or install a service-role key in this app.
5. Put the selected project's HTTPS URL and modern publishable key in ignored `.env.local` (or the later approved host's environment UI). `.env.example` names the two public settings and contains no values. Never put a secret key in `NEXT_PUBLIC_*`. Set authorized site/redirect origins once the actual host is approved; no auth callback/OAuth flow is implemented here.
6. Run hosted Auth/REST validation with synthetic records: real login/logout, cookie refresh/expiry, revoked/invalid sessions, direct API permission denial, two-user cross-project reads/writes, revision conflicts and repeated create requests. Confirm the writer role has no LOGIN/BYPASSRLS/table ownership, authenticated cannot assume it, and RPC execute grants match the migration. Test browser navigation/cache behavior across sign-out and account changes before real data.
7. Only after PM accepts these checks should real paper metadata be entered. No PDF upload, signed URLs, provider search or Work/API integration is delivered by Task 2.

## Local commands

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run test:app
npm run test:db
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run test:smoke
npm run test:browser
```

`test:app` uses the Node react-server condition so server-only imports remain enforced; one action test stubs only Next navigation to run outside the Next runtime. It never fabricates a production identity. `test:db` creates/removes a network-isolated PostgreSQL 17 container with a test identity shim and synthetic data; it tests C1 first, then Task 2 and concurrent requests. This exercises real grants/RLS/transactions, not hosted JWT authentication.

Browser tests use system Chromium at `/usr/bin/chromium` in this environment. The app itself runs with explicitly empty Supabase settings. Additional form-component tests compile the real form components into a separate synthetic harness using mocked actions/navigation. They exercise layout, pending state and draft preservation; they are not successful authenticated application E2E tests. Temporary screenshots are stored under `/tmp`, never in Git.

## Official references checked

- [Supabase SSR client and token verification](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
- [Supabase SSR release notes](https://github.com/supabase/ssr/releases): installed version 0.12.7 and cookie/cache-header fixes reviewed; package and lockfile pinned.
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
