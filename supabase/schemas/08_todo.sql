-- =============================================================================
-- 08_todo.sql — Todos and todo assignments
-- =============================================================================

-- Todo table
CREATE TABLE public.todo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  tags JSONB,
  visibility TEXT NOT NULL DEFAULT 'public',
  creator_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID,
  event_id UUID,
  amendment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_creator ON public.todo (creator_id);
CREATE INDEX idx_todo_group ON public.todo (group_id);
CREATE INDEX idx_todo_status ON public.todo (status);
CREATE INDEX idx_todo_archived_at ON public.todo (archived_at DESC)
WHERE archived_at IS NOT NULL;
CREATE INDEX idx_todo_active_status ON public.todo (status)
WHERE archived_at IS NULL;

ALTER TABLE public.todo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.todo FOR ALL TO service_role USING (true);

-- Todo assignment table
CREATE TABLE public.todo_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todo (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  role TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_assignment_todo ON public.todo_assignment (todo_id);
CREATE INDEX idx_todo_assignment_user ON public.todo_assignment (user_id);

ALTER TABLE public.todo_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.todo_assignment FOR ALL TO service_role USING (true);

-- Append-only activity history for todos. Application writes are performed by
-- trusted Zero mutators in the same transaction as the corresponding change.
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
