# Task 5 local repository and worker wiring

Review base: `d1b443651c84af5ecb5e4fa0e5db6f5943f823f8`. This follow-up is local and unpublished. No migration, hosted history mapping, remote branch, credentials, grants, sharing or deployment changed. Production Drive remains unconditionally UNCONFIGURED, before request-body consumption.

## Implemented

`repository.ts` implements DriveRepository using the signed-in user's RLS reads, explicit owner/project/paper authorization, and four narrow worker functions for mutations. Receipt lookup preserves project, paper, intent and file identity. Multiple bindings fail closed unless the trusted caller selects a binding explicitly.

`worker.ts` independently verifies the application JWT before acquiring a connection. Each operation checks the actual database session identity and privileges, binds the verified subject transaction-locally, invokes fixed parameterized SQL, commits and clears caller context. Errors roll back and discard the connection. Raw database errors never reach clients. The preflight rejects elevated capabilities, direct application table/column grants, unexpected executable SECURITY DEFINER functions, unexpected reachable roles and direct ADMIN/SET membership options.

`connection.ts` supplies a small pg pool with certificate-verified TLS and explicit configuration, plus Supabase JWT verification with issuer, audience, expiry and authenticated-role checks. There is no service-role key, default administrator URL, environment discovery or TLS bypass. `configured.ts` composes explicitly supplied server capabilities and a fresh cookie-bound user client per request; production does not call it.

`orchestration.ts` dispatches bounded, strictly validated begin/session/complete/cancel/status/download commands with fixed-origin checks and private no-store responses. Only server streaming computes receipt hashes. Status supports scoped receipt reconciliation, but does not yet implement a browser recovery interface. Actual private download delivery remains closed.

## Validation and independent review

Passed: 61 domain/protocol tests, 69 application tests, 153 PostgreSQL assertions plus managed-role preflight, five concurrency checks, 32 desktop/mobile browser tests, lint, typecheck, production build, three HTTP smoke checks and production dependency audit (zero reported vulnerabilities).

The new composed synthetic test covers repository reads, worker transport, upload session, streamed verification, atomic completion acknowledgement and idempotent replay. Real disposable PostgreSQL tests execute the exact production catalog preflight with a dedicated test identity, then prove rejection of a non-inherited privileged role reachable through SET ROLE and an accidental direct table grant.

Independent reviewer `/root/task5_patch_review` found the non-inherited membership gap; it was fixed and covered by PostgreSQL regression. The reviewer reran seven focused tests and reported no further material defects in this bounded slice. Tests do not establish a real pg TLS connection, hosted JWT/Auth behavior, PostgREST integration or Google upload behavior. No external Drive requests were made.

## Remaining implementation and provisioning

1. Choose and implement durable encrypted token/state/session storage. Minimal alternatives are an already approved durable secret/KV store with atomic per-intent creation and expiry, or a separately reviewed server-only encrypted PostgreSQL vault with narrow functions and a separate encryption key. Neither option is selected or provisioned here. TokenProvider, OAuthStateStore and SessionVault remain interfaces.
2. Implement OAuth callback, code exchange, refresh/revocation, secure state consumption and trusted account/folder binding. Existing OAuth code only prepares authorization with state/PKCE. This requires actual code, not merely supplying credentials.
3. After separate authorization, provision a dedicated database LOGIN with CONNECT and only inherited `kg_drive_worker` membership: INHERIT true, SET false, ADMIN false. The group supplies private-schema USAGE and four function EXECUTEs. No other memberships or application table privileges are allowed. Current/session user must match the configured login; do not use administrator, authenticated or function-owner credentials. Supply server-only TLS connection configuration through approved secret storage. No login or grant was created here.
4. Separately review/apply the outstanding Task 4/5 migrations while preserving hosted migration mapping. This patch changes neither migration. Supply approved vaults and worker configuration, review production activation, and prove real direct Google session/CORS, quota, retained revisions and runtime limits with synthetic data before claiming support for the 100,000,000-byte target.
5. Implement durable browser attempt recovery and paper-document listing/reopening, plus authenticated revision-pinned private attachment transport. The existing mounted-form retry and server status command are not a complete recovery UI. `download` still returns DOWNLOAD_UNPROVEN.

These boundaries preserve stored_unparsed receipts, draft-only scientific confirmation, immutable provenance and independent claim/experiment scope. No parser, verified passage, chemistry confirmation or AI service was added.
