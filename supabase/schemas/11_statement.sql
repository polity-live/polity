-- =============================================================================
-- 11_statement.sql — User statements (Reddit-style short posts)
-- =============================================================================

-- Statement table
CREATE TABLE IF NOT EXISTS public.statement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  title TEXT,
  text TEXT,
  image_url TEXT,
  video_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'text',
  is_story BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  visibility TEXT NOT NULL DEFAULT 'public',
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT statement_media_type_check CHECK (media_type IN ('text', 'image', 'video')),
  CONSTRAINT statement_single_primary_media_check CHECK (image_url IS NULL OR video_url IS NULL),
  CONSTRAINT statement_has_content_check CHECK (
    NULLIF(BTRIM(COALESCE(title, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(text, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(video_url, '')), '') IS NOT NULL
  )
);

CREATE INDEX idx_statement_user ON public.statement (user_id);
CREATE INDEX idx_statement_group ON public.statement (group_id);
CREATE INDEX idx_statement_expires ON public.statement (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_statement_story_created ON public.statement (is_story, created_at DESC);
CREATE INDEX idx_zero_statement_user_created_id
  ON public.statement (user_id, created_at DESC, id DESC);
CREATE INDEX idx_zero_statement_group_created_id
  ON public.statement (group_id, created_at DESC, id DESC);

ALTER TABLE public.statement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.statement FOR ALL TO service_role USING (true);

-- Statement survey table (polls attached to statements)
CREATE TABLE IF NOT EXISTS public.statement_survey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.statement (id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (statement_id)
);

CREATE INDEX idx_statement_survey_statement ON public.statement_survey (statement_id);

ALTER TABLE public.statement_survey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.statement_survey FOR ALL TO service_role USING (true);

-- Statement survey option table
CREATE TABLE IF NOT EXISTS public.statement_survey_option (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.statement_survey (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_statement_survey_option_survey ON public.statement_survey_option (survey_id);

ALTER TABLE public.statement_survey_option ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.statement_survey_option FOR ALL TO service_role USING (true);

-- Statement survey vote table
CREATE TABLE IF NOT EXISTS public.statement_survey_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES public.statement_survey_option (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (option_id, user_id)
);

CREATE INDEX idx_statement_survey_vote_option ON public.statement_survey_vote (option_id);
CREATE INDEX idx_statement_survey_vote_user ON public.statement_survey_vote (user_id);

ALTER TABLE public.statement_survey_vote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.statement_survey_vote FOR ALL TO service_role USING (true);

-- Statement support vote table
CREATE TABLE IF NOT EXISTS public.statement_support_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.statement (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  vote INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_statement_support_vote_statement ON public.statement_support_vote (statement_id);
CREATE INDEX idx_statement_support_vote_user ON public.statement_support_vote (user_id);

ALTER TABLE public.statement_support_vote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.statement_support_vote FOR ALL TO service_role USING (true);
