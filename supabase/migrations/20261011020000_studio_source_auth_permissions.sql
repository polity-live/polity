-- Deferred Studio projections must run with their owner permissions, including Auth commits.
CREATE OR REPLACE FUNCTION public.studio_source_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE r jsonb; prev jsonb; sid uuid; aid uuid; eid uuid; kind_name text; fid uuid;
 BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='document' THEN FOR sid IN SELECT id FROM public.amendment WHERE document_id=(r->>'id')::uuid LOOP PERFORM public.studio_refresh_source('amendment',sid); END LOOP; RETURN NULL; END IF;
 IF TG_TABLE_NAME IN ('event','agenda_item','vote','election','amendment','user','group') THEN
  kind_name:=TG_TABLE_NAME; sid:=(r->>'id')::uuid;
 ELSE
  IF r ? 'vote_id' THEN kind_name:='vote'; sid:=(r->>'vote_id')::uuid;
  ELSIF r ? 'election_id' THEN kind_name:='election'; sid:=(r->>'election_id')::uuid;
  ELSE kind_name:='agenda_item'; sid:=(r->>'agenda_item_id')::uuid; END IF;
 END IF;
 PERFORM public.studio_refresh_source(kind_name,sid);
 IF kind_name='vote' THEN SELECT agenda_item_id INTO aid FROM public.vote WHERE id=sid;
 ELSIF kind_name='election' THEN SELECT agenda_item_id INTO aid FROM public.election WHERE id=sid;
 ELSIF kind_name='agenda_item' THEN aid:=sid;
 END IF;
 IF aid IS NOT NULL THEN PERFORM public.studio_refresh_source('agenda_item',aid); END IF;
 IF TG_TABLE_NAME='event' OR TG_TABLE_NAME='agenda_item' THEN
  eid:=CASE WHEN TG_TABLE_NAME='event' THEN sid ELSE (r->>'event_id')::uuid END;
  FOR aid IN SELECT id FROM public.agenda_item WHERE event_id=eid LOOP PERFORM public.studio_refresh_source('agenda_item',aid); END LOOP;
 END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('vote','election') AND to_jsonb(OLD)->>'status' IS DISTINCT FROM r->>'status' THEN
  SELECT a.event_id,ep.frame_id INTO eid,fid FROM public.agenda_item a JOIN public.event_presentation ep ON ep.event_id=a.event_id JOIN public.studio_state st ON st.project_id=ep.project_id WHERE a.id=aid AND EXISTS(SELECT 1 FROM jsonb_array_elements(st.document->'nodes') n WHERE n->>'id'=ep.frame_id::text AND n#>>'{eventSource,id}'=aid::text);
  IF fid IS NOT NULL AND (SELECT payload->>'result_source_id' FROM public.studio_live_source WHERE source_type='agenda_item' AND source_id=aid)=sid::text THEN PERFORM public.studio_fire_show_cue(eid,fid,r->>'status'); END IF;
 END IF;
 IF TG_TABLE_NAME IN ('user','group') THEN
  FOR eid IN SELECT id FROM public.event WHERE (kind_name='group' AND group_id=sid) OR (kind_name='user' AND creator_id=sid) LOOP PERFORM public.studio_refresh_source('event',eid); END LOOP;
  IF kind_name='user' THEN
   FOR aid IN SELECT DISTINCT agenda_item_id FROM public.speaker_list WHERE user_id=sid LOOP PERFORM public.studio_refresh_source('agenda_item',aid); END LOOP;
   FOR eid IN SELECT DISTINCT election_id FROM public.election_candidate WHERE user_id=sid LOOP PERFORM public.studio_refresh_source('election',eid); SELECT agenda_item_id INTO aid FROM public.election WHERE id=eid; PERFORM public.studio_refresh_source('agenda_item',aid); END LOOP;
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME NOT IN ('event','agenda_item','vote','election','amendment','user','group') THEN
  prev:=to_jsonb(OLD);
  IF prev->>'vote_id' IS DISTINCT FROM r->>'vote_id' THEN PERFORM public.studio_refresh_source('vote',(prev->>'vote_id')::uuid); END IF;
  IF prev->>'election_id' IS DISTINCT FROM r->>'election_id' THEN PERFORM public.studio_refresh_source('election',(prev->>'election_id')::uuid); END IF;
 END IF;
 RETURN NULL;
 END;
$$;
ALTER FUNCTION public.studio_source_changed() OWNER TO postgres;
