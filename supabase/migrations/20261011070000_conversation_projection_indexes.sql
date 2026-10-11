-- Zero orders relationship rows by their primary key. These indexes serve both
-- the relationship filter and that ordering without scanning unrelated rows.
CREATE INDEX idx_conversation_group_id
  ON public.conversation (group_id, id);

CREATE INDEX idx_conversation_participant_conversation_id
  ON public.conversation_participant (conversation_id, id);
