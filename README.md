# 糖類アルカリ反応 Knowledge Graph — Task 2

A private, evidence- and condition-aware research application foundation. Project/paper forms and the owner-scoped server DAL are Auth-ready. **With no Supabase configuration, the app fails closed and reads/writes no research data.** No credentials or hosted services have been configured by this task. `/demo` retains the visibly synthetic Phase 1 demonstration. No OpenAI API dependency. Dot owns research and source-grounded extraction; the initial analysis transport remains manual versioned JSON.

Start with [Task 2 setup, architecture and live-validation requirements](docs/task2-setup.md) and [Task 2 verification](docs/task2-verification.md).

```sh
npm ci
npm run dev
# Open http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run test:app
npm run build
# Disposable Docker PostgreSQL only; never uses DATABASE_URL or production services:
npm run test:db
npm run test:smoke
npm run test:browser
```

Use Node 24 and the committed npm lockfile. If the home cache is unavailable, use `npm --cache /tmp/kg-npm-cache ci`. Set `NEXT_TELEMETRY_DISABLED=1` for local builds if desired.

- [Architecture / decisions](docs/architecture.md)
- [ERD](docs/erd.md)
- [Data dictionary and C2/D contracts](docs/data-dictionary.md)
- [Versioned analysis JSON schema](contracts/analysis-v0.1.schema.json) (`npm run contract:generate`)
- [Verification results and limitations](docs/verification.md)
- [C1 migration](supabase/migrations/202610020001_c1_baseline.sql)

The database still comprises only the C1 tables: projects, project_members, audit_events, papers, paper_identifiers, document_assets, paper_documents and source_anchors. Other scientific entities are contracts and synthetic tests, not persisted tables. The SQL tests use real PostgreSQL grants/RLS with a test-only Auth identity shim; they do not certify Supabase Auth, REST or Storage integration.

Do not commit research PDFs, private passages, exports, actual analysis JSON or credentials. `.gitignore` is a guardrail, not a content-inspection substitute. The historical tutorial PDF remains recoverable from Git history; it is absent from the current working tree. Do not rewrite history.

Cleanup baseline: `71809f49637f5a43bd666ef9a17db962d1ad316b`. Work is isolated on `phase0/research-knowledge-graph`. Recover an old path with `git restore --source=71809f49637f5a43bd666ef9a17db962d1ad316b -- <exact-path>` (restoring README overwrites this new README). Seven original RAG files were removed/replaced under user authorization; `.gitignore` and the existing Slack workflow were retained. Task 2 is saved in a local-only commit after review. No push, PR, deployment or hosted migration is authorized.

## Task 3 local PDF foundation

The PDF queue, upload/recovery components, byte-verification service and private Storage policy candidate are available for local review. Production uploads remain disabled until a scoped verifier and bounded parser worker are reviewed/provisioned. See [Task 3 design and limits](docs/task3-pdf.md), [verification](docs/task3-verification.md) and the [root-reported hosted migration mapping](docs/hosted-migration-map.md). Do not reapply metadata migrations because local and connector-generated versions differ.

## Task 4 draft research core and Drive decision

The bounded paper → compounds/reaction → experiment conditions → evidence path includes immutable revisions and staged JSON preview/apply. Source confirmation remains disabled. See [research core](docs/task4-research-core.md) and [the accepted Drive adapter plan](docs/drive-adapter-plan.md). Google Drive will hold PDF originals; Supabase Storage Task 3 is superseded and its unapplied SQL is outside the active migration directory. No app OAuth or Drive upload is configured.
