-- Revision triggers execute through the server write path, never as a public RPC.
REVOKE ALL ON FUNCTION public.canvas_record_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_record_revision() TO service_role;
