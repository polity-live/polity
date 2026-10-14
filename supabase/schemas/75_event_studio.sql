-- 75_event_studio.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.event_presentation (
    event_id uuid NOT NULL,
    project_id uuid NOT NULL,
    mode text DEFAULT 'studio'::text NOT NULL,
    frame_id uuid,
    follow_agenda boolean DEFAULT true NOT NULL,
    results_visible boolean DEFAULT true NOT NULL,
    running boolean DEFAULT false NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    cue_id uuid,
    cue_at bigint,
    controller_id uuid,
    controller_device_id uuid,
    lease_until bigint,
    audio_device_id uuid,
    audio jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT event_presentation_mode_check CHECK ((mode = ANY (ARRAY['studio'::text, 'agenda'::text, 'speakers'::text]))),
    CONSTRAINT event_presentation_pkey PRIMARY KEY (event_id),
    CONSTRAINT event_presentation_project_id_key UNIQUE (project_id)
);

CREATE TABLE public.event_presentation_device (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    last_seen bigint NOT NULL,
    CONSTRAINT event_presentation_device_name_check CHECK (((length(name) >= 1) AND (length(name) <= 100))),
    CONSTRAINT event_presentation_device_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_presentation_operation (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    input_hash text NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT event_presentation_operation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_event_template (
    kind text NOT NULL,
    document jsonb NOT NULL,
    CONSTRAINT studio_event_template_pkey PRIMARY KEY (kind)
);

CREATE TABLE public.studio_live_source (
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    event_id uuid,
    agenda_item_id uuid,
    vote_id uuid,
    election_id uuid,
    amendment_id uuid,
    user_id uuid,
    group_id uuid,
    payload jsonb NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT studio_live_source_source_type_check CHECK ((source_type = ANY (ARRAY['event'::text, 'agenda_item'::text, 'vote'::text, 'election'::text, 'amendment'::text, 'user'::text, 'group'::text]))),
    CONSTRAINT studio_live_source_pkey PRIMARY KEY (source_type, source_id)
);

ALTER TABLE public.event_presentation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_presentation_device ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_presentation_operation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_event_template ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_live_source ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.event_studio_can_manage(actor uuid, eid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT actor IS NOT NULL AND event_studio_can_read(actor,eid) AND EXISTS(SELECT 1 FROM event e WHERE e.id=eid AND (e.creator_id=actor
 OR EXISTS(SELECT 1 FROM event_participant ep JOIN event_participant_role pr ON pr.event_participant_id=ep.id
 JOIN role r ON r.id=pr.role_id AND r.scope='event' AND r.event_id=e.id JOIN action_right ar ON ar.role_id=pr.role_id WHERE ep.event_id=e.id AND ep.user_id=actor
 AND ep.status IN ('active','confirmed','member','admin') AND ar.event_id=e.id AND ar.resource IN ('events','agendaItems') AND ar.action='manage')));
$$;

CREATE FUNCTION public.event_studio_can_read(actor uuid, eid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM event e WHERE e.id=eid AND (e.tutorial_run_id IS NULL OR EXISTS(SELECT 1 FROM app_tutorial_run tr WHERE tr.id=e.tutorial_run_id AND tr.user_id=actor AND tr.status IN ('active','paused'))) AND (
 e.visibility='public' OR (actor IS NOT NULL AND (e.visibility='authenticated' OR e.creator_id=actor
 OR EXISTS(SELECT 1 FROM "group" g WHERE g.id=e.group_id AND (g.owner_id=actor
  OR EXISTS(SELECT 1 FROM group_membership m WHERE m.group_id=g.id AND m.user_id=actor AND m.status IN ('active','member','admin'))
  OR EXISTS(SELECT 1 FROM group_guest_access ga WHERE ga.group_id=g.id AND ga.user_id=actor AND ga.status='active')))
 OR EXISTS(SELECT 1 FROM event_participant ep JOIN event_participant_role pr ON pr.event_participant_id=ep.id
 JOIN role r ON r.id=pr.role_id AND r.scope='event' AND r.event_id=e.id JOIN action_right ar ON ar.role_id=pr.role_id WHERE ep.event_id=e.id AND ep.user_id=actor
 AND ep.status IN ('active','confirmed','member','admin','invited') AND ar.event_id=e.id AND ar.resource='events' AND ar.action IN ('view','manage','moderate','manage_members','manage_roles','manage_participants','manage_speakers','manage_votes','speak'))))));
$$;

CREATE FUNCTION public.studio_agenda_audio_activation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.studio_clone_event_nodes(kind_name text, source uuid, frame_position integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE value text; token text;
 BEGIN
 SELECT document->'nodes' INTO value FROM studio_event_template WHERE kind=kind_name;
 IF value IS NULL THEN SELECT document->'nodes' INTO value FROM studio_event_template WHERE kind='discussion'; END IF;
 FOR token IN SELECT DISTINCT m[1] FROM regexp_matches(value,'"id": "([0-9a-f-]{36})"','g') m LOOP
  IF token<>'00000000-0000-4000-8000-000000000000' THEN value:=replace(value,token,gen_random_uuid()::text); END IF;
 END LOOP;
 value:=replace(value,'00000000-0000-4000-8000-000000000000',source::text);
 RETURN jsonb_set(jsonb_set(value::jsonb,'{0,zIndex}',to_jsonb(frame_position)), '{0,transform,x}',to_jsonb(frame_position*2080));
 END;
$$;

CREATE FUNCTION public.studio_election_payload(eid uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
 SELECT jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'majority_type',e.majority_type,'election_mode',coalesce(e.election_mode,'single'), 'seat_count',e.seat_count,'max_votes',e.max_votes,
 'eligible',(SELECT count(*) FROM elector WHERE election_id=eid AND participation_channel='online')+e.offline_electorate_size,
 'options',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',coalesce(nullif(c.name,''),concat_ws(' ',u.first_name,u.last_name)),'image_url',c.image_url,
 'indicative',(SELECT count(*) FROM indicative_candidate_selection WHERE election_id=eid AND candidate_id=c.id)+coalesce((SELECT sum(count) FROM election_offline_tally WHERE election_id=eid AND candidate_id=c.id AND phase='indicative'),0),
 'final',(SELECT count(*) FROM final_candidate_selection WHERE election_id=eid AND candidate_id=c.id)+coalesce((SELECT sum(count) FROM election_offline_tally WHERE election_id=eid AND candidate_id=c.id AND phase='final'),0)) ORDER BY c.order_index,c.id) FROM election_candidate c JOIN "user" u ON u.id=c.user_id WHERE c.election_id=eid AND c.status<>'withdrawn'),'[]')) FROM election e WHERE e.id=eid;
