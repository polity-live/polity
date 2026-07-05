ALTER TABLE public.amendment
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS post_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS house_number TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE OR REPLACE FUNCTION public.populate_search_document_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  direct_latitude DOUBLE PRECISION;
  direct_longitude DOUBLE PRECISION;
  direct_label TEXT;
  direct_source TEXT;
  group_latitude DOUBLE PRECISION;
  group_longitude DOUBLE PRECISION;
  group_label TEXT;
  owner_latitude DOUBLE PRECISION;
  owner_longitude DOUBLE PRECISION;
  owner_label TEXT;
  resolved_group_id UUID;
  resolved_owner_user_id UUID;
BEGIN
  resolved_group_id := NEW.group_id;
  resolved_owner_user_id := NEW.owner_user_id;

  IF NEW.entity_type = 'user' THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number)
    INTO direct_latitude, direct_longitude, direct_label
    FROM public."user" AS u
    WHERE u.id = NEW.entity_id;

    direct_source := 'user';
    resolved_owner_user_id := coalesce(resolved_owner_user_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'group' THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number),
      g.owner_id
    INTO direct_latitude, direct_longitude, direct_label, resolved_owner_user_id
    FROM public."group" AS g
    WHERE g.id = NEW.entity_id;

    direct_source := 'group';
    resolved_group_id := coalesce(resolved_group_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'event' THEN
    SELECT
      e.latitude,
      e.longitude,
      public.search_document_format_location(e.location_name, e.country, e.region, e.post_code, e.city, e.street, e.house_number),
      e.group_id,
      e.creator_id
    INTO direct_latitude, direct_longitude, direct_label, resolved_group_id, resolved_owner_user_id
    FROM public.event AS e
    WHERE e.id = NEW.entity_id;

    direct_source := 'event';
  ELSIF NEW.entity_type = 'amendment' THEN
    SELECT
      a.latitude,
      a.longitude,
      public.search_document_format_location(NULL, a.country, a.region, a.post_code, a.city, a.street, a.house_number),
      a.group_id,
      a.created_by_id
    INTO direct_latitude, direct_longitude, direct_label, resolved_group_id, resolved_owner_user_id
    FROM public.amendment AS a
    WHERE a.id = NEW.entity_id;

    direct_source := 'amendment';
  ELSIF NEW.entity_type = 'blog' AND resolved_owner_user_id IS NULL THEN
    SELECT bb.user_id
    INTO resolved_owner_user_id
    FROM public.blog_blogger AS bb
    WHERE bb.blog_id = NEW.entity_id
    ORDER BY bb.created_at ASC
    LIMIT 1;
  END IF;

  NEW.group_id := resolved_group_id;
  NEW.owner_user_id := resolved_owner_user_id;

  IF NEW.location_latitude IS NOT NULL AND NEW.location_longitude IS NOT NULL THEN
    NEW.location_source := coalesce(NEW.location_source, direct_source, 'document');
    RETURN NEW;
  END IF;

  IF direct_latitude IS NOT NULL AND direct_longitude IS NOT NULL THEN
    NEW.location_latitude := direct_latitude;
    NEW.location_longitude := direct_longitude;
    NEW.location_label := coalesce(nullif(NEW.location_label, ''), direct_label);
    NEW.location_source := coalesce(direct_source, 'own');
    RETURN NEW;
  END IF;

  IF resolved_group_id IS NOT NULL THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number)
    INTO group_latitude, group_longitude, group_label
    FROM public."group" AS g
    WHERE g.id = resolved_group_id;

    IF group_latitude IS NOT NULL AND group_longitude IS NOT NULL THEN
      NEW.location_latitude := group_latitude;
      NEW.location_longitude := group_longitude;
      NEW.location_label := coalesce(nullif(NEW.location_label, ''), group_label);
      NEW.location_source := 'group';
      RETURN NEW;
    END IF;
  END IF;

  IF resolved_owner_user_id IS NOT NULL THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number)
    INTO owner_latitude, owner_longitude, owner_label
    FROM public."user" AS u
    WHERE u.id = resolved_owner_user_id;

    IF owner_latitude IS NOT NULL AND owner_longitude IS NOT NULL THEN
      NEW.location_latitude := owner_latitude;
      NEW.location_longitude := owner_longitude;
      NEW.location_label := coalesce(nullif(NEW.location_label, ''), owner_label);
      NEW.location_source := 'owner';
      RETURN NEW;
    END IF;
  END IF;

  NEW.location_latitude := NULL;
  NEW.location_longitude := NULL;
  NEW.location_label := NULL;
  NEW.location_source := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document(target_amendment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  amendment_row public.amendment%ROWTYPE;
  supporting_group_count INTEGER;
  net_user_votes INTEGER;
BEGIN
  SELECT *
  INTO amendment_row
  FROM public.amendment
  WHERE id = target_amendment_id;

  IF NOT FOUND THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('amendment', target_amendment_id);
    RETURN;
  END IF;

  supporting_group_count := public.amendment_supporting_group_count(amendment_row.id);
  net_user_votes := coalesce(amendment_row.upvotes, 0) - coalesce(amendment_row.downvotes, 0);

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
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('amendment', amendment_row.id),
    'amendment',
    amendment_row.id,
    coalesce(nullif(amendment_row.title, ''), nullif(amendment_row.code, ''), 'Amendment'),
    amendment_row.code,
    coalesce(amendment_row.reason, amendment_row.preamble),
    concat_ws(
      ' ',
      amendment_row.code,
      amendment_row.title,
      amendment_row.reason,
      amendment_row.preamble,
      amendment_row.category,
      amendment_row.country,
      amendment_row.region,
      amendment_row.post_code,
      amendment_row.city,
      amendment_row.street,
      amendment_row.house_number
    ),
    coalesce(amendment_row.visibility, 'public'),
    amendment_row.created_by_id,
    amendment_row.group_id,
    amendment_row.image_url,
    jsonb_build_object(
      'type', 'amendment',
      'code', amendment_row.code,
      'location', public.search_document_format_location(
        NULL,
        amendment_row.country,
        amendment_row.region,
        amendment_row.post_code,
        amendment_row.city,
        amendment_row.street,
        amendment_row.house_number
      ),
      'status', (
        SELECT branch.editing_mode
        FROM public.amendment_process_branch branch
        WHERE branch.process_run_id = amendment_row.current_process_run_id
        ORDER BY branch.created_at ASC, branch.id ASC
        LIMIT 1
      ),
      'branch_statuses', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'branch_id', branch.id,
            'label', coalesce(branch.title, 'Branch'),
            'editing_mode', branch.editing_mode,
            'process_status', branch.status,
            'resolution', branch.resolution
          )
          ORDER BY branch.created_at ASC, branch.id ASC
        )
        FROM public.amendment_process_branch branch
        WHERE branch.process_run_id = amendment_row.current_process_run_id
      ), '[]'::jsonb),
      'entity_id', amendment_row.id,
      'metadata', jsonb_build_object('event_id', amendment_row.event_id),
      'stats', jsonb_build_object(
        'upvotes', amendment_row.upvotes,
        'downvotes', amendment_row.downvotes,
        'supporting_groups', supporting_group_count,
        'comments', amendment_row.comment_count
      )
    ),
    amendment_row.created_at,
    amendment_row.updated_at,
    net_user_votes + supporting_group_count + coalesce(amendment_row.comment_count, 0),
    net_user_votes + supporting_group_count
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score,
    location_latitude = EXCLUDED.location_latitude,
    location_longitude = EXCLUDED.location_longitude,
    location_label = EXCLUDED.location_label,
    location_source = EXCLUDED.location_source;

  PERFORM public.sync_amendment_search_document_topics(amendment_row.id);
END;
$$;
