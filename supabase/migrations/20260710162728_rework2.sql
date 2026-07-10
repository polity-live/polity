alter table "public"."dataset" add column "column_profiles" jsonb not null default '[]'::jsonb;

alter table "public"."dataset_snapshot" add column "column_profiles" jsonb not null default '[]'::jsonb;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.touch_dataset_from_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_dataset_id UUID;
BEGIN
  target_dataset_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.dataset_id ELSE NEW.dataset_id END;

  UPDATE public.dataset
  SET
    columns = CASE
      WHEN TG_OP = 'DELETE' THEN columns
      ELSE NEW.columns
    END,
    column_profiles = CASE
      WHEN TG_OP = 'DELETE' THEN column_profiles
      ELSE NEW.column_profiles
    END,
    updated_at = now()
  WHERE id = target_dataset_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_dataset_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  latest_snapshot RECORD;
  provider_label TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('dataset', OLD.id);
    RETURN OLD;
  END IF;

  SELECT
    ds.id,
    ds.status,
    ds.snapshot_taken_at,
    ds.byte_size,
    ds.row_count,
    ds.column_count
  INTO latest_snapshot
  FROM public.dataset_snapshot AS ds
  WHERE ds.dataset_id = NEW.id
  ORDER BY ds.snapshot_taken_at DESC
  LIMIT 1;

  provider_label := CASE NEW.provider
    WHEN 'EUROSTAT' THEN 'Eurostat'
    WHEN 'GENESIS_DESTATIS' THEN 'Genesis/Destatis'
    WHEN 'GOVDATA' THEN 'GovData'
    WHEN 'UPLOAD' THEN 'Upload'
    ELSE NEW.provider
  END;

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
    public.search_document_id('dataset', NEW.id),
    'dataset',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Dataset'),
    concat_ws(' · ', provider_label, nullif(NEW.publisher, ''), nullif(NEW.provider_dataset_id, '')),
    left(coalesce(NEW.description, NEW.structure_summary, ''), 420),
    concat_ws(
      ' ',
      NEW.title,
      NEW.description,
      NEW.structure_summary,
      NEW.provider,
      provider_label,
      NEW.provider_dataset_id,
      NEW.provider_resource_id,
      NEW.publisher,
      NEW.license,
      public.search_document_json_text(NEW.columns),
      public.search_document_json_text(NEW.column_profiles),
      public.search_document_json_text(NEW.dimensions),
      public.search_document_json_text(NEW.time_coverage),
      public.search_document_json_text(NEW.spatial_coverage),
      public.search_document_json_text(NEW.topics),
      public.search_document_json_text(NEW.metadata)
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.owner_user_id,
    NEW.group_id,
    jsonb_build_object(
      'type', 'dataset',
      'provider', NEW.provider,
      'provider_label', provider_label,
      'provider_dataset_id', NEW.provider_dataset_id,
      'provider_resource_id', NEW.provider_resource_id,
      'publisher', NEW.publisher,
      'license', NEW.license,
      'structure_summary', NEW.structure_summary,
      'column_profiles', coalesce(NEW.column_profiles, '[]'::jsonb),
      'snapshot_id', latest_snapshot.id,
      'snapshot_status', latest_snapshot.status,
      'snapshot_taken_at', public.search_document_epoch_ms(latest_snapshot.snapshot_taken_at),
      'byte_size', latest_snapshot.byte_size,
      'row_count', latest_snapshot.row_count,
      'column_count', latest_snapshot.column_count,
      'metadata', coalesce(NEW.metadata, '{}'::jsonb)
    ),
    NEW.created_at,
    NEW.updated_at,
    CASE WHEN latest_snapshot.status = 'ready' THEN 2 ELSE 1 END,
    CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END
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

  PERFORM public.sync_dataset_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;


