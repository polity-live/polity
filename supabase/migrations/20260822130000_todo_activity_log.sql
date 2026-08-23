CREATE TABLE public.todo_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todo (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  subject_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (
    action IN ('created', 'updated', 'assigned', 'unassigned', 'archived', 'unarchived')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'high')),
  changes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(changes) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_activity_todo_severity_created
  ON public.todo_activity (todo_id, severity, created_at DESC);

ALTER TABLE public.todo_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.todo_activity FOR ALL TO service_role USING (true);

INSERT INTO public.todo_activity (
  id,
  todo_id,
  actor_id,
  subject_user_id,
  action,
  severity,
  changes,
  created_at
)
SELECT
  todo.id,
  todo.id,
  todo.creator_id,
  NULL,
  'created',
  'high',
  '[]'::JSONB,
  todo.created_at
FROM public.todo;

GRANT ALL PRIVILEGES ON TABLE public.todo_activity TO service_role;
