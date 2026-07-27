-- =============================================================================
-- 09_message.sql — Conversations, participants, messages
-- =============================================================================

-- Conversation table
CREATE TABLE public.conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  name TEXT,
  status TEXT,
  pinned BOOLEAN,
  last_message_at TIMESTAMPTZ,
  last_message_id UUID,
  last_message_preview TEXT,
  assistant_for_user_id UUID REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID,
  event_id UUID REFERENCES public.event (id) ON DELETE CASCADE,
  requested_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_group ON public.conversation (group_id);
CREATE INDEX idx_conversation_event ON public.conversation (event_id);
CREATE INDEX idx_conversation_requested_by ON public.conversation (requested_by_id);
CREATE INDEX idx_conversation_assistant_for_user ON public.conversation (assistant_for_user_id);
CREATE INDEX idx_conversation_last_message
  ON public.conversation (last_message_at DESC, id DESC);

ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.conversation FOR ALL TO service_role USING (true);

-- Conversation participant table
CREATE TABLE public.conversation_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversation (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_conversation_participant_conversation ON public.conversation_participant (conversation_id);
CREATE INDEX idx_conversation_participant_user ON public.conversation_participant (user_id);
CREATE UNIQUE INDEX idx_conversation_participant_unique_membership
  ON public.conversation_participant (conversation_id, user_id);
CREATE INDEX idx_conversation_participant_user_left
  ON public.conversation_participant (user_id, left_at, conversation_id);

ALTER TABLE public.conversation_participant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.conversation_participant FOR ALL TO service_role USING (true);

-- Message table
CREATE TABLE public.message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversation (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  content TEXT,
  context_json TEXT NOT NULL DEFAULT '[]',
  is_read BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_conversation ON public.message (conversation_id);
CREATE INDEX idx_message_sender ON public.message (sender_id);
CREATE INDEX idx_message_conversation_created_id
  ON public.message (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_message_content_trgm
  ON public.message USING gin (content gin_trgm_ops);

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.message FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups(target_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups_from_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

CREATE TRIGGER trg_message_refresh_conversation_rollups
AFTER INSERT OR UPDATE OR DELETE ON public.message
FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_message();

CREATE TRIGGER trg_participant_refresh_conversation_rollups
AFTER INSERT OR UPDATE OF last_read_at, left_at, user_id OR DELETE ON public.conversation_participant
FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_participant();