$$;

CREATE FUNCTION public.studio_event_access_changed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 DECLARE r jsonb; prior jsonb; eid uuid; pid uuid; ids uuid[]:=ARRAY[]::uuid[];
 BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 prior:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 ids:=array_append(array_append(ids,(r->>'event_id')::uuid),(prior->>'event_id')::uuid);
 IF TG_TABLE_NAME='event_participant_role' THEN
  SELECT event_id INTO eid FROM event_participant WHERE id=(r->>'event_participant_id')::uuid; ids:=array_append(ids,eid);
  SELECT event_id INTO eid FROM event_participant WHERE id=(prior->>'event_participant_id')::uuid; ids:=array_append(ids,eid);
 END IF;
 FOR pid IN SELECT id FROM studio_project WHERE event_id=ANY(ids) LOOP PERFORM sync_studio_search_acl(pid); END LOOP;
 RETURN NULL;
 END;
$$;

CREATE FUNCTION public.studio_event_document_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 DECLARE eid uuid; item jsonb;
 BEGIN
 SELECT event_id INTO eid FROM studio_project WHERE id=NEW.project_id;
 IF eid IS NULL OR current_setting('polity.event_studio_sync',true)=NEW.project_id::text THEN RETURN NEW; END IF;
 FOR item IN SELECT v FROM jsonb_array_elements(OLD.document->'nodes') v WHERE v ? 'eventSource' LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.document->'nodes') v WHERE v->>'id'=item->>'id' AND v->'eventSource'=item->'eventSource') THEN RAISE EXCEPTION 'Event frames are managed by their agenda. Hide the frame or duplicate it instead.'; END IF;
 END LOOP;
 FOR item IN SELECT v FROM jsonb_array_elements(NEW.document->'nodes') v WHERE v ? 'eventSource' LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.document->'nodes') v WHERE v->>'id'=item->>'id' AND v->'eventSource'=item->'eventSource') THEN RAISE EXCEPTION 'Event frame provenance cannot be changed'; END IF;
 END LOOP;
 RETURN NEW;
 END;
