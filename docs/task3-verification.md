# Task 3 verification handoff

Status: independently reviewed local foundation, production upload/finalization disabled. No Task 3 migration, Storage bucket, worker credential or user account was created remotely by this executor. No Git push, PR, deployment, email, research PDF or private passage was used.

## Deliverables

- Additive `20261002044143_private_pdf_acquisition.sql`: mutable upload_intents with append-only audit, optional author metadata, physical page count/verifier version, owner-only intent functions, private invoker finalizer capability and immutable-original Storage policies. The accepted C1/Task 2 SQL files are unchanged by Task 3.
- Server-only PDF service and user-scoped Supabase repository/Storage adapters; production factory deliberately raises UNCONFIGURED instead of accepting unreviewed credentials.
- PDF-needed queue, paper-detail edition/provenance and recovery display, labelled file forms, upload progress, retry/cancel and new-edition flow, authorized private-view signing route.
- Pinned pdf-lib 1.17.1; runtime-generated synthetic fixtures only. No PDF bytes are committed.
- Root-reported hosted migration mapping in hosted-migration-map.md. The existing Task 2 Library artifact is not changed by this package.

## Local results

| Check | Result | Boundary |
|---|---|---|
| Domain suite | 43 passed | Existing scientific contracts |
| Application suite | 41 passed | 24 prior + 17 PDF service/SDK tests; synthetic/injected dependencies |
| Database suite | 126 SQL assertions + 1 managed-role/Auth-ACL preflight + 4 concurrency checks passed | 45 C1 + 54 Task 2 + 27 Task 3; actual PostgreSQL 17 grants/RLS/triggers/transactions |
| Browser suite | 14 passed | Desktop + 390px mobile; real unconfigured app and separate enabled-component harness with mocked HTTP |
| Smoke | 3 passed | Unconfigured private response and existing synthetic graph modes |
| Lint / typecheck / production build | Passed | Production upload factory remains disabled |
| Dependency audit, production | 0 vulnerabilities reported | Registry advisory snapshot; not a PDF parser security guarantee |
| Live Auth/Storage/expiry | Not run | No configured service or authorized worker integration |

The Storage shim exercises policies but is not Supabase Storage HTTP, signed-token validation or byte storage. It explicitly gives the simulated postgres actor Storage table ownership; this is a hosted compatibility prerequisite to verify, not evidence of hosted ownership. Concurrent SQL tests show one canonical asset/link for simultaneous duplicate hashes and stable repeated-finalize IDs; object-service races still need live synthetic testing.

Local PDF tests derive hash/size/page count from actual synthetic bytes and test mismatches, malformed/non-PDF/oversized input, expiration, cancellation, cross-project refusal, immutable retention, duplicate-byte matching, DB-failure recovery and failed-state retry without INSERT. Adapter tests use real SDK error instances for symbolic and legacy duplicate responses and reject generic 400. Signed-link tests verify requested 60-second TTL and refusal; they do not claim the live service expires a token correctly.

Mobile screenshots under /tmp were visually inspected: labels and buttons fit without horizontal overflow. Browser tests cover pending/double-tap protection, draft retention, retry preserving the intent, cancel/new attempt and successful finalize followed by a new edition. Component HTTP mocks are isolated from production and do not impersonate an authenticated user in the app.

## Independent review

Review found and corrected two concrete issues: finalized attempts could not reset for a new edition, and retained-object retry did not match Storage duplicate-error/RLS behavior. Re-review found no material blocker to committing the disabled local foundation and independently reran all 41 application tests successfully. Intent audit/repeated-cancel semantics and trusted-worker contract were also reviewed. A minor misleading cancellation message after successful local reset was corrected.

## Required activation work

See task3-pdf.md for the exact lifecycle and constraints. Do not enable uploads until a reviewed scoped verifier is provisioned with independently verified user identity, hard parser CPU/time/memory limits, actual-object verification, and no broad service-role application CRUD. Root must verify hosted Storage DDL/ACL compatibility and run synthetic HTTP upload/duplicate/denial/recovery/signed-expiry/mobile tests. Real research data must wait for acceptance of both metadata and PDF/storage security boundaries. Root's metadata initialization success does not satisfy these separate gates.
