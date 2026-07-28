-- =============================================================================
-- Local context-fixture staging tables
-- =============================================================================
-- Supabase CLI prepares each seed file as a batch. These relations must exist
-- before seed.local.sql is parsed; seed.local.sql drops them after enrichment.

DROP TABLE IF EXISTS
  public.tmp_context_amendment_profile,
  public.tmp_context_event_profile,
  public.tmp_context_group_profile,
  public.tmp_context_user_profile,
  public.tmp_context_location;

CREATE TABLE public.tmp_context_location (
  seq INTEGER PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  post_code TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  house_number TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  location_url TEXT NOT NULL
);

CREATE TABLE public.tmp_context_user_profile (
  seq INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  handle_slug TEXT NOT NULL,
  gender TEXT NOT NULL,
  role_title TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  bio TEXT NOT NULL
);

CREATE TABLE public.tmp_context_group_profile (
  seq INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description_text TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  contact_slug TEXT NOT NULL,
  subscriber_count INTEGER NOT NULL,
  fallback_member_count INTEGER NOT NULL
);

CREATE TABLE public.tmp_context_event_profile (
  seq INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description_text TEXT NOT NULL,
  event_type TEXT NOT NULL,
  attendance_mode TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  agenda_management TEXT NOT NULL,
  capacity INTEGER NOT NULL
);

CREATE TABLE public.tmp_context_amendment_profile (
  seq INTEGER PRIMARY KEY,
  code_prefix TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL,
  preamble TEXT NOT NULL,
  tag_one TEXT NOT NULL,
  tag_two TEXT NOT NULL,
  tag_three TEXT NOT NULL,
  estimated_cost_minor INTEGER NOT NULL
);
