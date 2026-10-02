# Literature search and RQ-linked PDF acquisition

Base: 950506be052563884f3d7e5b77d2336bc8367a96. Local candidate only. No live schema changes, credentials, paid services, provider searches, pushes or deployment were performed. Only public API documentation was consulted.

## Working local flow

From a project, open Literature search → create/select a Research Question → run a search → inspect the candidate's bibliographic metadata and explicitly labelled abstract excerpt → enter selection reason and priority → save → open the existing paper or PDF acquisition queue. The queue records needed/requested/blocked/deferred status, priority, RQ and reason with optimistic revisions and audit history. Multiple RQs can have separate tasks for one paper. A stored original removes the paper from the PDF-needed view; a manual status change never claims PDF bytes exist or scientific analysis is complete.

Searches retain the exact normalized query, associated RQ, timestamp, normalized per-provider result snapshots and status. Candidate selections retain their own reasons, priority and paper/task links. Latest 20 searches and latest 100 selection records are available in the search history; nothing is deleted by that display limit. RQ prompts are immutable in this bounded slice; there is no question-answering or scientific completion assertion.

Adapters use fixed public GET endpoints for Semantic Scholar and Crossref, with no API keys, bearer tokens, paid fallback, arbitrary URL fetch or automatic retries. Each request is limited to the first 10 results per provider, 12 seconds and a 1 MiB body. Rate limits retain Retry-After and impose a process-local cooldown; that cooldown is not a distributed quota guarantee. Denied access, unavailable service and invalid responses remain visible alongside any usable result from the other provider. Search terms are sent to the named providers; the UI says so before submission. Production behavior without an API key remains subject to provider availability and throttling.

API references: [Semantic Scholar's published OpenAPI specification](https://api.semanticscholar.org/graph/v1/swagger.json), [Crossref REST API documentation](https://www.crossref.org/documentation/retrieve-metadata/rest-api/). The adapters retrieve metadata, not paper PDFs. No full-text reading, evidence extraction or scientific confirmation occurs. Abstracts are plain text, labelled excerpts limited to 2000 characters.

## Identity and persistence

Candidate merging uses normalized DOI or matching Semantic Scholar ID, never title similarity. Conflicting DOI identities are not merged by a shared provider ID. SQL serializes selections per project, uses existing create_paper validation/idempotency, and preserves existing human metadata. A title-only duplicate produces a reviewable error rather than an automatic merge. New provider identifiers retain literature_search_unverified attribution. New papers start with analysis not requested, PDF missing and publication status unknown.

Candidate migration: `20261002090000_literature_acquisition.sql`. Adds research_questions, literature_searches, literature_selections and acquisition_tasks, plus the missing papers.authors column used by the acquisition view. A NOLOGIN/non-bypass writer has narrow RPC permissions; authenticated clients have owner-scoped reads and no direct table writes. The existing metadata-owner role is assumed temporarily only to grant execute on create_paper, then SET is removed again. Query/results/selections are immutable; acquisition updates retain audit rows. Source receipts and scientific tables are unchanged.

The queue page now reads the real task/RQ relation instead of its previous placeholder. All writes require an active owner project; archived project history remains readable. Existing operational tasks are preserved when the same candidate is selected again for that RQ.

## Verification and live boundary

Synthetic adapter, DAL, real PostgreSQL and desktop/mobile browser tests cover normalization, stable-identifier deduplication, rate limits/partial results, response bounds, no requests before authorization, snapshot replay, metadata preservation, immutable history, cross-owner denial, selection reasons, RQ linking and queue revision conflicts. No real query or paper data is in these fixtures. Passed: 85 application tests, 183 PostgreSQL checks and six concurrency checks, 38 existing browser regressions plus the two new desktop/mobile literature-flow tests, lint, typecheck, production build and three HTTP smoke checks. The new browser test initially used an overly strict select-label locator; after correcting that test locator, both variants passed.

Root still must approve/apply the candidate migration and publish the reviewed code. No credential or new infrastructure decision is required for these public search adapters. Provider availability must be checked after activation with a non-private query. Existing Drive setup approval remains separate; the queue is useful before Drive activation and does not bypass that boundary.
