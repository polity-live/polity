-- 09_message.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.conversation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text,
    name text,
    status text,
    pinned boolean,
    last_message_at timestamp with time zone,
    last_message_id uuid,
    last_message_preview text,
    assistant_for_user_id uuid,
    group_id uuid,
    event_id uuid,
    requested_by_id uuid,
    amendment_id uuid,
    studio_project_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT conversation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.conversation_participant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone,
    left_at timestamp with time zone,
    unread_count integer DEFAULT 0 NOT NULL,
    project_surface text,
    CONSTRAINT conversation_participant_project_surface_check CHECK ((project_surface = ANY (ARRAY['amendment_text'::text, 'city_design'::text]))),
    CONSTRAINT conversation_participant_pkey PRIMARY KEY (id)
);

CREATE TABLE public.message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    context_json text DEFAULT '[]'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_pkey PRIMARY KEY (id)
);

ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_participant ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.refresh_conversation_rollups(target_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  latest RECORD;
BEGIN
  SELECT id, created_at, content
  INTO latest
  FROM public.message
  WHERE conversation_id = target_conversation_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  UPDATE public.conversation
  SET
    last_message_id = latest.id,
    last_message_at = latest.created_at,
    last_message_preview = left(coalesce(latest.content, ''), 240)
  WHERE id = target_conversation_id;

  UPDATE public.conversation_participant AS cp
  SET unread_count = coalesce((
    SELECT count(*)::integer
    FROM public.message AS m
    WHERE m.conversation_id = cp.conversation_id
      AND m.deleted_at IS NULL
      AND m.sender_id <> cp.user_id
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  ), 0)
  WHERE cp.conversation_id = target_conversation_id;
END;
$$;

CREATE FUNCTION public.refresh_conversation_rollups_from_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_conversation_rollups(OLD.conversation_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_conversation_rollups(NEW.conversation_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE FUNCTION public.refresh_conversation_rollups_from_participant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_conversation_rollups(OLD.conversation_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_conversation_rollups(NEW.conversation_id);
  RETURN NEW;
END;
$$;

CREATE INDEX conversation_tutorial_run_id_idx ON public.conversation USING btree (tutorial_run_id);

CREATE INDEX idx_conversation_amendment ON public.conversation USING btree (amendment_id);

CREATE INDEX idx_conversation_assistant_for_user ON public.conversation USING btree (assistant_for_user_id);

CREATE INDEX idx_conversation_event ON public.conversation USING btree (event_id);

CREATE INDEX idx_conversation_event_id ON public.conversation USING btree (event_id, id);

CREATE INDEX idx_conversation_group ON public.conversation USING btree (group_id);

CREATE INDEX idx_conversation_group_id ON public.conversation USING btree (group_id, id);

CREATE INDEX idx_conversation_last_message ON public.conversation USING btree (last_message_at DESC, id DESC);

CREATE INDEX idx_conversation_participant_conversation ON public.conversation_participant USING btree (conversation_id);

CREATE INDEX idx_conversation_participant_conversation_id ON public.conversation_participant USING btree (conversation_id, id);

CREATE UNIQUE INDEX idx_conversation_participant_unique_membership ON public.conversation_participant USING btree (conversation_id, user_id);

CREATE INDEX idx_conversation_participant_user ON public.conversation_participant USING btree (user_id);

CREATE INDEX idx_conversation_participant_user_id ON public.conversation_participant USING btree (user_id, id);

CREATE INDEX idx_conversation_participant_user_left ON public.conversation_participant USING btree (user_id, left_at, conversation_id);

CREATE INDEX idx_conversation_requested_by ON public.conversation USING btree (requested_by_id);

CREATE INDEX idx_conversation_studio_project ON public.conversation USING btree (studio_project_id);

CREATE INDEX idx_message_content_trgm ON public.message USING gin (content public.gin_trgm_ops);

CREATE INDEX idx_message_conversation ON public.message USING btree (conversation_id);

CREATE INDEX idx_message_conversation_created_id ON public.message USING btree (conversation_id, created_at DESC, id DESC);

CREATE INDEX idx_message_sender ON public.message USING btree (sender_id);

CREATE POLICY service_role_all ON public.conversation TO service_role USING (true);

CREATE POLICY service_role_all ON public.conversation_participant TO service_role USING (true);

CREATE POLICY service_role_all ON public.message TO service_role USING (true);
