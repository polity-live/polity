-- 29_pql_filter.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.pql_filter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid,
    storage_key text NOT NULL,
    label text NOT NULL,
    query text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pql_filter_pkey PRIMARY KEY (id)
);

ALTER TABLE public.pql_filter ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pql_filter_active_scope ON public.pql_filter USING btree (user_id, storage_key, group_id, is_active);

CREATE INDEX idx_pql_filter_user_scope ON public.pql_filter USING btree (user_id, storage_key, group_id);

CREATE POLICY service_role_all ON public.pql_filter TO service_role USING (true);
