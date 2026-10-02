# Approved Drive runtime release preparation

Base: reviewed `33dbaa55f95882befa3aaecae3140bb8de88febd`. Root reported user approval at 09:35 UTC on 2026-10-02 for private drive.file storage, encrypted persisted Google connection and two restricted database logins. This change wires those existing components; it does not create logins, enter secrets, grant Google access, migrate hosted data or move main. No paid resources are required.

## Migration handoff

`Alkali-KG-Outstanding-Migrations-33dbaa5.json` contains seven ordered exact SQL files with SHA-256 and byte lengths. Root applies through the Supabase connector. Preserve `docs/hosted-migration-map.md`: C1 and Task2 already exist under different hosted versions and MUST NOT be replayed. The superseded Supabase Storage migration is excluded. This release does not change any migration bytes.

## Minimal Vercel fields

Set in the existing project's **Production** environment using the dashboard. Do not paste values into chat or source. Existing metadata fields remain unchanged:

| Field | Value/source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing `sb_publishable_…` key; never service-role |
| `KG_DRIVE_ENABLED` | `true` only after migration/provisioning/secret entry; otherwise absent or `false` |
| `KG_APP_ORIGIN` | `https://simple-local-rag.vercel.app` (no trailing slash) |
| `KG_DRIVE_DB_HOST` | Exact shared pooler hostname from this Supabase project's Connect dialog; never guess the cluster/region |
| `KG_DRIVE_DB_PORT` | `6543` for shared transaction pooler; `5432` supports shared session pooler |
| `KG_DRIVE_DB_PASSWORD` | User-created password for `kg_drive_app` (Sensitive) |
| `KG_VAULT_DB_PASSWORD` | Different user-created password for `kg_vault_app` (Sensitive) |
| `KG_DRIVE_ENCRYPTION_KEY_BASE64` | User-generated 32 random bytes encoded as standard Base64 (Sensitive) |
| `GOOGLE_DRIVE_CLIENT_ID` | User-created Web application OAuth client ID ending `.apps.googleusercontent.com` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Matching OAuth client secret (Sensitive) |
| `KG_DB_CA_PEM` | Optional trust certificate PEM from Supabase Database Settings if needed for the server certificate chain |

There are no DATABASE_URL, service-role, callback override, scope override, folder-ID, database-name or login-name variables. Database is `postgres`; fixed least-privilege SQL roles are `kg_drive_app` and `kg_vault_app`. Pooled wire usernames automatically become `kg_drive_app.iqglaucujjwowihgbenx` and `kg_vault_app.iqglaucujjwowihgbenx`; guard comparisons retain the bare SQL role names. Direct host `db.iqglaucujjwowihgbenx.supabase.co:5432` is also supported when the runtime has IPv6; no IPv4 add-on is requested.

TLS always verifies the peer certificate and hostname (`rejectUnauthorized: true`). The code uses separate connection fields, so URL `sslmode` parameters cannot overwrite TLS options. No insecure TLS switch exists. Each warm instance lazily owns two pools with at most two connections each; deployment concurrency still multiplies that total. Transactions use local user identity/timeouts and transaction advisory locks, parameterized unnamed queries, and no session-state assumptions or named prepared statements. Live pooler/TLS verification remains a release check.

Missing/malformed fields make Drive unavailable without throwing during metadata page rendering. Preview deployments are explicitly disabled even if mistakenly given these fields. Configuration is process-scoped: redeploy after changing values. Metadata/Auth do not require any Drive fields. Production `driveAvailable` means complete validated configuration, not proof of live connectivity.

## User-only narrow-login provisioning

Use PostgreSQL 17+ `psql` on your own trusted terminal after root confirms the migrations. The agent must not execute these steps against hosted data or see passwords. Take the session-pooler host from Connect; use the downloaded trust certificate with `sslmode=verify-full`. For example, replace only the nonsecret host/certificate placeholders:

```sh
psql -X -W "host=<dashboard-session-pooler-host> port=5432 dbname=postgres user=postgres.iqglaucujjwowihgbenx sslmode=verify-full sslrootcert=<local-certificate-path>"
```

