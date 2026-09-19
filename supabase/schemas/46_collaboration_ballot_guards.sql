-- Preserve both sides of a link reassignment and protect the actual ballot visibility column.
CREATE OR REPLACE FUNCTION public.collaboration_ballot_metadata_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE field text;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR NOT EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=OLD.id) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000'; END IF;
  FOREACH field IN ARRAY ARRAY['amendment_id','agenda_item_id','purpose','majority_type','visibility','ballot_visibility','offline_electorate_size','electorate_snapshotted_at'] LOOP
    IF (to_jsonb(NEW)->field) IS DISTINCT FROM (to_jsonb(OLD)->field) THEN RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.collaboration_ballot_input_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE vid uuid; previous_vid uuid;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_TABLE_NAME='change_request_vote' THEN
    IF NOT EXISTS(SELECT 1 FROM collaboration_proposal WHERE change_request_id=NEW.change_request_id AND submitted_revision_id IS NOT NULL) THEN RAISE EXCEPTION 'submitted_revision_missing' USING ERRCODE='55000'; END IF;
  ELSE
    vid:=(to_jsonb(NEW)->>'vote_id')::uuid;
    previous_vid:=(to_jsonb(OLD)->>'vote_id')::uuid;
    IF TG_TABLE_NAME IN ('vote_choice','agenda_item_change_request') THEN
      IF EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id IN (vid,previous_vid)) AND
         (TG_OP IN ('INSERT','DELETE') OR TG_TABLE_NAME='vote_choice' OR
          (to_jsonb(NEW)-ARRAY['status','blocked_reason','result_status','obsolete_reason','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','blocked_reason','result_status','obsolete_reason','updated_at'])) THEN
        RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000';
      END IF;
    ELSIF NOT EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=vid) THEN
      RAISE EXCEPTION 'ballot_not_ready' USING ERRCODE='55000';
    END IF;
    IF TG_TABLE_NAME IN ('indicative_choice_decision','final_choice_decision') AND NOT EXISTS(SELECT 1 FROM vote_choice WHERE id=(to_jsonb(NEW)->>'choice_id')::uuid AND vote_id=vid) THEN
      RAISE EXCEPTION 'ballot_choice_mismatch' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER collaboration_ballot_ready BEFORE INSERT OR UPDATE ON public.indicative_choice_decision FOR EACH ROW EXECUTE FUNCTION public.collaboration_ballot_input_guard();
CREATE TRIGGER collaboration_ballot_ready BEFORE INSERT OR UPDATE ON public.final_choice_decision FOR EACH ROW EXECUTE FUNCTION public.collaboration_ballot_input_guard();
