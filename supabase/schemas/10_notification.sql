-- =============================================================================
-- 10_notification.sql — Notifications, push subscriptions, notification settings
-- =============================================================================

-- Notification table
CREATE TABLE IF NOT EXISTS public.notification (
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
CREATE TABLE IF NOT EXISTS public.push_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT,
  p256dh TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscription_user ON public.push_subscription (user_id);

ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.push_subscription FOR ALL TO service_role USING (true);

-- Notification setting table
CREATE TABLE IF NOT EXISTS public.notification_setting (
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
CREATE TABLE IF NOT EXISTS public.notification_read (
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
