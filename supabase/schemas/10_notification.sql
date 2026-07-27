-- =============================================================================
-- 10_notification.sql — Notifications, push subscriptions, notification settings
-- =============================================================================

-- Notification table
CREATE TABLE public.notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public."user" (id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  title TEXT,
  message TEXT,
  type TEXT,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_entity_type TEXT,
  on_behalf_of_entity_type TEXT,
  on_behalf_of_entity_id UUID,
  recipient_entity_type TEXT,
  recipient_entity_id UUID,
  related_user_id UUID,
  related_group_id UUID,
  related_amendment_id UUID,
  related_event_id UUID,
  related_blog_id UUID,
  on_behalf_of_group_id UUID,
  on_behalf_of_event_id UUID,
  on_behalf_of_amendment_id UUID,
  on_behalf_of_blog_id UUID,
  recipient_group_id UUID,
  recipient_event_id UUID,
  recipient_amendment_id UUID,
  recipient_blog_id UUID,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  CONSTRAINT notification_recipient_target_shape CHECK (
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
  ),
  CONSTRAINT notification_recipient_target_consistency CHECK (
    recipient_entity_type IS NULL
    OR (recipient_entity_type = 'group' AND recipient_group_id = recipient_entity_id)
    OR (recipient_entity_type = 'event' AND recipient_event_id = recipient_entity_id)
    OR (recipient_entity_type = 'amendment' AND recipient_amendment_id = recipient_entity_id)
    OR (recipient_entity_type = 'blog' AND recipient_blog_id = recipient_entity_id)
  )
);

