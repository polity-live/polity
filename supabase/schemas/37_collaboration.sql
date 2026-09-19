-- One authority for content, permissions and decisions. Binary state is never
-- published through Zero or PostgREST; authenticated application endpoints own it.
CREATE TABLE public.collaboration_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  phase text NOT NULL DEFAULT 'legacy' CHECK(phase IN ('legacy','maintenance','active')),
  migration_id uuid,
  maintenance_started_at bigint,
  manifest jsonb,
  updated_at bigint NOT NULL DEFAULT 0
);
INSERT INTO public.collaboration_control(singleton) VALUES(true);

CREATE TABLE public.collaboration_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind IN ('document','blog','city','studio')),
  entity_id uuid NOT NULL,
  branch_id uuid,
  workspace_id uuid,
  workspace_type text NOT NULL DEFAULT 'canonical' CHECK(workspace_type IN ('canonical','proposal','followup')),
  owner_id uuid REFERENCES public."user"(id),
  base_document_id uuid REFERENCES public.collaboration_document(id),
  base_revision bigint,
  generation uuid NOT NULL DEFAULT gen_random_uuid(),
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
  checksum text NOT NULL,
  state bytea NOT NULL CHECK(octet_length(state)<=12000000),
  projection jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  frozen boolean NOT NULL DEFAULT false,
  shared boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE NULLS NOT DISTINCT(kind,entity_id,branch_id,workspace_id),
  CHECK((workspace_type='canonical' AND workspace_id IS NULL) OR
        (workspace_type<>'canonical' AND workspace_id IS NOT NULL AND owner_id IS NOT NULL AND base_document_id IS NOT NULL))
);
CREATE TABLE public.collaboration_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  generation uuid NOT NULL,
  revision bigint NOT NULL,
  checksum text NOT NULL,
  state bytea NOT NULL,
  projection jsonb NOT NULL,
  actor_id uuid REFERENCES public."user"(id),
  operation_id text NOT NULL,
  reason text NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE(document_id,revision),
  UNIQUE(document_id,operation_id)
);
CREATE TABLE public.collaboration_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  generation uuid NOT NULL,
  revision bigint NOT NULL,
  created_at bigint NOT NULL,
  delivered_at bigint
);
ALTER TABLE public.studio_revision ADD COLUMN collaboration_revision_id uuid REFERENCES public.collaboration_revision(id);
CREATE INDEX collaboration_outbox_pending ON public.collaboration_outbox(id) WHERE delivered_at IS NULL;
CREATE TABLE public.collaboration_proposal (
  change_request_id uuid PRIMARY KEY REFERENCES public.change_request(id),
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  base_revision_id uuid NOT NULL REFERENCES public.collaboration_revision(id),
  submitted_revision_id uuid REFERENCES public.collaboration_revision(id),
  submitted_content jsonb NOT NULL,
  checksum text NOT NULL,
  decision_result text CHECK(decision_result IN ('passed','rejected','tie')),
  application_status text NOT NULL DEFAULT 'pending' CHECK(application_status IN ('pending','applied','conflict','obsolete')),
  application_revision_id uuid REFERENCES public.collaboration_revision(id),
  conflict_reason text,
  created_at bigint NOT NULL
);
CREATE TABLE public.collaboration_checkpoint (
  migration_id uuid NOT NULL,
  kind text NOT NULL,
  entity_id uuid NOT NULL,
  original jsonb NOT NULL,
  checksum text NOT NULL,
  PRIMARY KEY(migration_id,kind,entity_id)
);

-- Proofs contain document references only; votes and secret ballots remain in
-- their existing SQL tables and can never be changed through a Yjs update.
CREATE TABLE public.collaboration_ballot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES public.vote(id),
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  revision_id uuid NOT NULL REFERENCES public.collaboration_revision(id),
  change_request_id uuid REFERENCES public.change_request(id),
  checksum text NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE NULLS NOT DISTINCT(vote_id,document_id,change_request_id)
);

