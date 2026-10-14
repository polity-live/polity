-- 76_group_email_invitations.sql: canonical current definitions; historical upgrades are not replayed.

CREATE SCHEMA group_invitations;

CREATE TABLE group_invitations.group_email_invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    invited_by_id uuid NOT NULL,
    token_hash text NOT NULL,
    language text NOT NULL,
    role_count integer NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    accepted_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_email_invitation_email_check CHECK ((email = lower(btrim(email)))),
    CONSTRAINT group_email_invitation_first_name_check CHECK (((first_name IS NULL) OR ((first_name = btrim(first_name)) AND ((char_length(first_name) >= 1) AND (char_length(first_name) <= 100))))),
    CONSTRAINT group_email_invitation_language_check CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))),
    CONSTRAINT group_email_invitation_last_name_check CHECK (((last_name IS NULL) OR ((last_name = btrim(last_name)) AND ((char_length(last_name) >= 1) AND (char_length(last_name) <= 100))))),
    CONSTRAINT group_email_invitation_role_count_check CHECK ((role_count > 0)),
    CONSTRAINT group_email_invitation_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text]))),
    CONSTRAINT group_email_invitation_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT group_email_invitation_pkey PRIMARY KEY (id),
    CONSTRAINT group_email_invitation_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE group_invitations.group_email_invitation_batch (
    id uuid NOT NULL,
    requested_by_id uuid NOT NULL,
    group_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    fingerprint text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_email_invitation_batch_pkey PRIMARY KEY (id),
    CONSTRAINT group_email_invitation_batch_requested_by_id_idempotency_ke_key UNIQUE (requested_by_id, idempotency_key)
);

CREATE TABLE group_invitations.group_email_invitation_delivery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invitation_id uuid,
    batch_id uuid,
    resend_email_id text,
    status text DEFAULT 'sending'::text NOT NULL,
    error_code text,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    event_at timestamp with time zone,
    CONSTRAINT group_email_invitation_delivery_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'delivered'::text, 'bounced'::text, 'complained'::text, 'failed'::text, 'unknown'::text]))),
    CONSTRAINT group_email_invitation_delivery_batch_id_invitation_id_key UNIQUE (batch_id, invitation_id),
    CONSTRAINT group_email_invitation_delivery_pkey PRIMARY KEY (id),
    CONSTRAINT group_email_invitation_delivery_resend_email_id_key UNIQUE (resend_email_id)
);

CREATE TABLE group_invitations.group_email_invitation_role (
    invitation_id uuid NOT NULL,
    role_id uuid NOT NULL,
    CONSTRAINT group_email_invitation_role_pkey PRIMARY KEY (invitation_id, role_id)
);

ALTER TABLE group_invitations.group_email_invitation ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_invitations.group_email_invitation_batch ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_invitations.group_email_invitation_delivery ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_invitations.group_email_invitation_role ENABLE ROW LEVEL SECURITY;

CREATE INDEX group_email_invitation_delivery_budget ON group_invitations.group_email_invitation_delivery USING btree (attempted_at);

CREATE INDEX group_email_invitation_delivery_invitation ON group_invitations.group_email_invitation_delivery USING btree (invitation_id, attempted_at DESC);

CREATE UNIQUE INDEX group_email_invitation_pending ON group_invitations.group_email_invitation USING btree (group_id, email) WHERE (state = 'pending'::text);
