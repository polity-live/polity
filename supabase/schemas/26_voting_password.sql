-- 26_voting_password.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.voting_password (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT voting_password_pkey PRIMARY KEY (id),
    CONSTRAINT voting_password_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.voting_password ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_voting_password_user ON public.voting_password USING btree (user_id);

CREATE POLICY service_role_all ON public.voting_password TO service_role USING (true);
