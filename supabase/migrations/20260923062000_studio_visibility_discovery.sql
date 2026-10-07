ALTER TABLE public.studio_project
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
  CONSTRAINT studio_project_visibility_check
  CHECK (visibility IN ('public', 'authenticated', 'private'));

CREATE OR REPLACE FUNCTION public.studio_access(actor uuid, pid uuid, edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
   CASE WHEN edit THEN
     actor IS NOT NULL AND (
       p.owner_id=actor OR
       (p.group_id IS NULL AND EXISTS (
         SELECT 1 FROM public.studio_project_collaborator c
         WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
       (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,true)))
   ELSE
     p.visibility='public' OR
     (actor IS NOT NULL AND (
       p.visibility='authenticated' OR p.owner_id=actor OR
       (p.group_id IS NULL AND EXISTS (
         SELECT 1 FROM public.studio_project_collaborator c
         WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
       (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,false))))
   END
 );
$$;

-- Published content can be read widely; procedures, Presence and AI chats cannot.
CREATE FUNCTION public.studio_collaboration_access(actor uuid,pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT actor IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.studio_project p WHERE p.id=pid AND (
     p.owner_id=actor OR
     (p.group_id IS NULL AND EXISTS (
       SELECT 1 FROM public.studio_project_collaborator c
       WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
     (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,false)))
 );
$$;
REVOKE ALL ON FUNCTION public.studio_collaboration_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_collaboration_access(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.canvas_capability(actor uuid,pid uuid,cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid
 AND public.studio_collaboration_access(actor,pid) AND
 CASE WHEN cap='read' THEN true
 WHEN cap='edit' THEN public.studio_access(actor,pid,true)
 WHEN cap='manage' THEN public.canvas_manage(actor,pid)
 WHEN cap IN ('suggest','comment','vote') THEN
  (p.group_id IS NOT NULL OR cap='comment') AND NOT EXISTS(
   SELECT 1 FROM public.group_membership m
   JOIN public.group_membership_role mr ON mr.group_membership_id=m.id
   JOIN public.role r ON r.id=mr.role_id AND r.group_id=p.group_id
   JOIN public.canvas_role_capability c ON c.role_id=r.id
   WHERE m.group_id=p.group_id AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND c.capability=cap AND NOT c.allowed
  ) ELSE false END);
$$;

CREATE OR REPLACE FUNCTION public.canvas_proposal_access(actor uuid,wid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.canvas_proposal w WHERE w.id=wid
 AND public.studio_collaboration_access(actor,w.project_id)
 AND (w.checksum IS NOT NULL OR w.owner_id=actor OR actor=ANY(w.shared_ids)));
$$;

CREATE OR REPLACE FUNCTION public.studio_realtime_access(topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN topic ~ '^studio:[0-9a-f-]{36}$'
   THEN public.studio_collaboration_access(auth.uid(),substring(topic from 8)::uuid)
 WHEN topic ~ '^canvas-proposal:[0-9a-f-]{36}$'
   THEN public.canvas_proposal_access(auth.uid(),substring(topic from 17)::uuid)
 ELSE false END;
$$;

CREATE OR REPLACE FUNCTION public.canvas_presence_access(topic text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE parts text[];
BEGIN
 IF topic !~ '^canvas-user:[0-9a-f-]{36}:(main|[0-9a-f-]{36}):[0-9a-f-]{36}$' THEN RETURN false; END IF;
 parts:=string_to_array(topic,':');
 IF parts[4]::uuid IS DISTINCT FROM auth.uid()
    OR NOT public.studio_collaboration_access(auth.uid(),parts[2]::uuid) THEN RETURN false; END IF;
 RETURN parts[3]='main' OR public.canvas_proposal_access(auth.uid(),parts[3]::uuid);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_studio_search_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM public.search_document
    WHERE id=public.search_document_id('studio',OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.document_schema_version<>5 THEN RETURN NEW; END IF;
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_search_document_studio
AFTER INSERT OR UPDATE OR DELETE ON public.studio_project
FOR EACH ROW EXECUTE FUNCTION public.upsert_studio_search_document();

CREATE OR REPLACE FUNCTION public.sync_studio_search_acl(pid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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

CREATE OR REPLACE FUNCTION public.refresh_studio_search_acl()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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

CREATE TRIGGER trg_zz_studio_search_acl_project
AFTER INSERT OR UPDATE OF visibility,owner_id,group_id ON public.studio_project
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();
CREATE TRIGGER trg_zz_studio_search_acl_collaborator
AFTER INSERT OR UPDATE OR DELETE ON public.studio_project_collaborator
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();
CREATE TRIGGER trg_zz_studio_search_acl_membership
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();
CREATE TRIGGER trg_zz_studio_search_acl_membership_role
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();
CREATE TRIGGER trg_zz_studio_search_acl_action_right
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();
CREATE TRIGGER trg_zz_studio_search_acl_group
AFTER UPDATE OF owner_id ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

INSERT INTO public.search_document (
  id,entity_type,entity_id,title,subtitle,search_text,visibility,
  owner_user_id,group_id,card_payload,created_at,updated_at
)
SELECT public.search_document_id('studio',id),'studio',id,title,kind,
  concat_ws(' ',title,kind),visibility,owner_id,group_id,
  jsonb_build_object('type','studio','kind',kind),
  to_timestamp(created_at/1000.0),to_timestamp(updated_at/1000.0)
FROM public.studio_project WHERE document_schema_version=5
ON CONFLICT (id) DO NOTHING;

DO $$ DECLARE pid uuid; BEGIN
  FOR pid IN SELECT id FROM public.studio_project WHERE document_schema_version=5 LOOP
    PERFORM public.sync_studio_search_acl(pid);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.upsert_studio_search_document(),
  public.sync_studio_search_acl(uuid),public.refresh_studio_search_acl()
  FROM PUBLIC,anon,authenticated;
