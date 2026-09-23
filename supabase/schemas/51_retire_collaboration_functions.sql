DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'collaboration_%'
 LOOP EXECUTE format('DROP FUNCTION %s CASCADE',r.signature); END LOOP;
END $$;
ALTER TABLE public.studio_reset_storage_manifest ENABLE ROW LEVEL SECURITY;
