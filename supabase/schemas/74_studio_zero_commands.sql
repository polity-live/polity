-- 74_studio_zero_commands.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_command_receipt (
    id uuid NOT NULL,
    actor_id uuid NOT NULL,
    project_id uuid,
    command text NOT NULL,
    input_hash text NOT NULL,
    result jsonb NOT NULL,
    created_at bigint NOT NULL,
    expires_at bigint,
    CONSTRAINT studio_command_receipt_pkey PRIMARY KEY (id)
);

ALTER TABLE public.studio_command_receipt ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.studio_editor_action_pending() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN NEW.pending := (NEW.result IS NULL); RETURN NEW; END $$;

CREATE FUNCTION public.studio_membership_group_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
 UPDATE public.group_membership_role SET group_id=NEW.group_id WHERE group_membership_id=NEW.id;
 RETURN NEW;
END $$;

CREATE FUNCTION public.studio_membership_role_group() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
 SELECT group_id INTO NEW.group_id FROM public.group_membership WHERE id=NEW.group_membership_id;
 RETURN NEW;
END $$;

CREATE FUNCTION public.studio_presence_channel_access(topic text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
END $_$;

CREATE INDEX studio_command_receipt_actor ON public.studio_command_receipt USING btree (actor_id, created_at);

CREATE INDEX studio_command_receipt_expiry ON public.studio_command_receipt USING btree (expires_at) WHERE (expires_at IS NOT NULL);
