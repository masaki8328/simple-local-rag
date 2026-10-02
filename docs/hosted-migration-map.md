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
