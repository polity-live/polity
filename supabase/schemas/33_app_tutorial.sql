-- 33_app_tutorial.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.app_tutorial_checkpoint_effect (
    run_id uuid NOT NULL,
    checkpoint_id text NOT NULL,
    effect_key text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_tutorial_checkpoint_effect_pkey PRIMARY KEY (run_id, checkpoint_id, effect_key)
);

CREATE TABLE public.app_tutorial_entity (
    run_id uuid NOT NULL,
    alias text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    CONSTRAINT app_tutorial_entity_pkey PRIMARY KEY (run_id, alias),
    CONSTRAINT app_tutorial_entity_run_type_id_key UNIQUE (run_id, entity_type, entity_id)
);

CREATE TABLE public.app_tutorial_run (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_checkpoint_id text NOT NULL,
    fixture_version integer NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    CONSTRAINT app_tutorial_run_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT app_tutorial_run_pkey PRIMARY KEY (id)
);

ALTER TABLE public.app_tutorial_checkpoint_effect ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_tutorial_entity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_tutorial_run ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.cleanup_expired_app_tutorial_runs() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE cleaned_count integer;
BEGIN
  DELETE FROM amendment_process_run process_run USING amendment, app_tutorial_run tutorial_run
    WHERE process_run.amendment_id=amendment.id AND amendment.tutorial_run_id=tutorial_run.id AND tutorial_run.expires_at<=now();
  DELETE FROM app_tutorial_run WHERE expires_at<=now();
  GET DIAGNOSTICS cleaned_count=ROW_COUNT;
  RETURN cleaned_count;
END $$;

CREATE FUNCTION public.tag_app_tutorial_search_document() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.search_document
  SET tutorial_run_id = NEW.tutorial_run_id
  WHERE entity_type = TG_ARGV[0]
    AND entity_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE INDEX app_tutorial_run_expires_at_idx ON public.app_tutorial_run USING btree (expires_at);

CREATE UNIQUE INDEX app_tutorial_run_one_open_per_user ON public.app_tutorial_run USING btree (user_id) WHERE (status = ANY (ARRAY['active'::text, 'paused'::text]));

CREATE POLICY app_tutorial_effect_service_role_all ON public.app_tutorial_checkpoint_effect TO service_role USING (true) WITH CHECK (true);

CREATE POLICY app_tutorial_entity_owner_select ON public.app_tutorial_entity FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_tutorial_run run
  WHERE ((run.id = app_tutorial_entity.run_id) AND (run.user_id = auth.uid())))));

CREATE POLICY app_tutorial_entity_service_role_all ON public.app_tutorial_entity TO service_role USING (true) WITH CHECK (true);

CREATE POLICY app_tutorial_run_owner_select ON public.app_tutorial_run FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY app_tutorial_service_role_all ON public.app_tutorial_run TO service_role USING (true) WITH CHECK (true);
