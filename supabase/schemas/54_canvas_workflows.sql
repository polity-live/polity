-- 54_canvas_workflows.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.canvas_comment (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    proposal_id uuid,
    author_id uuid NOT NULL,
    element_id text,
    body text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT canvas_comment_body_check CHECK (((length(body) >= 1) AND (length(body) <= 10000))),
    CONSTRAINT canvas_comment_pkey PRIMARY KEY (id)
);

CREATE TABLE public.canvas_control (
    project_id uuid NOT NULL,
    phase text DEFAULT 'edit'::text NOT NULL,
    generation uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT canvas_control_phase_check CHECK ((phase = ANY (ARRAY['edit'::text, 'view'::text, 'suggest_internal'::text, 'vote_internal'::text]))),
    CONSTRAINT canvas_control_pkey PRIMARY KEY (project_id)
);

CREATE TABLE public.canvas_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    revision integer NOT NULL,
    generation uuid NOT NULL,
    document jsonb NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT canvas_history_pkey PRIMARY KEY (id),
    CONSTRAINT canvas_history_project_id_revision_key UNIQUE (project_id, revision)
);

CREATE TABLE public.canvas_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT canvas_library_pkey PRIMARY KEY (id)
);

CREATE TABLE public.canvas_proposal (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    shared_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    title text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    base_document jsonb NOT NULL,
    base_revision integer NOT NULL,
    base_generation uuid NOT NULL,
    document jsonb NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    state text DEFAULT 'draft'::text NOT NULL,
    changes jsonb,
    checksum text,
    decision text,
    application text DEFAULT 'pending'::text NOT NULL,
    conflicts jsonb DEFAULT '[]'::jsonb NOT NULL,
    electorate uuid[],
    deadline bigint,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    resolves_id uuid,
    origin text DEFAULT 'human'::text NOT NULL,
    ai_mode text,
    ai_status text DEFAULT 'ready'::text NOT NULL,
    ai_request_key text,
    ai_sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT canvas_proposal_ai_mode_check CHECK ((ai_mode = ANY (ARRAY['template'::text, 'free'::text]))),
    CONSTRAINT canvas_proposal_ai_status_check CHECK ((ai_status = ANY (ARRAY['generating'::text, 'ready'::text]))),
    CONSTRAINT canvas_proposal_application_check CHECK ((application = ANY (ARRAY['pending'::text, 'applied'::text, 'conflict'::text, 'not_applicable'::text, 'superseded'::text]))),
    CONSTRAINT canvas_proposal_decision_check CHECK ((decision = ANY (ARRAY['accepted'::text, 'rejected'::text]))),
    CONSTRAINT canvas_proposal_origin_check CHECK ((origin = ANY (ARRAY['human'::text, 'ai'::text]))),
    CONSTRAINT canvas_proposal_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'submitted'::text, 'voting'::text, 'closed'::text, 'withdrawn'::text]))),
    CONSTRAINT canvas_proposal_pkey PRIMARY KEY (id)
);

CREATE TABLE public.canvas_receipt (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    input_hash text NOT NULL,
    result jsonb NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT canvas_receipt_pkey PRIMARY KEY (id)
);

CREATE TABLE public.canvas_vote (
    proposal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    choice text NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT canvas_vote_choice_check CHECK ((choice = ANY (ARRAY['accept'::text, 'reject'::text, 'abstain'::text]))),
    CONSTRAINT canvas_vote_pkey PRIMARY KEY (proposal_id, user_id)
);

ALTER TABLE public.canvas_comment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_control ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_library ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_proposal ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_receipt ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canvas_vote ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.canvas_manage(actor uuid, pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT coalesce((SELECT CASE WHEN p.event_id IS NOT NULL THEN event_studio_can_manage(actor,p.event_id)
 ELSE canvas_manage_without_events(actor,pid) END FROM studio_project p WHERE p.id=pid),false);
$$;

CREATE FUNCTION public.canvas_manage_without_events(actor uuid, pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
   ((p.group_id IS NULL AND p.owner_id=actor) OR
    (p.group_id IS NOT NULL AND (p.owner_id=actor OR public.studio_group_access(actor,p.group_id,true)))));
$$;

CREATE FUNCTION public.canvas_proposal_access(actor uuid, wid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.canvas_proposal w
 JOIN public.studio_project p ON p.id=w.project_id
 WHERE w.id=wid AND public.studio_collaboration_access(actor,w.project_id)
 AND (w.checksum IS NOT NULL OR w.owner_id=actor OR actor=ANY(w.shared_ids)
   OR (w.origin='ai' AND p.group_id IS NULL AND public.canvas_manage(actor,w.project_id))));
$$;

CREATE FUNCTION public.canvas_record_revision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 DECLARE g uuid; phase_name text;
 BEGIN
 INSERT INTO canvas_control(project_id) VALUES(NEW.project_id) ON CONFLICT DO NOTHING;
 SELECT generation,phase INTO g,phase_name FROM canvas_control WHERE project_id=NEW.project_id FOR UPDATE;
 IF TG_OP='UPDATE' AND NEW.document IS DISTINCT FROM OLD.document AND phase_name<>'edit' AND current_setting('polity.canvas_command',true) IS DISTINCT FROM NEW.project_id::text THEN
 RAISE EXCEPTION 'Canvas content is locked by its procedure'; END IF;
 INSERT INTO canvas_history(project_id,revision,generation,document,created_at) VALUES(NEW.project_id,NEW.content_revision,g,NEW.document,NEW.updated_at) ON CONFLICT DO NOTHING;
 RETURN NEW;
 END $$;

CREATE UNIQUE INDEX canvas_proposal_ai_request_key ON public.canvas_proposal USING btree (ai_request_key) WHERE (ai_request_key IS NOT NULL);

CREATE INDEX canvas_proposal_project ON public.canvas_proposal USING btree (project_id, created_at);
