-- 01_user.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path text,
    url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_pkey PRIMARY KEY (id)
);

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    contact_email text,
    handle text,
    first_name text,
    last_name text,
    bio text,
    gender text,
    about jsonb,
    avatar text,
    video_url text,
    x text,
    youtube text,
    linkedin text,
    website text,
    whatsapp text,
    instagram text,
    twitter text,
    facebook text,
    snapchat text,
    tiktok text,
    country text,
    region text,
    post_code text,
    city text,
    street text,
    house_number text,
    latitude double precision,
    longitude double precision,
    location_kind text,
    location_place_id text,
    location_boundary_source text,
    location_geometry jsonb,
    location_bounds jsonb,
    visibility text DEFAULT 'public'::text NOT NULL,
    subscriber_count integer DEFAULT 0 NOT NULL,
    amendment_count integer DEFAULT 0 NOT NULL,
    group_count integer DEFAULT 0 NOT NULL,
    tutorial_step integer,
    assistant_introduction boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT user_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'diverse'::text]))),
    CONSTRAINT user_single_primary_media_check CHECK (((avatar IS NULL) OR (video_url IS NULL))),
    CONSTRAINT user_pkey PRIMARY KEY (id)
);

ALTER TABLE public.file ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_email ON public."user" USING btree (email);

CREATE UNIQUE INDEX idx_user_handle ON public."user" USING btree (handle);

CREATE INDEX user_tutorial_run_id_idx ON public."user" USING btree (tutorial_run_id);

CREATE POLICY service_role_all ON public.file TO service_role USING (true);

CREATE POLICY service_role_all ON public."user" TO service_role USING (true);
