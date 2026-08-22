-- @covers schema 08_todo.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

INSERT INTO public."user" (id, handle)
VALUES
  ('e9800000-0000-4000-a000-000000000001', 'activity-creator'),
  ('e9800000-0000-4000-a000-000000000002', 'activity-actor');

INSERT INTO public.todo (id, title, creator_id)
VALUES (
  'e9810000-0000-4000-a000-000000000001',
  'Todo with activity',
  'e9800000-0000-4000-a000-000000000001'
);

INSERT INTO public.todo_activity (
  id,
  todo_id,
  actor_id,
  action,
  severity,
  changes
)
VALUES (
  'e9820000-0000-4000-a000-000000000001',
  'e9810000-0000-4000-a000-000000000001',
  'e9800000-0000-4000-a000-000000000002',
  'updated',
  'normal',
  '[{"field":"priority","from":"low","to":"medium"}]'::JSONB
);

SELECT results_eq(
  $sql$
    SELECT action, severity, changes->0->>'field'
    FROM public.todo_activity
    WHERE id = 'e9820000-0000-4000-a000-000000000001'
  $sql$,
  $sql$ VALUES ('updated'::TEXT, 'normal'::TEXT, 'priority'::TEXT) $sql$,
  'todo activities retain their action, severity, and changes'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.todo_activity SET severity = 'critical'
      WHERE id = 'e9820000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'todo activity severity is constrained'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.todo_activity SET action = 'deleted'
      WHERE id = 'e9820000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'todo activity actions are constrained'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.todo_activity SET changes = '{}'::JSONB
      WHERE id = 'e9820000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'todo activity changes must be an array'
);

SELECT has_index(
  'public',
  'todo_activity',
  'idx_todo_activity_todo_severity_created',
  'todo activities have a todo, severity, and time index'
);

DELETE FROM public.todo
WHERE id = 'e9810000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.todo_activity
    WHERE id = 'e9820000-0000-4000-a000-000000000001'
  ),
  0,
  'deleting a todo cascades to its activities'
);

SELECT * FROM finish();

ROLLBACK;
