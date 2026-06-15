alter table "public"."search_document" add column if not exists "location_label" text;

alter table "public"."search_document" add column if not exists "location_latitude" double precision;

alter table "public"."search_document" add column if not exists "location_longitude" double precision;

alter table "public"."search_document" add column if not exists "location_source" text;

CREATE INDEX IF NOT EXISTS idx_search_document_location ON public.search_document USING btree (location_latitude, location_longitude) WHERE ((location_latitude IS NOT NULL) AND (location_longitude IS NOT NULL));

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.populate_search_document_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_blog_search_document_from_blogger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_group_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.search_document
  SET updated_at = updated_at
  WHERE group_id = NEW.id
    OR id = public.search_document_id('group', NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_user_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.search_document
  SET updated_at = updated_at
  WHERE owner_user_id = NEW.id
    OR id = public.search_document_id('user', NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_format_location(p_location_name text, p_country text, p_region text, p_post_code text, p_city text, p_street text, p_house_number text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_epoch_ms(value timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE floor(extract(epoch FROM value) * 1000)::bigint
  END;
$function$
;

CREATE TRIGGER trg_search_document_blog_blogger_location_refresh AFTER INSERT OR DELETE OR UPDATE ON public.blog_blogger FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_from_blogger();

CREATE TRIGGER trg_search_document_group_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude ON public."group" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_group_location();

CREATE TRIGGER trg_search_document_populate_location BEFORE INSERT OR UPDATE ON public.search_document FOR EACH ROW EXECUTE FUNCTION public.populate_search_document_location();

CREATE TRIGGER trg_search_document_user_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude ON public."user" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_user_location();

UPDATE public.search_document
SET updated_at = updated_at;

