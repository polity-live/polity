DO $migration$
DECLARE
  definition text;
BEGIN
  definition := pg_get_functiondef('public.upsert_blog_search_document()'::regprocedure);
  IF position('''supporters'', NEW.supporter_count' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected upsert_blog_search_document definition';
  END IF;
  definition := replace(
    definition,
    '''supporters'', NEW.supporter_count',
    '''supporters'', NEW.supporter_count, ''subscribers'', NEW.subscriber_count'
  );
  EXECUTE definition;

  definition := pg_get_functiondef(
    'public.refresh_amendment_search_document(uuid)'::regprocedure
  );
  IF position('''comments'', amendment_row.comment_count' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected refresh_amendment_search_document definition';
  END IF;
  definition := replace(
    definition,
    '''comments'', amendment_row.comment_count',
    '''comments'', amendment_row.comment_count, ''subscribers'', amendment_row.subscriber_count, ''collaborators'', amendment_row.collaborator_count'
  );
  EXECUTE definition;

  definition := pg_get_functiondef('public.upsert_group_search_document()'::regprocedure);
  IF position('''type'', ''group'',' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected upsert_group_search_document definition';
  END IF;
  definition := replace(
    definition,
    '''type'', ''group'',',
    '''type'', ''group'', ''group_type'', NEW.group_type, ''connected_group_id'', NEW.connected_group_id, ''primary_sibling_membership_mode'', NEW.primary_sibling_membership_mode,'
  );
  EXECUTE definition;

  definition := pg_get_functiondef('public.upsert_event_search_document()'::regprocedure);
  IF position('''type'', ''event'',' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected upsert_event_search_document definition';
  END IF;
  definition := replace(
    definition,
    '''type'', ''event'',',
    '''type'', ''event'', ''event_type'', NEW.event_type,'
  );
  EXECUTE definition;
END;
$migration$;

UPDATE public.search_document sd
SET card_payload = jsonb_set(
  coalesce(sd.card_payload, '{}'::jsonb),
  '{stats,subscribers}',
  to_jsonb(b.subscriber_count),
  true
)
FROM public.blog b
WHERE sd.entity_type = 'blog'
  AND sd.entity_id = b.id;

UPDATE public.search_document sd
SET card_payload = jsonb_set(
  jsonb_set(
    coalesce(sd.card_payload, '{}'::jsonb),
    '{stats,subscribers}',
    to_jsonb(a.subscriber_count),
    true
  ),
  '{stats,collaborators}',
  to_jsonb(a.collaborator_count),
  true
)
FROM public.amendment a
WHERE sd.entity_type = 'amendment'
  AND sd.entity_id = a.id;

UPDATE public.search_document sd
SET card_payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      coalesce(sd.card_payload, '{}'::jsonb),
      '{group_type}',
      coalesce(to_jsonb(g.group_type), 'null'::jsonb),
      true
    ),
    '{connected_group_id}',
    coalesce(to_jsonb(g.connected_group_id), 'null'::jsonb),
    true
  ),
  '{primary_sibling_membership_mode}',
  coalesce(to_jsonb(g.primary_sibling_membership_mode), 'null'::jsonb),
  true
)
FROM public."group" g
WHERE sd.entity_type = 'group'
  AND sd.entity_id = g.id;

UPDATE public.search_document sd
SET card_payload = jsonb_set(
  coalesce(sd.card_payload, '{}'::jsonb),
  '{event_type}',
  coalesce(to_jsonb(e.event_type), 'null'::jsonb),
  true
)
FROM public.event e
WHERE sd.entity_type = 'event'
  AND sd.entity_id = e.id;