$$;

CREATE FUNCTION public.studio_event_project_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 BEGIN
 IF OLD.event_id IS NOT NULL AND EXISTS(SELECT 1 FROM event WHERE id=OLD.event_id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Delete the event to remove its presentation project'; END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.owner_id IS DISTINCT FROM (SELECT creator_id FROM event WHERE id=OLD.event_id) OR NEW.group_id IS DISTINCT FROM (SELECT group_id FROM event WHERE id=OLD.event_id) OR NEW.visibility IS DISTINCT FROM (SELECT visibility FROM event WHERE id=OLD.event_id) THEN RAISE EXCEPTION 'Event presentation access is inherited'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END;
$$;

CREATE FUNCTION public.studio_event_structure_changed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 BEGIN
 IF TG_TABLE_NAME='event' THEN PERFORM studio_sync_event(NEW.id);
 ELSE
  IF TG_OP<>'INSERT' AND OLD.event_id IS NOT NULL THEN PERFORM studio_sync_event(OLD.event_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.event_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.event_id IS DISTINCT FROM OLD.event_id) THEN PERFORM studio_sync_event(NEW.event_id); END IF;
 END IF;
 RETURN NULL;
 END;
$$;

CREATE FUNCTION public.studio_fire_show_cue(eid uuid, fid uuid, trigger_name text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.studio_leave_intro_audio() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE d jsonb; previous jsonb; incoming boolean; now_ms bigint;
BEGIN
 IF OLD.mode<>'studio' OR (NEW.mode='studio' AND NEW.frame_id IS NOT DISTINCT FROM OLD.frame_id)
    OR NEW.audio IS DISTINCT FROM OLD.audio OR NEW.audio->>'status'<>'playing' THEN RETURN NEW; END IF;
 SELECT document INTO d FROM studio_state WHERE project_id=NEW.project_id;
 SELECT n INTO previous FROM jsonb_array_elements(d->'nodes') n WHERE n->>'id'=OLD.frame_id::text;
 IF previous IS NULL OR NOT(previous ? 'intro' OR previous#>>'{eventSource,template}'='cover') THEN RETURN NEW; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d#>'{show,cues}','[]')) c
  JOIN studio_asset a ON a.id=(c->>'assetId')::uuid AND a.project_id=NEW.project_id AND a.ready
   AND a.workspace_id IS NULL AND a.mime_type IN ('audio/mpeg','audio/wav')
  WHERE c->>'frameId'=NEW.frame_id::text AND c->>'trigger' IN ('enter','activate') AND NEW.mode='studio') INTO incoming;
 IF incoming THEN RETURN NEW; END IF;
 now_ms:=(extract(epoch FROM clock_timestamp())*1000)::bigint;
 NEW.audio:=NEW.audio || jsonb_build_object('status','stopped','position',0,'fadeSeconds',1,'at',now_ms);
 RETURN NEW;
END;
$$;

CREATE FUNCTION public.studio_presentation_audio_rules() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.studio_refresh_source(kind_name text, sid uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
 DECLARE p jsonb; eid uuid; aid uuid; vid uuid; elid uuid; amid uuid; uid uuid; gid uuid; row_data jsonb; selected_result jsonb;
 BEGIN
 IF sid IS NULL THEN RETURN; END IF;
 CASE kind_name
 WHEN 'event' THEN
  SELECT jsonb_build_object('title',e.title,'status',e.status,'start_time',extract(epoch FROM e.start_date)*1000,'end_time',extract(epoch FROM e.end_date)*1000,'timezone',coalesce(e.timezone,'Europe/Berlin'),'location',concat_ws(' · ',e.location_name,e.city,e.location_type),'organizer',coalesce(g.name,concat_ws(' ',u.first_name,u.last_name)),'image_url',e.image_url,'current_agenda_item_id',e.current_agenda_item_id,'details',e.event_type) INTO p FROM event e LEFT JOIN "group" g ON g.id=e.group_id LEFT JOIN "user" u ON u.id=e.creator_id WHERE e.id=sid;
  eid:=sid;
 WHEN 'agenda_item' THEN
  aid:=sid;
  SELECT a.event_id,to_jsonb(a) INTO eid,row_data FROM agenda_item a WHERE a.id=sid;
  IF row_data IS NOT NULL THEN
   SELECT studio_vote_payload(v.id) INTO selected_result FROM vote v LEFT JOIN agenda_item_change_request cr ON cr.vote_id=v.id AND cr.agenda_item_id=sid WHERE v.agenda_item_id=sid OR cr.agenda_item_id=sid
   ORDER BY CASE WHEN v.status IN ('indicative','final') THEN 0 WHEN cr.status IN ('in-progress','active') THEN 1 WHEN v.purpose='closing' THEN 2 ELSE 3 END,cr.order_index,v.created_at DESC LIMIT 1;
   IF selected_result IS NULL THEN SELECT studio_election_payload(id) INTO selected_result FROM election WHERE agenda_item_id=sid ORDER BY created_at DESC LIMIT 1; END IF;
   SELECT jsonb_build_object('title',row_data->>'title','status',row_data->>'status','type',row_data->>'type','order_index',row_data->'order_index','duration',row_data->'duration',
   'start_time',coalesce(extract(epoch FROM (row_data->>'activated_at')::timestamptz)*1000,extract(epoch FROM (row_data->>'start_time')::timestamptz)*1000,extract(epoch FROM e.start_date)*1000+coalesce((SELECT sum(coalesce(duration,30))*60000 FROM agenda_item a WHERE a.event_id=eid AND a.order_index<(row_data->>'order_index')::int AND coalesce(a.status,'') NOT IN ('withdrawn','cancelled')),0)),
   'end_time',coalesce(extract(epoch FROM (row_data->>'completed_at')::timestamptz)*1000,extract(epoch FROM (row_data->>'end_time')::timestamptz)*1000),
   'timezone',coalesce(e.timezone,'Europe/Berlin'),'result_source_id',selected_result->>'id','result_source_type',CASE WHEN selected_result ? 'election_mode' THEN 'election' WHEN selected_result IS NOT NULL THEN 'vote' ELSE NULL END,'details',coalesce(row_data->>'description',''),
   'speakers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',concat_ws(' ',u.first_name,u.last_name),'completed',s.completed,'time',s.time,'start_time',extract(epoch FROM s.start_time)*1000,'end_time',extract(epoch FROM s.end_time)*1000) ORDER BY s.order_index,s.id) FROM speaker_list s JOIN "user" u ON u.id=s.user_id WHERE s.agenda_item_id=sid),'[]')) INTO p FROM event e WHERE e.id=eid;
   p:=jsonb_set(p,'{end_time}',coalesce(nullif(p->'end_time','null'),to_jsonb((p->>'start_time')::numeric+coalesce((row_data->>'duration')::numeric,30)*60000),'null'::jsonb));
  END IF;
 WHEN 'vote' THEN
  vid:=sid; SELECT agenda_item_id INTO aid FROM vote WHERE id=sid; SELECT event_id INTO eid FROM agenda_item WHERE id=aid;
  p:=jsonb_build_object('results',studio_vote_payload(sid)); SELECT p||jsonb_build_object('title',title,'status',status,'description',description) INTO p FROM vote WHERE id=sid;
 WHEN 'election' THEN
  elid:=sid; SELECT agenda_item_id INTO aid FROM election WHERE id=sid; SELECT event_id INTO eid FROM agenda_item WHERE id=aid;
  p:=jsonb_build_object('results',studio_election_payload(sid)); SELECT p||jsonb_build_object('title',title,'status',status,'description',description) INTO p FROM election WHERE id=sid;
 WHEN 'amendment' THEN amid:=sid; SELECT jsonb_build_object('title',a.title,'status',d.editing_mode,'description',a.reason) INTO p FROM amendment a LEFT JOIN document d ON d.id=a.document_id WHERE a.id=sid;
 WHEN 'user' THEN uid:=sid; SELECT jsonb_build_object('title',concat_ws(' ',first_name,last_name),'image_url',avatar,'description',handle) INTO p FROM "user" WHERE id=sid;
 WHEN 'group' THEN gid:=sid; SELECT jsonb_build_object('title',name,'description',description,'image_url',image_url) INTO p FROM "group" WHERE id=sid;
 END CASE;
 IF p IS NULL THEN DELETE FROM studio_live_source WHERE source_type=kind_name AND source_id=sid; RETURN; END IF;
 -- Legacy votes and elections may carry an agenda identifier without a parent row.
 -- Keep their source payload available while linking only existing agenda items.
 IF aid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM agenda_item WHERE id=aid) THEN aid:=NULL; END IF;
 IF eid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM event WHERE id=eid) THEN eid:=NULL; END IF;
 INSERT INTO studio_live_source(source_type,source_id,event_id,agenda_item_id,vote_id,election_id,amendment_id,user_id,group_id,payload,updated_at)
 VALUES(kind_name,sid,eid,aid,vid,elid,amid,uid,gid,p,(extract(epoch FROM clock_timestamp())*1000)::bigint)
 ON CONFLICT(source_type,source_id) DO UPDATE SET event_id=excluded.event_id,agenda_item_id=excluded.agenda_item_id,vote_id=excluded.vote_id,election_id=excluded.election_id,amendment_id=excluded.amendment_id,user_id=excluded.user_id,group_id=excluded.group_id,payload=excluded.payload,updated_at=excluded.updated_at;
 END;
