ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public."user"
  DROP CONSTRAINT IF EXISTS user_single_primary_media_check;
ALTER TABLE public."user"
  ADD CONSTRAINT user_single_primary_media_check
  CHECK (avatar IS NULL OR video_url IS NULL);
