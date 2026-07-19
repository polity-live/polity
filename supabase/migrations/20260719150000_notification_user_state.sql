-- Add a canonical, per-user inbox state while retaining the legacy read model
-- for one rolling-client compatibility window.

ALTER TABLE public.notification
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL;

UPDATE public.notification
SET updated_at = created_at
WHERE updated_at IS DISTINCT FROM created_at;

-- A historical, unused builder stored the sender as recipient for shared rows.
UPDATE public.notification
SET recipient_id = NULL
WHERE recipient_entity_id IS NOT NULL
  AND recipient_id = sender_id;

-- Normalize the polymorphic target columns emitted by older builders.
UPDATE public.notification
SET
  recipient_entity_type = CASE
    WHEN recipient_id IS NOT NULL THEN NULL
    ELSE COALESCE(
      recipient_entity_type,
      CASE
        WHEN recipient_group_id IS NOT NULL THEN 'group'
        WHEN recipient_event_id IS NOT NULL THEN 'event'
        WHEN recipient_amendment_id IS NOT NULL THEN 'amendment'
        WHEN recipient_blog_id IS NOT NULL THEN 'blog'
      END
    )
  END,
  recipient_entity_id = CASE
    WHEN recipient_id IS NOT NULL THEN NULL
    ELSE COALESCE(
      recipient_entity_id,
      recipient_group_id,
      recipient_event_id,
      recipient_amendment_id,
      recipient_blog_id
    )
  END;

UPDATE public.notification
SET
  recipient_group_id = CASE
    WHEN recipient_entity_type = 'group' THEN recipient_entity_id
    ELSE NULL
  END,
  recipient_event_id = CASE
    WHEN recipient_entity_type = 'event' THEN recipient_entity_id
    ELSE NULL
  END,
  recipient_amendment_id = CASE
    WHEN recipient_entity_type = 'amendment' THEN recipient_entity_id
    ELSE NULL
  END,
  recipient_blog_id = CASE
    WHEN recipient_entity_type = 'blog' THEN recipient_entity_id
    ELSE NULL
  END;

CREATE TABLE IF NOT EXISTS public.notification_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notification (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_user_state_per_user_key UNIQUE (notification_id, user_id),
  CONSTRAINT notification_user_state_order CHECK (purged_at IS NULL OR dismissed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notification_user_state_user
ON public.notification_user_state (user_id, dismissed_at, purged_at, read_at);
CREATE INDEX IF NOT EXISTS idx_notification_user_state_notification
ON public.notification_user_state (notification_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notification_active_created
ON public.notification (created_at DESC)
WHERE deleted_at IS NULL;

ALTER TABLE public.notification_user_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.notification_user_state;
CREATE POLICY "service_role_all" ON public.notification_user_state
FOR ALL TO service_role USING (true);

-- Backfill personal reads. The legacy boolean has no read timestamp, so the
-- notification timestamp is the safest deterministic approximation.
INSERT INTO public.notification_user_state (
  id,
  notification_id,
  user_id,
  read_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  notification.id,
  notification.recipient_id,
  notification.created_at,
  notification.created_at,
  now()
FROM public.notification
WHERE notification.recipient_id IS NOT NULL
  AND notification.is_read = true
ON CONFLICT (notification_id, user_id) DO UPDATE
SET
  read_at = COALESCE(public.notification_user_state.read_at, EXCLUDED.read_at),
  updated_at = now();

-- Backfill entity reads and merge historical duplicates by user.
INSERT INTO public.notification_user_state (
  id,
  notification_id,
  user_id,
  read_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  notification_read.notification_id,
  notification_read.read_by_user_id,
  MIN(notification_read.read_at),
  MIN(notification_read.read_at),
  now()
FROM public.notification_read
WHERE notification_read.read_by_user_id IS NOT NULL
GROUP BY notification_read.notification_id, notification_read.read_by_user_id
ON CONFLICT (notification_id, user_id) DO UPDATE
SET
  read_at = COALESCE(public.notification_user_state.read_at, EXCLUDED.read_at),
  updated_at = now();

-- Enforce the canonical target shape for new/updated rows immediately. The
-- constraints remain NOT VALID until the compatibility cleanup migration so
-- unexpected historical rows cannot block this additive rollout.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_recipient_target_shape'
  ) THEN
    ALTER TABLE public.notification
      ADD CONSTRAINT notification_recipient_target_shape CHECK (
        (
          recipient_id IS NOT NULL
          AND recipient_entity_type IS NULL
          AND recipient_entity_id IS NULL
          AND recipient_group_id IS NULL
          AND recipient_event_id IS NULL
          AND recipient_amendment_id IS NULL
          AND recipient_blog_id IS NULL
        )
        OR
        (
          recipient_id IS NULL
          AND recipient_entity_type IN ('group', 'event', 'amendment', 'blog')
          AND recipient_entity_id IS NOT NULL
          AND num_nonnulls(
            recipient_group_id,
            recipient_event_id,
            recipient_amendment_id,
            recipient_blog_id
          ) = 1
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_recipient_target_consistency'
  ) THEN
    ALTER TABLE public.notification
      ADD CONSTRAINT notification_recipient_target_consistency CHECK (
        recipient_entity_type IS NULL
        OR (recipient_entity_type = 'group' AND recipient_group_id = recipient_entity_id)
        OR (recipient_entity_type = 'event' AND recipient_event_id = recipient_entity_id)
        OR (recipient_entity_type = 'amendment' AND recipient_amendment_id = recipient_entity_id)
        OR (recipient_entity_type = 'blog' AND recipient_blog_id = recipient_entity_id)
      ) NOT VALID;
  END IF;
END $$;

-- Called by the deployment scheduler. Entity rows are only physically removed
-- after a manager soft-delete; active shared history is retained.
CREATE OR REPLACE FUNCTION public.purge_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed_count INTEGER;
BEGIN
  DELETE FROM public.notification
  WHERE deleted_at < now() - INTERVAL '30 days'
     OR (
       recipient_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.notification_user_state state
         WHERE state.notification_id = notification.id
           AND state.user_id = notification.recipient_id
           AND state.purged_at < now() - INTERVAL '30 days'
       )
     );
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;
