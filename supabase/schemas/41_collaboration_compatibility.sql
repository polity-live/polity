ALTER TABLE public.collaboration_control ADD COLUMN compatibility boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.collaboration_source_deleted() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE kind_name text:=TG_ARGV[0]; entity uuid:=(to_jsonb(OLD)->>COALESCE(TG_ARGV[1],'id'))::uuid;
BEGIN
  UPDATE collaboration_document SET deleted=true,generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint WHERE kind=kind_name AND entity_id=entity;
  INSERT INTO collaboration_outbox(document_id,generation,revision,created_at) SELECT id,generation,revision,updated_at FROM collaboration_document WHERE kind=kind_name AND entity_id=entity;
  RETURN OLD;
END $$;
CREATE TRIGGER collaboration_source_deleted AFTER DELETE ON public.document FOR EACH ROW EXECUTE FUNCTION public.collaboration_source_deleted('document');
CREATE TRIGGER collaboration_source_deleted AFTER DELETE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_source_deleted('blog');
CREATE TRIGGER collaboration_source_deleted AFTER DELETE ON public.amendment_city_design FOR EACH ROW EXECUTE FUNCTION public.collaboration_source_deleted('city');
CREATE TRIGGER collaboration_source_deleted AFTER DELETE ON public.studio_project FOR EACH ROW EXECUTE FUNCTION public.collaboration_source_deleted('studio');
REVOKE ALL ON FUNCTION public.collaboration_source_deleted() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_source_deleted() TO service_role;
