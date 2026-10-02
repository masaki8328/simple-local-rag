# 糖類アルカリ反応 Knowledge Graph — Phase 1

A Next.js foundation for a private, evidence- and condition-aware research graph. **The app displays visibly synthetic test data only. No actual research data, PDF service, Auth session, database connection or research-analysis provider integration is configured.** No OpenAI API dependency. Dot owns literature research and source-grounded extraction; the initial transport is dot/manual versioned JSON, with no Work product connection required.

```sh
npm ci
npm run dev
# Open http://localhost:3000
npm run typecheck
npm test
npm run build
# Disposable Docker PostgreSQL only; never uses DATABASE_URL or production services:
npm run test:db
```

Use Node 24 and the committed npm lockfile. If the home cache is unavailable, use `npm --cache /tmp/kg-npm-cache ci`. Set `NEXT_TELEMETRY_DISABLED=1` for local builds if desired.

- [Architecture / decisions](docs/architecture.md)
- [ERD](docs/erd.md)
- [Data dictionary and C2/D contracts](docs/data-dictionary.md)
- [Versioned analysis JSON schema](contracts/analysis-v0.1.schema.json) (`npm run contract:generate`)
- [Verification results and limitations](docs/verification.md)
- [C1 migration](supabase/migrations/202610020001_c1_baseline.sql)

C1 comprises only projects, project_members, audit_events, papers, paper_identifiers, document_assets, paper_documents and source_anchors. Other scientific entities are contracts and synthetic tests, not persisted tables. The SQL tests use real PostgreSQL grants/RLS with a test-only Auth identity shim; they do not certify Supabase Auth, REST or Storage integration.

Do not commit research PDFs, private passages, exports, actual analysis JSON or credentials. `.gitignore` is a guardrail, not a content-inspection substitute. The historical tutorial PDF remains recoverable from Git history; it is absent from the current working tree. Do not rewrite history.

Cleanup baseline: `71809f49637f5a43bd666ef9a17db962d1ad316b`. Work is isolated on `phase0/research-knowledge-graph`. Recover an old path with `git restore --source=71809f49637f5a43bd666ef9a17db962d1ad316b -- <exact-path>` (restoring README overwrites this new README). Seven original RAG files were removed/replaced under user authorization; `.gitignore` and the existing Slack workflow were retained. No push, PR, deployment or live migration is authorized in this phase.
