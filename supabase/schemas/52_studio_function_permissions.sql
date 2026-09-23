-- Revision triggers and Presence helpers are private server infrastructure.
REVOKE ALL ON FUNCTION public.project_content_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_content_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_realtime_access(text) TO service_role;
