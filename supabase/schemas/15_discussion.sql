-- 15_discussion.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.comment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comment_pkey PRIMARY KEY (id)
);

CREATE TABLE public.comment_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comment_vote_pkey PRIMARY KEY (id)
);

CREATE TABLE public.thread (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    amendment_id uuid,
    statement_id uuid,
    blog_id uuid,
    todo_id uuid,
    user_id uuid NOT NULL,
    content text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp with time zone,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    "position" jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_pkey PRIMARY KEY (id)
);

CREATE TABLE public.thread_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_vote_pkey PRIMARY KEY (id)
);

ALTER TABLE public.comment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comment_vote ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.thread ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.thread_vote ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.ensure_todo_discussion_thread() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.thread (
    id,
    todo_id,
    user_id,
    content,
    status,
    upvotes,
    downvotes,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.creator_id,
    NULL,
    'open',
    0,
    0,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (todo_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE INDEX idx_comment_parent ON public.comment USING btree (parent_id);

CREATE INDEX idx_comment_thread ON public.comment USING btree (thread_id);

CREATE INDEX idx_comment_user ON public.comment USING btree (user_id);

CREATE INDEX idx_comment_vote_comment ON public.comment_vote USING btree (comment_id);

CREATE INDEX idx_comment_vote_user ON public.comment_vote USING btree (user_id);

CREATE INDEX idx_thread_blog ON public.thread USING btree (blog_id);

CREATE INDEX idx_thread_document ON public.thread USING btree (document_id);

CREATE INDEX idx_thread_statement ON public.thread USING btree (statement_id);

CREATE UNIQUE INDEX idx_thread_todo_unique ON public.thread USING btree (todo_id);

CREATE INDEX idx_thread_user ON public.thread USING btree (user_id);

CREATE INDEX idx_thread_vote_thread ON public.thread_vote USING btree (thread_id);

CREATE INDEX idx_thread_vote_user ON public.thread_vote USING btree (user_id);

CREATE INDEX idx_zero_thread_document_created_id ON public.thread USING btree (document_id, created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.comment TO service_role USING (true);

CREATE POLICY service_role_all ON public.comment_vote TO service_role USING (true);

CREATE POLICY service_role_all ON public.thread TO service_role USING (true);

CREATE POLICY service_role_all ON public.thread_vote TO service_role USING (true);
