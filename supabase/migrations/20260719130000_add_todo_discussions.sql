ALTER TABLE public.thread
ADD COLUMN IF NOT EXISTS todo_id UUID REFERENCES public.todo (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_todo_unique ON public.thread (todo_id);

INSERT INTO public.thread (
  id,
  todo_id,
  user_id,
  content,
  status,
  upvotes,
  downvotes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  todo.id,
  todo.creator_id,
  NULL,
  'open',
  0,
  0,
  todo.created_at,
  todo.updated_at
FROM public.todo
WHERE NOT EXISTS (
  SELECT 1
  FROM public.thread
  WHERE thread.todo_id = todo.id
)
ON CONFLICT (todo_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_todo_discussion_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.thread (
    id,
    todo_id,
    user_id,
    content,
    status,
    upvotes,
    downvotes,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.creator_id,
    NULL,
    'open',
    0,
    0,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (todo_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS todo_ensure_discussion_thread ON public.todo;
CREATE TRIGGER todo_ensure_discussion_thread
AFTER INSERT ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.ensure_todo_discussion_thread();
