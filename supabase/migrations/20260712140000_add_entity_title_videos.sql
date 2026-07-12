ALTER TABLE public.amendment ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public."group" ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.event ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.blog ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public.amendment
  DROP CONSTRAINT IF EXISTS amendment_single_primary_media_check;
ALTER TABLE public.amendment
  ADD CONSTRAINT amendment_single_primary_media_check
  CHECK (image_url IS NULL OR video_url IS NULL);

ALTER TABLE public."group"
  DROP CONSTRAINT IF EXISTS group_single_primary_media_check;
ALTER TABLE public."group"
  ADD CONSTRAINT group_single_primary_media_check
  CHECK (image_url IS NULL OR video_url IS NULL);

ALTER TABLE public.event
  DROP CONSTRAINT IF EXISTS event_single_primary_media_check;
ALTER TABLE public.event
  ADD CONSTRAINT event_single_primary_media_check
  CHECK (image_url IS NULL OR video_url IS NULL);

ALTER TABLE public.blog
  DROP CONSTRAINT IF EXISTS blog_single_primary_media_check;
ALTER TABLE public.blog
  ADD CONSTRAINT blog_single_primary_media_check
  CHECK (image_url IS NULL OR video_url IS NULL);
