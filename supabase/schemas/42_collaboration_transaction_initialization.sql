CREATE FUNCTION public.collaboration_needs_initialization() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM collaboration_control WHERE singleton AND phase='active') THEN
    PERFORM set_config('polity.collaboration_needs_initialization','on',true);
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['document','blog','amendment_city_design','amendment_process_branch','studio_state'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_initialize AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.collaboration_needs_initialization()',target);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.collaboration_needs_initialization() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_needs_initialization() TO service_role;
