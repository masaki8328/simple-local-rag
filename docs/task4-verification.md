# Task 4 local verification — 2026-10-02

This is a draft-only implementation checkpoint for PM/scientific review. No live Task 4 schema, Drive OAuth, storage access, upload, account or deployment was changed. All fixtures are explicitly synthetic.

## Completed checks

- `npm test`: 57 passing domain/contract/classifier tests.
- `npm run test:app`: 45 passing application/DAL/verifier tests. Legacy PDF service tests remain regression coverage, not activation evidence.
- `npm run test:db`: 133 SQL assertions plus the managed-role preflight and four real concurrent request checks. PostgreSQL 17 runs in a disposable network-disabled Docker container. Migrations connect as a real NOSUPERUSER/CREATEROLE session with no Auth grant options, not a superuser session using SET ROLE.
- Active migration sequence is C1, corrected Task 2, Task 4 only. No Storage shim or superseded Task 3 migration is required. Checks cover tenant isolation, restricted writer permissions, immutable versions and ancestry, participant snapshot FKs, source scope, forged review refusal, stale edits, human protection, idempotent apply and aggregate rollback.
- `npm run test:browser`: 18 passing desktop/mobile checks, including draft retention, duplicate-submit prevention, dirty-review refusal, protected import preview and no horizontal page overflow. The Task 4 mobile editor screenshot was visually inspected. Component harness requests are mocked; these are not hosted Auth/REST end-to-end tests.
- `npm run lint`, `npm run typecheck`, production `npm run build`: passed.
- `npm run test:smoke`: three production HTTP checks passed (unconfigured private workspace and labelled synthetic graph variants).
- `git diff --check`: passed. Embedded SQL import shape matches the published generated JSON schema.

C1 and Task 2 migration hashes are unchanged. The former Task 3 migration is preserved byte-for-byte under `supabase/superseded/` (SHA-256 `6e947ad1d75e84441b6c69493089e1ea4472eb6d68cc3743eb24ba96a1ce010e`). Its isolated historical harness is `scripts/test-legacy-pdf-db.sh`; that separate harness was not rerun for this checkpoint and is not the active application path.

## Review and remaining limits

Implementation self-review and local checks are complete; independent PM/scientific/security review of Task 4 is still required. This checkpoint does not inherit Task 3's independent review as approval of the new chemistry schema.

No live Task 4 migration or signed-in hosted Auth/REST/browser test was run. No real research files were used. There is no verified source-analysis workflow, confirmed chemistry write path, global entity/original-study resolver or production chemistry graph. The inherited source-anchor/document bridge awaits a reviewed provider-neutral Drive receipt/analysis migration. Refer to `task4-research-core.md` for bounded model decisions and `drive-adapter-plan.md` for the separately scoped next task.

Before any future hosted migration, reconcile the two already-applied hosted migration versions using `hosted-migration-map.md`; do not replay them because their local filenames differ. No push, deployment or live schema application is part of this checkpoint.
