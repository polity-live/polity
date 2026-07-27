-- =============================================================================
-- 33_app_tutorial.sql — Isolated, resumable live tutorial runs
-- =============================================================================

CREATE TABLE public.app_tutorial_run (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT app_tutorial_run_status_check CHECK (status IN ('active', 'paused')),
  current_checkpoint_id TEXT NOT NULL,
  fixture_version INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE UNIQUE INDEX app_tutorial_run_one_open_per_user
  ON public.app_tutorial_run (user_id)
  WHERE status IN ('active', 'paused');
CREATE INDEX app_tutorial_run_expires_at_idx
  ON public.app_tutorial_run (expires_at);

CREATE TABLE public.app_tutorial_checkpoint_effect (
  run_id UUID NOT NULL REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE,
  checkpoint_id TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, checkpoint_id, effect_key)
);

CREATE TABLE public.app_tutorial_entity (
  run_id UUID NOT NULL REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  PRIMARY KEY (run_id, alias),
  CONSTRAINT app_tutorial_entity_run_type_id_key
    UNIQUE (run_id, entity_type, entity_id)
);

ALTER TABLE public."user"
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public."group"
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.event
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.amendment
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.blog
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.statement
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.todo
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.notification
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.conversation
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.payment
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;
ALTER TABLE public.search_document
  ADD COLUMN tutorial_run_id UUID REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

CREATE INDEX user_tutorial_run_id_idx ON public."user" (tutorial_run_id);
CREATE INDEX group_tutorial_run_id_idx ON public."group" (tutorial_run_id);
CREATE INDEX event_tutorial_run_id_idx ON public.event (tutorial_run_id);
CREATE INDEX amendment_tutorial_run_id_idx ON public.amendment (tutorial_run_id);
CREATE INDEX blog_tutorial_run_id_idx ON public.blog (tutorial_run_id);
CREATE INDEX statement_tutorial_run_id_idx ON public.statement (tutorial_run_id);
CREATE INDEX todo_tutorial_run_id_idx ON public.todo (tutorial_run_id);
CREATE INDEX notification_tutorial_run_id_idx ON public.notification (tutorial_run_id);
CREATE INDEX conversation_tutorial_run_id_idx ON public.conversation (tutorial_run_id);
CREATE INDEX payment_tutorial_run_id_idx ON public.payment (tutorial_run_id);
CREATE INDEX search_document_tutorial_run_id_idx ON public.search_document (tutorial_run_id);

CREATE OR REPLACE FUNCTION public.tag_app_tutorial_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.search_document
  SET tutorial_run_id = NEW.tutorial_run_id
  WHERE entity_type = TG_ARGV[0]
    AND entity_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_tag_user_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('user');
CREATE TRIGGER zz_tag_group_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('group');
CREATE TRIGGER zz_tag_event_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public.event
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('event');
CREATE TRIGGER zz_tag_amendment_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public.amendment
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('amendment');
CREATE TRIGGER zz_tag_blog_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public.blog
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('blog');
CREATE TRIGGER zz_tag_statement_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public.statement
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('statement');
CREATE TRIGGER zz_tag_todo_tutorial_search_document
AFTER INSERT OR UPDATE OF tutorial_run_id ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('todo');

ALTER TABLE public.app_tutorial_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_tutorial_checkpoint_effect ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_tutorial_entity ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_tutorial_run_owner_select
  ON public.app_tutorial_run FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY app_tutorial_entity_owner_select
  ON public.app_tutorial_entity FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_tutorial_run run
      WHERE run.id = run_id AND run.user_id = auth.uid()
    )
  );
CREATE POLICY app_tutorial_service_role_all
  ON public.app_tutorial_run FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY app_tutorial_effect_service_role_all
  ON public.app_tutorial_checkpoint_effect FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY app_tutorial_entity_service_role_all
  ON public.app_tutorial_entity FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_expired_app_tutorial_runs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.amendment_process_run process_run
  USING public.amendment amendment, public.app_tutorial_run tutorial_run
  WHERE process_run.amendment_id = amendment.id
    AND amendment.tutorial_run_id = tutorial_run.id
    AND tutorial_run.expires_at <= now();

  DELETE FROM public.app_tutorial_run
  WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_app_tutorial_runs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_app_tutorial_runs() TO service_role;
