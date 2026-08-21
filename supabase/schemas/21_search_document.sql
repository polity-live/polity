-- =============================================================================
-- 21_search_document.sql — Flattened search projection for virtualized search
-- =============================================================================

CREATE TABLE public.search_document (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  search_text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  owner_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  image_url TEXT,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  location_label TEXT,
  location_source TEXT,
  location_kind TEXT,
  location_place_id TEXT,
  location_boundary_source TEXT,
  location_geometry JSONB,
  location_bounds JSONB,
  card_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  engagement_score INTEGER NOT NULL DEFAULT 0,
  trending_score DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX idx_search_document_search_text_trgm
  ON public.search_document USING gin (search_text gin_trgm_ops);
CREATE INDEX idx_search_document_title_trgm
  ON public.search_document USING gin (title gin_trgm_ops);
CREATE INDEX idx_search_document_recent
  ON public.search_document (created_at DESC, id DESC);
CREATE INDEX idx_search_document_engagement
  ON public.search_document (engagement_score DESC, created_at DESC, id DESC);
CREATE INDEX idx_search_document_trending
  ON public.search_document (trending_score DESC, created_at DESC, id DESC);
CREATE INDEX idx_search_document_type_recent
  ON public.search_document (entity_type, created_at DESC, id DESC);
CREATE INDEX idx_search_document_group
  ON public.search_document (group_id, created_at DESC, id DESC);
CREATE INDEX idx_search_document_owner
  ON public.search_document (owner_user_id, created_at DESC, id DESC);
CREATE INDEX idx_search_document_location
  ON public.search_document (location_latitude, location_longitude)
  WHERE location_latitude IS NOT NULL AND location_longitude IS NOT NULL;
CREATE INDEX idx_search_document_location_kind
  ON public.search_document (location_kind)
  WHERE location_kind IS NOT NULL;

ALTER TABLE public.search_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.search_document FOR ALL TO service_role USING (true);

CREATE TABLE public.search_document_topic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES public.search_document (id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, topic)
);

CREATE INDEX idx_search_document_topic_topic_document
  ON public.search_document_topic (topic, document_id);

ALTER TABLE public.search_document_topic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.search_document_topic FOR ALL TO service_role USING (true);

