# Data dictionary v0.1

Task 2 implementation update: see [Auth-ready workflow and revised mutation privileges](task2-setup.md). The Phase 1/C1 baseline below is retained as a design record.

## C1 physical baseline

PKs are UUID; timestamps are timestamptz; scientific parent links use `(project_id,id)`; deletes are not granted and references use NO ACTION. Defaults never invent scientific observations. See the migration for exact nullability/checks.

| Table | Fields and meaning | Mutation policy |
|---|---|---|
| projects | id, owner_user_id, name, description, created_at/by, updated_at, archived_at | Atomic create_project RPC creates owner membership. Only owner updates; owner identity immutable |
| project_members | project_id/user_id composite PK, owner/editor/reviewer/viewer, created_at/by, updated_at | Bootstrap only in C1; no direct authenticated writes; one owner per project |
| audit_events | project/id, actor_type/id, action, entity_type/id, old/new version IDs, reason, old/new JSON snapshots, created_at | Trigger-written and append-only; member-read; no client insertion |
| papers | project/id, title/normalized_title, journal/year/abstract/canonical_url/publication_type, publication_status, relevance/priority/investigation_reason/notes, acquisition_status, analysis_status, revision, created_at/by, updated_at, archived_at | Owner/editor create/edit; edits increment revision; trigger preserves before/after |
| paper_identifiers | project/id/paper, provider/raw_value/normalized_value, source/retrieved_at, created_at/by | Append-only; project/provider/normalized_value unique; no title-based uniqueness |
| document_assets | project/id, storage_bucket/path, sha256, byte_size, MIME, original_filename, upload_state/verified_at, created_at/by | Append-only metadata, scoped path project/id/original.pdf; only pending/unverified inserts for clients; verified hashes unique within project |
| paper_documents | project/id, paper/asset IDs, role, edition_label, acquired_at/from, access_basis, created_at/by | Immutable many-to-many edition link |
| source_anchors | project/id, paper_document, physical_page_start/end (1-based), printed_page_label, section, figure_table_scheme, bounding_boxes, verbatim_passage/hash, extraction_run_id, anchor_verified_at, supersedes_anchor_id, created_at/by | Append-only; client inserts unverified; corrections supersede; C1 extraction_run_id is an opaque protocol reference pending C2 FK |

Paper identifier corrections currently require an explicit future supersession/retirement contract; do not mutate the immutable record or bypass uniqueness to resolve a correction. C1 metadata insertion does not prove an object exists. Pending assets cannot be promoted in this phase; a reviewed verifier transition is required in Phase 2. Source anchors retain old edition links after new documents/OCR records are added.

## C2 required contracts (not physically implemented)

| Family/table | Required semantics and fields |
|---|---|
| upload_intents | project/object path, expected size/hash, expiry/status, completed asset; recovery across DB/Storage |
| paper_authors; paper_relations | ordered author names/ORCID; cites/corrects/retracts/same-dataset relations with source anchor; derive cited_by inverse |
| acquisition_requests; acquisition_request_questions | paper, priority/reason/status, timestamps/resolution document; question association |
| compounds; compound_versions | stable/current pointer/archive/merge; canonical name, node_type, formula/charge nullable, stereochemistry/protonation/structure scope, epistemic status/unknown reason |
| compound_identifiers; compound_aliases | identifiers pinned to version with provider/toolkit/version/source/verification; aliases are searchable labels, not identity proof |
| reactions; reaction_versions; reaction_participants | stable/current; representation_scope, reaction_type, reversibility, mechanism description/origin, mapping, equation balance/status/basis, product inventory/status; many participant version IDs, roles, nullable coefficients/status/display/position |
| claims | immutable reaction XOR compound version, scope/proposition/direction/qualifiers, asserted_by, origin paper, supersedes |
| studies; experiments; experiment_versions | original paper/dataset/source resolution/independence group; original experiment/replicate labels; version, sample/source anchor, condition-stage links/context |
| experiment_components | actual compound/material sample, substrate/alkali/catalyst/solvent/additive/atmosphere role, inventory completeness/source |
| material_samples; sample_properties | experiment/compound, vendor/batch/preparation/sample label; DP/crystallinity/particle size/pretreatment as typed/raw sourced measurements |
| condition_sets; condition_definitions; condition_values | immutable stage/basis/completeness; semantic version, dimension/value-kind/unit/basis rules; state/raw/typed range values, comparators/inclusivity, normalized units, measurement role/target, derivation/input IDs/assumptions, uncertainty/LOD/precision, structured extras |
| analytical_methods; observations | experiment/instrument/protocol/target/calibration/limits/source; immutable detection/non-detection/yield/rate/spectrum, value/uncertainty/species/source |
| evidence; evidence_versions | stable/current; claim, reporting paper, experiment or reported applicability, study, stance/type/strength+rationale/review/origin/source-access/extraction-confidence/limitations/status |
| evidence_sources; evidence_observations | version/source anchor with supporting/method/condition/figure/prior-citation role and scope; observation link/role |
| evidence_dependencies; evidence_comparisons | adopts/same-experiment/reanalysis/derived-from with resolution; consistent/apparent/direct conflict/different-conditions/not-comparable, explanation/reviewer/resolution; keep both sides |
| research_questions; question_links; question_decisions | question/why/status/priority/scope/origin/depth/parent/stop criteria/next action/answer/review; typed XOR links; state decision history with evidence |
| search_runs; search_results | provider/query/filters/time/cursor/version/RQ/error/hash; provider ID/paper/rank/snapshot and candidate/accept/reject/defer decisions |
| analysis_jobs; analysis_runs | document/requester/scope/adapter/attempts/status/error; input hash/schema/protocol/model/extraction method/output asset/times/status |
| import_batches; import_items; review_tasks | project/run/schema/content hash/idempotency/state/report/applied actor; local IDs/payload/link-create-revise-ignore targets/conflicts; manual decisions with rationale |

Question statuses: open, searching, waiting_for_pdf, analyzing, answered, unresolved, rejected, low_priority. Answered requires scoped summary and adopted evidence. Search budget/depth/stop criteria remain explicit. Adapters preserve external IDs separately from internal UUIDs.

## D extension contracts

merge_decisions retain proposed/accepted/reverted rationale; compound_relations/reaction_relations preserve relationship provenance; evidence_groups can expand simple confirmed/provisional/unknown origin groups without re-counting citations. Advanced UI, automatic scoring, collaboration and graph caches are deferred. Export must eventually preserve schema_version, IDs, version graph and Storage manifest/hashes; restoring DB alone is insufficient.
