-- @covers schema 08_todo.sql
-- @covers schema 15_discussion.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

INSERT INTO public."user" (id, handle)
VALUES (
  'e9500000-0000-4000-a000-000000000001',
  'todo-thread-creator'
);

INSERT INTO public.todo (
  id,
  title,
  creator_id,
  created_at,
  updated_at
)
VALUES (
  'e9510000-0000-4000-a000-000000000001',
  'Todo with discussion',
  'e9500000-0000-4000-a000-000000000001',
  TIMESTAMPTZ '2026-02-01 10:00:00+00',
  TIMESTAMPTZ '2026-02-01 11:00:00+00'
);

SELECT results_eq(
  $sql$
    SELECT id, todo_id, user_id, status, upvotes, downvotes
    FROM public.thread
    WHERE todo_id = 'e9510000-0000-4000-a000-000000000001'
  $sql$,
  $sql$
    VALUES (
      'e9510000-0000-4000-a000-000000000001'::UUID,
      'e9510000-0000-4000-a000-000000000001'::UUID,
      'e9500000-0000-4000-a000-000000000001'::UUID,
      'open'::TEXT,
      0,
      0
    )
  $sql$,
  'creating a todo creates its canonical discussion thread'
);

SELECT results_eq(
  $sql$
    SELECT created_at, updated_at
    FROM public.thread
    WHERE todo_id = 'e9510000-0000-4000-a000-000000000001'
  $sql$,
  $sql$
    VALUES (
      TIMESTAMPTZ '2026-02-01 10:00:00+00',
      TIMESTAMPTZ '2026-02-01 11:00:00+00'
    )
  $sql$,
  'the discussion thread inherits todo timestamps'
);

UPDATE public.todo
SET title = 'Updated todo'
WHERE id = 'e9510000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.thread
    WHERE todo_id = 'e9510000-0000-4000-a000-000000000001'
  ),
  1,
  'updating a todo does not duplicate its thread'
);

INSERT INTO public.comment (
  id,
  thread_id,
  user_id,
  content
)
VALUES (
  'e9520000-0000-4000-a000-000000000001',
  'e9510000-0000-4000-a000-000000000001',
  'e9500000-0000-4000-a000-000000000001',
  'Todo discussion comment'
);

INSERT INTO public.thread_vote (
  id,
  thread_id,
  user_id,
  vote
)
VALUES (
  'e9530000-0000-4000-a000-000000000001',
  'e9510000-0000-4000-a000-000000000001',
  'e9500000-0000-4000-a000-000000000001',
  1
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.comment
    WHERE thread_id = 'e9510000-0000-4000-a000-000000000001'
  ),
  1,
  'the generated thread accepts comments'
);

DELETE FROM public.todo
WHERE id = 'e9510000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.thread
    WHERE id = 'e9510000-0000-4000-a000-000000000001'
  ),
  0,
  'deleting a todo cascades to its generated thread'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.comment
    WHERE id = 'e9520000-0000-4000-a000-000000000001'
  ),
  0,
  'deleting a todo cascades through the thread to comments'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.thread_vote
    WHERE id = 'e9530000-0000-4000-a000-000000000001'
  ),
  0,
  'deleting a todo cascades through the thread to votes'
);

SELECT * FROM finish();

ROLLBACK;
