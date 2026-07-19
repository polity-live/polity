CREATE OR REPLACE FUNCTION public.upsert_todo_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('todo', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('todo', NEW.id),
    'todo',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Todo'),
    NEW.status,
    NEW.description,
    concat_ws(' ', NEW.title, NEW.description, NEW.status, NEW.priority),
    coalesce(NEW.visibility, 'public'),
    NEW.creator_id,
    NEW.group_id,
    jsonb_build_object(
      'type', 'todo',
      'priority', NEW.priority,
      'status', NEW.status,
      'due_at', public.search_document_epoch_ms(NEW.due_date),
      'archived_at', public.search_document_epoch_ms(NEW.archived_at),
      'metadata', jsonb_build_object('event_id', NEW.event_id, 'amendment_id', NEW.amendment_id)
    ),
    NEW.created_at,
    NEW.updated_at,
    CASE
      WHEN NEW.status = 'completed' THEN 0
      WHEN NEW.priority = 'high' THEN 3
      WHEN NEW.priority = 'medium' THEN 2
      ELSE 1
    END,
    CASE
      WHEN NEW.due_date IS NOT NULL AND NEW.completed_at IS NULL THEN 1
      ELSE 0
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('todo', NEW.id),
    NEW.tags
  );
  RETURN NEW;
END;
$$;

UPDATE public.search_document AS search_document
SET card_payload = search_document.card_payload || jsonb_build_object(
  'archived_at',
  public.search_document_epoch_ms(todo.archived_at)
)
FROM public.todo AS todo
WHERE search_document.id = public.search_document_id('todo', todo.id);
