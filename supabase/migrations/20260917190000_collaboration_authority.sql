-- Context changes serialize with writes and retire offline generations.
CREATE OR REPLACE FUNCTION public.collaboration_acl_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE field text; changed boolean:=false;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN RETURN NULL; END IF;
  IF TG_LEVEL='ROW' AND TG_OP='UPDATE' THEN
    FOREACH field IN ARRAY ARRAY['visibility','editing_mode','status','group_id','owner_id','created_by_id','amendment_id','event_id','document_id','current_process_run_id','active_branch_id','process_run_id','parent_branch_id','tutorial_run_id'] LOOP
      IF (to_jsonb(NEW)->field) IS DISTINCT FROM (to_jsonb(OLD)->field) THEN changed:=true; EXIT; END IF;
    END LOOP;
    IF NOT changed THEN RETURN NULL; END IF;
  END IF;
  UPDATE collaboration_document SET generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint WHERE NOT deleted;
  INSERT INTO collaboration_outbox(document_id,generation,revision,created_at)
    SELECT id,generation,revision,updated_at FROM collaboration_document WHERE NOT deleted;
  RETURN NULL;
END $$;
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['amendment_process_run','amendment_process_step_run','amendment_city_design'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_acl AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.collaboration_acl_changed()',target);
  END LOOP;
END $$;

CREATE FUNCTION public.collaboration_ballot_metadata_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE field text;
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) OR NOT EXISTS(SELECT 1 FROM collaboration_ballot_context WHERE vote_id=OLD.id) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000'; END IF;
  FOREACH field IN ARRAY ARRAY['amendment_id','agenda_item_id','purpose','majority_type','quorum_required','voting_type','visibility','is_secret'] LOOP
    IF (to_jsonb(NEW)->field) IS DISTINCT FROM (to_jsonb(OLD)->field) THEN RAISE EXCEPTION 'ballot_inputs_immutable' USING ERRCODE='55000'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER collaboration_ballot_metadata BEFORE UPDATE OR DELETE ON public.vote FOR EACH ROW EXECUTE FUNCTION public.collaboration_ballot_metadata_guard();
REVOKE ALL ON FUNCTION public.collaboration_ballot_metadata_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_ballot_metadata_guard() TO service_role;

ALTER TABLE public.collaboration_comment ADD COLUMN change_request_id uuid REFERENCES public.change_request(id);
ALTER TABLE public.collaboration_comment ADD COLUMN visibility text NOT NULL DEFAULT 'document' CHECK(visibility IN ('document','collaborators'));
