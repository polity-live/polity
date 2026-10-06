-- Server-only diagnostics in a private schema; Zero auto-publishes public tables.
CREATE SCHEMA ai_diagnostics;
REVOKE ALL ON SCHEMA ai_diagnostics FROM PUBLIC;
GRANT USAGE ON SCHEMA ai_diagnostics TO service_role;
CREATE TABLE ai_diagnostics.ai_trace (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversation(id) ON DELETE CASCADE,
  origin_message_id uuid REFERENCES public.message(id) ON DELETE CASCADE,
  response_message_id uuid REFERENCES public.message(id) ON DELETE SET NULL,
  studio_project_id uuid REFERENCES public.studio_project(id) ON DELETE CASCADE,
  amendment_id uuid REFERENCES public.amendment(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.document(id) ON DELETE CASCADE,
  surface text NOT NULL,
  invocation text NOT NULL,
  prompt jsonb NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX ai_trace_origin ON ai_diagnostics.ai_trace(origin_message_id);
CREATE INDEX ai_trace_response ON ai_diagnostics.ai_trace(response_message_id);
CREATE INDEX ai_trace_conversation ON ai_diagnostics.ai_trace(conversation_id,created_at DESC);
CREATE INDEX ai_trace_document ON ai_diagnostics.ai_trace(actor_id,document_id,created_at DESC);
CREATE INDEX ai_trace_actor ON ai_diagnostics.ai_trace(actor_id,created_at DESC);

CREATE TABLE ai_diagnostics.ai_trace_operation (
  id uuid PRIMARY KEY,
  trace_id uuid NOT NULL REFERENCES ai_diagnostics.ai_trace(id) ON DELETE CASCADE,
  parent_operation_id uuid REFERENCES ai_diagnostics.ai_trace_operation(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  status text NOT NULL CHECK(status IN ('running','completed','failed','cancelled','queued')),
  tool_call_id text,
  attempt integer NOT NULL DEFAULT 1,
  input jsonb,
  output jsonb,
  error jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at bigint NOT NULL,
  finished_at bigint
);
CREATE INDEX ai_trace_operations ON ai_diagnostics.ai_trace_operation(trace_id,created_at,id);
ALTER TABLE ai_diagnostics.ai_trace ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_diagnostics.ai_trace_operation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_diagnostics.ai_trace,ai_diagnostics.ai_trace_operation FROM anon,authenticated;
CREATE POLICY service_role_all ON ai_diagnostics.ai_trace FOR ALL TO service_role USING(true);
CREATE POLICY service_role_all ON ai_diagnostics.ai_trace_operation FOR ALL TO service_role USING(true);
GRANT ALL ON ai_diagnostics.ai_trace,ai_diagnostics.ai_trace_operation TO service_role;

-- A soft-deleted message must not retain a readable copy in diagnostics.
CREATE FUNCTION public.delete_message_ai_trace() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public,ai_diagnostics AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM ai_diagnostics.ai_trace WHERE origin_message_id=NEW.id OR response_message_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_message_ai_trace() FROM PUBLIC;
CREATE TRIGGER delete_message_ai_trace AFTER UPDATE OF deleted_at ON public.message
FOR EACH ROW EXECUTE FUNCTION public.delete_message_ai_trace();
