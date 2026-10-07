-- Serialize capability changes with canvas commands, including Zero mutators.
CREATE FUNCTION public.canvas_lock_authority() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(1886351981);
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.canvas_lock_authority() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['group','group_membership','group_membership_role','role','action_right','studio_project','canvas_role_capability'] LOOP
  EXECUTE format('CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority()',name);
 END LOOP;
END $$;
