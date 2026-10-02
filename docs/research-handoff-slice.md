# Bounded research handoff and Research Questions

Local candidate after `68ea60a`. The original 28-section specification was supplied by PM in full on 2026-10-02. Later instructions override PDF storage with private Google Drive, allow Dot-side cloud research instead of mandatory Work dispatch, prohibit a paid/API dependency, and bound this implementation to one paper/question/case. No hosted migration or credential operation is part of this change.

## Workflow

1. Open Project → Research Questions. Create a question, record importance, P1–P4 priority, status, and reason. All eight specified statuses are supported.
2. Choose an existing paper/case and one question; save and download its immutable research request. It pins the question revision, case revision, source anchor/page/passage, original receipt revision and PDF SHA-256 when present. Missing sources remain missing. The exported private JSON is for the research operator, never GitHub.
3. Dot researches this bounded question and returns `research-result/0.1`, using the exported template and existing `research-case/0.1` schema. No dispatch, API model call, recursive search or automatic PDF analysis occurs. New passages must first be registered through the existing source-anchor UI; extraction cannot invent verified anchors.
4. Paste the result JSON. The database checks its saved request hash, tenant, paper, case and base revision, atomically records immutable raw content/hash, and stages the scientific proposal. Retry IDs are content-bound. Reload retains the result and reconstructs its difference against the current case.
5. Compare differences. An AI-only, unchanged base can be applied through the existing idempotent import RPC. Human-owned/reviewed cases require deliberate correction in the existing editor. Case/source/scientific review remain independent.
6. Select the result's conclusion as an answer candidate in the question editor. This resets answer review to unreviewed. Edit, link evidence versions, give a reason, and explicitly record human review. The question revision retains the research-result ID, conclusion and immutable evidence-version links. Nothing automatically sets answered.
7. Answered requires a nonempty human-reviewed conclusion and current, nonarchived evidence with accepted scientific review bound to the latest attested source. It does not imply strong evidence or an elementary mechanism. Refuting or inconclusive evidence can support a appropriately scoped answer. Later source withdrawal, replacement, case revision or scientific-review withdrawal marks the saved answer for re-review; old conclusions remain in history.

Question-related papers, reactions and compounds are reached through linked case/evidence snapshots, rather than a separate duplicate entity model. Existing search/acquisition question IDs remain stable. The request's question text uses the latest question revision.

## Security and release

`20261002140245_research_handoff.sql` is one additive, unapplied candidate. Supabase CLI generated its filename in a disposable network-disabled container because its normal startup tried to create a configuration directory outside the writable workspace. No CLI login/configuration persisted. Existing migration bytes and the root-reported hosted map are preserved.

Three RLS-protected append-only tables use the existing restricted NOLOGIN research writer. Authenticated clients have owner-scoped reads and vetted RPC execution, with no direct writes; anonymous/service-role privileges are revoked. Mutation RPCs require an active owned project, validate tenant-bound references, serialize revision updates and pin history. No new login, service key, browser credential or integration access is introduced. Request downloads use authenticated server access and private/no-store responses; source passages only leave the app when the user downloads them. Do not publish JSON exports or result content.

Apply the candidate only through root's separately controlled release workflow before publishing these routes. The existing hosted migrations must not be replayed. Current release `68ea60a` remains unchanged by this local slice.

## Scope and limits

A request is one existing case, not a whole-paper extraction job; larger analyses are separate bounded requests. Results and request lists show the latest 30 records. Import never promotes paper analysis status or proves PDF inspection. A changed human case must be corrected manually; the proposal remains accessible. Research Question edits are human records; AI attribution stays in the linked immutable result. Full-text parsing, immutable byte-pinned PDF delivery, full-project backup/export and automated discovery remain separate work.

Generated contracts: `contracts/research-result-v0.1.schema.json` and `contracts/question-revision-v0.1.schema.json`; semantic validation also runs in TypeScript and SQL. Generate with `node --import tsx scripts/generate-handoff-contract.ts`.

## Local verification

Passed: 80 domain tests; the 95-test app/server suite plus seven focused follow-up checks (including the new stale/withdrawn-answer check); 236 PostgreSQL assertions and six concurrency/pool checks in disposable PostgreSQL 17; typecheck, lint, production build; three production HTTP smoke checks; desktop and 390px mobile handoff browser tests. Browser tests use synthetic component fixtures and intercepted API responses; they are not a hosted Supabase/Google end-to-end claim. They exercise request selection/download link, result staging/reload display, protected apply, answer candidate selection, evidence linkage and explicit human review, with no page errors or horizontal overflow. Mobile screenshot inspected locally.

Database tests verify snapshot source hashes/pages, idempotent export/staging/application, content and base-revision tampering, AI revision application, human correction protection, question optimistic revisions, answer review/source gates, withdrawn source handling, preserved history, owner isolation, anonymous denial and denied direct writes. The production build includes the authenticated `/projects/[projectId]/questions` and `/api/handoff` routes.

Candidate SQL SHA-256: `96e7b0375a869842131dcbed451c3266449c38f10a2bd5027e97cdfb6619e2ea`. Official Supabase RLS documentation was checked; its changelog endpoint again returned an internal fetch error. No new SDK version or undocumented Supabase feature was introduced. Local catalog/grant assertions substitute for hosted advisor access here; no hosted advisors or database were contacted.
