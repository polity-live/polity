CREATE OR REPLACE FUNCTION public.canvas_proposal_access(actor uuid,wid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM canvas_proposal w WHERE w.id=wid AND studio_access(actor,w.project_id,false) AND
 (w.checksum IS NOT NULL OR w.owner_id=actor OR actor=ANY(w.shared_ids)));
$$;
CREATE FUNCTION public.canvas_presence_access(topic text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE parts text[];
BEGIN
 IF topic !~ '^canvas-user:[0-9a-f-]{36}:(main|[0-9a-f-]{36}):[0-9a-f-]{36}$' THEN RETURN false; END IF;
 parts:=string_to_array(topic,':');
 IF parts[4]::uuid IS DISTINCT FROM auth.uid() OR NOT studio_access(auth.uid(),parts[2]::uuid,false) THEN RETURN false; END IF;
 RETURN parts[3]='main' OR canvas_proposal_access(auth.uid(),parts[3]::uuid);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.canvas_presence_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.canvas_presence_access(text) TO authenticated;
CREATE POLICY canvas_recipient_presence_read ON realtime.messages FOR SELECT TO authenticated USING(public.canvas_presence_access(realtime.topic()));
-- No INSERT policy: only the server broadcasts to these recipient-specific topics.
