-- Serialize additive DDL and derived-right backfills with existing permission writers.
SELECT pg_advisory_xact_lock(1886351981);

-- Studio command results are private to the authenticated caller.
CREATE TABLE public.studio_command_receipt (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  project_id uuid,
  command text NOT NULL,
  input_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint
);
CREATE INDEX studio_command_receipt_actor ON public.studio_command_receipt(actor_id, created_at);
CREATE INDEX studio_command_receipt_expiry ON public.studio_command_receipt(expires_at) WHERE expires_at IS NOT NULL;
ALTER TABLE public.studio_command_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_command_receipt FROM anon, authenticated;
GRANT ALL ON public.studio_command_receipt TO service_role;

CREATE OR REPLACE FUNCTION public.studio_presence_channel_access(topic text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE parts text[];
BEGIN
  IF topic !~ '^presence:studio:[0-9a-f-]{36}:(main|[0-9a-f-]{36})$' THEN RETURN false; END IF;
  parts := string_to_array(topic, ':');
  IF NOT public.studio_collaboration_access(auth.uid(), parts[3]::uuid) THEN RETURN false; END IF;
  IF parts[4]='main' THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.canvas_proposal p WHERE p.id=parts[4]::uuid AND p.project_id=parts[3]::uuid
      AND public.canvas_proposal_access(auth.uid(), p.id)
  );
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.studio_presence_channel_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_presence_channel_access(text) TO authenticated;
CREATE POLICY studio_direct_presence_read ON realtime.messages FOR SELECT TO authenticated
  USING(public.studio_presence_channel_access(realtime.topic()));
CREATE POLICY studio_direct_presence_write ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK(public.studio_presence_channel_access(realtime.topic()));

ALTER TABLE public.studio_editor_action ADD COLUMN pending boolean NOT NULL DEFAULT true;
UPDATE public.studio_editor_action SET pending=(result IS NULL);
CREATE FUNCTION public.studio_editor_action_pending() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN NEW.pending := (NEW.result IS NULL); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.studio_editor_action_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_editor_action_pending() TO service_role;
CREATE TRIGGER studio_editor_action_pending BEFORE INSERT OR UPDATE OF result ON public.studio_editor_action FOR EACH ROW EXECUTE FUNCTION public.studio_editor_action_pending();
CREATE INDEX studio_editor_action_pending_actor ON public.studio_editor_action(actor_id,project_id,created_at) WHERE pending;

DO $$ DECLARE name text; BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='zero' AND NOT puballtables) THEN
    FOREACH name IN ARRAY ARRAY['studio_command_receipt','studio_asset','studio_revision','canvas_control','canvas_vote','canvas_comment','canvas_history','canvas_library','canvas_role_capability','canvas_receipt','studio_editor_action','studio_element_set','studio_element_set_revision'] LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='zero' AND schemaname='public' AND tablename=name) THEN
        EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I', name);
      END IF;
    END LOOP;
  END IF;
END $$;

-- Retire the former server-broadcast and recipient transport policies.
DROP POLICY IF EXISTS studio_presence_read ON realtime.messages;
DROP POLICY IF EXISTS studio_presence_write ON realtime.messages;
DROP POLICY IF EXISTS canvas_recipient_presence_read ON realtime.messages;
DROP FUNCTION IF EXISTS public.studio_realtime_access(text);
DROP FUNCTION IF EXISTS public.canvas_presence_access(text);
GRANT EXECUTE ON FUNCTION public.studio_presence_channel_access(text) TO service_role;

-- Correlate role rights with the membership's group, independently of the role's scope.
-- A regular column is replicated by Zero; triggers keep existing writers compatible.
ALTER TABLE public.group_membership_role ADD COLUMN group_id uuid;
UPDATE public.group_membership_role a SET group_id=m.group_id FROM public.group_membership m WHERE m.id=a.group_membership_id;
ALTER TABLE public.group_membership_role ALTER COLUMN group_id SET NOT NULL;
CREATE INDEX group_membership_role_studio_rights ON public.group_membership_role(group_id,role_id);
CREATE FUNCTION public.studio_membership_role_group() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 SELECT group_id INTO NEW.group_id FROM public.group_membership WHERE id=NEW.group_membership_id;
 RETURN NEW;
END $$;
CREATE TRIGGER studio_membership_role_group BEFORE INSERT OR UPDATE OF group_membership_id,group_id ON public.group_membership_role FOR EACH ROW EXECUTE FUNCTION public.studio_membership_role_group();
CREATE FUNCTION public.studio_membership_group_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.group_membership_role SET group_id=NEW.group_id WHERE group_membership_id=NEW.id;
 RETURN NEW;
END $$;
CREATE TRIGGER studio_membership_group_changed AFTER UPDATE OF group_id ON public.group_membership FOR EACH ROW WHEN (OLD.group_id IS DISTINCT FROM NEW.group_id) EXECUTE FUNCTION public.studio_membership_group_changed();
REVOKE ALL ON FUNCTION public.studio_membership_role_group(),public.studio_membership_group_changed() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_membership_role_group(),public.studio_membership_group_changed() TO service_role;
