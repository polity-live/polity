-- 21_common.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.amendment_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_hashtag_amendment_id_hashtag_id_key UNIQUE (amendment_id, hashtag_id),
    CONSTRAINT amendment_hashtag_pkey PRIMARY KEY (id)
);

CREATE TABLE public.blog_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blog_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_hashtag_blog_id_hashtag_id_key UNIQUE (blog_id, hashtag_id),
    CONSTRAINT blog_hashtag_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_hashtag_event_id_hashtag_id_key UNIQUE (event_id, hashtag_id),
    CONSTRAINT event_hashtag_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_hashtag_group_id_hashtag_id_key UNIQUE (group_id, hashtag_id),
    CONSTRAINT group_hashtag_pkey PRIMARY KEY (id)
);

CREATE TABLE public.hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hashtag_pkey PRIMARY KEY (id)
);

CREATE TABLE public.link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text,
    url text,
    user_id uuid,
    group_id uuid,
    event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT link_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id uuid,
    entity_type text,
    reaction_type text,
    user_id uuid NOT NULL,
    timeline_event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reaction_pkey PRIMARY KEY (id)
);

CREATE TABLE public.statement_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_hashtag_pkey PRIMARY KEY (id),
    CONSTRAINT statement_hashtag_statement_id_hashtag_id_key UNIQUE (statement_id, hashtag_id)
);

CREATE TABLE public.timeline_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text,
    entity_type text,
    entity_id uuid,
    title text,
    description text,
    metadata jsonb,
    image_url text,
    video_url text,
    video_thumbnail_url text,
    content_type text,
    tags jsonb,
    stats jsonb,
    vote_status text,
    election_status text,
    ends_at timestamp with time zone,
    user_id uuid,
    group_id uuid,
    amendment_id uuid,
    event_id uuid,
    todo_id uuid,
    blog_id uuid,
    statement_id uuid,
    actor_id uuid,
    election_id uuid,
    amendment_vote_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timeline_event_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_hashtag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    hashtag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_hashtag_pkey PRIMARY KEY (id),
    CONSTRAINT user_hashtag_user_id_hashtag_id_key UNIQUE (user_id, hashtag_id)
);

ALTER TABLE public.amendment_hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.blog_hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.link ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reaction ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.statement_hashtag ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.timeline_event ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_hashtag ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_amendment_hashtag_amendment ON public.amendment_hashtag USING btree (amendment_id);

CREATE INDEX idx_amendment_hashtag_hashtag ON public.amendment_hashtag USING btree (hashtag_id);

CREATE INDEX idx_blog_hashtag_blog ON public.blog_hashtag USING btree (blog_id);

CREATE INDEX idx_blog_hashtag_hashtag ON public.blog_hashtag USING btree (hashtag_id);

CREATE INDEX idx_event_hashtag_event ON public.event_hashtag USING btree (event_id);

CREATE INDEX idx_event_hashtag_hashtag ON public.event_hashtag USING btree (hashtag_id);

CREATE INDEX idx_group_hashtag_group ON public.group_hashtag USING btree (group_id);

CREATE INDEX idx_group_hashtag_hashtag ON public.group_hashtag USING btree (hashtag_id);

CREATE UNIQUE INDEX idx_hashtag_tag ON public.hashtag USING btree (tag);

CREATE INDEX idx_link_event ON public.link USING btree (event_id);

CREATE INDEX idx_link_group ON public.link USING btree (group_id);

CREATE INDEX idx_link_user ON public.link USING btree (user_id);

CREATE INDEX idx_reaction_entity ON public.reaction USING btree (entity_type, entity_id);

CREATE INDEX idx_reaction_timeline ON public.reaction USING btree (timeline_event_id);

CREATE INDEX idx_reaction_user ON public.reaction USING btree (user_id);

CREATE INDEX idx_statement_hashtag_hashtag ON public.statement_hashtag USING btree (hashtag_id);

CREATE INDEX idx_statement_hashtag_statement ON public.statement_hashtag USING btree (statement_id);

CREATE INDEX idx_timeline_event_created ON public.timeline_event USING btree (created_at);

CREATE INDEX idx_timeline_event_entity ON public.timeline_event USING btree (entity_type, entity_id);

CREATE INDEX idx_timeline_event_group ON public.timeline_event USING btree (group_id);

CREATE INDEX idx_timeline_event_user ON public.timeline_event USING btree (user_id);

CREATE INDEX idx_user_hashtag_hashtag ON public.user_hashtag USING btree (hashtag_id);

CREATE INDEX idx_user_hashtag_user ON public.user_hashtag USING btree (user_id);

CREATE INDEX idx_zero_user_hashtag_user_created_id ON public.user_hashtag USING btree (user_id, created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.amendment_hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.blog_hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.link TO service_role USING (true);

CREATE POLICY service_role_all ON public.reaction TO service_role USING (true);

CREATE POLICY service_role_all ON public.statement_hashtag TO service_role USING (true);

CREATE POLICY service_role_all ON public.timeline_event TO service_role USING (true);

CREATE POLICY service_role_all ON public.user_hashtag TO service_role USING (true);