CREATE TABLE public.search_document_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES public.search_document (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

CREATE INDEX idx_search_document_acl_user_document
  ON public.search_document_acl (user_id, document_id);

ALTER TABLE public.search_document_acl ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.search_document_acl FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.search_document_id(entity_type TEXT, entity_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT entity_type || ':' || entity_id::text;
$$;

CREATE OR REPLACE FUNCTION public.search_document_json_text(value JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(regexp_replace(value::text, '[\[\]\{\}"_,:]+', ' ', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.search_document_epoch_ms(value TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE floor(extract(epoch FROM value) * 1000)::bigint
  END;
$$;

CREATE OR REPLACE FUNCTION public.search_document_format_location(
  p_location_name TEXT,
  p_country TEXT,
  p_region TEXT,
  p_post_code TEXT,
  p_city TEXT,
  p_street TEXT,
  p_house_number TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    concat_ws(
      ', ',
      nullif(trim(coalesce(p_location_name, '')), ''),
      nullif(trim(concat_ws(' ', nullif(p_street, ''), nullif(p_house_number, ''))), ''),
      nullif(trim(concat_ws(' ', nullif(p_post_code, ''), nullif(p_city, ''))), ''),
      nullif(trim(coalesce(p_region, '')), ''),
      nullif(trim(coalesce(p_country, '')), '')
    ),
    ''
  );
$$;

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
  direct_kind TEXT;
  direct_place_id TEXT;
  direct_boundary_source TEXT;
  direct_geometry JSONB;
  direct_bounds JSONB;
  group_latitude DOUBLE PRECISION;
  group_longitude DOUBLE PRECISION;
  group_label TEXT;
  group_kind TEXT;
  group_place_id TEXT;
  group_boundary_source TEXT;
  group_geometry JSONB;
  group_bounds JSONB;
  owner_latitude DOUBLE PRECISION;
  owner_longitude DOUBLE PRECISION;
  owner_label TEXT;
  owner_kind TEXT;
  owner_place_id TEXT;
  owner_boundary_source TEXT;
  owner_geometry JSONB;
  owner_bounds JSONB;
  resolved_group_id UUID;
  resolved_owner_user_id UUID;
BEGIN
  resolved_group_id := NEW.group_id;
  resolved_owner_user_id := NEW.owner_user_id;

  IF NEW.entity_type = 'user' THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number),
      u.location_kind,
      u.location_place_id,
      u.location_boundary_source,
      u.location_geometry,
      u.location_bounds
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds
    FROM public."user" AS u
    WHERE u.id = NEW.entity_id;

    direct_source := 'user';
    resolved_owner_user_id := coalesce(resolved_owner_user_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'group' THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number),
      g.location_kind,
      g.location_place_id,
      g.location_boundary_source,
      g.location_geometry,
      g.location_bounds,
      g.owner_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_owner_user_id
    FROM public."group" AS g
    WHERE g.id = NEW.entity_id;

    direct_source := 'group';
    resolved_group_id := coalesce(resolved_group_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'event' THEN
    SELECT
      e.latitude,
      e.longitude,
      public.search_document_format_location(e.location_name, e.country, e.region, e.post_code, e.city, e.street, e.house_number),
      e.location_kind,
      e.location_place_id,
      e.location_boundary_source,
      e.location_geometry,
      e.location_bounds,
      e.group_id,
      e.creator_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_group_id, resolved_owner_user_id
    FROM public.event AS e
    WHERE e.id = NEW.entity_id;

    direct_source := 'event';
  ELSIF NEW.entity_type = 'amendment' THEN
    SELECT
      a.latitude,
      a.longitude,
      public.search_document_format_location(NULL, a.country, a.region, a.post_code, a.city, a.street, a.house_number),
      a.location_kind,
      a.location_place_id,
      a.location_boundary_source,
      a.location_geometry,
      a.location_bounds,
      a.group_id,
      a.created_by_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_group_id, resolved_owner_user_id
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

  IF direct_latitude IS NOT NULL AND direct_longitude IS NOT NULL THEN
    NEW.location_latitude := direct_latitude;
    NEW.location_longitude := direct_longitude;
    NEW.location_label := direct_label;
    NEW.location_source := coalesce(direct_source, 'own');
    NEW.location_kind := direct_kind;
    NEW.location_place_id := direct_place_id;
    NEW.location_boundary_source := direct_boundary_source;
    NEW.location_geometry := direct_geometry;
    NEW.location_bounds := direct_bounds;
    RETURN NEW;
  END IF;

  IF NEW.location_latitude IS NOT NULL AND NEW.location_longitude IS NOT NULL THEN
    NEW.location_source := coalesce(NEW.location_source, direct_source, 'document');
    RETURN NEW;
  END IF;

  IF resolved_group_id IS NOT NULL THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number),
      g.location_kind,
      g.location_place_id,
      g.location_boundary_source,
      g.location_geometry,
      g.location_bounds
    INTO group_latitude, group_longitude, group_label, group_kind, group_place_id, group_boundary_source, group_geometry, group_bounds
    FROM public."group" AS g
    WHERE g.id = resolved_group_id;

    IF group_latitude IS NOT NULL AND group_longitude IS NOT NULL THEN
      NEW.location_latitude := group_latitude;
      NEW.location_longitude := group_longitude;
      NEW.location_label := group_label;
      NEW.location_source := 'group';
      NEW.location_kind := group_kind;
      NEW.location_place_id := group_place_id;
      NEW.location_boundary_source := group_boundary_source;
      NEW.location_geometry := group_geometry;
      NEW.location_bounds := group_bounds;
      RETURN NEW;
    END IF;
  END IF;

  IF resolved_owner_user_id IS NOT NULL THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number),
      u.location_kind,
      u.location_place_id,
      u.location_boundary_source,
      u.location_geometry,
      u.location_bounds
    INTO owner_latitude, owner_longitude, owner_label, owner_kind, owner_place_id, owner_boundary_source, owner_geometry, owner_bounds
    FROM public."user" AS u
    WHERE u.id = resolved_owner_user_id;

    IF owner_latitude IS NOT NULL AND owner_longitude IS NOT NULL THEN
      NEW.location_latitude := owner_latitude;
      NEW.location_longitude := owner_longitude;
      NEW.location_label := owner_label;
      NEW.location_source := 'owner';
      NEW.location_kind := owner_kind;
      NEW.location_place_id := owner_place_id;
      NEW.location_boundary_source := owner_boundary_source;
      NEW.location_geometry := owner_geometry;
      NEW.location_bounds := owner_bounds;
      RETURN NEW;
    END IF;
  END IF;

  NEW.location_latitude := NULL;
  NEW.location_longitude := NULL;
  NEW.location_label := NULL;
  NEW.location_source := NULL;
  NEW.location_kind := NULL;
  NEW.location_place_id := NULL;
  NEW.location_boundary_source := NULL;
  NEW.location_geometry := NULL;
  NEW.location_bounds := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_user_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.search_document
  SET
    location_latitude = NULL,
    location_longitude = NULL,
    location_label = NULL,
    location_source = NULL,
    location_kind = NULL,
    location_place_id = NULL,
    location_boundary_source = NULL,
    location_geometry = NULL,
    location_bounds = NULL,
    updated_at = updated_at
  WHERE owner_user_id = NEW.id
    OR id = public.search_document_id('user', NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_group_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.search_document
  SET
    location_latitude = NULL,
    location_longitude = NULL,
    location_label = NULL,
    location_source = NULL,
    location_kind = NULL,
    location_place_id = NULL,
    location_boundary_source = NULL,
    location_geometry = NULL,
    location_bounds = NULL,
    updated_at = updated_at
  WHERE group_id = NEW.id
    OR id = public.search_document_id('group', NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_blog_search_document_from_blogger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_blog_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_blog_id := OLD.blog_id;
  ELSE
    target_blog_id := NEW.blog_id;
  END IF;

  UPDATE public.search_document
  SET updated_at = updated_at
  WHERE id = public.search_document_id('blog', target_blog_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_search_document_topics(
  p_document_id TEXT,
  p_topics JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  normalized_topics JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.search_document WHERE id = p_document_id
  ) THEN
    RETURN;
  END IF;

  normalized_topics := CASE
    WHEN jsonb_typeof(p_topics) = 'array' THEN p_topics
    ELSE '[]'::jsonb
  END;

  DELETE FROM public.search_document_topic
  WHERE document_id = p_document_id;

  INSERT INTO public.search_document_topic (document_id, topic)
  SELECT DISTINCT p_document_id, lower(trim(value))
  FROM jsonb_array_elements_text(normalized_topics) AS topic_value(value)
  WHERE nullif(trim(value), '') IS NOT NULL
  ON CONFLICT (document_id, topic) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_search_document_topics(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.user_hashtag AS uh
  JOIN public.hashtag AS h ON h.id = uh.hashtag_id
  WHERE uh.user_id = target_user_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('user', target_user_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_group_search_document_topics(target_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.group_hashtag AS gh
  JOIN public.hashtag AS h ON h.id = gh.hashtag_id
  WHERE gh.group_id = target_group_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('group', target_group_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_statement_search_document_topics(target_statement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.statement_hashtag AS sh
  JOIN public.hashtag AS h ON h.id = sh.hashtag_id
  WHERE sh.statement_id = target_statement_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('statement', target_statement_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_blog_search_document_topics(target_blog_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.blog_hashtag AS bh
  JOIN public.hashtag AS h ON h.id = bh.hashtag_id
  WHERE bh.blog_id = target_blog_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('blog', target_blog_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_amendment_search_document_topics(target_amendment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  WITH topic_values AS (
    SELECT value AS topic
    FROM public.amendment AS a,
      jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(a.tags) = 'array' THEN a.tags ELSE '[]'::jsonb END
      ) AS tag_value(value)
    WHERE a.id = target_amendment_id
    UNION
    SELECT h.tag
    FROM public.amendment_hashtag AS ah
    JOIN public.hashtag AS h ON h.id = ah.hashtag_id
    WHERE ah.amendment_id = target_amendment_id
  )
  SELECT coalesce(jsonb_agg(topic ORDER BY topic), '[]'::jsonb)
  INTO topics
  FROM topic_values;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('amendment', target_amendment_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_search_document_topics(target_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.event_hashtag AS eh
  JOIN public.hashtag AS h ON h.id = eh.hashtag_id
  WHERE eh.event_id = target_event_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('event', target_event_id),
    topics
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dataset_search_document_topics(target_dataset_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  topics JSONB;
BEGIN
  SELECT CASE
    WHEN jsonb_typeof(d.topics) = 'array' THEN d.topics
    ELSE '[]'::jsonb
  END
  INTO topics
  FROM public.dataset AS d
  WHERE d.id = target_dataset_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('dataset', target_dataset_id),
    coalesce(topics, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  display_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('user', OLD.id);
    RETURN OLD;
  END IF;

  display_name := coalesce(
    nullif(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
    nullif(NEW.handle, ''),
    NEW.email,
    'User'
  );

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
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('user', NEW.id),
    'user',
    NEW.id,
    display_name,
    CASE WHEN nullif(NEW.handle, '') IS NULL THEN NEW.city ELSE '@' || NEW.handle END,
    NEW.bio,
    concat_ws(
      ' ',
      display_name,
      NEW.handle,
      NEW.email,
      NEW.bio,
      NEW.city,
      NEW.region,
      NEW.country,
      public.search_document_json_text(NEW.about)
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.id,
    NEW.avatar,
    jsonb_build_object(
      'type', 'user',
      'handle', NEW.handle,
      'stats', jsonb_build_object(
        'subscribers', NEW.subscriber_count,
        'amendments', NEW.amendment_count,
        'groups', NEW.group_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.subscriber_count, 0) + coalesce(NEW.amendment_count, 0) + coalesce(NEW.group_count, 0),
    coalesce(NEW.subscriber_count, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_user_search_document_topics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_group_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('group', OLD.id);
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
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('group', NEW.id),
    'group',
    NEW.id,
    coalesce(nullif(NEW.name, ''), 'Group'),
    concat_ws(', ', nullif(NEW.city, ''), nullif(NEW.region, ''), nullif(NEW.country, '')),
    left(public.search_document_json_text(NEW.description), 320),
    concat_ws(
      ' ',
      NEW.name,
      public.search_document_json_text(NEW.description),
      NEW.city,
      NEW.region,
      NEW.country
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.owner_id,
    NEW.id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'group',
      'group_type', NEW.group_type,
      'connected_group_id', NEW.connected_group_id,
      'primary_sibling_membership_mode', NEW.primary_sibling_membership_mode,
      'location', concat_ws(', ', nullif(NEW.city, ''), nullif(NEW.region, ''), nullif(NEW.country, '')),
      'stats', jsonb_build_object(
        'members', NEW.member_count,
        'subscribers', NEW.subscriber_count,
        'events', NEW.event_count,
        'amendments', NEW.amendment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.member_count, 0) + coalesce(NEW.subscriber_count, 0) + coalesce(NEW.event_count, 0) + coalesce(NEW.amendment_count, 0),
    coalesce(NEW.subscriber_count, 0)
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
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_group_search_document_topics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_statement_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('statement', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
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
    public.search_document_id('statement', NEW.id),
    'statement',
    NEW.id,
    coalesce(nullif(left(NEW.text, 100), ''), 'Statement'),
    NEW.text,
    coalesce(NEW.text, ''),
    coalesce(NEW.visibility, 'public'),
    NEW.user_id,
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'statement',
      'stats', jsonb_build_object(
        'upvotes', NEW.upvotes,
        'comments', NEW.comment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0) + coalesce(NEW.comment_count, 0),
    coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
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
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_statement_search_document_topics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_blog_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('blog', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    summary,
    search_text,
    visibility,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('blog', NEW.id),
    'blog',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Blog'),
    coalesce(NEW.description, left(public.search_document_json_text(NEW.content), 320)),
    concat_ws(' ', NEW.title, NEW.description, public.search_document_json_text(NEW.content)),
    coalesce(NEW.visibility, 'public'),
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'blog',
      'stats', jsonb_build_object(
        'likes', NEW.like_count,
        'comments', NEW.comment_count,
        'supporters', NEW.supporter_count,
        'subscribers', NEW.subscriber_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.like_count, 0) + coalesce(NEW.comment_count, 0) + coalesce(NEW.supporter_count, 0) + coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0),
    coalesce(NEW.like_count, 0) + coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_blog_search_document_topics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.amendment_supporting_group_count(target_amendment_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT count(*)::INTEGER
  FROM public.amendment_group_decision decision
  LEFT JOIN LATERAL (
    SELECT confirmation.status
    FROM public.support_confirmation confirmation
    WHERE confirmation.amendment_id = decision.amendment_id
      AND confirmation.group_id = decision.group_id
    ORDER BY confirmation.created_at DESC, confirmation.id DESC
    LIMIT 1
  ) latest_confirmation ON true
  WHERE decision.amendment_id = target_amendment_id
    AND decision.status IN ('supported', 'accepted')
    AND coalesce(latest_confirmation.status, '') NOT IN ('declined', 'withdrawn');
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
        'comments', amendment_row.comment_count,
        'subscribers', amendment_row.subscriber_count,
        'collaborators', amendment_row.collaborator_count
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
    location_source = EXCLUDED.location_source,
    location_kind = EXCLUDED.location_kind,
    location_place_id = EXCLUDED.location_place_id,
    location_boundary_source = EXCLUDED.location_boundary_source,
    location_geometry = EXCLUDED.location_geometry,
    location_bounds = EXCLUDED.location_bounds;

  PERFORM public.sync_amendment_search_document_topics(amendment_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_amendment_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('amendment', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_amendment_search_document(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document_from_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_amendment_id UUID;
BEGIN
  target_amendment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.amendment_id ELSE NEW.amendment_id END;

  IF TG_OP = 'UPDATE' AND OLD.amendment_id IS DISTINCT FROM NEW.amendment_id THEN
    PERFORM public.refresh_amendment_search_document(OLD.amendment_id);
  END IF;

  IF target_amendment_id IS NOT NULL THEN
    PERFORM public.refresh_amendment_search_document(target_amendment_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_dataset_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.delete_inactive_dataset_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('dataset', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_inactive_dataset_search_document() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.upsert_event_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('event', OLD.id);
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
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('event', NEW.id),
    'event',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Event'),
    concat_ws(', ', nullif(NEW.location_name, ''), nullif(NEW.city, ''), nullif(NEW.country, '')),
    left(public.search_document_json_text(NEW.description), 320),
    concat_ws(
      ' ',
      NEW.title,
      public.search_document_json_text(NEW.description),
      NEW.event_type,
      NEW.location_name,
      NEW.city,
      NEW.region,
      NEW.country
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.creator_id,
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'event',
      'event_type', NEW.event_type,
      'location', concat_ws(', ', nullif(NEW.location_name, ''), nullif(NEW.city, ''), nullif(NEW.country, '')),
      'starts_at', public.search_document_epoch_ms(NEW.start_date),
      'ends_at', public.search_document_epoch_ms(NEW.end_date),
      'status', NEW.status,
      'stats', jsonb_build_object(
        'participants', NEW.participant_count,
        'subscribers', NEW.subscriber_count,
        'amendments', NEW.amendment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.participant_count, 0) + coalesce(NEW.subscriber_count, 0) + coalesce(NEW.amendment_count, 0) + coalesce(NEW.election_count, 0),
    coalesce(NEW.participant_count, 0)
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
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_event_search_document_topics(NEW.id);
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.upsert_timeline_event_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  projected_type TEXT;
  projected_entity_id UUID;
  score INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('timeline_event', OLD.id);
    RETURN OLD;
  END IF;

  projected_type := coalesce(NEW.content_type, NEW.entity_type, 'timeline_event');
  projected_entity_id := coalesce(NEW.entity_id, NEW.id);
  score := CASE
    WHEN NEW.stats ? 'score' AND (NEW.stats ->> 'score') ~ '^-?[0-9]+$'
      THEN (NEW.stats ->> 'score')::integer
    ELSE 0
  END;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
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
    public.search_document_id('timeline_event', NEW.id),
    projected_type,
    projected_entity_id,
    coalesce(nullif(NEW.title, ''), 'Timeline item'),
    NEW.description,
    concat_ws(
      ' ',
      NEW.title,
      NEW.description,
      NEW.event_type,
      NEW.entity_type,
      NEW.content_type,
      public.search_document_json_text(NEW.metadata),
      public.search_document_json_text(NEW.tags)
    ),
    'public',
    coalesce(NEW.user_id, NEW.actor_id),
    NEW.group_id,
    coalesce(NEW.image_url, NEW.video_thumbnail_url),
    jsonb_build_object(
      'type', projected_type,
      'status', coalesce(NEW.vote_status, NEW.election_status),
      'ends_at', public.search_document_epoch_ms(NEW.ends_at),
      'entity_type', NEW.entity_type,
      'entity_id', projected_entity_id,
      'metadata', coalesce(NEW.metadata, '{}'::jsonb),
      'stats', coalesce(NEW.stats, '{}'::jsonb)
    ),
    NEW.created_at,
    NEW.created_at,
    score,
    score
  )
  ON CONFLICT (id) DO UPDATE SET
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    title = EXCLUDED.title,
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
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('timeline_event', NEW.id),
    NEW.tags
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_user_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_user_search_document_topics(OLD.user_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_user_search_document_topics(NEW.user_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_group_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_group_search_document_topics(OLD.group_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_group_search_document_topics(NEW.group_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_statement_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_statement_search_document_topics(OLD.statement_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_statement_search_document_topics(NEW.statement_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_blog_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_blog_search_document_topics(OLD.blog_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_blog_search_document_topics(NEW.blog_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_amendment_search_document_topics(OLD.amendment_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_amendment_search_document_topics(NEW.amendment_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_event_search_document_topics_from_hashtag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_event_search_document_topics(OLD.event_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_event_search_document_topics(NEW.event_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_search_document_user
AFTER INSERT OR UPDATE OR DELETE ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.upsert_user_search_document();

CREATE TRIGGER trg_search_document_group
AFTER INSERT OR UPDATE OR DELETE ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.upsert_group_search_document();

CREATE TRIGGER trg_search_document_statement
AFTER INSERT OR UPDATE OR DELETE ON public.statement
FOR EACH ROW EXECUTE FUNCTION public.upsert_statement_search_document();

CREATE TRIGGER trg_search_document_blog
AFTER INSERT OR UPDATE OR DELETE ON public.blog
FOR EACH ROW EXECUTE FUNCTION public.upsert_blog_search_document();

CREATE TRIGGER trg_search_document_amendment
AFTER INSERT OR UPDATE OR DELETE ON public.amendment
FOR EACH ROW EXECUTE FUNCTION public.upsert_amendment_search_document();

CREATE TRIGGER trg_search_document_amendment_group_decision
AFTER INSERT OR UPDATE OR DELETE ON public.amendment_group_decision
FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_support_confirmation
AFTER INSERT OR UPDATE OR DELETE ON public.support_confirmation
FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_event
AFTER INSERT OR UPDATE OR DELETE ON public.event
FOR EACH ROW EXECUTE FUNCTION public.upsert_event_search_document();

CREATE TRIGGER trg_search_document_todo
AFTER INSERT OR UPDATE OR DELETE ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.upsert_todo_search_document();

CREATE TRIGGER trg_search_document_election
AFTER INSERT OR UPDATE OR DELETE ON public.election
FOR EACH ROW EXECUTE FUNCTION public.upsert_election_search_document();

CREATE TRIGGER trg_search_document_timeline_event
AFTER INSERT OR UPDATE OR DELETE ON public.timeline_event
FOR EACH ROW EXECUTE FUNCTION public.upsert_timeline_event_search_document();

CREATE TRIGGER trg_search_document_populate_location
BEFORE INSERT OR UPDATE ON public.search_document
FOR EACH ROW EXECUTE FUNCTION public.populate_search_document_location();

CREATE TRIGGER trg_search_document_user_location_refresh
AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds
ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_user_location();

CREATE TRIGGER trg_search_document_group_location_refresh
AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds
ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_group_location();

CREATE TRIGGER trg_search_document_blog_blogger_location_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.blog_blogger
FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_from_blogger();

CREATE TRIGGER trg_search_document_user_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.user_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_user_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_group_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.group_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_group_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_statement_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.statement_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_statement_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_blog_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.blog_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_amendment_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.amendment_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_event_hashtag
AFTER INSERT OR UPDATE OR DELETE ON public.event_hashtag
FOR EACH ROW EXECUTE FUNCTION public.refresh_event_search_document_topics_from_hashtag();

-- Keep private search results aligned with the same relationship rules as
-- entity reads. Public/authenticated documents do not need ACL rows.

CREATE OR REPLACE FUNCTION public.search_document_group_acl_users(target_group_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT g.owner_id
  FROM public."group" AS g
  WHERE g.id = target_group_id
    AND g.owner_id IS NOT NULL
  UNION
  SELECT gm.user_id
  FROM public.group_membership AS gm
  WHERE gm.group_id = target_group_id
    AND gm.status IN ('active', 'member', 'admin')
  UNION
  SELECT ga.user_id
  FROM public.group_guest_access AS ga
  WHERE ga.group_id = target_group_id
    AND ga.status = 'active';
$$;

-- Group documents are discoverable under a stricter rule than their child
-- documents: a valid group role must explicitly grant groups:view/manage.
CREATE OR REPLACE FUNCTION public.search_document_group_discovery_acl_users(target_group_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT g.owner_id
  FROM public."group" AS g
  WHERE g.id = target_group_id
    AND g.owner_id IS NOT NULL
  UNION
  SELECT gm.user_id
  FROM public.group_membership AS gm
  JOIN public.group_membership_role AS gmr ON gmr.group_membership_id = gm.id
  JOIN public.role AS r
    ON r.id = gmr.role_id
   AND r.scope = 'group'
   AND r.group_id = target_group_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.group_id = target_group_id
   AND ar.resource = 'groups'
   AND ar.action IN ('view', 'manage')
  WHERE gm.group_id = target_group_id
    AND gm.status IN ('invited', 'active', 'member', 'admin')
  UNION
  SELECT ga.user_id
  FROM public.group_guest_access AS ga
  JOIN public.group_guest_role AS ggr ON ggr.group_guest_access_id = ga.id
  JOIN public.role AS r
    ON r.id = ggr.role_id
   AND r.scope = 'group'
   AND r.group_id = target_group_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.group_id = target_group_id
   AND ar.resource = 'groups'
   AND ar.action IN ('view', 'manage')
  WHERE ga.group_id = target_group_id
    AND ga.status IN ('invited', 'active');
$$;

-- Keep this list in parity with src/zero/rbac/constants.ts VIEW_IMPLYING_ACTIONS.
CREATE OR REPLACE FUNCTION public.permission_action_implies_view(target_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT target_action IN (
    'view',
    'manage',
    'moderate',
    'manage_members',
    'manage_roles',
    'manage_participants',
    'manage_speakers',
    'manage_votes',
    'speak'
  );
$$;

CREATE OR REPLACE FUNCTION public.search_document_event_discovery_acl_users(target_event_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.creator_id
  FROM public.event AS e
  WHERE e.id = target_event_id
    AND e.creator_id IS NOT NULL
  UNION
  SELECT ep.user_id
  FROM public.event_participant AS ep
  JOIN public.event_participant_role AS epr ON epr.event_participant_id = ep.id
  JOIN public.role AS r
    ON r.id = epr.role_id
   AND r.scope = 'event'
   AND r.event_id = target_event_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.event_id = target_event_id
   AND ar.resource = 'events'
   AND public.permission_action_implies_view(ar.action)
  WHERE ep.event_id = target_event_id
    AND ep.status IN ('invited', 'active', 'confirmed', 'member', 'admin')
  UNION
  SELECT access.user_id
  FROM public.event AS e
  CROSS JOIN LATERAL public.search_document_group_acl_users(e.group_id) AS access
  WHERE e.id = target_event_id
    AND e.group_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.search_document_amendment_discovery_acl_users(
  target_amendment_id UUID
)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.created_by_id
  FROM public.amendment AS a
  WHERE a.id = target_amendment_id
    AND a.created_by_id IS NOT NULL
  UNION
  SELECT ac.user_id
  FROM public.amendment_collaborator AS ac
  JOIN public.role AS r
    ON r.id = ac.role_id
   AND r.scope = 'amendment'
   AND r.amendment_id = target_amendment_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.amendment_id = target_amendment_id
   AND ar.resource = 'amendments'
   AND public.permission_action_implies_view(ar.action)
  WHERE ac.amendment_id = target_amendment_id
    AND ac.status IN ('invited', 'active', 'collaborator', 'member', 'admin')
  UNION
  SELECT access.user_id
  FROM public.amendment AS a
  CROSS JOIN LATERAL public.search_document_group_acl_users(a.group_id) AS access
  WHERE a.id = target_amendment_id
    AND a.group_id IS NOT NULL
  UNION
  SELECT ep.user_id
  FROM public.amendment AS a
  JOIN public.event_participant AS ep ON ep.event_id = a.event_id
  WHERE a.id = target_amendment_id
    AND ep.status IN ('active', 'confirmed', 'member', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.search_document_blog_discovery_acl_users(target_blog_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT bb.user_id
  FROM public.blog_blogger AS bb
  WHERE bb.blog_id = target_blog_id
    AND bb.status = 'owner'
  UNION
  SELECT bb.user_id
  FROM public.blog_blogger AS bb
  JOIN public.role AS r
    ON r.id = bb.role_id
   AND r.scope = 'blog'
   AND r.blog_id = target_blog_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.blog_id = target_blog_id
   AND ar.resource = 'blogs'
   AND public.permission_action_implies_view(ar.action)
  WHERE bb.blog_id = target_blog_id
    AND bb.status IN ('invited', 'admin', 'member', 'writer')
  UNION
  SELECT access.user_id
  FROM public.blog AS b
  CROSS JOIN LATERAL public.search_document_group_acl_users(b.group_id) AS access
  WHERE b.id = target_blog_id
    AND b.group_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl(
  target_entity_type TEXT,
  target_entity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_document_id TEXT := public.search_document_id(target_entity_type, target_entity_id);
  target_visibility TEXT;
  source_type TEXT;
  source_id UUID;
BEGIN
  DELETE FROM public.search_document_acl
  WHERE document_id = target_document_id;

  SELECT visibility
  INTO target_visibility
  FROM public.search_document
  WHERE id = target_document_id;

  IF target_visibility IS DISTINCT FROM 'private' THEN
    RETURN;
  END IF;

  IF target_entity_type = 'user' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    VALUES (target_document_id, target_entity_id)
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'group' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_group_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'statement' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT s.user_id
      FROM public.statement AS s
      WHERE s.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.statement AS s
      CROSS JOIN LATERAL public.search_document_group_acl_users(s.group_id) AS access
      WHERE s.id = target_entity_id
        AND s.group_id IS NOT NULL
    ) AS candidates
    WHERE candidates.user_id IS NOT NULL
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'blog' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_blog_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'amendment' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_amendment_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'event' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_event_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'todo' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT t.creator_id AS user_id
      FROM public.todo AS t
      WHERE t.id = target_entity_id
      UNION
      SELECT ta.user_id
      FROM public.todo_assignment AS ta
      WHERE ta.todo_id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      CROSS JOIN LATERAL public.search_document_group_acl_users(t.group_id) AS access
      WHERE t.id = target_entity_id
        AND t.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.todo AS t
      JOIN public.event_participant AS ep ON ep.event_id = t.event_id
      WHERE t.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
      UNION
      SELECT e.creator_id
      FROM public.todo AS t
      JOIN public.event AS e ON e.id = t.event_id
      WHERE t.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      JOIN public.event AS e ON e.id = t.event_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(e.group_id) AS access
      WHERE t.id = target_entity_id
        AND e.group_id IS NOT NULL
      UNION
      SELECT a.created_by_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      WHERE t.id = target_entity_id
      UNION
      SELECT ac.user_id
      FROM public.todo AS t
      JOIN public.amendment_collaborator AS ac ON ac.amendment_id = t.amendment_id
      WHERE t.id = target_entity_id
        AND ac.status IN ('active', 'collaborator', 'member', 'admin')
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(a.group_id) AS access
      WHERE t.id = target_entity_id
        AND a.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      JOIN public.event_participant AS ep ON ep.event_id = a.event_id
      WHERE t.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'dataset' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT d.owner_user_id AS user_id
      FROM public.dataset AS d
      WHERE d.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.dataset AS d
      CROSS JOIN LATERAL public.search_document_group_acl_users(d.group_id) AS access
      WHERE d.id = target_entity_id
        AND d.group_id IS NOT NULL
    ) AS candidates
    WHERE candidates.user_id IS NOT NULL
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'election' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT el.user_id
      FROM public.elector AS el
      WHERE el.election_id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.election AS e
      JOIN public.role AS r ON r.id = e.role_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(r.group_id) AS access
      WHERE e.id = target_entity_id
        AND r.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.election AS e
      JOIN public.agenda_item AS ai ON ai.id = e.agenda_item_id
      JOIN public.event_participant AS ep ON ep.event_id = ai.event_id
      WHERE e.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'timeline_event' THEN
    SELECT
      CASE
        WHEN te.todo_id IS NOT NULL THEN 'todo'
        WHEN te.statement_id IS NOT NULL THEN 'statement'
        WHEN te.amendment_id IS NOT NULL THEN 'amendment'
        WHEN te.event_id IS NOT NULL THEN 'event'
        WHEN te.blog_id IS NOT NULL THEN 'blog'
        WHEN te.group_id IS NOT NULL THEN 'group'
        WHEN te.election_id IS NOT NULL THEN 'election'
        WHEN te.user_id IS NOT NULL THEN 'user'
        WHEN te.actor_id IS NOT NULL THEN 'user'
        ELSE NULL
      END,
      coalesce(
        te.todo_id,
        te.statement_id,
        te.amendment_id,
        te.event_id,
        te.blog_id,
        te.group_id,
        te.election_id,
        te.user_id,
        te.actor_id
      )
    INTO source_type, source_id
    FROM public.timeline_event AS te
    WHERE te.id = target_entity_id;

    IF source_type IS NOT NULL AND source_id IS NOT NULL THEN
      INSERT INTO public.search_document_acl (document_id, user_id)
      SELECT target_document_id, acl.user_id
      FROM public.search_document_acl AS acl
      WHERE acl.document_id = public.search_document_id(source_type, source_id)
      ON CONFLICT (document_id, user_id) DO NOTHING;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_with_derivatives(
  target_entity_type TEXT,
  target_entity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  timeline_row RECORD;
BEGIN
  PERFORM public.sync_search_document_acl(target_entity_type, target_entity_id);

  IF target_entity_type = 'timeline_event' THEN
    RETURN;
  END IF;

  IF target_entity_type = 'event' THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', a.id)
    FROM public.amendment AS a
    WHERE a.event_id = target_entity_id;

    PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
    FROM public.todo AS t
    WHERE t.event_id = target_entity_id;
  ELSIF target_entity_type = 'amendment' THEN
    PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
    FROM public.todo AS t
    WHERE t.amendment_id = target_entity_id;
  END IF;

  FOR timeline_row IN
    SELECT te.id
    FROM public.timeline_event AS te
    WHERE
      (target_entity_type = 'todo' AND te.todo_id = target_entity_id)
      OR (target_entity_type = 'statement' AND te.statement_id = target_entity_id)
      OR (target_entity_type = 'amendment' AND te.amendment_id = target_entity_id)
      OR (target_entity_type = 'event' AND te.event_id = target_entity_id)
      OR (target_entity_type = 'blog' AND te.blog_id = target_entity_id)
      OR (target_entity_type = 'group' AND te.group_id = target_entity_id)
      OR (target_entity_type = 'election' AND te.election_id = target_entity_id)
      OR (
        target_entity_type = 'user'
        AND (te.user_id = target_entity_id OR te.actor_id = target_entity_id)
      )
  LOOP
    UPDATE public.search_document AS timeline_document
    SET visibility = coalesce((
      SELECT visibility
      FROM public.search_document
      WHERE id = public.search_document_id(target_entity_type, target_entity_id)
    ), timeline_document.visibility)
    WHERE timeline_document.id = public.search_document_id('timeline_event', timeline_row.id);

    PERFORM public.sync_search_document_acl('timeline_event', timeline_row.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_group_search_document_acls(target_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  document_row RECORD;
BEGIN
  FOR document_row IN
    SELECT sd.entity_type, sd.entity_id
    FROM public.search_document AS sd
    WHERE sd.group_id = target_group_id
      AND sd.entity_type IN (
        'group',
        'statement',
        'blog',
        'amendment',
        'event',
        'todo',
        'dataset',
        'election'
      )
  LOOP
    PERFORM public.sync_search_document_acl_with_derivatives(
      document_row.entity_type,
      document_row.entity_id
    );
  END LOOP;

  PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
  FROM public.todo AS t
  LEFT JOIN public.event AS e ON e.id = t.event_id
  LEFT JOIN public.amendment AS a ON a.id = t.amendment_id
  WHERE e.group_id = target_group_id
     OR a.group_id = target_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_entity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  entity_type TEXT := TG_TABLE_NAME;
  entity_id UUID := NEW.id;
BEGIN
  IF entity_type = 'user' THEN
    entity_type := 'user';
  END IF;

  PERFORM public.sync_search_document_acl_with_derivatives(entity_type, entity_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_timeline_search_document_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  source_visibility TEXT;
BEGIN
  source_visibility := coalesce(
    (SELECT t.visibility FROM public.todo AS t WHERE t.id = NEW.todo_id),
    (SELECT s.visibility FROM public.statement AS s WHERE s.id = NEW.statement_id),
    (SELECT a.visibility FROM public.amendment AS a WHERE a.id = NEW.amendment_id),
    (SELECT e.visibility FROM public.event AS e WHERE e.id = NEW.event_id),
    (SELECT b.visibility FROM public.blog AS b WHERE b.id = NEW.blog_id),
    (SELECT g.visibility FROM public."group" AS g WHERE g.id = NEW.group_id),
    (SELECT e.visibility FROM public.election AS e WHERE e.id = NEW.election_id),
    (SELECT u.visibility FROM public."user" AS u WHERE u.id = coalesce(NEW.user_id, NEW.actor_id)),
    'public'
  );

  UPDATE public.search_document
  SET visibility = source_visibility
  WHERE id = public.search_document_id('timeline_event', NEW.id);

  PERFORM public.sync_search_document_acl('timeline_event', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_search_document_acl_relation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_parent_id UUID;
  new_parent_id UUID;
BEGIN
  IF TG_TABLE_NAME IN ('group_membership', 'group_guest_access') THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.group_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.group_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'group_membership_role' THEN
    old_parent_id := CASE
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
        SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = OLD.group_membership_id
      )
      ELSE NULL
    END;
    new_parent_id := CASE
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
        SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = NEW.group_membership_id
      )
      ELSE NULL
    END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'group_guest_role' THEN
    old_parent_id := CASE
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
        SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = OLD.group_guest_access_id
      )
      ELSE NULL
    END;
    new_parent_id := CASE
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
        SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = NEW.group_guest_access_id
      )
      ELSE NULL
    END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME IN ('action_right', 'role') THEN
    old_parent_id := CASE
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
        CASE WHEN TG_TABLE_NAME = 'action_right' THEN
          (SELECT r.group_id FROM public.role AS r WHERE r.id = OLD.role_id)
        ELSE OLD.group_id END
      )
      ELSE NULL
    END;
    new_parent_id := CASE
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
        CASE WHEN TG_TABLE_NAME = 'action_right' THEN
          (SELECT r.group_id FROM public.role AS r WHERE r.id = NEW.role_id)
        ELSE NEW.group_id END
      )
      ELSE NULL
    END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'event_participant' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('event', old_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'amendment',
        a.id
      ) FROM public.amendment AS a WHERE a.event_id = old_parent_id;
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.event_id = old_parent_id;
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('event', new_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'amendment',
        a.id
      ) FROM public.amendment AS a WHERE a.event_id = new_parent_id;
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.event_id = new_parent_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'amendment_collaborator' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('amendment', old_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.amendment_id = old_parent_id;
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('amendment', new_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.amendment_id = new_parent_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'blog_blogger' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('blog', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('blog', new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'todo_assignment' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.todo_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.todo_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('todo', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('todo', new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'elector' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.election_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.election_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('election', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('election', new_parent_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_zz_search_document_acl_user
AFTER INSERT OR UPDATE ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group
AFTER INSERT OR UPDATE ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_statement
AFTER INSERT OR UPDATE ON public.statement
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_blog
AFTER INSERT OR UPDATE ON public.blog
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_amendment
AFTER INSERT OR UPDATE ON public.amendment
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_event
AFTER INSERT OR UPDATE ON public.event
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_todo
AFTER INSERT OR UPDATE ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_election
AFTER INSERT OR UPDATE ON public.election
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_timeline_event
AFTER INSERT OR UPDATE ON public.timeline_event
FOR EACH ROW EXECUTE FUNCTION public.sync_timeline_search_document_privacy();

CREATE TRIGGER trg_zz_search_document_acl_group_membership
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_access
AFTER INSERT OR UPDATE OR DELETE ON public.group_guest_access
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_membership_role
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_role
AFTER INSERT OR UPDATE OR DELETE ON public.group_guest_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role
AFTER INSERT OR UPDATE OR DELETE ON public.role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_event_participant
AFTER INSERT OR UPDATE OR DELETE ON public.event_participant
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_amendment_collaborator
AFTER INSERT OR UPDATE OR DELETE ON public.amendment_collaborator
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_blog_blogger
AFTER INSERT OR UPDATE OR DELETE ON public.blog_blogger
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_todo_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.todo_assignment
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_elector
AFTER INSERT OR UPDATE OR DELETE ON public.elector
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE OR REPLACE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_event_id UUID;
  new_event_id UUID;
  old_amendment_id UUID;
  new_amendment_id UUID;
  old_blog_id UUID;
  new_blog_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'event_participant_role' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT ep.event_id
      FROM public.event_participant AS ep
      WHERE ep.id = OLD.event_participant_id
    ) END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT ep.event_id
      FROM public.event_participant AS ep
      WHERE ep.id = NEW.event_participant_id
    ) END;
  ELSIF TG_TABLE_NAME = 'action_right' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id END;
    old_amendment_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id END;
    new_amendment_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id END;
    old_blog_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id END;
    new_blog_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id END;
  ELSIF TG_TABLE_NAME = 'role' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id END;
    old_amendment_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id END;
    new_amendment_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id END;
    old_blog_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id END;
    new_blog_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id END;
  END IF;

  IF old_event_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('event', old_event_id);
  END IF;
  IF new_event_id IS NOT NULL AND new_event_id IS DISTINCT FROM old_event_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('event', new_event_id);
  END IF;
  IF old_amendment_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', old_amendment_id);
  END IF;
  IF new_amendment_id IS NOT NULL AND new_amendment_id IS DISTINCT FROM old_amendment_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', new_amendment_id);
  END IF;
  IF old_blog_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('blog', old_blog_id);
  END IF;
  IF new_blog_id IS NOT NULL AND new_blog_id IS DISTINCT FROM old_blog_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('blog', new_blog_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_zz_search_document_acl_event_participant_role_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.event_participant_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right_entity_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role_entity_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.role
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();
