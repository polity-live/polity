CREATE TABLE public.collaboration_ballot_context (
  vote_id uuid PRIMARY KEY REFERENCES public.vote(id),
  context jsonb NOT NULL,
  created_at bigint NOT NULL
);
ALTER TABLE public.collaboration_ballot_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaboration_ballot_context FROM anon,authenticated;
GRANT ALL ON public.collaboration_ballot_context TO service_role;
CREATE TRIGGER collaboration_ballot_context_immutable BEFORE UPDATE OR DELETE ON public.collaboration_ballot_context FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();

-- Validate after the whole domain transaction has inserted links and choices.
-- Canonical Yjs documents are initialized by the server transaction finalizer.
CREATE OR REPLACE FUNCTION public.collaboration_capture_ballot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v vote; link agenda_item_change_request; branch uuid; amendment_doc uuid; item record; captured integer:=0; branches uuid[]; choices jsonb; context jsonb;
BEGIN
  SELECT * INTO v FROM vote WHERE id=NEW.id;
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR v.status NOT IN ('internal','indicative','final') THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=v.id) THEN RETURN NEW; END IF;
  SELECT jsonb_agg(to_jsonb(c) ORDER BY c.order_index,c.id) INTO choices FROM vote_choice c WHERE c.vote_id=v.id;
  IF choices IS NULL THEN RAISE EXCEPTION 'ballot_choices_missing' USING ERRCODE='55000'; END IF;
  context:=jsonb_build_object('amendmentId',v.amendment_id,'agendaItemId',v.agenda_item_id,'purpose',v.purpose,'choices',choices,
    'links',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM agenda_item_change_request l WHERE l.vote_id=v.id));
  IF v.amendment_id IS NULL THEN
    INSERT INTO collaboration_ballot_context VALUES(v.id,context,(extract(epoch from clock_timestamp())*1000)::bigint); RETURN NEW;
  END IF;
  FOR link IN SELECT * FROM agenda_item_change_request WHERE vote_id=v.id AND change_request_id IS NOT NULL LOOP
    INSERT INTO collaboration_ballot(vote_id,document_id,revision_id,change_request_id,checksum,created_at)
      SELECT v.id,p.document_id,p.submitted_revision_id,p.change_request_id,p.checksum,(extract(epoch from clock_timestamp())*1000)::bigint
      FROM collaboration_proposal p WHERE p.change_request_id=link.change_request_id AND p.submitted_revision_id IS NOT NULL ON CONFLICT DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM collaboration_ballot WHERE vote_id=v.id AND change_request_id=link.change_request_id) THEN RAISE EXCEPTION 'submitted_revision_missing' USING ERRCODE='55000'; END IF;
    captured:=captured+1;
  END LOOP;
  IF captured=0 THEN
    IF v.purpose='change_request' THEN RAISE EXCEPTION 'ballot_proposal_link_missing' USING ERRCODE='55000'; END IF;
    IF v.purpose='merge_variant' THEN
      SELECT array_agg(DISTINCT process_branch_id) FILTER(WHERE process_branch_id IS NOT NULL) INTO branches FROM vote_choice WHERE vote_id=v.id;
      IF coalesce(array_length(branches,1),0)<2 THEN RAISE EXCEPTION 'ballot_variants_missing' USING ERRCODE='55000'; END IF;
    ELSE
      SELECT process_branch_id INTO branch FROM agenda_item_change_request WHERE vote_id=v.id ORDER BY id LIMIT 1;
      IF branch IS NULL THEN SELECT branch_id INTO branch FROM amendment_process_step_run WHERE vote_id=v.id ORDER BY id LIMIT 1; END IF;
      branches:=ARRAY[branch];
    END IF;
    FOREACH branch IN ARRAY branches LOOP
      IF branch IS NULL THEN SELECT document_id INTO amendment_doc FROM amendment WHERE id=v.amendment_id;
      ELSE SELECT b.document_id INTO amendment_doc FROM amendment_process_branch b JOIN amendment_process_run r ON r.id=b.process_run_id WHERE b.id=branch AND r.amendment_id=v.amendment_id; END IF;
      captured:=0;
      FOR item IN SELECT d.id,d.checksum,r.id AS revision_id FROM collaboration_document d JOIN collaboration_revision r ON r.document_id=d.id AND r.revision=d.revision
        WHERE d.workspace_type='canonical' AND NOT d.deleted AND d.branch_id IS NOT DISTINCT FROM branch AND
        ((d.kind='document' AND d.entity_id=amendment_doc) OR (d.kind='city' AND d.entity_id IN(SELECT id FROM amendment_city_design WHERE amendment_id=v.amendment_id))) LOOP
        INSERT INTO collaboration_ballot(vote_id,document_id,revision_id,checksum,created_at) VALUES(v.id,item.id,item.revision_id,item.checksum,(extract(epoch from clock_timestamp())*1000)::bigint) ON CONFLICT DO NOTHING;
        captured:=captured+1;
      END LOOP;
      IF captured=0 THEN RAISE EXCEPTION 'ballot_document_missing' USING ERRCODE='55000'; END IF;
    END LOOP;
  END IF;
  INSERT INTO collaboration_ballot_context VALUES(v.id,context,(extract(epoch from clock_timestamp())*1000)::bigint);
  RETURN NEW;
END $$;
DROP TRIGGER collaboration_capture_ballot ON public.vote;
CREATE CONSTRAINT TRIGGER collaboration_capture_ballot AFTER INSERT OR UPDATE ON public.vote DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.collaboration_capture_ballot();

CREATE FUNCTION public.collaboration_ballot_input_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE vid uuid;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_TABLE_NAME='change_request_vote' THEN
    IF NOT EXISTS(SELECT 1 FROM collaboration_proposal WHERE change_request_id=NEW.change_request_id AND submitted_revision_id IS NOT NULL) THEN RAISE EXCEPTION 'submitted_revision_missing' USING ERRCODE='55000'; END IF;
  ELSE
    vid:=coalesce((to_jsonb(NEW)->>'vote_id')::uuid,(to_jsonb(OLD)->>'vote_id')::uuid);
    IF TG_TABLE_NAME IN ('vote_choice','agenda_item_change_request') THEN
      IF EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=vid) AND
         (TG_OP='DELETE' OR TG_TABLE_NAME='vote_choice' OR
          (to_jsonb(NEW)-ARRAY['status','blocked_reason','result_status','obsolete_reason','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','blocked_reason','result_status','obsolete_reason','updated_at'])) THEN
        RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000';
      END IF;
    ELSIF NOT EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=vid) THEN
      RAISE EXCEPTION 'ballot_not_ready' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN coalesce(NEW,OLD);
END $$;
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['vote_choice','agenda_item_change_request'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_ballot_input BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.collaboration_ballot_input_guard()',target);
  END LOOP;
  FOREACH target IN ARRAY ARRAY['change_request_vote','indicative_voter_participation','final_voter_participation','vote_offline_tally'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_ballot_ready BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.collaboration_ballot_input_guard()',target);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.collaboration_ballot_input_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_ballot_input_guard() TO service_role;
