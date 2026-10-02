# Draft graph and original-source access

Review base: facae5ab14aecaf576705a7a85fa4074de88e309. Local only; no provider requests, credentials, live migration, push or activation.

## User path

After the previously reviewed Drive setup is enabled: upload a PDF → open its paper's research page → enter an exact passage and physical-page range against the stored original → save an unverified source anchor → use that anchor ID in research-case/0.1 JSON → inspect the staged diff and apply the AI draft → open the clickable reaction and its evidence → follow the source reference to the passage, page locator, immutable PDF revision and SHA-256 → check and open the original in Google Drive.

The existing structured import contract is unchanged. Apply now navigates to the saved case. Human-protected content, expected revisions, idempotency and history remain enforced by Task 4. The local PostgreSQL flow test connects a receipt, source anchor and real staged/applied evidence revision.

The graph shows every participant and coproduct in each current, non-archived case. Reaction, claim, experiment, stance, evidence class and human review state remain distinct. The current contract has one claim/experiment/evidence record per case; cases are not merged by name or silently combined into an independence count. Conditions are evaluated against that evidence's experiment, stage, exact dimension/basis/unit and unknown state. Only matched proposal-class support gets a dashed draft connection. Other matched draft assertions are dotted; excluded or unknown matches have no connection. No draft gets solid confirmed support, and net conversion never becomes elementary-mechanism proof. Original records and corrections remain accessible.

## Checked original viewer

`DriveService.viewer` reuses the server revision/hash/source-ownership checks before returning a Google Drive viewer URL. It returns no bearer token or public sharing capability. Missing, changed or inaccessible originals cannot produce a link; immutable receipts and source anchors remain intact. Browser links use noopener/noreferrer and show the successful-check warning.

The viewer is mutable: Drive may display a later file state after the check. It is not a byte-pinned download and does not verify the entered page/passage. The source panel retains the stored revision/hash and declared physical/printed locator for manual comparison. No relay, paid service, new storage provider or public sharing is needed. Byte-pinned download remains DOWNLOAD_UNPROVEN.

## Unverified source anchors

New candidate migration `20261002080000_draft_source_anchors.sql` adds one narrow owner-only RPC. A NOLOGIN, non-bypass function role can insert unverified anchors against same-project/paper stored receipts. No client table-write grants are restored. Passage SHA-256 is computed from exact UTF-8 text in SQL; callers cannot supply verification, actor or hash fields. Identical request IDs replay; changed payloads conflict. Corrections append and link the old anchor within the same document. Page ranges are user-declared; there is no parsed page count, automated extraction or confirmation procedure. This candidate requires root's separate migration approval.

## Pool blocker corrected

GoogleDriveAdapter prepares a binding-scoped token before SessionVault.once acquires its database transaction. Session creation uses that captured grant, so it cannot recursively acquire the same vault pool. Pool size remains two. A real node-pg max=2 regression runs against disposable PostgreSQL over a random loopback-only port: two different intents plus a duplicate intent complete, create two provider sessions and return one shared session for the duplicate. Production certificate-verified TLS remains unchanged; only this synthetic local PostgreSQL test uses plaintext loopback.

## Verification and remaining boundary

Tests cover the real-pool concurrency failure, SQL receipt→anchor→import, immutable correction/replay, cross-owner rejection, exact passage preservation, draft condition matching, changed/deleted viewer refusal and desktop/mobile graph/source interaction. All data is clearly synthetic. Passed: 62 domain tests, 79 application tests, 169 PostgreSQL checks (including managed-role preflight), six concurrency checks including the real max=2 pool regression, 38 desktop/mobile browser tests, lint, typecheck, production build and three HTTP smoke checks.

Live setup remains the only activation boundary for this slice: root must review/apply the outstanding candidates and configure approved Google/server capabilities. Actual Google CORS, consent/account behavior and capacity still need a synthetic-file live probe. Page/passage verification and scientific confirmation are not implemented or implied by this draft flow. The metadata-only production release remains unchanged.
