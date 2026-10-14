-- 73_ai_traces.sql: canonical current definitions; historical upgrades are not replayed.

CREATE SCHEMA ai_diagnostics;

CREATE TABLE ai_diagnostics.ai_trace (
    id uuid NOT NULL,
    actor_id uuid NOT NULL,
    conversation_id uuid,
    origin_message_id uuid,
    response_message_id uuid,
    studio_project_id uuid,
    amendment_id uuid,
    document_id uuid,
    surface text NOT NULL,
    invocation text NOT NULL,
    prompt jsonb NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT ai_trace_pkey PRIMARY KEY (id)
);

CREATE TABLE ai_diagnostics.ai_trace_operation (
    id uuid NOT NULL,
    trace_id uuid NOT NULL,
    parent_operation_id uuid,
    kind text NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    tool_call_id text,
    attempt integer DEFAULT 1 NOT NULL,
    input jsonb,
    output jsonb,
    error jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at bigint NOT NULL,
    finished_at bigint,
    CONSTRAINT ai_trace_operation_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'queued'::text]))),
    CONSTRAINT ai_trace_operation_pkey PRIMARY KEY (id)
);

ALTER TABLE ai_diagnostics.ai_trace ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_diagnostics.ai_trace_operation ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.delete_message_ai_trace() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'ai_diagnostics'
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM ai_diagnostics.ai_trace WHERE origin_message_id=NEW.id OR response_message_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE INDEX ai_trace_actor ON ai_diagnostics.ai_trace USING btree (actor_id, created_at DESC);

CREATE INDEX ai_trace_conversation ON ai_diagnostics.ai_trace USING btree (conversation_id, created_at DESC);

CREATE INDEX ai_trace_document ON ai_diagnostics.ai_trace USING btree (actor_id, document_id, created_at DESC);

CREATE INDEX ai_trace_operations ON ai_diagnostics.ai_trace_operation USING btree (trace_id, created_at, id);

CREATE INDEX ai_trace_origin ON ai_diagnostics.ai_trace USING btree (origin_message_id);

CREATE INDEX ai_trace_response ON ai_diagnostics.ai_trace USING btree (response_message_id);

CREATE POLICY service_role_all ON ai_diagnostics.ai_trace TO service_role USING (true);

CREATE POLICY service_role_all ON ai_diagnostics.ai_trace_operation TO service_role USING (true);
