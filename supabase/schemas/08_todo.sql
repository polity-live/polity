-- 08_todo.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.todo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    description text,
    status text,
    priority text,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    archived_at timestamp with time zone,
    tags jsonb,
    visibility text DEFAULT 'public'::text NOT NULL,
    creator_id uuid NOT NULL,
    group_id uuid,
    event_id uuid,
    amendment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT todo_pkey PRIMARY KEY (id)
);

CREATE TABLE public.todo_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    actor_id uuid,
    subject_user_id uuid,
    action text NOT NULL,
    severity text NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT todo_activity_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'assigned'::text, 'unassigned'::text, 'archived'::text, 'unarchived'::text]))),
    CONSTRAINT todo_activity_changes_check CHECK ((jsonb_typeof(changes) = 'array'::text)),
    CONSTRAINT todo_activity_severity_check CHECK ((severity = ANY (ARRAY['normal'::text, 'high'::text]))),
    CONSTRAINT todo_activity_pkey PRIMARY KEY (id)
);

CREATE TABLE public.todo_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT todo_assignment_pkey PRIMARY KEY (id)
);

ALTER TABLE public.todo ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.todo_activity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.todo_assignment ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_todo_active_status ON public.todo USING btree (status) WHERE (archived_at IS NULL);

CREATE INDEX idx_todo_activity_todo_severity_created ON public.todo_activity USING btree (todo_id, severity, created_at DESC);

CREATE INDEX idx_todo_archived_at ON public.todo USING btree (archived_at DESC) WHERE (archived_at IS NOT NULL);

CREATE INDEX idx_todo_assignment_todo ON public.todo_assignment USING btree (todo_id);

CREATE INDEX idx_todo_assignment_user ON public.todo_assignment USING btree (user_id);

CREATE INDEX idx_todo_creator ON public.todo USING btree (creator_id);

CREATE INDEX idx_todo_group ON public.todo USING btree (group_id);

CREATE INDEX idx_todo_status ON public.todo USING btree (status);

CREATE INDEX todo_tutorial_run_id_idx ON public.todo USING btree (tutorial_run_id);

CREATE POLICY service_role_all ON public.todo TO service_role USING (true);

CREATE POLICY service_role_all ON public.todo_activity TO service_role USING (true);

CREATE POLICY service_role_all ON public.todo_assignment TO service_role USING (true);