CREATE FUNCTION public.collaboration_authority_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1886351981);
  IF (SELECT phase='maintenance' FROM collaboration_control WHERE singleton) AND
     current_setting('polity.collaboration_migration',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'collaboration_maintenance' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.collaboration_projection_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
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
CREATE TRIGGER collaboration_document_content BEFORE UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('content','document');
CREATE TRIGGER collaboration_blog_content BEFORE UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('content','blog');
CREATE TRIGGER collaboration_city_content BEFORE UPDATE ON public.amendment_city_design FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('design_state','city');
CREATE TRIGGER collaboration_studio_content BEFORE UPDATE ON public.studio_state FOR EACH ROW EXECUTE FUNCTION public.collaboration_projection_guard('document','studio','project_id');

CREATE FUNCTION public.collaboration_mode_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
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
CREATE TRIGGER collaboration_document_mode AFTER UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();
CREATE TRIGGER collaboration_blog_mode AFTER UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();
CREATE TRIGGER collaboration_branch_mode AFTER UPDATE ON public.amendment_process_branch FOR EACH ROW EXECUTE FUNCTION public.collaboration_mode_changed();

CREATE FUNCTION public.collaboration_proposal_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.change_request_id IS DISTINCT FROM OLD.change_request_id OR NEW.document_id IS DISTINCT FROM OLD.document_id OR
     NEW.base_revision_id IS DISTINCT FROM OLD.base_revision_id OR NEW.submitted_revision_id IS DISTINCT FROM OLD.submitted_revision_id OR
     NEW.submitted_content IS DISTINCT FROM OLD.submitted_content OR NEW.checksum IS DISTINCT FROM OLD.checksum OR
     (OLD.decision_result IS NOT NULL AND NEW.decision_result IS DISTINCT FROM OLD.decision_result) THEN
    RAISE EXCEPTION 'collaboration_proposal_immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collaboration_proposal_immutable BEFORE UPDATE ON public.collaboration_proposal FOR EACH ROW EXECUTE FUNCTION public.collaboration_proposal_immutable();

CREATE FUNCTION public.collaboration_immutable_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'collaboration_revision_immutable' USING ERRCODE='55000'; END $$;
CREATE TRIGGER collaboration_revision_immutable BEFORE UPDATE OR DELETE ON public.collaboration_revision FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();
CREATE TRIGGER collaboration_ballot_immutable BEFORE UPDATE OR DELETE ON public.collaboration_ballot FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();

CREATE FUNCTION public.collaboration_cr_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
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
CREATE TRIGGER collaboration_cr_guard BEFORE UPDATE OR DELETE ON public.change_request FOR EACH ROW EXECUTE FUNCTION public.collaboration_cr_guard();

CREATE FUNCTION public.collaboration_capture_ballot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
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
CREATE TRIGGER collaboration_capture_ballot AFTER INSERT OR UPDATE ON public.vote FOR EACH ROW EXECUTE FUNCTION public.collaboration_capture_ballot();

-- Statement locks are acquired before row locks. API commands acquire the same
-- lock before reading permissions; direct policy changes cannot race that read.
DO $$ DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['document','blog','amendment','amendment_city_design',
    'amendment_process_branch','amendment_process_run','change_request','vote','election',
    'group','group_membership','group_membership_role','group_guest_access','event',
    'event_participant','event_participant_role','amendment_collaborator','document_collaborator',
    'blog_blogger','role','action_right','studio_project','studio_state','change_request_vote',
    'vote_choice','voter','indicative_voter_participation','indicative_choice_decision','final_voter_participation','final_choice_decision','vote_offline_tally',
    'election_candidate','elector','indicative_elector_participation','indicative_candidate_selection','final_elector_participation','final_candidate_selection','election_offline_tally',
    'amendment_process_step_run','process_task','agenda_item','agenda_item_change_request','accreditation','accreditation_audit'] LOOP
    IF to_regclass('public.'||quote_ident(target)) IS NOT NULL THEN
      EXECUTE format('CREATE TRIGGER collaboration_authority BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_authority_lock()',target);
    END IF;
  END LOOP;
END $$;

DO $$ DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['collaboration_control','collaboration_document','collaboration_revision',
    'collaboration_outbox','collaboration_proposal','collaboration_checkpoint','collaboration_ballot'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',target);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',target);
  END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE public.collaboration_outbox_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.collaboration_authority_lock(),public.collaboration_projection_guard(),public.collaboration_immutable_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_authority_lock(),public.collaboration_projection_guard(),public.collaboration_immutable_revision() TO service_role;
REVOKE ALL ON FUNCTION public.collaboration_mode_changed(),public.collaboration_proposal_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_mode_changed(),public.collaboration_proposal_immutable() TO service_role;
REVOKE ALL ON FUNCTION public.collaboration_cr_guard(),public.collaboration_capture_ballot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_cr_guard(),public.collaboration_capture_ballot() TO service_role;
