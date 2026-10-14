-- 67_personal_studio_collaborators.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_project_collaborator (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    invited_by_id uuid NOT NULL,
    status text NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT studio_project_collaborator_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'declined'::text]))),
    CONSTRAINT studio_project_collaborator_pkey PRIMARY KEY (id),
    CONSTRAINT studio_project_collaborator_project_id_user_id_key UNIQUE (project_id, user_id)
);

ALTER TABLE public.studio_project_collaborator ENABLE ROW LEVEL SECURITY;

CREATE INDEX studio_project_collaborator_user_status ON public.studio_project_collaborator USING btree (user_id, status);
