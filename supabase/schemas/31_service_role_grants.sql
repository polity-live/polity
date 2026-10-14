-- MANUAL_SQL: Schema usage and default ACLs are not emitted by migra.
GRANT USAGE ON SCHEMA public, ai_diagnostics, group_invitations TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, ai_diagnostics, group_invitations TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public, ai_diagnostics, group_invitations TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, ai_diagnostics, group_invitations
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, ai_diagnostics, group_invitations
  GRANT ALL ON SEQUENCES TO service_role;
