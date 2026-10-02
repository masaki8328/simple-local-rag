# Local connected Drive upload slice

Base: 1425e08086bb7a403cc343f62364c9f4e571f15c. No production changes, push, credentials, grants or hosted migrations. Existing deployed metadata flow stays unchanged.

## Connected behavior

`configuredDriveIntegration` composes cookie-bound user authentication, owner-scoped binding, OAuth consent/callback, PKCE and one-time encrypted state, code exchange, exact drive.file scope, expected-account checks, private folder verification, encrypted refresh tokens, serialized refresh, encrypted resumable sessions, DriveRepository and the receipt worker. It supplies the three actual route handlers. Runtime activation is still deliberately closed, so this is locally connected code, not a live feature.

The separate vault login inherits only kg_vault_worker. It cannot read tables or invoke receipt functions. Its sole vault function uses caller-scoped RLS and a per-user/key transaction lock. AES-256-GCM encryption and user/key associated data occur in the server; PostgreSQL stores ciphertext and expiry, never the encryption key. Tokens expire from accessible storage after at most 365 days; OAuth state after ten minutes; upload sessions at intent expiry. Expiry prevents reads but does not physically purge ciphertext. Key rotation and expired-row maintenance need an operator procedure before sustained use.

Callback state is consumed before token exchange, so replay is refused. If an external operation fails after state consumption, reconnect starts a new attempt. A first connection interrupted after folder creation may leave an empty private app-created folder; no existing original is replaced or shared. Revocation is currently through Google's connected-app controls; the app detects revoked/expired refresh grants and requests reconnect. There is no in-app disconnect/revocation button.

The paper page has a connection action and server-backed transfer history when enabled. It lists the latest 50 attempts, stored receipt IDs, exact revisions and hashes. After reload, a completed upload can be verified/finalized again idempotently. An incomplete upload must be cancelled and restarted with a new intent: reselecting a same-size file cannot prove it has the same bytes, so partial re-selection is not offered. No session URL, access token or refresh token is placed in browser storage. Scientific state remains stored_unparsed/draft; no pages, passages or chemistry are confirmed.

## Validation

Synthetic connected test: OAuth start/callback → grant refresh → direct browser chunk protocol → Drive metadata/revision stream → server SHA-256 receipt → new service instance → reconciliation/listing. Additional tests cover one-use/expired state, wrong-account reconnect, serialized refresh/session creation, ciphertext tampering, swapped user/key and unknown vault keys. Disposable PostgreSQL tests verify the migration under a non-superuser migration actor, ciphertext-table denial, caller isolation, deletion and the actual narrow-login privilege guard. Desktop/mobile browser tests exercise recovery across page reloads without reupload or localStorage. Passed: 76 application tests, 160 SQL assertions plus managed-role preflight, five existing concurrency checks, 34 browser tests, lint, typecheck, production build and three HTTP smoke checks.

These tests use synthetic Google transport and application repositories; separate repository/worker tests cover those boundaries. They are not a hosted Supabase/Google end-to-end test, and no external Drive request was made. Production TLS, Google consent/CORS/session authorization, quotas and runtime limits remain live setup checks.

## Exact setup boundary for root

1. Review/apply outstanding Task 4, Task 5 receipt and new `20261002071500_drive_vault.sql` migrations only with explicit authorization. Preserve docs/hosted-migration-map.md; do not replay already applied C1/Task 2.
2. Provision two distinct restricted connection logins: one inherits only kg_drive_worker, the other only kg_vault_worker. Both memberships use INHERIT true, SET false, ADMIN false. Neither login has direct table grants, elevated attributes, other memberships or owner access. Supply certificate-verified TLS connection parameters; do not use service_role/postgres credentials.
3. Supply a random 32-byte server encryption key through approved secret storage, separate from the database. Supply Google Web OAuth client ID/secret, exact production origin and callback `/api/drive/oauth/callback`, with only drive.file scope. These are setup requirements, not resources created by this change.
4. Root reviews runtime activation: construct one configuredDriveIntegration from the approved secret configuration, return it from productionDriveIntegration, and enable the UI flag. Production currently returns UNCONFIGURED regardless of environment variables. The legacy PDF endpoints stay 410. No additional application subsystem needs writing for the basic upload path, but actual provider behavior must pass the synthetic-file live probe before use.
5. Mobile user's eventual path: sign in → open paper → Connect Google Drive → consent with the intended account → choose PDF and fill source/access fields → Save → inspect stored-unparsed receipt. If navigation interrupts acknowledgement, return to the paper and confirm the transfer result. Never send passwords, client secrets or encryption keys through chat.

## Remaining delivery and source work

Private PDF attachment delivery remains blocked on an architecture decision. Current policy excludes a 100 MB Vercel proxy, and server Google credentials must not be exposed to the browser. A revision-pinned relay would change that hosting/bandwidth contract; a separate download service would add infrastructure. No paid service, public share, mutable download link or substitute inline viewer is introduced. The existing source-check operation verifies revision/hash but download still returns DOWNLOAD_UNPROVEN.

This slice does not claim the later full research path is complete: structured evidence import and graph editing exist from Task 4, but verified PDF page/passage anchoring and clickable private PDF delivery require their own bounded follow-up. Storage alone never upgrades evidence or confirms a mechanism.
