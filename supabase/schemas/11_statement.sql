-- 11_statement.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.statement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid,
    title text,
    text text,
    image_url text,
    video_url text,
    media_type text DEFAULT 'text'::text NOT NULL,
    is_story boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone,
    visibility text DEFAULT 'public'::text NOT NULL,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT statement_has_content_check CHECK (((NULLIF(btrim(COALESCE(title, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(text, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(image_url, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(video_url, ''::text)), ''::text) IS NOT NULL))),
    CONSTRAINT statement_media_type_check CHECK ((media_type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text]))),
    CONSTRAINT statement_single_primary_media_check CHECK (((image_url IS NULL) OR (video_url IS NULL))),
    CONSTRAINT statement_pkey PRIMARY KEY (id)
);

CREATE TABLE public.statement_support_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_support_vote_pkey PRIMARY KEY (id)
);

CREATE TABLE public.statement_survey (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_id uuid NOT NULL,
    question text NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_survey_pkey PRIMARY KEY (id),
    CONSTRAINT statement_survey_statement_id_key UNIQUE (statement_id)
);

CREATE TABLE public.statement_survey_option (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    label text NOT NULL,
    vote_count integer DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_survey_option_pkey PRIMARY KEY (id)
);

CREATE TABLE public.statement_survey_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_survey_vote_option_id_user_id_key UNIQUE (option_id, user_id),
    CONSTRAINT statement_survey_vote_pkey PRIMARY KEY (id)
);

ALTER TABLE public.statement ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.statement_support_vote ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.statement_survey ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.statement_survey_option ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.statement_survey_vote ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_statement_expires ON public.statement USING btree (expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX idx_statement_group ON public.statement USING btree (group_id);

CREATE INDEX idx_statement_story_created ON public.statement USING btree (is_story, created_at DESC);

CREATE INDEX idx_statement_support_vote_statement ON public.statement_support_vote USING btree (statement_id);

CREATE INDEX idx_statement_support_vote_user ON public.statement_support_vote USING btree (user_id);

CREATE INDEX idx_statement_survey_option_survey ON public.statement_survey_option USING btree (survey_id);

CREATE INDEX idx_statement_survey_statement ON public.statement_survey USING btree (statement_id);

CREATE INDEX idx_statement_survey_vote_option ON public.statement_survey_vote USING btree (option_id);

CREATE INDEX idx_statement_survey_vote_user ON public.statement_survey_vote USING btree (user_id);

CREATE INDEX idx_statement_user ON public.statement USING btree (user_id);

CREATE INDEX idx_zero_statement_group_created_id ON public.statement USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_statement_user_created_id ON public.statement USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX statement_tutorial_run_id_idx ON public.statement USING btree (tutorial_run_id);

CREATE POLICY service_role_all ON public.statement TO service_role USING (true);

CREATE POLICY service_role_all ON public.statement_support_vote TO service_role USING (true);

CREATE POLICY service_role_all ON public.statement_survey TO service_role USING (true);

CREATE POLICY service_role_all ON public.statement_survey_option TO service_role USING (true);

CREATE POLICY service_role_all ON public.statement_survey_vote TO service_role USING (true);
