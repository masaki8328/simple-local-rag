# Logical ERD v0.1

Only the eight tables in the first diagram are physically created in Phase 1. Every research relationship is project-scoped. Arrows do not imply cascade deletion.

```mermaid
erDiagram
    projects ||--|{ project_members : membership
    projects ||--o{ audit_events : audit
    projects ||--o{ papers : owns
    papers ||--o{ paper_identifiers : identifies
    papers ||--o{ paper_documents : editions
    document_assets ||--o{ paper_documents : immutable_bytes
    paper_documents ||--o{ source_anchors : immutable_locations
    source_anchors o|--o{ source_anchors : supersedes
```

C2 core contract (not migration tables yet):

```mermaid
erDiagram
    compounds ||--|{ compound_versions : revisions
    reactions ||--|{ reaction_versions : revisions
    reaction_versions ||--|{ reaction_participants : hyperedge
    compound_versions ||--o{ reaction_participants : role
    reaction_versions o|--o{ claims : subject_XOR_compound
    compound_versions o|--o{ claims : subject_XOR_reaction
    studies ||--|{ experiments : original_identity
    experiments ||--|{ experiment_versions : revisions
    experiment_versions ||--o{ condition_sets : stages
    condition_sets ||--o{ condition_values : typed_conditions
    experiment_versions ||--o{ experiment_components : actual_inputs
    experiment_versions ||--o{ analytical_methods : measurements
    experiment_versions ||--o{ observations : findings
    claims ||--o{ evidence_versions : exact_scope
    evidence ||--|{ evidence_versions : revisions
    experiment_versions o|--o{ evidence_versions : conditions
    evidence_versions ||--|{ evidence_sources : provenance
    source_anchors ||--o{ evidence_sources : fixed_PDF_location
    evidence_versions ||--o{ evidence_observations : measured_basis
    observations ||--o{ evidence_observations : pins
    evidence_versions ||--o{ evidence_dependencies : original_study
    paper_documents ||--o{ analysis_jobs : dot_manual_request
    analysis_jobs ||--o{ analysis_runs : protocol_versions
    analysis_runs ||--o{ import_batches : idempotent_staging
    import_batches ||--o{ import_items : local_ID_resolution
```

Experimentless proposals reference explicitly reported applicability condition sets, never invented experiments. C2 comparisons preserve both supporting and refuting evidence and their condition comparability. Current pointers and supersedes edges must be constrained to the same tenant and stable entity. RQ typed joins, material samples, provider history and deferred tables are listed in the data dictionary.
