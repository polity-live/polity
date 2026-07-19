ALTER TABLE public.todo
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_todo_archived_at
ON public.todo (archived_at DESC)
WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todo_active_status
ON public.todo (status)
WHERE archived_at IS NULL;
