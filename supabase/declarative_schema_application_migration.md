# Declarative schema workflow and baseline audit

`supabase/schemas/` is the source of truth for application-owned SQL objects and
required operational SQL. The explicit `db.migrations.schema_paths` order in
`config.toml` loads canonical definitions, then foreign keys, triggers, managed
policies, permissions, scheduled jobs, legacy publication membership and Event
Studio template rows. Historical ALTER/backfill/delete sequences are not replayed.

## October 2026 baseline audit

The 23 previous migrations and the original 82 schema files were independently
applied to isolated PostgreSQL 17 Supabase databases. A migra diff covering
`public,ai_diagnostics,group_invitations,auth,storage,realtime` found no structural
changes. Schema-only catalog dumps additionally identified two harmless column
ordering differences and a Studio comment absent from the migration history.

No current table, function, trigger, constraint, index or policy was missing from
the schema sources. The original sources did omit the explicit public-schema
CREATE revocation and depended on historical steps for the final function ACLs.
Those contracts are now explicit and applied after all application objects.
The comment claiming Studio schema 4 was corrected to schema 6.

The canonical inventory is 184 application tables (178 public, two diagnostics,
four invitations), 1,922 columns, 453 foreign keys and 112 application functions.
Removing retired collaboration definitions and duplicate historical definitions
changes the source inventory, not the resulting database structure. The database
coverage matrix now counts the canonical definitions and constraint triggers.

A regression probe also showed that schema-specific default privilege revocations
do not remove PostgreSQL's implicit global PUBLIC EXECUTE on future functions.
The final security source revokes that global default for the application owner
`postgres` and explicitly allowlists current client/server RPCs. Managed objects
owned by Supabase's other roles retain their platform contracts.

## What the generated migration does not capture

| State                                                             | Canonical source                                | Delivery                                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Required extensions outside the selected application schemas      | `00_extensions.sql`                             | Idempotent manual extension setup before cron configuration                          |
| Schema usage, CREATE restrictions, function ACLs and default ACLs | `31_service_role_grants.sql`, `35_security.sql` | Manual SQL after all application objects                                             |
| Tutorial cleanup and conditional push-delivery jobs               | `34_scheduled_jobs.sql`                         | Manual `cron.schedule` blocks; no push job without its existing Vault secret         |
| Table additions to an existing legacy `zero` publication          | `98_publications.sql`                           | Idempotent manual SQL; runtime-owned publications are not created or copied          |
| Nine required Event Studio templates                              | `99_event_templates.sql`                        | Manual INSERT/ON CONFLICT statements; these rows are required before creating events |
| Studio document-version comment                                   | `36_communication_studio.sql`                   | Manual COMMENT statement                                                             |
| Storage buckets, size limits and MIME types                       | `config.toml`                                   | `supabase seed buckets --local` / `--linked`                                         |

Own triggers on `auth.users` and own RLS policies on `storage.objects` and
`realtime.messages` **are** captured in this baseline. Other potential migra gaps
(roles, domains, view ownership/security-invoker settings, column ACLs, materialized
view indexes and other comments) must be assessed when introducing those objects;
this application currently declares no additional instances of them.

## Generate and validate migrations

Use the pinned CLI (2.115.0 for this baseline) and explicitly select `--use-migra`.
Do not generate an initial migration from a database containing live application
data, Zero runtime schemas, publications or replication slots.

1. Edit the canonical schema source first.
2. Start a disposable Supabase PostgreSQL project on separate ports with seeding
   disabled. Concatenate the schema files in `config.toml` order into a temporary
   reference migration and apply it there. Its DML is limited to required setup.
3. For a fresh baseline, remove old migration files only after preserving the audit
   inputs. Diff the empty migration history against that reference database:

   ```powershell
   pnpm exec supabase db diff --db-url '<reference-db-url>?sslmode=disable' --schema 'public,ai_diagnostics,group_invitations,auth,storage,realtime' --use-migra -f initial
   ```

4. Add the manual supplement at the immediately following timestamp. Copy the
   canonical operational sources verbatim and include the omitted COMMENT.
   `baseline.static-contract.test.ts` checks that these copies remain in sync.
5. Preserve generator output. If a correction is necessary, enclose every changed
   block in `MANUAL_EDIT_BEGIN: <reason>` / `MANUAL_EDIT_END`. Mark every manual
   supplement with `MANUAL_SQL: <source and reason>`. Search these exact markers
   with Ctrl+F. This initial baseline required no generator corrections.
6. Rebuild a second disposable database from exactly the two migration files,
   provision its buckets, and run database coverage, pgTAP and integration tests.
   Compare its catalog with the reference and verify an empty structural diff.
   Check ACLs, cron jobs, publication membership and required data separately.

## Apply this destructive baseline

This baseline is for an explicitly authorized full data restart. It is not an
incremental migration that can be pushed over the previous application tables.

- Stop local writers and Zero, reset locally, provision buckets, apply the
  configured local seeds and restart Zero with a fresh replica.
- For the linked production project, pause writers, remove uploads through the
  Storage API (not SQL, which leaves physical files behind), and hard-delete Auth
  accounts through the Admin API before resetting application objects.
- Preserve Supabase system structures, project settings and Vault secrets. Check
  the linked project identity before running `supabase db reset --linked --no-seed`.
- Provision buckets with `supabase seed buckets --linked` and apply **only**
  `seed.production.sql`; never run the configured local seed list remotely.
- Reinitialize Zero replication and its persistent replica, restart services, and
  verify the two applied migration versions, catalog parity and service health.

See the [Supabase declarative schema guide](https://supabase.com/docs/guides/local-development/declarative-database-schemas)
and [CLI diff reference](https://supabase.com/docs/reference/cli/supabase-db-diff).
