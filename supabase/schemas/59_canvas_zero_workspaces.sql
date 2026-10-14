-- 59_canvas_zero_workspaces.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.canvas_workspace_reader (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT canvas_workspace_reader_pkey PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE public.canvas_workspace_reader ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.canvas_sync_readers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
 DELETE FROM canvas_workspace_reader WHERE workspace_id=NEW.id;
 INSERT INTO canvas_workspace_reader(workspace_id,user_id) SELECT NEW.id,unnest(NEW.shared_ids) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
