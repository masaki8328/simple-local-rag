# Architecture decision record — reviewed design v0.1

Task 2 implementation update: see [Auth-ready workflow and revised mutation privileges](task2-setup.md). The Phase 1/C1 baseline below is retained as a design record.

2026-10-02. PM: dot. Implementation/test owner: Codex. This document records the approved boundaries and scientific contracts; it is not a claim that C2/D or cloud integrations are implemented.

## Decision and implementation boundary

Use Next.js App Router/TypeScript, Vercel hosting, Supabase PostgreSQL/Auth/private Storage and GitHub for source/development history. PostgreSQL is the research source of truth; the graph is a derived reading model. No OpenAI API is required. Phase 1 implements the shell, pure domain/staging contracts, synthetic tests, and exactly eight C1 SQL tables. No live migrations, cloud credentials, upload service, providers, actual imports or authentication UI exist.

User authorization superseded the original preserve-RAG instruction. Seven tracked tutorial files were removed locally; the former README is replaced. Baseline `71809f49637f5a43bd666ef9a17db962d1ad316b` retains the original files. `.gitignore` and the pre-existing Slack workflow are retained. No untracked/ignored material was found during cleanup. History was not rewritten. Branch: `phase0/research-knowledge-graph`. No push or PR is authorized.

## Accepted research role update

The user selected dot-side cloud literature research (option ②). Dot owns literature search, PDF reading, source-grounded extraction and scientific coordination. Codex owns development/tests. The human obtains inaccessible PDFs and makes important scientific decisions. The research-analysis provider interface starts with dot/manual versioned JSON (`adapter=dot_manual_json`); future authenticated API/MCP transports are separate work. No ChatGPT Work product connection or external LLM API is required, and no automatic application write is configured.

## Trust boundaries

Authenticated future read/write flow: browser → server-only DAL/RPC → user-scoped PostgreSQL. Each entry point must authenticate, authorize project and operation, validate input and return only required DTO fields. No service-role access for ordinary CRUD. Source evidence and PDFs remain private. The current demo accepts only a synthetic temperature query and has no database connection.

Future PDF flow: authorized upload intent → private storage → byte/MIME/size verification and SHA-256 → immutable asset/link. Storage and DB do not share an atomic transaction; recovery reconciles incomplete intents without replacing old bytes. Signed URLs are short-lived capabilities, never durable database references or logged URLs. C1 stores metadata only and rejects user assertions of successful verification. No bucket is created by C1. Storage policies, verifier and signed-URL authorization are Phase 2 work.

Future analysis flow: dot-led research-analysis request → versioned JSON → structural and semantic validation → staging/diff/review → one database transaction → audit and graph version. JSON cannot assert human review. Text extracted from PDFs is data, not tool instructions. A structurally accepted AI record remains `ai_generated`. The current implementation is a pure validator and staging decision function, not an authenticated provider integration or importer.

## Scientific invariants

- Reaction is an independent entity with many reactants/products/formal auxiliaries; coefficients may be unknown. Formal balance and product-inventory completeness are independent. Solvent/catalyst/amount belongs to experiment components unless mechanistic definition explicitly requires it.
- Claim scope distinguishes product/intermediate presence, net conversion, elementary mechanism, pathway and order of steps. Observation of a product/net conversion cannot establish an elementary step.
- Evidence classification (`directly_observed`, `strongly_supported`, `proposed`, `adopted_from_prior_literature`, `speculative`), stance, review, origin, source access, extraction confidence and strength rationale are separate axes. Strong support requires alternatives tested and limitations. Human review does not promote scientific strength.
- Conditions preserve reported/unknown/not_reported/not_applicable/ambiguous state, raw values and units, normalized dimension/basis, ranges and open/closed boundaries. Calculated values retain derivation. pH is not NaOH molarity. Unknown atmosphere is not oxygen-free; incomplete alkali inventory cannot establish “NaOH only”. Never infer aqueous medium from unknown water amount.
- Strict filtering evaluates all requested conditions in one experiment-version/stage bundle. Ranges must be entirely below an upper-bound filter; overlap is a future explicit mode. Duplicate condition keys are unknown pending resolution rather than favorable cherry-picking.
- Positive matching directly observed/strongly supported evidence can yield solid; only proposed/adopted/speculative yields dashed. No matched positive evidence yields hidden, never a fabricated proposal. Unknown and refutation displays are separate options. Conflict and unreviewed badges are independent of line style. All participants remain in the DTO.
- Independence aggregates confirmed original-study groups, never citation or evidence-row counts. Unresolved origin remains unknown. Repeated reports of one experiment share a group.
- Free molecules, polymer sites, protonation/stereochemistry contexts and hypothetical structures are not merged by names. DP/crystallinity belong to material samples, not permanent cellulose identity.
- Stable entities point to immutable versions. Evidence pins reaction, experiment and anchor versions. Claims, PDF assets, source anchors and raw analysis outputs are append-only; superseding records preserve old provenance. Human corrections produce conflicts on reanalysis, never automatic overwrites. Scientific records have no cascading deletion.

