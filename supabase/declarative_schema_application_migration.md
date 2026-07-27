# Declarative schema workflow

The SQL files in `supabase/schemas/` are the source of truth for durable
database objects.

1. Update the relevant declarative schema files.
2. Have a human generate a migration with `supabase db diff -f <name>`.
3. Review the generated migration before applying it.
4. For a fresh baseline, copy the two idempotent `pg_cron` setup blocks from
   `schemas/34_scheduled_jobs.sql` into the generated migration. Cron jobs are
   DML-managed operational state and are not reliably emitted by `db diff`.
5. Apply versioned migrations with `supabase migration up`, or rebuild the
   disposable local database and seed data with `supabase db reset`.
6. Run `supabase test db --local` and verify that a subsequent
   `supabase db diff` has no functional changes.

See the
[Supabase declarative schema guide](https://supabase.com/docs/guides/local-development/declarative-database-schemas).
