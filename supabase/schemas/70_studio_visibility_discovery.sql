-- 70_studio_visibility_discovery.sql: canonical current definitions; historical upgrades are not replayed.

CREATE FUNCTION public.refresh_studio_search_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE gid uuid;
DECLARE old_gid uuid;
DECLARE pid uuid;
BEGIN
  IF TG_TABLE_NAME='studio_project' THEN
    IF TG_OP<>'DELETE' THEN PERFORM public.sync_studio_search_acl(NEW.id); END IF;
  ELSIF TG_TABLE_NAME='studio_project_collaborator' THEN
    IF TG_OP<>'INSERT' THEN PERFORM public.sync_studio_search_acl(OLD.project_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM public.sync_studio_search_acl(NEW.project_id); END IF;
  ELSE
    IF TG_TABLE_NAME='group_membership' THEN
      gid := CASE WHEN TG_OP='DELETE' THEN OLD.group_id ELSE NEW.group_id END;
      IF TG_OP='UPDATE' THEN old_gid := OLD.group_id; END IF;
    ELSIF TG_TABLE_NAME='group_membership_role' THEN
      SELECT group_id INTO gid FROM public.group_membership
      WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.group_membership_id ELSE NEW.group_membership_id END;
      IF TG_OP='UPDATE' THEN
        SELECT group_id INTO old_gid FROM public.group_membership WHERE id=OLD.group_membership_id;
      END IF;
    ELSIF TG_TABLE_NAME='action_right' THEN
      gid := CASE WHEN TG_OP='DELETE' THEN OLD.group_id ELSE NEW.group_id END;
      IF TG_OP='UPDATE' THEN old_gid := OLD.group_id; END IF;
    ELSIF TG_TABLE_NAME='group' THEN
      gid := NEW.id;
    END IF;
    IF gid IS NOT NULL THEN
      FOR pid IN SELECT id FROM public.studio_project WHERE group_id=gid AND visibility='private' LOOP
        PERFORM public.sync_studio_search_acl(pid);
      END LOOP;
    END IF;
    IF old_gid IS NOT NULL AND old_gid IS DISTINCT FROM gid THEN
      FOR pid IN SELECT id FROM public.studio_project WHERE group_id=old_gid AND visibility='private' LOOP
        PERFORM public.sync_studio_search_acl(pid);
      END LOOP;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.studio_collaboration_access(actor uuid, pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT coalesce((SELECT CASE WHEN p.event_id IS NOT NULL THEN event_studio_can_manage(actor,p.event_id)
 ELSE studio_collaboration_access_without_events(actor,pid) END FROM studio_project p WHERE p.id=pid),false);
$$;

CREATE FUNCTION public.studio_collaboration_access_without_events(actor uuid, pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT actor IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.studio_project p WHERE p.id=pid AND (
     p.owner_id=actor OR
     (p.group_id IS NULL AND EXISTS (
       SELECT 1 FROM public.studio_project_collaborator c
       WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
     (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,false)))
 );
$$;

CREATE FUNCTION public.sync_studio_search_acl(pid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 DECLARE eid uuid; doc_id text:=public.search_document_id('studio',pid);
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM search_document WHERE id=doc_id) THEN RETURN; END IF;
 SELECT event_id INTO eid FROM studio_project WHERE id=pid;
 IF eid IS NULL THEN PERFORM sync_studio_search_acl_without_events(pid); RETURN; END IF;
 DELETE FROM search_document_acl WHERE document_id=doc_id;
 INSERT INTO search_document_acl(document_id,user_id) SELECT doc_id,u.id FROM "user" u WHERE event_studio_can_read(u.id,eid) AND (SELECT visibility FROM studio_project WHERE id=pid)='private' ON CONFLICT(document_id,user_id) DO NOTHING;
 END;
$$;

CREATE FUNCTION public.sync_studio_search_acl_without_events(pid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE doc_id text := public.search_document_id('studio',pid);
BEGIN
  DELETE FROM public.search_document_acl WHERE document_id=doc_id;
  INSERT INTO public.search_document_acl(document_id,user_id)
  SELECT doc_id,candidates.user_id FROM (
    SELECT p.owner_id AS user_id FROM public.studio_project p WHERE p.id=pid AND p.visibility='private'
    UNION
    SELECT g.owner_id FROM public."group" g
    JOIN public.studio_project p ON p.group_id=g.id
    WHERE p.id=pid AND p.visibility='private'
    UNION
    SELECT c.user_id FROM public.studio_project_collaborator c
    JOIN public.studio_project p ON p.id=c.project_id
    WHERE c.project_id=pid AND c.status='active' AND p.group_id IS NULL AND p.visibility='private'
    UNION
    SELECT m.user_id FROM public.group_membership m
    JOIN public.studio_project p ON p.group_id=m.group_id
    WHERE p.id=pid AND p.visibility='private' AND m.status IN ('active','member','admin')
      AND public.studio_group_access(m.user_id,p.group_id,false)
  ) candidates
  ON CONFLICT (document_id,user_id) DO NOTHING;
END;
$$;

CREATE FUNCTION public.upsert_studio_search_document() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM public.search_document
    WHERE id=public.search_document_id('studio',OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.document_schema_version<>6 THEN RETURN NEW; END IF;
  INSERT INTO public.search_document (
    id,entity_type,entity_id,title,subtitle,search_text,visibility,
    owner_user_id,group_id,card_payload,created_at,updated_at
  ) VALUES (
    public.search_document_id('studio',NEW.id),'studio',NEW.id,NEW.title,NEW.kind,
    concat_ws(' ',NEW.title,NEW.kind),NEW.visibility,NEW.owner_id,NEW.group_id,
    jsonb_build_object('type','studio','kind',NEW.kind),
    to_timestamp(NEW.created_at/1000.0),to_timestamp(NEW.updated_at/1000.0)
  ) ON CONFLICT (id) DO UPDATE SET
    title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,search_text=EXCLUDED.search_text,
    visibility=EXCLUDED.visibility,owner_user_id=EXCLUDED.owner_user_id,
    group_id=EXCLUDED.group_id,card_payload=EXCLUDED.card_payload,
    updated_at=EXCLUDED.updated_at;
  UPDATE public.search_document SET tutorial_run_id=(SELECT e.tutorial_run_id FROM public.event e WHERE e.id=NEW.event_id) WHERE id=public.search_document_id('studio',NEW.id);
  RETURN NEW;
END;
$$;
