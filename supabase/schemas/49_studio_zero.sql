-- Studio v2 replaces the retired CRDT store. Studio reset explicitly requested.
SELECT pg_advisory_xact_lock(1886351981);
CREATE TABLE IF NOT EXISTS public.studio_reset_storage_manifest (
  bucket_id text NOT NULL, storage_path text NOT NULL, removed_at bigint,
  PRIMARY KEY(bucket_id,storage_path)
);
REVOKE ALL ON public.studio_reset_storage_manifest FROM anon,authenticated;
GRANT ALL ON public.studio_reset_storage_manifest TO service_role;
INSERT INTO public.studio_reset_storage_manifest(bucket_id,storage_path)
 SELECT 'studio',storage_path FROM public.studio_asset
 UNION SELECT 'studio',storage_path FROM public.studio_export WHERE storage_path IS NOT NULL
 ON CONFLICT DO NOTHING;
UPDATE public.statement SET image_url=NULL WHERE image_url LIKE '/api/studio/published-media/%';
UPDATE public.statement SET video_url=NULL WHERE video_url LIKE '/api/studio/published-media/%';
-- Remove triggers belonging to the retired subsystem before deleting its records.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT t.tgname,c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE 'collaboration_%'
 LOOP EXECUTE format('DROP TRIGGER %I ON public.%I',r.tgname,r.relname); END LOOP;
END $$;
DELETE FROM public.studio_project;
ALTER TABLE public.studio_state DROP COLUMN state;
ALTER TABLE public.studio_state ADD COLUMN content_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.studio_revision DROP COLUMN IF EXISTS collaboration_revision_id;
ALTER TABLE public.studio_revision ADD COLUMN content_revision integer NOT NULL DEFAULT 0;
CREATE TABLE public.studio_operation (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public."user"(id), input_hash text NOT NULL,
 changes jsonb NOT NULL, result jsonb NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX studio_operation_project ON public.studio_operation(project_id,created_at);
ALTER TABLE public.studio_operation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_operation FROM anon,authenticated;
GRANT ALL ON public.studio_operation TO service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'collaboration_%'
 LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE',r.tablename); END LOOP;
END $$;
-- Realtime authorization is independent of the service-role persistence API.
CREATE OR REPLACE FUNCTION public.studio_realtime_access(topic text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN topic ~ '^studio:[0-9a-f-]{36}$' THEN public.studio_access(auth.uid(),substring(topic from 8)::uuid,false) ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.studio_realtime_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.studio_realtime_access(text) TO authenticated;
CREATE POLICY studio_presence_read ON realtime.messages FOR SELECT TO authenticated USING (public.studio_realtime_access(realtime.topic()));
CREATE POLICY studio_presence_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK (public.studio_realtime_access(realtime.topic()));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='zero') AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='zero' AND tablename='studio_state') THEN ALTER PUBLICATION zero ADD TABLE public.studio_state; END IF;
END $$;
