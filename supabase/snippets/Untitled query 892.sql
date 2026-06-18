CREATE OR REPLACE FUNCTION public.upsert_election_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  related_group_id UUID;
  related_event_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('election', OLD.id);
    RETURN OLD;
  END IF;

  SELECT group_id
  INTO related_group_id
  FROM public.role
  WHERE id = NEW.role_id;

  SELECT event_id
  INTO related_event_id
  FROM public.agenda_item
  WHERE id = NEW.agenda_item_id;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    group_id,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('election', NEW.id),
    'election',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Election'),
    NEW.status,
    NEW.description,
    concat_ws(' ', NEW.title, NEW.description, NEW.status, NEW.majority_type, NEW.election_mode),
    coalesce(NEW.visibility, 'public'),
    related_group_id,
    jsonb_build_object(
      'type', 'election',
      'status', NEW.status,
      'agenda_event_id', related_event_id,
      'agenda_item_id', NEW.agenda_item_id,
      'metadata', jsonb_build_object(
        'role_id', NEW.role_id,
        'event_id', related_event_id,
        'agenda_event_id', related_event_id,
        'agenda_item_id', NEW.agenda_item_id,
        'election_mode', NEW.election_mode
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.seat_count, 0) + coalesce(NEW.max_votes, 0),
    CASE WHEN NEW.status IN ('open', 'active') THEN 1 ELSE 0 END
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    group_id = EXCLUDED.group_id,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  RETURN NEW;
END;
$$;

UPDATE public.search_document AS sd
SET card_payload =
  coalesce(sd.card_payload, '{}'::jsonb)
  || jsonb_build_object(
    'agenda_event_id', ai.event_id,
    'agenda_item_id', e.agenda_item_id,
    'metadata',
      coalesce(sd.card_payload->'metadata', '{}'::jsonb)
      || jsonb_build_object(
        'event_id', ai.event_id,
        'agenda_event_id', ai.event_id,
        'agenda_item_id', e.agenda_item_id
      )
  )
FROM public.election AS e
LEFT JOIN public.agenda_item AS ai ON ai.id = e.agenda_item_id
WHERE sd.id = public.search_document_id('election', e.id)
  AND e.agenda_item_id IS NOT NULL;