The existing admin password is entered at the hidden prompt, not in that command. In this interactive session:

```sql
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE kg_drive_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
CREATE ROLE kg_vault_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
GRANT kg_drive_worker TO kg_drive_app WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
GRANT kg_vault_worker TO kg_vault_app WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
COMMIT;
SET password_encryption = 'scram-sha-256';
\password kg_drive_app
\password kg_vault_app
```

Generate two different long random passwords in your password manager, then enter each at its hidden `\password` prompts. Do not use `ALTER ROLE … PASSWORD 'literal'`, psql variables or shell arguments containing passwords. If roles already exist, stop for review instead of overwriting their access. After both password commands succeed:

```sql
ALTER ROLE kg_drive_app LOGIN;
ALTER ROLE kg_vault_app LOGIN;
SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin
FROM pg_roles WHERE rolname IN ('kg_drive_app','kg_vault_app');
SELECT member.rolname, parent.rolname, m.inherit_option,m.set_option,m.admin_option
FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
JOIN pg_roles parent ON parent.oid=m.roleid
WHERE member.rolname IN ('kg_drive_app','kg_vault_app');
```

Each login must have exactly its one worker membership: INHERIT true, SET/ADMIN false; all elevated attributes false. Grant no application tables, owner role, authenticated/service_role membership or auth schema access. Runtime catalog guards reject excess privileges. These are separate connection credentials, not research-user Supabase Auth accounts.

Enter the two saved passwords directly into the corresponding Sensitive Vercel fields. For the encryption key, the user may run `openssl rand -base64 32` on their own trusted terminal, save the result securely, and enter it directly in Vercel. The agent has not run this command or generated a key. Retain that key separately from database backups; replacing it makes existing grants/sessions unreadable and requires reconnect. Never commit or upload these values.

## Google consent and callback

In the user's Google Cloud project, enable Drive API and create a Web application OAuth client. Exact redirect URI:

`https://simple-local-rag.vercel.app/api/drive/oauth/callback`

The app requests only `https://www.googleapis.com/auth/drive.file`, offline access, PKCE and one-use state. No broad Drive grant or pre-existing-folder selection is required. After credentials are entered and the release is activated, the user signs in, opens a paper, and presses Connect Google Drive to consent personally. The app creates/verifies its private app-owned originals folder; it never changes sharing. If Google consent remains in Testing, add the intended test user and account for Google's refresh-token expiry rules. Do not confuse this Drive callback with the separate Supabase Auth callback.

## Release gate and rollback

Root checks the pushed release delta before moving main or activating. Then verify existing login/project/paper behavior with Drive absent, followed by user consent and a clearly synthetic small PDF through upload, receipt hashing and reload recovery. Verify two-owner isolation, TLS/pooler current_user/session_user, encrypted vault access and private folder permissions. No actual research PDF is required for this probe. The existing viewer remains mutable; byte-pinned attachment delivery is still unproven.

To disable Drive, set `KG_DRIVE_ENABLED=false` and redeploy; metadata/login remains available. Do not delete immutable receipts or history. User can revoke Google consent in their Google Account. No hosted changes or credentials are implied by local passing tests.

Official references checked for this preparation: [Supabase connection modes and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres), [node-postgres TLS behavior](https://node-postgres.com/features/ssl), [psql password prompts](https://www.postgresql.org/docs/current/app-psql.html), [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Vercel environment scoping](https://vercel.com/docs/environment-variables). The Supabase markdown changelog could not be fetched (web content-type rejection and HTTP 403); no schema/API changes were based on it.

Local verification for this release: 91 app/server tests, 209 disposable PostgreSQL assertions and 6 concurrency/pool checks passed; typecheck, lint, production build and 3 HTTP smoke checks passed. Configuration tests cover every missing field, malformed settings, preview disablement, lazy singleton construction, pooled/bare username separation and mandatory certificate verification. No live Google or Supabase operation was used for validation.
