-- Display rich text as content instead of editor node keys in compact search results.
CREATE OR REPLACE FUNCTION public.search_document_json_text(value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT;
BEGIN
  IF value IS NULL OR value = 'null'::jsonb THEN RETURN ''; END IF;
  CASE jsonb_typeof(value)
    WHEN 'string' THEN RETURN value #>> '{}';
    WHEN 'array' THEN
      SELECT string_agg(public.search_document_json_text(item), ' ' ORDER BY ordinal)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS nodes(item, ordinal);
      RETURN coalesce(result, '');
    WHEN 'object' THEN
      IF value ? 'text' THEN RETURN coalesce(value->>'text', ''); END IF;
      IF value ? 'children' THEN RETURN public.search_document_json_text(value->'children'); END IF;
      RETURN '';
    ELSE RETURN '';
  END CASE;
END;
$$;

UPDATE public.search_document AS document
SET summary = left(public.search_document_json_text(source.description), 320)
FROM public."group" AS source
WHERE document.entity_type = 'group' AND document.entity_id = source.id;

UPDATE public.search_document AS document
SET summary = left(public.search_document_json_text(source.description), 320)
FROM public.event AS source
WHERE document.entity_type = 'event' AND document.entity_id = source.id;
