-- 50_studio_editor_actions.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_editor_action (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    request_id text NOT NULL,
    name text NOT NULL,
    input jsonb NOT NULL,
    result jsonb,
    created_at bigint NOT NULL,
    claimed_by uuid,
    pending boolean DEFAULT true NOT NULL,
    CONSTRAINT studio_editor_action_pkey PRIMARY KEY (id),
    CONSTRAINT studio_editor_action_request_id_key UNIQUE (request_id)
);

ALTER TABLE public.studio_editor_action ENABLE ROW LEVEL SECURITY;

CREATE INDEX studio_editor_action_pending_actor ON public.studio_editor_action USING btree (actor_id, project_id, created_at) WHERE pending;
