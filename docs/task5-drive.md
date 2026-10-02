# Task 5 — bounded local Drive foundation

This checkpoint implements interfaces, an injectable HTTP adapter, additive SQL, a mobile form and synthetic tests. Production is deliberately UNCONFIGURED regardless of environment variables. It is not a working live Drive connection. No OAuth client, grant, token, folder, external file, server login or live migration was created.

## Receipt and source bridge

Apply the candidate only after reviewed metadata and Task 4, and only with separate live authorization. `20261002060000_drive_receipts.sql` adds immutable Drive bindings, intents, provider-neutral document receipts and provider events. A receipt records Google Drive file ID, exact observed content revision, server SHA-256, byte count and import time. Its only allowed state is `stored_unparsed`. No parser, physical-page count, analysis result or source-confirmation field is introduced.

Existing paper_documents can point to exactly one legacy asset OR one receipt through a same-project/paper FK. Existing document/anchor IDs and scientific references remain unchanged. The migration never rewrites legacy rows and never requires the superseded Storage migration. Source anchors cannot be added or verified through this capability. Task 4 confirmation remains draft-only.

Each edition gets an allocated new Drive file ID before upload. Scoped idempotency preserves intent input; finalization serializes on intent, checks cancellation/expiry/size and atomically inserts receipt, paper-document link and event. Replays must match the original revision/hash/size. Provider observations append to events; unavailable/replaced originals retain their original receipt. Drive is mutable: detecting a change does not recover lost bytes, and a file may change after a successful check.

The NOLOGIN function owner has scoped RLS and minimum SELECT/INSERT privileges, no table ownership, Auth usage or bypass. The separate NOLOGIN worker has private-schema USAGE and four EXECUTEs only, no table access and no owner membership. No actual worker login is provisioned. A future trusted connection must independently verify the application JWT, bind its subject transaction-locally, invoke a parameterized private function, and clear context before returning to a pool. Never pass client-certified receipt values directly to this capability. No service-role shortcut is provided.

## Adapter and protocol

`GoogleDriveAdapter` accepts a server-only token provider and injectable fetch. It requests no new scopes and refuses a token-provider grant that is not exactly drive.file. Every operation checks the expected Drive account permissionId. HTTP/refresh failures return bounded codes, not provider bodies or credentials. An app-created folder must be owned, not shared and tagged for originals before session creation. Stored-file metadata must remain privately owned, match the intent and target folder, and retain the expected size.

New-file session creation requests `keepRevisionForever=true`, because Drive documents that revision-specific blob downloads require retained revisions. This is a retention request, not WORM or recovery from deletion; actual retention/download behavior remains unproven. No fallback silently downloads a newer revision. [Drive revision downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

Completion streams a revision-specific media response with byte/time limits, incremental SHA-256 and an exact nine-byte PDF version-line check (including its line terminator). It compares head revision and metadata before and after streaming. A changed revision, wrong size, missing source, or invalid header cannot create a receipt. It does not buffer/parse/decompress the entire PDF. Header screening does not prove valid/safe PDF content. Missing/transient responses append observations without permanently poisoning retries; database failure leaves bytes available for retry.

The requested cap is exactly 100,000,000 bytes. Actual quota/maxUploadSize is checked through the app's own grant; missing quota refuses rather than claiming capacity. Browser protocol uses direct resumable PUT chunks/status probes with no access token, cookies or referrer. The session URL is a sensitive scoped capability: an eventual encrypted short-lived server vault must serialize session creation per intent and keep it out of logs, SQL, audit, browser persistence and telemetry. Actual local Chromium networking now verifies cross-origin 308/Range handling and redirect refusal. Google session-only authorization/CORS remains unproven. Vercel receives intent metadata only, never PDF request bodies.

Private download source checks re-stream/hash the recorded revision and compare the current source. Actual delivery throws DOWNLOAD_UNPROVEN: no mutable webContentLink, public share, inline viewer or 100 MB Vercel proxy is offered. A separately reviewed authenticated revision-pinned transport is required.

## Closed integration boundaries

Production Drive service and `/api/drive` fail closed before consuming a body. OAuth preparation has cryptographic state/PKCE and an injected one-time state-store contract; no callback, exchange, refresh vault or account-binding endpoint is routed. The SQL repository, independently verified JWT worker transport and explicit server composition are now implemented locally; see [wiring review](task5-wiring-review.md). Secure token/state/session stores remain interfaces awaiting implementation and provisioning. The mock component harness is not part of the application. No environment flag can activate this candidate.

Both legacy Storage HTTP endpoints permanently return 410. Production paper/queue UI uses the disabled Drive control and does not call legacy upload-intent/page-count queries. Historical Storage code/tests remain as superseded regression artifacts.

See task5-setup.md for the separate deployment and OAuth sequences. Full graph/search/RQ and source analysis remain outside this slice.

Follow-up: OAuth, encrypted PostgreSQL vault and reload reconciliation are now locally connected. See [connected integration and remaining live boundaries](task5-connected-integration.md). Earlier unimplemented-interface descriptions above refer to the prior checkpoint. Production remains disabled.