CREATE INDEX idx_notification_recipient ON public.notification (recipient_id);
CREATE INDEX idx_notification_sender ON public.notification (sender_id);
CREATE INDEX idx_notification_is_read ON public.notification (is_read);
CREATE INDEX idx_notification_recipient_entity ON public.notification (recipient_entity_id, created_at);
CREATE INDEX idx_notification_recipient_group ON public.notification (recipient_group_id, created_at);
CREATE INDEX idx_notification_recipient_event ON public.notification (recipient_event_id, created_at);
CREATE INDEX idx_notification_recipient_amendment ON public.notification (recipient_amendment_id, created_at);
CREATE INDEX idx_notification_recipient_blog ON public.notification (recipient_blog_id, created_at);
CREATE INDEX idx_notification_recipient_read ON public.notification (recipient_id, is_read);
CREATE INDEX idx_notification_category ON public.notification (category);
CREATE INDEX idx_notification_active_created ON public.notification (created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_zero_notification_recipient_created_id_deleted
  ON public.notification (recipient_id, created_at DESC, id DESC, deleted_at);
CREATE INDEX idx_zero_notification_entity_created_id_deleted
  ON public.notification (
    recipient_entity_type,
    recipient_entity_id,
    created_at DESC,
    id DESC,
    deleted_at
  );
CREATE INDEX idx_zero_notification_created_id_deleted
  ON public.notification (created_at DESC, id DESC, deleted_at);

ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.notification FOR ALL TO service_role USING (true);

-- Push subscription table
CREATE TABLE public.push_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  device_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT,
  p256dh TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscription_user ON public.push_subscription (user_id);
CREATE UNIQUE INDEX idx_push_subscription_user_device
ON public.push_subscription (user_id, device_id)
WHERE device_id IS NOT NULL;

ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.push_subscription FOR ALL TO service_role USING (true);

-- Notification setting table
CREATE TABLE public.notification_setting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE UNIQUE,
  group_notifications JSONB,
  event_notifications JSONB,
  amendment_notifications JSONB,
  blog_notifications JSONB,
  todo_notifications JSONB,
  social_notifications JSONB,
  delivery_settings JSONB,
  timeline_settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.notification_setting FOR ALL TO service_role USING (true);

-- Notification read table (entity-level shared read tracking)
CREATE TABLE public.notification_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notification (id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  read_by_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_read_per_user_key UNIQUE (
    notification_id,
    entity_type,
    entity_id,
    read_by_user_id
  )
);

CREATE INDEX idx_notification_read_entity ON public.notification_read (entity_type, entity_id);
CREATE INDEX idx_zero_notification_read_notification_user_id
  ON public.notification_read (notification_id, read_by_user_id, id);

ALTER TABLE public.notification_read ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.notification_read FOR ALL TO service_role USING (true);

-- Canonical per-user notification inbox state
CREATE TABLE public.notification_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notification (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_user_state_per_user_key UNIQUE (notification_id, user_id),
  CONSTRAINT notification_user_state_order CHECK (
    purged_at IS NULL OR dismissed_at IS NOT NULL
  )
);

CREATE INDEX idx_notification_user_state_user
ON public.notification_user_state (user_id, dismissed_at, purged_at, read_at);
CREATE INDEX idx_notification_user_state_notification
ON public.notification_user_state (notification_id, user_id);

ALTER TABLE public.notification_user_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.notification_user_state
FOR ALL TO service_role USING (true);

-- A lightweight parent job is inserted in the same transaction as every
-- notification. Audience expansion and network delivery happen separately.
CREATE TABLE public.push_notification_outbox (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  notification_id UUID NOT NULL UNIQUE
    REFERENCES public.notification (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_notification_outbox_pending
ON public.push_notification_outbox (available_at, id)
WHERE status = 'pending';

ALTER TABLE public.push_notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.push_notification_outbox
FOR ALL TO service_role USING (true);

CREATE TABLE public.push_delivery_outbox (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  notification_job_id BIGINT
    REFERENCES public.push_notification_outbox (id) ON DELETE CASCADE,
  notification_id UUID
    REFERENCES public.notification (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  push_subscription_id UUID
    REFERENCES public.push_subscription (id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'notification'
    CHECK (kind IN ('notification', 'test')),
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_push_delivery_notification_subscription
ON public.push_delivery_outbox (notification_id, push_subscription_id)
WHERE notification_id IS NOT NULL AND push_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX idx_push_delivery_dedupe_subscription
ON public.push_delivery_outbox (dedupe_key, push_subscription_id)
WHERE push_subscription_id IS NOT NULL;
CREATE INDEX idx_push_delivery_outbox_pending
ON public.push_delivery_outbox (available_at, id)
WHERE status = 'pending';
CREATE INDEX idx_push_delivery_outbox_user
ON public.push_delivery_outbox (user_id, created_at DESC);

ALTER TABLE public.push_delivery_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.push_delivery_outbox
FOR ALL TO service_role USING (true);
GRANT ALL ON public.push_notification_outbox TO service_role;
GRANT ALL ON public.push_delivery_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_notification_outbox_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_delivery_outbox_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.push_notification_outbox (notification_id)
  VALUES (NEW.id)
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notification_enqueue_push
AFTER INSERT ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_notification();

-- Keep this resolver aligned with applyNotificationViewAccess() in the Zero
-- notification queries. It snapshots the audience when the parent job expands.
CREATE OR REPLACE FUNCTION public.resolve_notification_recipients(
  target_notification_id UUID
)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT *
    FROM public.notification
    WHERE id = target_notification_id
      AND deleted_at IS NULL
  ),
  candidates AS (
    SELECT recipient_id AS user_id
    FROM target
    WHERE recipient_id IS NOT NULL

    UNION

    SELECT recipient_group.owner_id
    FROM target
    JOIN public."group" recipient_group
      ON recipient_group.id = target.recipient_group_id
    WHERE recipient_group.owner_id IS NOT NULL

    UNION

    SELECT membership.user_id
    FROM target
    JOIN public.group_membership membership
      ON membership.group_id = target.recipient_group_id
     AND membership.status IN ('active', 'member', 'admin')
    JOIN public.group_membership_role membership_role
      ON membership_role.group_membership_id = membership.id
    JOIN public.action_right action_right
      ON action_right.role_id = membership_role.role_id
     AND action_right.resource = 'groupNotifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT guest_access.user_id
    FROM target
    JOIN public.group_guest_access guest_access
      ON guest_access.group_id = target.recipient_group_id
     AND guest_access.status = 'active'
    JOIN public.group_guest_role guest_role
      ON guest_role.group_guest_access_id = guest_access.id
    JOIN public.action_right action_right
      ON action_right.role_id = guest_role.role_id
     AND action_right.resource = 'groupNotifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT participant.user_id
    FROM target
    JOIN public.event_participant participant
      ON participant.event_id = target.recipient_event_id
     AND participant.status IN ('active', 'confirmed', 'member', 'admin')
    JOIN public.event_participant_role participant_role
      ON participant_role.event_participant_id = participant.id
    JOIN public.action_right action_right
      ON action_right.role_id = participant_role.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT amendment.created_by_id
    FROM target
    JOIN public.amendment amendment
      ON amendment.id = target.recipient_amendment_id
    WHERE amendment.created_by_id IS NOT NULL

    UNION

    SELECT collaborator.user_id
    FROM target
    JOIN public.amendment_collaborator collaborator
      ON collaborator.amendment_id = target.recipient_amendment_id
     AND collaborator.status IN ('active', 'collaborator', 'member', 'admin')
    JOIN public.action_right action_right
      ON action_right.role_id = collaborator.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT blogger.user_id
    FROM target
    JOIN public.blog_blogger blogger
      ON blogger.blog_id = target.recipient_blog_id
    JOIN public.action_right action_right
      ON action_right.role_id = blogger.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')
  )
  SELECT DISTINCT candidates.user_id
  FROM candidates
  CROSS JOIN target
  WHERE candidates.user_id IS NOT NULL
    AND candidates.user_id IS DISTINCT FROM target.sender_id;
$$;

CREATE OR REPLACE FUNCTION public.claim_push_notification_jobs(
  job_limit INTEGER DEFAULT 100,
  notification_filter UUID DEFAULT NULL
)
RETURNS SETOF public.push_notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.push_notification_outbox
  SET status = 'pending',
      locked_at = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - INTERVAL '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.push_notification_outbox job
    WHERE job.status = 'pending'
      AND job.available_at <= now()
      AND (notification_filter IS NULL OR job.notification_id = notification_filter)
    ORDER BY job.available_at, job.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(job_limit, 1), 100)
  )
  UPDATE public.push_notification_outbox job
  SET status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.expand_push_notification_job(target_job_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.push_delivery_outbox (
    notification_job_id,
    notification_id,
    user_id,
    push_subscription_id,
    dedupe_key,
    payload
  )
  SELECT
    job.id,
    notification.id,
    recipient.user_id,
    subscription.id,
    md5(concat_ws(
      '|',
      notification.type,
      notification.sender_id,
      notification.action_url,
      notification.related_user_id,
      notification.related_group_id,
      notification.related_event_id,
      notification.related_amendment_id,
      notification.related_blog_id,
      notification.title,
      notification.message,
      date_trunc('minute', notification.created_at)
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'title', COALESCE(notification.title, 'Polity'),
      'message', COALESCE(notification.message, ''),
      'body', COALESCE(notification.message, ''),
      'actionUrl', notification.action_url,
      'notificationId', notification.id,
      'type', notification.type,
      'icon', '/android-chrome-192x192.png',
      'badge', '/favicon-32x32.png',
      'tag', notification.id,
      'requireInteraction', false,
      'foregroundBehavior', 'toast'
    ))
  FROM public.push_notification_outbox job
  JOIN public.notification notification
    ON notification.id = job.notification_id
  CROSS JOIN LATERAL public.resolve_notification_recipients(notification.id) recipient
  JOIN public.push_subscription subscription
    ON subscription.user_id = recipient.user_id
   AND subscription.auth IS NOT NULL
   AND subscription.p256dh IS NOT NULL
  WHERE job.id = target_job_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.push_notification_outbox
  SET status = 'completed',
      completed_at = now(),
      locked_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = target_job_id;

  RETURN inserted_count;
END;
$$;

-- Direct notifications can still use Push when the recipient has disabled the
-- in-app channel. These jobs intentionally have no notification row and are
-- never used for entity fan-out.
CREATE OR REPLACE FUNCTION public.enqueue_direct_push_delivery(
  target_user_id UUID,
  target_dedupe_key TEXT,
  target_payload JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.push_delivery_outbox (
    notification_id,
    user_id,
    push_subscription_id,
    kind,
    dedupe_key,
    payload
  )
  SELECT
    NULL,
    target_user_id,
    subscription.id,
    'notification',
    target_dedupe_key,
    target_payload
  FROM public.push_subscription subscription
  WHERE subscription.user_id = target_user_id
    AND subscription.auth IS NOT NULL
    AND subscription.p256dh IS NOT NULL
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_push_delivery_jobs(
  job_limit INTEGER DEFAULT 100,
  notification_filter UUID DEFAULT NULL,
  delivery_filter BIGINT DEFAULT NULL
)
RETURNS SETOF public.push_delivery_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.push_delivery_outbox
  SET status = 'pending',
      locked_at = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - INTERVAL '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.push_delivery_outbox job
    WHERE job.status = 'pending'
      AND job.available_at <= now()
      AND (notification_filter IS NULL OR job.notification_id = notification_filter)
      AND (delivery_filter IS NULL OR job.id = delivery_filter)
    ORDER BY job.available_at, job.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(job_limit, 1), 100)
  )
  UPDATE public.push_delivery_outbox job
  SET status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_notification_recipients(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_notification_jobs(INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expand_push_notification_job(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_direct_push_delivery(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_delivery_jobs(INTEGER, UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_notification_jobs(INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expand_push_notification_job(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_push_delivery(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_jobs(INTEGER, UUID, BIGINT) TO service_role;

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