## Revision and ownership contract for C2

Every research table carries project_id, with composite `(project_id, referenced_id)` FKs and corresponding parent UNIQUE keys. Version tables require UNIQUE(project_id, stable_id, version_no), plus UNIQUE(project_id, stable_id, id) for current pointers referencing `(project_id, id, current_version_id)`. Version ancestry must remain within the same stable entity. Use deferred constraints/transaction insert order for stable/current-version cycles. Avoid a redundant experiment↔condition-set FK cycle: link experiment versions to staged condition sets through one explicit association.

Stable compounds/reactions/experiments/evidence have archived/merged metadata as applicable. Versions carry version_no, supersedes, change_reason, actor, created_at. Claims are immutable with reaction_version XOR compound_version; C1's executable analysis profile currently supports reaction claims only. Paper edits use revision comparisons (`WHERE revision = expected`) and increment; C1 triggers capture old/new paper snapshots. Client-supplied authorship cannot assert human review. Import batch application and audit must be atomic, and retries cannot duplicate rows.

## Import profile v0.1.0

`contracts/analysis-v0.1.schema.json` is generated from the strict Zod schema. It is a deliberately bounded Phase 1 staging profile, not a full C2 persistence API: reaction claims; interval/controlled-term/composition conditions; local compound/reaction/claim/study/experiment/evidence references; source anchors; SHA-256; project/paper identity; protocol/run metadata; uncertainties/RQ candidates. Exact numeric values use closed singleton intervals. Unsupported boolean/text/profile conditions must be retained upstream and rejected for this profile, not coerced or silently discarded. Expand/version the contract before importing them. Full definitions include numeric/text/boolean/composition, normalized and raw units, measurement role, component/sample target, uncertainty/detection limits and structured heating profile.

The JSON transport parser enforces a 1 MiB Phase 1 payload cap and rejects malformed JSON. Validator checks local uniqueness/reference resolution, target project/paper/PDF/link identity, passage hashes/pages, interval validity, original-experiment/group consistency across all records, unresolved-study checks, acyclic citation dependencies and observation scope. JSON schema provides structural checks; TypeScript also provides cross-record checks. Review state is restricted to `ai_generated` and unknown fields are rejected. No verified-anchor flag is accepted. Existing immutable database anchors will require DAL validation at actual import time.

The pure planImport function hashes exact UTF-8 payload bytes. Same idempotency key+same bytes returns replay; same key+different bytes rejects. Human-corrected targets yield non-overwriting revision proposals. Durable UNIQUE(project_id,idempotency_key), content hash, locking, local-ID mapping and transaction rollback remain C2, so Phase 1 does not claim durable idempotency. Do not treat passing this validator as approval to add research facts.

## Delivery sequence

1. This phase: contracts, C1, synthetic semantics and PostgreSQL RLS tests; stop for PM review.
2. Auth/DAL and C1 paper path, then upload intents/private Storage and mobile PDF acquisition with verifier/recovery.
3. C2 species/reaction/claim/experiment/condition/evidence revisions and import transactions; material/sample contract before cellulose research.
4. Real filtered graph and provenance drill-down; contradictions and human correction workflow.
5. Provider adapters, RQs and dot/manual JSON research-analysis lifecycle; real-data research QA only after security and restoration checks.

Deferred D: advanced merge scoring/UI, multi-layer independence groups, advanced chemical/reaction relations, collaboration UI, persistent graph cache, vector retrieval, automated AI providers, confidence-width encoding and bulk export UI. Stable IDs/versioned manifests must permit eventual DB+Storage restoration; CSV is supplemental, not the canonical representation of many-to-many history.

## Sources consulted

- [Next.js data security](https://nextjs.org/docs/app/guides/data-security): server-side data boundaries and minimal DTOs.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): SQL grants plus row policies. Real hosted Auth/JWT, Storage and API verification remain necessary beyond local PostgreSQL tests.
