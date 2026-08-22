-- Supabase CLI 2.115 no longer pre-installs pg_net on fresh local stacks.
-- Keep migrations aligned with the extension declared in schemas/00_extensions.sql.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
