# Root-reported hosted metadata initialization — 2026-10-02

Source: root's connected-Supabase verification report after explicit user approval. This executor did not apply or query the hosted project. Target: `Alkali-reserch-kg`, `iqglaucujjwowihgbenx` only.

| Local source file | Root-reported hosted migration version/name | Exact SQL SHA-256 |
|---|---|---|
| 202610020001_c1_baseline.sql | 20261002043904 / c1_baseline | 3a840686481dcf3051adde42c744996fb632a96d7f1970654e9e5aff191f28d3 |
| 202610020002_project_paper_workflow.sql | 20261002043929 / project_paper_workflow | 60ff491bc75081594d81da8c0897dd35f72a2e37168d786ae6e2843cea14626e |

Do not reapply these migrations because filenames differ from connector-assigned versions. Before any future CLI db push, root must inspect and reconcile migration history through a separately authorized workflow. No automatic migration repair/push is installed. The new unapplied Task 3 candidate was generated with CLI 2.119.0 as `20261002044143_private_pdf_acquisition.sql`, after those hosted versions. Earlier uncommitted Task 3 draft filename was discarded; it was never applied.

Root verified eight tables with RLS, anonymous SELECT denied, authenticated direct INSERT/UPDATE/DELETE denied, and the restricted writer without login/superuser/RLS bypass/inheritance, auth USAGE, public CREATE or app membership. Neither authenticated nor postgres can SET ROLE to the writer. Five metadata RPCs are writer-owned, project bootstrap is postgres-owned, and the private caller_uid helper has a fixed empty search path. Legacy client bootstrap execution is revoked.

Root reported six security-advisor WARN findings for the intended authenticated SECURITY DEFINER public RPCs: bootstrap plus five RLS-bound writer functions. They remain intentional reviewed architecture, not missing RLS and not zero warnings. See the [Supabase linter rule](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No rule was disabled. Live Auth/REST/tenant/session E2E remains a gate.

No users, credentials or research data were inserted by this initialization. Root owns further Auth setup/approval. Task 3 Storage/verifier setup is not covered by these results.

## Root-reported release application — 2026-10-02 11:47–11:48 UTC

Root reported application of the following seven migrations and verification that all public tables retain RLS and deny anonymous reads. Existing content remains one project and zero papers. This executor has not queried the hosted database or independently verified those results. Hashes below were recomputed from local files at `68ea60a`.

| Local source file | Root-reported hosted migration version/name | Exact SQL SHA-256 |
|---|---|---|
| 20261002045414_research_case_core.sql | 20261002114739 / research_case_core | b55476dec093885b9afc69dbe5d4b7fb3892b7460f0bba038669c4b06b636f4d |
| 20261002060000_drive_receipts.sql | 20261002114802 / drive_receipts | 0f58d6659f808e1592fc6298f0984f179bf6aa1bd872176665b67996c23c1597 |
| 20261002071500_drive_vault.sql | 20261002114811 / drive_vault | b02e583b6cf034fa7cc9531b7fa0ce608a3c1078cc5ec1431662bf42f9b0faed |
| 20261002080000_draft_source_anchors.sql | 20261002114821 / draft_source_anchors | 0740b2c1a155fef3e01c053daadedc54b8276c33a4c8bcd59827c68f0c1ce17d |
| 20261002090000_literature_acquisition.sql | 20261002114830 / literature_acquisition | 3db8b739de2a9571f6b9c512714b336846c9031e4598819dd3fa159a83045abc |
| 20261002100000_project_reaction_reviews.sql | 20261002114843 / project_reaction_reviews | 96a1a060fa521769064fc0c9e612454a800d2b27d29c82fe0bc64f0dc4d0bb8f |
| 20261002110000_compound_identity_links.sql | 20261002114852 / compound_identity_links | 0b26259ac245a11db3a98190aa9e2a8734b89abec19f3266fd042e8c9a215ff6 |

The earlier Task 3 Supabase Storage candidate was superseded by Drive and is not part of the applied set. Do not replay any of these nine recorded migrations. The `kg_drive_app` and `kg_vault_app` logins and Google credentials remain unprovisioned according to root. Root also reported main advanced to `68ea60a00a3f37527b09cb880ab10a4cf0c28a15`; successful production deployment and live Drive operation have not been verified here.

Follow-up root report: production `68ea60a` is READY. Hosted-app login was cancelled and was not retried by this executor. `20261002140245_research_handoff.sql` is a new local candidate only; it has no hosted migration version and must not be mistaken for an applied migration.
