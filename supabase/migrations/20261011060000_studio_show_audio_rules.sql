-- One authoritative cue evaluator for manual commands, agenda-follow and voting phases.
CREATE OR REPLACE FUNCTION public.studio_resolve_show_audio(eid uuid, fid uuid, names text[], base jsonb, now_ms bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d jsonb; pid uuid; cue jsonb; lane text; out_audio jsonb:=base;
        fired jsonb:=coalesce(base->'_cueFired','{}'); event_key text; fresh text[]:=ARRAY[]::text[]; name text; result jsonb; pos double precision;
BEGIN
 SELECT ep.project_id,st.document INTO pid,d FROM event_presentation ep JOIN studio_state st ON st.project_id=ep.project_id
 WHERE ep.event_id=eid AND (ep.running OR current_setting('polity.show_starting',true)=eid::text) AND ep.lease_until>now_ms;
 IF d IS NULL THEN RETURN base; END IF;
 FOREACH name IN ARRAY names LOOP
  event_key:=txid_current()::text||':'||fid::text||':'||name;
  IF fired->>name IS DISTINCT FROM event_key THEN fresh:=array_append(fresh,name); END IF;
  fired:=jsonb_set(fired,ARRAY[name],to_jsonb(event_key));
 END LOOP;
 IF cardinality(fresh)=0 THEN RETURN base; END IF;
 FOREACH lane IN ARRAY ARRAY['music','transition'] LOOP
  SELECT c INTO cue FROM jsonb_array_elements(coalesce(d#>'{show,cues}','[]')) WITH ORDINALITY cs(c,ord)
  WHERE coalesce(c->>'channel','music')=lane AND c->>'trigger'=ANY(fresh)
   AND ((coalesce(c->>'scope','frame')='frame' AND c->>'frameId'=fid::text)
    OR (lane='transition' AND c->>'scope'='global' AND c->>'trigger'='enter'))
   AND (coalesce(c->>'action','play') IN ('pause','stop') OR
    c->>'builtin' IN ('test-tone','cinematic-thriller','cinematic-atmosphere','cinematic-hope','cinematic-sequence') OR
    EXISTS(SELECT 1 FROM studio_asset a WHERE a.id::text=c->>'assetId' AND a.project_id=pid AND a.ready
     AND a.workspace_id IS NULL AND a.mime_type IN ('audio/mpeg','audio/wav')))
  ORDER BY CASE WHEN c->>'scope'='global' THEN 1 ELSE 0 END,array_position(fresh,c->>'trigger'),ord LIMIT 1;
  IF cue IS NULL THEN CONTINUE; END IF;
  IF coalesce(cue->>'action','play') IN ('pause','stop') THEN
   pos:=coalesce((base->>'position')::double precision,0)+CASE WHEN base->>'status'='playing' THEN greatest(0,(now_ms-coalesce((base->>'at')::bigint,now_ms))/1000.0) ELSE 0 END;
   result:=(out_audio-'transition')||jsonb_build_object('status',CASE WHEN cue->>'action'='pause' THEN 'paused' ELSE 'stopped' END,
    'position',CASE WHEN cue->>'action'='pause' THEN pos ELSE 0 END,'at',now_ms,
    'fadeOutSeconds',coalesce(cue->'fadeOutSeconds',cue->'fadeSeconds','1'::jsonb));
  ELSE
   result:=jsonb_strip_nulls(jsonb_build_object('assetId',cue->'assetId','builtin',cue->'builtin','status','playing',
    'position',0,'volume',coalesce(cue->'volume','0.65'::jsonb),
    'loop',CASE WHEN lane='transition' OR cue->>'builtin'='test-tone' THEN false ELSE coalesce((cue->>'loop')::boolean,cue ? 'builtin') END,
    'fadeSeconds',coalesce(cue->'fadeSeconds','1'::jsonb),
    'fadeInSeconds',coalesce(cue->'fadeInSeconds',cue->'fadeSeconds','1'::jsonb),
    'fadeOutSeconds',coalesce(cue->'fadeOutSeconds',cue->'fadeSeconds','1'::jsonb),
    'durationSeconds',CASE WHEN lane='transition' THEN coalesce(cue->'durationSeconds','3'::jsonb) ELSE NULL END,
    'ownerFrameId',fid,'cueId',gen_random_uuid(),'at',now_ms));
  END IF;
  IF lane='transition' THEN out_audio:=jsonb_set(out_audio,'{transition}',result);
  ELSE out_audio:=result||CASE WHEN out_audio ? 'transition' THEN jsonb_build_object('transition',out_audio->'transition') ELSE '{}' END; END IF;
 END LOOP;
 RETURN out_audio||jsonb_build_object('_cueFired',fired);
END;
$$;

CREATE OR REPLACE FUNCTION public.studio_fire_show_cue(eid uuid,fid uuid,trigger_name text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ep event_presentation; resolved jsonb; now_ms bigint;
BEGIN
 SELECT * INTO ep FROM event_presentation WHERE event_id=eid FOR UPDATE;
 IF ep.mode<>'studio' OR ep.frame_id IS DISTINCT FROM fid OR NOT ep.running THEN RETURN; END IF;
 now_ms:=(extract(epoch FROM clock_timestamp())*1000)::bigint;
 resolved:=studio_resolve_show_audio(eid,fid,ARRAY[trigger_name],ep.audio,now_ms);
 IF resolved IS DISTINCT FROM ep.audio THEN
  UPDATE event_presentation SET audio=resolved,cue_at=now_ms,cue_id=gen_random_uuid(),updated_at=now_ms,revision=revision+1 WHERE event_id=eid;
 END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.studio_presentation_audio_rules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE now_ms bigint; names text[]:='{}'; d jsonb; previous jsonb; incoming jsonb; resolved jsonb; entering boolean; leaving boolean; explicit_music boolean;
BEGIN
 now_ms:=(extract(epoch FROM clock_timestamp())*1000)::bigint;
 entering:=NEW.running AND NEW.mode='studio' AND NEW.frame_id IS NOT NULL AND
  (OLD.frame_id IS DISTINCT FROM NEW.frame_id OR OLD.mode<>'studio' OR NOT OLD.running);
 leaving:=OLD.mode='studio' AND (NEW.mode<>'studio' OR OLD.frame_id IS DISTINCT FROM NEW.frame_id OR NOT NEW.running);
 explicit_music:=(NEW.audio-'transition'-'_cueFired') IS DISTINCT FROM (OLD.audio-'transition'-'_cueFired');
 SELECT document INTO d FROM studio_state WHERE project_id=NEW.project_id;
 IF entering THEN
  names:=ARRAY['enter'];
  SELECT n INTO incoming FROM jsonb_array_elements(d->'nodes') n WHERE n->>'id'=NEW.frame_id::text;
  IF NEW.follow_agenda AND incoming#>>'{eventSource,type}'='agenda_item' AND
   incoming#>>'{eventSource,id}'=(SELECT current_agenda_item_id::text FROM event WHERE id=NEW.event_id) THEN names:=ARRAY['activate','enter']; END IF;
 END IF;
 IF NEW.running AND NEW.mode='studio' AND NEW.results_visible AND NOT OLD.results_visible THEN names:=array_append(names,'reveal'); END IF;
 IF leaving AND NOT explicit_music AND OLD.audio->>'status'='playing' THEN
  SELECT n INTO previous FROM jsonb_array_elements(d->'nodes') n WHERE n->>'id'=OLD.frame_id::text;
  IF OLD.audio->>'ownerFrameId'=OLD.frame_id::text OR previous ? 'intro' OR previous#>>'{eventSource,template}'='cover' THEN
   NEW.audio:=NEW.audio||jsonb_build_object('status','stopped','position',0,'at',now_ms,
    'fadeSeconds',coalesce(OLD.audio->'fadeOutSeconds',OLD.audio->'fadeSeconds','1'::jsonb));
  END IF;
 END IF;
 IF cardinality(names)>0 THEN
  -- The evaluator reads OLD persisted running; starting a presentation must be eligible too.
  IF NOT OLD.running AND NEW.running THEN
   PERFORM set_config('polity.show_starting',NEW.event_id::text,true);
  END IF;
  resolved:=studio_resolve_show_audio(NEW.event_id,NEW.frame_id,names,NEW.audio,now_ms);
  PERFORM set_config('polity.show_starting','',true);
  IF explicit_music THEN resolved:=(NEW.audio-'transition')||CASE WHEN resolved ? 'transition' THEN jsonb_build_object('transition',resolved->'transition') ELSE '{}' END; END IF;
  NEW.audio:=resolved;
  NEW.cue_id:=gen_random_uuid(); NEW.cue_at:=now_ms;
 END IF;
 IF NOT NEW.running AND NEW.audio<>'{}'::jsonb THEN
  NEW.audio:=NEW.audio||jsonb_build_object('status','stopped');
  IF NEW.audio ? 'transition' THEN NEW.audio:=jsonb_set(NEW.audio,'{transition,status}','"stopped"'); END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_leave_intro_audio ON public.event_presentation;
DROP TRIGGER IF EXISTS studio_presentation_audio_rules ON public.event_presentation;
CREATE TRIGGER studio_presentation_audio_rules BEFORE UPDATE OF frame_id,mode,running,results_visible,audio ON public.event_presentation
FOR EACH ROW EXECUTE FUNCTION public.studio_presentation_audio_rules();

-- Activate rules also work when the agenda item was already shown manually.
CREATE OR REPLACE FUNCTION public.studio_agenda_audio_activation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE fid uuid; eid uuid; aid uuid;
BEGIN
 IF TG_TABLE_NAME='event' THEN
  IF NEW.current_agenda_item_id IS NOT DISTINCT FROM OLD.current_agenda_item_id THEN RETURN NULL; END IF;
  eid:=NEW.id; aid:=NEW.current_agenda_item_id;
 ELSE
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status<>'active' THEN RETURN NULL; END IF;
  eid:=NEW.event_id; aid:=NEW.id;
 END IF;
 SELECT ep.frame_id INTO fid FROM event_presentation ep JOIN studio_state st ON st.project_id=ep.project_id
 WHERE ep.event_id=eid AND EXISTS(SELECT 1 FROM jsonb_array_elements(st.document->'nodes') n WHERE n->>'id'=ep.frame_id::text AND n#>>'{eventSource,id}'=aid::text);
 IF fid IS NOT NULL THEN PERFORM studio_fire_show_cue(eid,fid,'activate'); END IF;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS studio_agenda_audio_activation ON public.event;
CREATE CONSTRAINT TRIGGER studio_agenda_audio_activation AFTER UPDATE ON public.event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_agenda_audio_activation();
DROP TRIGGER IF EXISTS studio_agenda_audio_activation ON public.agenda_item;
CREATE CONSTRAINT TRIGGER studio_agenda_audio_activation AFTER UPDATE ON public.agenda_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_agenda_audio_activation();
REVOKE ALL ON FUNCTION public.studio_resolve_show_audio(uuid,uuid,text[],jsonb,bigint),public.studio_presentation_audio_rules(),public.studio_agenda_audio_activation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_resolve_show_audio(uuid,uuid,text[],jsonb,bigint),public.studio_presentation_audio_rules(),public.studio_agenda_audio_activation() TO service_role;

-- Preserve global rules when an agenda frame is removed.
CREATE OR REPLACE FUNCTION public.studio_sync_event(eid uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
 DECLARE e event; pid uuid; d jsonb; n jsonb; a agenda_item; added jsonb; fid text; keep_ids text[]; now_ms bigint; idx integer:=1; changed boolean:=false; ordered jsonb; previous_frame uuid; next_frame uuid; fallback_frame uuid; part jsonb;
 BEGIN
 PERFORM pg_advisory_xact_lock(1886351981);
 SELECT * INTO e FROM event WHERE id=eid;
 IF NOT FOUND THEN RETURN; END IF;
 now_ms:=(extract(epoch from clock_timestamp())*1000)::bigint;
 SELECT id INTO pid FROM studio_project WHERE event_id=eid;
 IF pid IS NULL THEN
  pid:=gen_random_uuid();
  SELECT document INTO d FROM studio_event_template WHERE kind='cover';
  d:=jsonb_set(d,'{nodes}',studio_clone_event_nodes('cover',eid,0));
  d:=jsonb_set(d,'{title}',to_jsonb(left(coalesce(nullif(e.title,''),'Event'),200)));
  INSERT INTO studio_project(id,owner_id,group_id,event_id,title,kind,visibility,document_schema_version,created_at,updated_at)
  VALUES(pid,e.creator_id,e.group_id,eid,d->>'title','event',e.visibility,6,now_ms,now_ms);
  INSERT INTO studio_state(project_id,document,updated_at) VALUES(pid,d,now_ms);
  INSERT INTO event_presentation(event_id,project_id,frame_id,updated_at) VALUES(eid,pid,(d#>>'{nodes,0,id}')::uuid,now_ms);
 END IF;
 SELECT document INTO d FROM studio_state WHERE project_id=pid FOR UPDATE;
 keep_ids:=ARRAY[eid::text];
 FOR a IN SELECT * FROM agenda_item WHERE event_id=eid AND coalesce(status,'') NOT IN ('withdrawn','cancelled') ORDER BY order_index NULLS LAST,id LOOP
  keep_ids:=array_append(keep_ids,a.id::text);
  SELECT item->>'id' INTO fid FROM jsonb_array_elements(d->'nodes') item WHERE item#>>'{eventSource,id}'=a.id::text;
  IF fid IS NULL THEN
   added:=studio_clone_event_nodes(coalesce(a.type,'discussion'),a.id,idx);
   added:=jsonb_set(added,'{0,name}',to_jsonb(left(coalesce(nullif(a.title,''),a.type,'TOP'),200)));
   d:=jsonb_set(d,'{nodes}',(d->'nodes')||added); changed:=true;
  ELSE
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(d->'nodes') item WHERE item->>'id'=fid AND item#>>'{eventSource,template}' IS DISTINCT FROM coalesce(a.type,'discussion')) THEN
    added:=studio_clone_event_nodes(coalesce(a.type,'discussion'),a.id,idx);
    SELECT jsonb_agg(item) INTO ordered FROM jsonb_array_elements(d->'nodes') item WHERE NOT(coalesce(item->>'parentFrameId'=fid,false) AND item ? 'eventTemplateSlot' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(added) fresh WHERE fresh->>'eventTemplateSlot'=item->>'eventTemplateSlot'));
    d:=jsonb_set(d,'{nodes}',ordered);
    FOR part IN SELECT item FROM jsonb_array_elements(added) item WHERE item->>'type'<>'frame' LOOP
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'nodes') item WHERE item->>'parentFrameId'=fid AND item->>'eventTemplateSlot'=part->>'eventTemplateSlot') THEN d:=jsonb_set(d,'{nodes}',d->'nodes'||jsonb_build_array(jsonb_set(part,'{parentFrameId}',to_jsonb(fid)))); END IF;
    END LOOP;
    changed:=true;
   END IF;
   SELECT jsonb_agg(CASE WHEN item->>'id'=fid THEN jsonb_set(item,'{eventSource,template}',to_jsonb(coalesce(a.type,'discussion'))) ELSE item END) INTO ordered FROM jsonb_array_elements(d->'nodes') item;
   IF ordered IS DISTINCT FROM d->'nodes' THEN d:=jsonb_set(d,'{nodes}',ordered); changed:=true; END IF;
  END IF;
  idx:=idx+1;
 END LOOP;
 FOR n IN SELECT item FROM jsonb_array_elements(d->'nodes') item WHERE item ? 'eventSource' AND NOT(item#>>'{eventSource,id}'=ANY(keep_ids)) LOOP
  fid:=n->>'id';
  -- Include nested frames and all descendants, not just immediate children.
  WITH RECURSIVE removed(id) AS (SELECT fid UNION ALL SELECT item->>'id' FROM jsonb_array_elements(d->'nodes') item JOIN removed r ON item->>'parentFrameId'=r.id)
  SELECT coalesce(jsonb_agg(item),'[]') INTO ordered FROM jsonb_array_elements(d->'nodes') item WHERE item->>'id' NOT IN(SELECT id FROM removed);
  d:=jsonb_set(d,'{nodes}',ordered);
  d:=jsonb_set(d,'{show,cues}',coalesce((SELECT jsonb_agg(c) FROM jsonb_array_elements(coalesce(d#>'{show,cues}','[]')) c WHERE c->>'frameId' IS DISTINCT FROM fid),'[]'));
  d:=jsonb_set(d,'{deliverables}',coalesce((SELECT jsonb_agg(jsonb_set(v,'{frameIds}',ids)) FROM jsonb_array_elements(d->'deliverables') v CROSS JOIN LATERAL (SELECT coalesce(jsonb_agg(x),'[]') ids FROM jsonb_array_elements(v->'frameIds') x WHERE x#>>'{}'<>fid) f WHERE jsonb_array_length(ids)>0),'[]'));
  changed:=true;
 END LOOP;
 IF coalesce(d#>>'{show,order}','agenda')='agenda' THEN
  SELECT jsonb_agg(CASE WHEN item ? 'eventSource' THEN jsonb_set(item,'{zIndex}',to_jsonb(CASE WHEN item#>>'{eventSource,type}'='event' THEN 0 ELSE coalesce((SELECT row_no::int FROM (SELECT id,row_number() OVER(ORDER BY order_index NULLS LAST,id) row_no FROM agenda_item WHERE event_id=eid AND coalesce(status,'') NOT IN ('withdrawn','cancelled')) seq WHERE seq.id::text=item#>>'{eventSource,id}'),0) END)) ELSE item END) INTO ordered FROM jsonb_array_elements(d->'nodes') item;
  IF ordered IS DISTINCT FROM d->'nodes' THEN d:=jsonb_set(d,'{nodes}',ordered); changed:=true; END IF;
 END IF;
 IF changed THEN
  PERFORM set_config('polity.event_studio_sync',pid::text,true);
  UPDATE studio_state SET document=d,content_revision=content_revision+1,updated_at=now_ms WHERE project_id=pid;
  PERFORM set_config('polity.event_studio_sync','',true);
 END IF;
 UPDATE studio_project SET owner_id=e.creator_id,visibility=e.visibility,group_id=e.group_id,updated_at=now_ms WHERE id=pid;
 SELECT (candidate->>'id')::uuid INTO fallback_frame FROM jsonb_array_elements(d->'nodes') candidate WHERE candidate->>'type'='frame' AND candidate->>'parentFrameId' IS NULL AND coalesce((candidate->>'visible')::boolean,true) ORDER BY CASE WHEN candidate#>>'{eventSource,type}'='event' THEN 0 ELSE 1 END,(candidate->>'zIndex')::int LIMIT 1;
 SELECT frame_id INTO previous_frame FROM event_presentation WHERE event_id=eid;
 UPDATE event_presentation SET frame_id=CASE WHEN follow_agenda THEN coalesce((SELECT (item->>'id')::uuid FROM jsonb_array_elements(d->'nodes') item WHERE item#>>'{eventSource,id}'=e.current_agenda_item_id::text AND coalesce((item->>'visible')::boolean,true)), fallback_frame)
 ELSE CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(d->'nodes') item WHERE item->>'id'=frame_id::text) THEN frame_id ELSE fallback_frame END END,
 running=running AND coalesce(e.status,'')<>'cancelled',audio=CASE WHEN e.status='cancelled' THEN '{}' ELSE audio END,
 revision=revision+1,updated_at=now_ms WHERE event_id=eid RETURNING frame_id INTO next_frame;
 IF previous_frame IS DISTINCT FROM next_frame THEN
  PERFORM studio_fire_show_cue(eid,next_frame,'enter');
  PERFORM studio_fire_show_cue(eid,next_frame,'activate');
 END IF;
 END;
$$;


