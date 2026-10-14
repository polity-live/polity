-- MANUAL_SQL: migra does not track publication membership.
-- Zero normally owns its publications. Extend only an existing legacy `zero`
-- publication with an explicit table list; do not create or alter runtime ones.
DO $$
DECLARE table_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zero' AND NOT puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY[
      'studio_state', 'canvas_proposal', 'canvas_workspace_reader',
      'studio_command_receipt', 'studio_asset', 'studio_revision',
      'canvas_control', 'canvas_vote', 'canvas_comment', 'canvas_history',
      'canvas_library', 'canvas_role_capability', 'canvas_receipt',
      'studio_editor_action', 'studio_element_set', 'studio_element_set_revision',
      'studio_live_source', 'event_presentation', 'event_presentation_device'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'zero' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END
$$;
