# Task 5 bounded pre-live patch review

Base: published `c815dd8fab341bd97b6966557488488ddd432a0a`. Local branch: `fix/task5-prelive-20261002`. This patch remains unpublished; production main is unchanged. The original WIP snapshot is `80df4080ad4b82b12ff6588508742633b7dce77e`.

## Reviewed changes

- Retain `fetch` redirect:error. The reported blanket 308 failure was disproved by both implementation and independent reviewer experiments: actual Chromium exposes cross-origin HTTP 308 and Range with appropriate CORS and no Location. Committed tests use actual local HTTP servers, not injected responses, and prove status probing/chunk offsets plus refusal to contact a Location redirect destination. No cookies, Authorization or referrer are sent. This does not establish Google CORS/session-only capability support. Location-bearing redirects deliberately remain refused.
- Acquisition queries recognize main-text stored_unparsed receipts through the same-project/paper document bridge, alongside legacy verified assets. Supplements, pending assets, absent sources and wrong-paper receipt matches do not remove a paper from the queue. Owner authorization precedes reads and all tables are project-filtered. Receipt document lookup reports stored_unparsed and no page count. These queries require the reviewed Task 5 migration; that migration is not applied live.
- Exact byte comparison replaces ASCII decoding in both Drive and dormant legacy screening. High-bit alias `a5d0c4c6adb1aeb7`, unsupported/malformed version lines and missing line terminators are rejected. Valid headers accumulated across stream chunks remain accepted. This is screening, not parsing or scientific/source verification.
- UI accepts only known safe error codes and supplies distinct reconnect/quota/expiry/access/transient recovery text. It preserves inputs on rejection and cancels begin/session requests without continuing to upload/finalize. Unknown provider text is not reflected.
- Independent review found a finalization recovery race. Fixed: once upload completes, a same-form retry directly repeats idempotent completion; it does not open another session. Finalization is not interruptible. A test simulates uncertain completion and verifies one session/upload, two completion calls and eventual acknowledgement.

## Verification and review

61 domain/protocol tests, 62 application tests, 150 PostgreSQL assertions plus managed-role preflight, five concurrency checks, and 32 desktop/mobile browser tests passed. Lint, typecheck, production build and three HTTP smoke checks passed. No migration files or hosted migration mappings changed.

Independent reviewer `/root/task5_patch_review` examined the patch, independently reproduced the 308 behavior, and ran focused application/unit/browser checks. After the finalization correction, the reviewer found no further material defect in this bounded patch. The reviewer explicitly limited recovery assurance to the mounted editor. No actual Google, Vercel, OAuth or hosted-schema operations formed part of this review.

## Missing for real PDF upload and reopening

This patch is not a usable live PDF feature. Production factory/API remain unconditionally closed; no environment flag enables them. Still needed, under separately approved setup/review:

1. Google app OAuth callback, exchange/refresh/revocation, secure token/state/session stores and account/folder binding. TokenProvider, OAuthStateStore and SessionVault remain interfaces; no real credentials exist here.
2. Implement the SQL-backed DriveRepository and independently JWT-verified, transaction-scoped execute-only worker connection. Existing narrow SQL functions do not themselves wire an application route. Apply the additive migration only after authorization, preserving hosted history mapping.
3. Prove actual Google direct browser session authorization/CORS, quota/cap, retained revision access and mobile transfer behavior with a synthetic file. The 100,000,000-byte cap remains a target, not verified capacity.
4. Durable attempt/status reconciliation after navigation, reload or uncertain network responses. Current form progress/recovery state is in memory; no persistent recovery UI is implemented. Do not persist raw session capability URLs in browser storage.
5. Private revision-pinned attachment transport and a paper-document listing/reopen action. `checkDownload` verifies source bytes but actual `download` intentionally throws DOWNLOAD_UNPROVEN. No inline viewer or substitute public link exists.

Source analysis, verified pages/passages and human source-confirmation are separate future procedures. Chemistry confirmation remains closed. No paid parser or full synchronous PDF parsing was added.
