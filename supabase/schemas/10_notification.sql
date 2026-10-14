-- 10_notification.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.push_delivery_outbox (
    id bigint NOT NULL,
    notification_job_id bigint,
    notification_id uuid,
    user_id uuid NOT NULL,
    push_subscription_id uuid,
    kind text DEFAULT 'notification'::text NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error text,
    skip_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_delivery_outbox_kind_check CHECK ((kind = ANY (ARRAY['notification'::text, 'test'::text]))),
    CONSTRAINT push_delivery_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'skipped'::text, 'failed'::text]))),
    CONSTRAINT push_delivery_outbox_pkey PRIMARY KEY (id)
);

CREATE TABLE public.push_notification_outbox (
    id bigint NOT NULL,
    notification_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_notification_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT push_notification_outbox_notification_id_key UNIQUE (notification_id),
    CONSTRAINT push_notification_outbox_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid,
    sender_id uuid,
    title text,
    message text,
    type text,
    action_url text,
    is_read boolean DEFAULT false NOT NULL,
    related_entity_type text,
    on_behalf_of_entity_type text,
    on_behalf_of_entity_id uuid,
    recipient_entity_type text,
    recipient_entity_id uuid,
    related_user_id uuid,
    related_group_id uuid,
    related_amendment_id uuid,
    related_event_id uuid,
    related_blog_id uuid,
    on_behalf_of_group_id uuid,
    on_behalf_of_event_id uuid,
    on_behalf_of_amendment_id uuid,
    on_behalf_of_blog_id uuid,
    recipient_group_id uuid,
    recipient_event_id uuid,
    recipient_amendment_id uuid,
    recipient_blog_id uuid,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    tutorial_run_id uuid,
    CONSTRAINT notification_recipient_target_consistency CHECK (((recipient_entity_type IS NULL) OR ((recipient_entity_type = 'group'::text) AND (recipient_group_id = recipient_entity_id)) OR ((recipient_entity_type = 'event'::text) AND (recipient_event_id = recipient_entity_id)) OR ((recipient_entity_type = 'amendment'::text) AND (recipient_amendment_id = recipient_entity_id)) OR ((recipient_entity_type = 'blog'::text) AND (recipient_blog_id = recipient_entity_id)))),
    CONSTRAINT notification_recipient_target_shape CHECK ((((recipient_id IS NOT NULL) AND (recipient_entity_type IS NULL) AND (recipient_entity_id IS NULL) AND (recipient_group_id IS NULL) AND (recipient_event_id IS NULL) AND (recipient_amendment_id IS NULL) AND (recipient_blog_id IS NULL)) OR ((recipient_id IS NULL) AND (recipient_entity_type = ANY (ARRAY['group'::text, 'event'::text, 'amendment'::text, 'blog'::text])) AND (recipient_entity_id IS NOT NULL) AND (num_nonnulls(recipient_group_id, recipient_event_id, recipient_amendment_id, recipient_blog_id) = 1)))),
    CONSTRAINT notification_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification_read (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    read_by_user_id uuid,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_read_per_user_key UNIQUE (notification_id, entity_type, entity_id, read_by_user_id),
    CONSTRAINT notification_read_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification_setting (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    group_notifications jsonb,
    event_notifications jsonb,
    amendment_notifications jsonb,
    blog_notifications jsonb,
    todo_notifications jsonb,
    social_notifications jsonb,
    delivery_settings jsonb,
    timeline_settings jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_setting_pkey PRIMARY KEY (id),
    CONSTRAINT notification_setting_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.notification_user_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    purged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_user_state_order CHECK (((purged_at IS NULL) OR (dismissed_at IS NOT NULL))),
    CONSTRAINT notification_user_state_per_user_key UNIQUE (notification_id, user_id),
    CONSTRAINT notification_user_state_pkey PRIMARY KEY (id)
);

CREATE TABLE public.push_subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id uuid,
    endpoint text NOT NULL,
    auth text,
    p256dh text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_subscription_endpoint_key UNIQUE (endpoint),
    CONSTRAINT push_subscription_pkey PRIMARY KEY (id)
);

ALTER TABLE public.push_delivery_outbox ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.push_delivery_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.push_notification_outbox ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.push_notification_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_read ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_setting ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_user_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_delivery_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_notification_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.claim_push_delivery_jobs(job_limit integer DEFAULT 100, notification_filter uuid DEFAULT NULL::uuid, delivery_filter bigint DEFAULT NULL::bigint) RETURNS SETOF public.push_delivery_outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.claim_push_notification_jobs(job_limit integer DEFAULT 100, notification_filter uuid DEFAULT NULL::uuid) RETURNS SETOF public.push_notification_outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.enqueue_direct_push_delivery(target_user_id uuid, target_dedupe_key text, target_payload jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.enqueue_push_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.push_notification_outbox (notification_id)
  VALUES (NEW.id)
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.expand_push_notification_job(target_job_id bigint) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.purge_expired_notifications() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.resolve_notification_recipients(target_notification_id uuid) RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE INDEX idx_notification_active_created ON public.notification USING btree (created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_notification_category ON public.notification USING btree (category);

CREATE INDEX idx_notification_is_read ON public.notification USING btree (is_read);

CREATE INDEX idx_notification_read_entity ON public.notification_read USING btree (entity_type, entity_id);

CREATE INDEX idx_notification_recipient ON public.notification USING btree (recipient_id);

CREATE INDEX idx_notification_recipient_amendment ON public.notification USING btree (recipient_amendment_id, created_at);

CREATE INDEX idx_notification_recipient_blog ON public.notification USING btree (recipient_blog_id, created_at);

CREATE INDEX idx_notification_recipient_entity ON public.notification USING btree (recipient_entity_id, created_at);

CREATE INDEX idx_notification_recipient_event ON public.notification USING btree (recipient_event_id, created_at);

CREATE INDEX idx_notification_recipient_group ON public.notification USING btree (recipient_group_id, created_at);

CREATE INDEX idx_notification_recipient_read ON public.notification USING btree (recipient_id, is_read);

CREATE INDEX idx_notification_sender ON public.notification USING btree (sender_id);

CREATE INDEX idx_notification_user_state_notification ON public.notification_user_state USING btree (notification_id, user_id);

CREATE INDEX idx_notification_user_state_user ON public.notification_user_state USING btree (user_id, dismissed_at, purged_at, read_at);

CREATE UNIQUE INDEX idx_push_delivery_dedupe_subscription ON public.push_delivery_outbox USING btree (dedupe_key, push_subscription_id) WHERE (push_subscription_id IS NOT NULL);

CREATE UNIQUE INDEX idx_push_delivery_notification_subscription ON public.push_delivery_outbox USING btree (notification_id, push_subscription_id) WHERE ((notification_id IS NOT NULL) AND (push_subscription_id IS NOT NULL));

CREATE INDEX idx_push_delivery_outbox_pending ON public.push_delivery_outbox USING btree (available_at, id) WHERE (status = 'pending'::text);

CREATE INDEX idx_push_delivery_outbox_user ON public.push_delivery_outbox USING btree (user_id, created_at DESC);

CREATE INDEX idx_push_notification_outbox_pending ON public.push_notification_outbox USING btree (available_at, id) WHERE (status = 'pending'::text);

CREATE INDEX idx_push_subscription_user ON public.push_subscription USING btree (user_id);

CREATE UNIQUE INDEX idx_push_subscription_user_device ON public.push_subscription USING btree (user_id, device_id) WHERE (device_id IS NOT NULL);

CREATE INDEX idx_zero_notification_created_id_deleted ON public.notification USING btree (created_at DESC, id DESC, deleted_at);

CREATE INDEX idx_zero_notification_entity_created_id_deleted ON public.notification USING btree (recipient_entity_type, recipient_entity_id, created_at DESC, id DESC, deleted_at);

CREATE INDEX idx_zero_notification_read_notification_user_id ON public.notification_read USING btree (notification_id, read_by_user_id, id);

CREATE INDEX idx_zero_notification_recipient_created_id_deleted ON public.notification USING btree (recipient_id, created_at DESC, id DESC, deleted_at);

CREATE INDEX notification_tutorial_run_id_idx ON public.notification USING btree (tutorial_run_id);

CREATE POLICY service_role_all ON public.notification TO service_role USING (true);

CREATE POLICY service_role_all ON public.notification_read TO service_role USING (true);

CREATE POLICY service_role_all ON public.notification_setting TO service_role USING (true);

CREATE POLICY service_role_all ON public.notification_user_state TO service_role USING (true);

CREATE POLICY service_role_all ON public.push_delivery_outbox TO service_role USING (true);

CREATE POLICY service_role_all ON public.push_notification_outbox TO service_role USING (true);

CREATE POLICY service_role_all ON public.push_subscription TO service_role USING (true);
