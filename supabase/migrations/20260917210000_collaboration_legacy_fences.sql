ALTER TABLE public.document_version ADD COLUMN collaboration_revision_id uuid REFERENCES public.collaboration_revision(id);
CREATE FUNCTION public.collaboration_version_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE proof uuid;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR current_setting('polity.collaboration_migration',true)='on' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id AND NEW.blog_id IS NOT DISTINCT FROM OLD.blog_id AND NEW.collaboration_revision_id IS NOT DISTINCT FROM OLD.collaboration_revision_id THEN RETURN NEW; END IF;
  SELECT r.id INTO proof FROM collaboration_document d JOIN collaboration_revision r ON r.document_id=d.id
    WHERE d.workspace_type='canonical' AND NOT d.deleted AND r.projection=NEW.content
    AND ((NEW.blog_id IS NULL AND d.kind='document' AND d.entity_id=NEW.document_id) OR (NEW.blog_id IS NOT NULL AND d.kind='blog' AND d.entity_id=NEW.blog_id))
    ORDER BY r.revision DESC LIMIT 1;
  IF proof IS NULL THEN RAISE EXCEPTION 'collaboration_version_requires_committed_revision' USING ERRCODE='55000'; END IF;
  NEW.collaboration_revision_id:=proof; RETURN NEW;
END $$;
CREATE TRIGGER collaboration_version_content BEFORE INSERT OR UPDATE ON public.document_version FOR EACH ROW EXECUTE FUNCTION public.collaboration_version_guard();
CREATE FUNCTION public.collaboration_annotation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR current_setting('polity.collaboration_migration',true)='on' THEN RETURN NEW; END IF;
  IF NEW.discussions IS NULL OR NEW.discussions='[]'::jsonb OR (TG_OP='UPDATE' AND NEW.discussions IS NOT DISTINCT FROM OLD.discussions) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'collaboration_comments_require_server_command' USING ERRCODE='55000';
END $$;
CREATE TRIGGER collaboration_annotations BEFORE INSERT OR UPDATE ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.collaboration_annotation_guard();
CREATE TRIGGER collaboration_annotations BEFORE INSERT OR UPDATE ON public.amendment_process_branch FOR EACH ROW EXECUTE FUNCTION public.collaboration_annotation_guard();
CREATE TRIGGER collaboration_annotations BEFORE INSERT OR UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_annotation_guard();
CREATE TRIGGER collaboration_acl AFTER INSERT OR UPDATE OR DELETE ON public.vote FOR EACH ROW EXECUTE FUNCTION public.collaboration_acl_changed();
REVOKE ALL ON FUNCTION public.collaboration_version_guard(),public.collaboration_annotation_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_version_guard(),public.collaboration_annotation_guard() TO service_role;
