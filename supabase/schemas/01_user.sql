-- =============================================================================
-- 01_user.sql — User accounts, files, and user stats
-- Follow table moved to 19_network.sql
-- =============================================================================

-- User table (main user profile)
CREATE TABLE public."user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  contact_email TEXT,
  handle TEXT,
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'diverse')),
  about JSONB,
  avatar TEXT,
  video_url TEXT,
  x TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  whatsapp TEXT,
  instagram TEXT,
  twitter TEXT,
  facebook TEXT,
  snapchat TEXT,
  tiktok TEXT,
  country TEXT,
  region TEXT,
  post_code TEXT,
  city TEXT,
  street TEXT,
  house_number TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_kind TEXT,
  location_place_id TEXT,
  location_boundary_source TEXT,
  location_geometry JSONB,
  location_bounds JSONB,
  visibility TEXT NOT NULL DEFAULT 'public',
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  amendment_count INTEGER NOT NULL DEFAULT 0,
  group_count INTEGER NOT NULL DEFAULT 0,
  tutorial_step INTEGER,
  assistant_introduction BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_single_primary_media_check CHECK (avatar IS NULL OR video_url IS NULL)
);

CREATE UNIQUE INDEX idx_user_handle ON public."user" (handle);
CREATE INDEX idx_user_email ON public."user" (email);

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."user" FOR ALL TO service_role USING (true);

-- File table
CREATE TABLE public.file (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.file ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.file FOR ALL TO service_role USING (true);
