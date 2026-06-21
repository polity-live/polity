ALTER TABLE public.statement
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS is_story BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.statement
SET media_type = CASE
  WHEN NULLIF(BTRIM(COALESCE(video_url, '')), '') IS NOT NULL THEN 'video'
  WHEN NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NOT NULL THEN 'image'
  ELSE 'text'
END
WHERE media_type IS NULL OR media_type NOT IN ('text', 'image', 'video');

ALTER TABLE public.statement
  ADD CONSTRAINT statement_media_type_check
    CHECK (media_type IN ('text', 'image', 'video')) NOT VALID,
  ADD CONSTRAINT statement_single_primary_media_check
    CHECK (image_url IS NULL OR video_url IS NULL) NOT VALID,
  ADD CONSTRAINT statement_has_content_check
    CHECK (
      NULLIF(BTRIM(COALESCE(title, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(text, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(video_url, '')), '') IS NOT NULL
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_statement_expires
  ON public.statement (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_statement_story_created
  ON public.statement (is_story, created_at DESC);
