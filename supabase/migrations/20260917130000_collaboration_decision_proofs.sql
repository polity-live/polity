-- Additive evolution of the first local collaboration schema.
ALTER TABLE public.collaboration_document ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.studio_revision ADD COLUMN IF NOT EXISTS collaboration_revision_id uuid REFERENCES public.collaboration_revision(id);

CREATE TABLE IF NOT EXISTS public.collaboration_ballot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES public.vote(id),
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  revision_id uuid NOT NULL REFERENCES public.collaboration_revision(id),
  change_request_id uuid REFERENCES public.change_request(id),
  checksum text NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE NULLS NOT DISTINCT(vote_id,document_id,change_request_id)
);

CREATE OR REPLACE FUNCTION public.collaboration_authority_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1886351981);
  IF (SELECT phase='maintenance' FROM collaboration_control WHERE singleton) AND
     current_setting('polity.collaboration_migration',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'collaboration_maintenance' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.collaboration_projection_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE field_name text := TG_ARGV[0]; doc_kind text := TG_ARGV[1]; new_value jsonb; old_value jsonb; entity uuid;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN RETURN NEW; END IF;
  new_value := to_jsonb(NEW)->field_name; old_value := to_jsonb(OLD)->field_name;
  entity := (to_jsonb(NEW)->>COALESCE(TG_ARGV[2],'id'))::uuid;
  IF new_value IS NOT DISTINCT FROM old_value AND (doc_kind<>'studio' OR (to_jsonb(NEW)->'state') IS NOT DISTINCT FROM (to_jsonb(OLD)->'state')) THEN RETURN NEW; END IF;
  IF current_setting('polity.collaboration_migration',true)='on' THEN RETURN NEW; END IF;
  IF current_setting('polity.collaboration_projection',true) IS DISTINCT FROM doc_kind||':'||entity::text OR
     NOT EXISTS(SELECT 1 FROM collaboration_document d WHERE d.kind=doc_kind AND d.entity_id=entity
       AND d.workspace_type='canonical' AND NOT d.deleted AND d.projection=new_value) THEN
    RAISE EXCEPTION 'collaboration_legacy_write_rejected' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.collaboration_mode_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (to_jsonb(NEW)->'editing_mode') IS NOT DISTINCT FROM (to_jsonb(OLD)->'editing_mode') AND
     (to_jsonb(NEW)->'status') IS NOT DISTINCT FROM (to_jsonb(OLD)->'status') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='amendment_process_branch' THEN
    UPDATE collaboration_document SET generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint
      WHERE branch_id=NEW.id AND workspace_type='canonical';
    INSERT INTO collaboration_outbox(document_id,generation,revision,created_at)
      SELECT id,generation,revision,updated_at FROM collaboration_document WHERE branch_id=NEW.id AND workspace_type='canonical';
  ELSE
    UPDATE collaboration_document SET generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint
      WHERE kind=TG_TABLE_NAME AND entity_id=NEW.id AND workspace_type='canonical';
    INSERT INTO collaboration_outbox(document_id,generation,revision,created_at)
      SELECT id,generation,revision,updated_at FROM collaboration_document WHERE kind=TG_TABLE_NAME AND entity_id=NEW.id AND workspace_type='canonical';
    IF TG_TABLE_NAME='document' THEN
      UPDATE collaboration_document SET generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint
        WHERE kind='city' AND workspace_type='canonical' AND branch_id IS NULL AND entity_id IN
          (SELECT c.id FROM amendment_city_design c JOIN amendment a ON a.id=c.amendment_id WHERE a.document_id=NEW.id);
      INSERT INTO collaboration_outbox(document_id,generation,revision,created_at)
        SELECT id,generation,revision,updated_at FROM collaboration_document WHERE kind='city' AND workspace_type='canonical' AND branch_id IS NULL AND entity_id IN
          (SELECT c.id FROM amendment_city_design c JOIN amendment a ON a.id=c.amendment_id WHERE a.document_id=NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.collaboration_proposal_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.change_request_id IS DISTINCT FROM OLD.change_request_id OR NEW.document_id IS DISTINCT FROM OLD.document_id OR
     NEW.base_revision_id IS DISTINCT FROM OLD.base_revision_id OR NEW.submitted_revision_id IS DISTINCT FROM OLD.submitted_revision_id OR
     NEW.submitted_content IS DISTINCT FROM OLD.submitted_content OR NEW.checksum IS DISTINCT FROM OLD.checksum OR
     (OLD.decision_result IS NOT NULL AND NEW.decision_result IS DISTINCT FROM OLD.decision_result) THEN
    RAISE EXCEPTION 'collaboration_proposal_immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.collaboration_immutable_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'collaboration_revision_immutable' USING ERRCODE='55000'; END $$;

CREATE OR REPLACE FUNCTION public.collaboration_cr_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE proposal collaboration_proposal;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT * INTO proposal FROM collaboration_proposal WHERE change_request_id=OLD.id;
  IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'submitted_proposal_cannot_be_deleted' USING ERRCODE='55000'; END IF;
  IF (to_jsonb(NEW)-ARRAY['title','description','reason','status','voting_status','votes_for','votes_against','votes_abstain','voting_deadline','voting_majority_type','quorum_required','resolved_in_mode','resolution_method','visibility_scope','obsolete_reason','obsolete_at','obsolete_by_vote_id','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['title','description','reason','status','voting_status','votes_for','votes_against','votes_abstain','voting_deadline','voting_majority_type','quorum_required','resolved_in_mode','resolution_method','visibility_scope','obsolete_reason','obsolete_at','obsolete_by_vote_id','updated_at']) THEN
    RAISE EXCEPTION 'submitted_proposal_immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.collaboration_capture_ballot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE link agenda_item_change_request; branch uuid; amendment_doc uuid; item record; captured integer:=0;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR NEW.status NOT IN ('internal','indicative','final') THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM collaboration_ballot WHERE vote_id=NEW.id) THEN RETURN NEW; END IF;
  SELECT * INTO link FROM agenda_item_change_request WHERE vote_id=NEW.id ORDER BY id LIMIT 1;
  IF link.change_request_id IS NOT NULL THEN
    INSERT INTO collaboration_ballot(vote_id,document_id,revision_id,change_request_id,checksum,created_at)
      SELECT NEW.id,p.document_id,coalesce(p.submitted_revision_id,p.base_revision_id),p.change_request_id,p.checksum,(extract(epoch from clock_timestamp())*1000)::bigint
      FROM collaboration_proposal p WHERE p.change_request_id=link.change_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'submitted_revision_missing' USING ERRCODE='55000'; END IF;
    RETURN NEW;
  END IF;
  branch:=link.process_branch_id;
  IF branch IS NULL THEN SELECT branch_id INTO branch FROM amendment_process_step_run WHERE vote_id=NEW.id ORDER BY id LIMIT 1; END IF;
  IF branch IS NULL THEN SELECT document_id INTO amendment_doc FROM amendment WHERE id=NEW.amendment_id;
  ELSE SELECT document_id INTO amendment_doc FROM amendment_process_branch WHERE id=branch; END IF;
  IF amendment_doc IS NULL AND NEW.amendment_id IS NULL THEN RETURN NEW; END IF;
  FOR item IN SELECT d.id,d.checksum,r.id AS revision_id FROM collaboration_document d JOIN collaboration_revision r ON r.document_id=d.id AND r.revision=d.revision
    WHERE d.workspace_type='canonical' AND NOT d.deleted AND d.branch_id IS NOT DISTINCT FROM branch AND
      ((d.kind='document' AND d.entity_id=amendment_doc) OR (d.kind='city' AND d.entity_id IN (SELECT id FROM amendment_city_design WHERE amendment_id=NEW.amendment_id))) LOOP
    INSERT INTO collaboration_ballot(vote_id,document_id,revision_id,checksum,created_at) VALUES(NEW.id,item.id,item.revision_id,item.checksum,(extract(epoch from clock_timestamp())*1000)::bigint);
    captured:=captured+1;
  END LOOP;
  IF captured=0 THEN RAISE EXCEPTION 'ballot_document_missing' USING ERRCODE='55000'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS collaboration_document_content ON public.document;
CREATE TRIGGER collaboration_document_content BEFORE UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('content','document');

DROP TRIGGER IF EXISTS collaboration_blog_content ON public.blog;
CREATE TRIGGER collaboration_blog_content BEFORE UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('content','blog');

DROP TRIGGER IF EXISTS collaboration_city_content ON public.amendment_city_design;
CREATE TRIGGER collaboration_city_content BEFORE UPDATE ON public.amendment_city_design FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('design_state','city');

DROP TRIGGER IF EXISTS collaboration_studio_content ON public.studio_state;
CREATE TRIGGER collaboration_studio_content BEFORE UPDATE ON public.studio_state FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('document','studio','project_id');

DROP TRIGGER IF EXISTS collaboration_document_mode ON public.document;
CREATE TRIGGER collaboration_document_mode AFTER UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();

DROP TRIGGER IF EXISTS collaboration_blog_mode ON public.blog;
CREATE TRIGGER collaboration_blog_mode AFTER UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();

DROP TRIGGER IF EXISTS collaboration_branch_mode ON public.amendment_process_branch;
CREATE TRIGGER collaboration_branch_mode AFTER UPDATE ON public.amendment_process_branch FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();

DROP TRIGGER IF EXISTS collaboration_proposal_immutable ON public.collaboration_proposal;
CREATE TRIGGER collaboration_proposal_immutable BEFORE UPDATE ON public.collaboration_proposal FOR EACH ROW EXECUTE FUNCTION public.collaboration_proposal_immutable();

DROP TRIGGER IF EXISTS collaboration_revision_immutable ON public.collaboration_revision;
CREATE TRIGGER collaboration_revision_immutable BEFORE UPDATE OR DELETE ON public.collaboration_revision FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();

DROP TRIGGER IF EXISTS collaboration_ballot_immutable ON public.collaboration_ballot;
CREATE TRIGGER collaboration_ballot_immutable BEFORE UPDATE OR DELETE ON public.collaboration_ballot FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();

DROP TRIGGER IF EXISTS collaboration_cr_guard ON public.change_request;
CREATE TRIGGER collaboration_cr_guard BEFORE UPDATE OR DELETE ON public.change_request FOR EACH ROW EXECUTE FUNCTION public.collaboration_cr_guard();

DROP TRIGGER IF EXISTS collaboration_capture_ballot ON public.vote;
CREATE TRIGGER collaboration_capture_ballot AFTER INSERT OR UPDATE ON public.vote FOR EACH ROW EXECUTE FUNCTION public.collaboration_capture_ballot();

DROP TRIGGER IF EXISTS collaboration_authority ON public.agenda_item_change_request;
CREATE TRIGGER collaboration_authority BEFORE INSERT OR UPDATE OR DELETE ON public.agenda_item_change_request FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_authority_lock();

DROP TRIGGER IF EXISTS collaboration_authority ON public.accreditation;
CREATE TRIGGER collaboration_authority BEFORE INSERT OR UPDATE OR DELETE ON public.accreditation FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_authority_lock();

DROP TRIGGER IF EXISTS collaboration_authority ON public.accreditation_audit;
CREATE TRIGGER collaboration_authority BEFORE INSERT OR UPDATE OR DELETE ON public.accreditation_audit FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_authority_lock();

ALTER TABLE public.collaboration_ballot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaboration_ballot FROM anon,authenticated;
GRANT ALL ON public.collaboration_ballot TO service_role;

GRANT USAGE,SELECT ON SEQUENCE public.collaboration_outbox_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.collaboration_authority_lock(),public.collaboration_projection_guard(),public.collaboration_immutable_revision() FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.collaboration_authority_lock(),public.collaboration_projection_guard(),public.collaboration_immutable_revision() TO service_role;

REVOKE ALL ON FUNCTION public.collaboration_mode_changed(),public.collaboration_proposal_immutable() FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.collaboration_mode_changed(),public.collaboration_proposal_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.collaboration_cr_guard(),public.collaboration_capture_ballot() FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.collaboration_cr_guard(),public.collaboration_capture_ballot() TO service_role;
