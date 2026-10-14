-- 07_blog.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.blog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    description text,
    content jsonb,
    date text,
    image_url text,
    video_url text,
    visibility text DEFAULT 'public'::text NOT NULL,
    subscriber_count integer DEFAULT 0 NOT NULL,
    supporter_count integer DEFAULT 0 NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    editing_mode text,
    discussions jsonb,
    group_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT blog_single_primary_media_check CHECK (((image_url IS NULL) OR (video_url IS NULL))),
    CONSTRAINT blog_pkey PRIMARY KEY (id)
);

CREATE TABLE public.blog_blogger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blog_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid,
    status text,
    visibility text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_blogger_pkey PRIMARY KEY (id)
);

CREATE TABLE public.blog_support_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blog_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_support_vote_pkey PRIMARY KEY (id)
);

ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.blog_blogger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.blog_support_vote ENABLE ROW LEVEL SECURITY;

CREATE INDEX blog_tutorial_run_id_idx ON public.blog USING btree (tutorial_run_id);

CREATE INDEX idx_blog_blogger_blog ON public.blog_blogger USING btree (blog_id);

CREATE INDEX idx_blog_blogger_user ON public.blog_blogger USING btree (user_id);

CREATE INDEX idx_blog_group ON public.blog USING btree (group_id);

CREATE INDEX idx_blog_support_vote_blog ON public.blog_support_vote USING btree (blog_id);

CREATE INDEX idx_blog_support_vote_user ON public.blog_support_vote USING btree (user_id);

CREATE INDEX idx_zero_blog_blogger_user_blog ON public.blog_blogger USING btree (user_id, blog_id);

CREATE INDEX idx_zero_blog_blogger_user_status_blog ON public.blog_blogger USING btree (user_id, status, blog_id);

CREATE INDEX idx_zero_blog_created_id ON public.blog USING btree (created_at DESC, id DESC);

CREATE INDEX idx_zero_blog_group_created_id ON public.blog USING btree (group_id, created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.blog TO service_role USING (true);

CREATE POLICY service_role_all ON public.blog_blogger TO service_role USING (true);

CREATE POLICY service_role_all ON public.blog_support_vote TO service_role USING (true);
