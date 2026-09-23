CREATE TABLE public.canvas_workspace_reader (
 workspace_id uuid NOT NULL REFERENCES public.canvas_proposal(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public."user"(id), PRIMARY KEY(workspace_id,user_id)
);
ALTER TABLE public.canvas_workspace_reader ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canvas_workspace_reader FROM anon,authenticated;
GRANT ALL ON public.canvas_workspace_reader TO service_role;
CREATE FUNCTION public.canvas_sync_readers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 DELETE FROM canvas_workspace_reader WHERE workspace_id=NEW.id;
 INSERT INTO canvas_workspace_reader(workspace_id,user_id) SELECT NEW.id,unnest(NEW.shared_ids) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.canvas_sync_readers() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER canvas_sync_readers AFTER INSERT OR UPDATE OF shared_ids ON public.canvas_proposal FOR EACH ROW EXECUTE FUNCTION public.canvas_sync_readers();
INSERT INTO canvas_workspace_reader(workspace_id,user_id) SELECT id,unnest(shared_ids) FROM canvas_proposal ON CONFLICT DO NOTHING;
DO $$ DECLARE name text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='zero') THEN
  FOREACH name IN ARRAY ARRAY['canvas_proposal','canvas_workspace_reader'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='zero' AND schemaname='public' AND tablename=name) THEN
    EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I',name);
   END IF;
  END LOOP;
 END IF;
END $$;