$$;

CREATE FUNCTION public.studio_resolve_show_audio(eid uuid, fid uuid, names text[], base jsonb, now_ms bigint) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.studio_source_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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

CREATE FUNCTION public.studio_sync_event(eid uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.studio_vote_payload(vid uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
 SELECT jsonb_build_object('id',v.id,'title',v.title,'status',v.status,'majority_type',v.majority_type,
 'eligible',(SELECT count(*) FROM voter WHERE vote_id=vid AND participation_channel='online')+v.offline_electorate_size,
 'options',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,
 'indicative',(SELECT count(*) FROM indicative_choice_decision WHERE vote_id=vid AND choice_id=c.id)+coalesce((SELECT sum(count) FROM vote_offline_tally WHERE vote_id=vid AND choice_id=c.id AND phase='indicative'),0),
 'final',(SELECT count(*) FROM final_choice_decision WHERE vote_id=vid AND choice_id=c.id)+coalesce((SELECT sum(count) FROM vote_offline_tally WHERE vote_id=vid AND choice_id=c.id AND phase='final'),0)) ORDER BY c.order_index,c.id) FROM vote_choice c WHERE c.vote_id=vid),'[]')) FROM vote v WHERE v.id=vid;
$$;

CREATE INDEX studio_live_source_event ON public.studio_live_source USING btree (event_id);
