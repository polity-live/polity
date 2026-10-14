-- Private server-managed invitations; deliberately excluded from Zero replication.
CREATE SCHEMA group_invitations;
REVOKE ALL ON SCHEMA group_invitations FROM PUBLIC;
GRANT USAGE ON SCHEMA group_invitations TO service_role;
CREATE TABLE group_invitations.group_email_invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public."group"(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(btrim(email))),
  invited_by_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  language TEXT NOT NULL CHECK (language IN ('de', 'en')),
  role_count INTEGER NOT NULL CHECK (role_count > 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  accepted_by_id UUID REFERENCES public."user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX group_email_invitation_pending ON group_invitations.group_email_invitation(group_id, email) WHERE state = 'pending';
CREATE TABLE group_invitations.group_email_invitation_role (
  invitation_id UUID NOT NULL REFERENCES group_invitations.group_email_invitation(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role(id) ON DELETE CASCADE,
  PRIMARY KEY (invitation_id, role_id)
);
CREATE TABLE group_invitations.group_email_invitation_batch (
  id UUID PRIMARY KEY,
  requested_by_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public."group"(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requested_by_id, idempotency_key)
);
CREATE TABLE group_invitations.group_email_invitation_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Retain the anonymous budget ledger when a group or inviter is deleted.
  invitation_id UUID REFERENCES group_invitations.group_email_invitation(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES group_invitations.group_email_invitation_batch(id) ON DELETE SET NULL,
  resend_email_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'unknown')),
  error_code TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_at TIMESTAMPTZ,
  UNIQUE (batch_id, invitation_id)
);
CREATE INDEX group_email_invitation_delivery_budget ON group_invitations.group_email_invitation_delivery(attempted_at);
CREATE INDEX group_email_invitation_delivery_invitation ON group_invitations.group_email_invitation_delivery(invitation_id, attempted_at DESC);
ALTER TABLE group_invitations.group_email_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations.group_email_invitation_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations.group_email_invitation_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations.group_email_invitation_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON group_invitations.group_email_invitation, group_invitations.group_email_invitation_role, group_invitations.group_email_invitation_batch, group_invitations.group_email_invitation_delivery FROM anon, authenticated;
GRANT ALL ON group_invitations.group_email_invitation, group_invitations.group_email_invitation_role, group_invitations.group_email_invitation_batch, group_invitations.group_email_invitation_delivery TO service_role;
