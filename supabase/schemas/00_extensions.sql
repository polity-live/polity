-- =============================================================================
-- 00_extensions.sql — PostgreSQL extensions required by schema indexes
-- =============================================================================

CREATE EXTENSION pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
