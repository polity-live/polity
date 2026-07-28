-- @covers schema 05_2_amendment.sql
-- @covers schema 33_app_tutorial.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

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
  ('a1000000-0000-4000-a000-000000000001', 'tutorial-owner'),
  ('a1000000-0000-4000-a000-000000000002', 'tutorial-other');

INSERT INTO public.app_tutorial_run (
  id,
  user_id,
  current_checkpoint_id,
  fixture_version,
  expires_at
)
VALUES
  (
    'a2000000-0000-4000-a000-000000000001',
    'a1000000-0000-4000-a000-000000000001',
    'welcome',
    1,
    now() + INTERVAL '1 day'
  ),
  (
    'a2000000-0000-4000-a000-000000000002',
    'a1000000-0000-4000-a000-000000000002',
    'welcome',
    1,
    now() - INTERVAL '1 day'
  );

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.app_tutorial_run (
        id, user_id, current_checkpoint_id, fixture_version
      ) VALUES (
        'a2000000-0000-4000-a000-000000000003',
        'a1000000-0000-4000-a000-000000000001',
        'duplicate',
        1
      )
    $sql$
  ),
  '23505',
  'a user can have only one open tutorial run'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.app_tutorial_run
      SET status = 'completed'
      WHERE id = 'a2000000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'tutorial runs reject unsupported statuses'
);

INSERT INTO public.app_tutorial_checkpoint_effect (
  run_id,
  checkpoint_id,
  effect_key
)
VALUES (
  'a2000000-0000-4000-a000-000000000001',
  'welcome',
  'seed'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.app_tutorial_checkpoint_effect (
        run_id, checkpoint_id, effect_key
      ) VALUES (
        'a2000000-0000-4000-a000-000000000001',
        'welcome',
        'seed'
      )
    $sql$
  ),
  '23505',
  'checkpoint effects are idempotent'
);

INSERT INTO public.app_tutorial_entity (
  run_id,
  alias,
  entity_type,
  entity_id
)
VALUES (
  'a2000000-0000-4000-a000-000000000001',
  'example',
  'group',
  'a3000000-0000-4000-a000-000000000001'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.app_tutorial_entity (
        run_id, alias, entity_type, entity_id
      ) VALUES (
        'a2000000-0000-4000-a000-000000000001',
        'example',
        'event',
        'a3000000-0000-4000-a000-000000000002'
      )
    $sql$
  ),
  '23505',
  'entity aliases are unique within a run'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.app_tutorial_entity (
        run_id, alias, entity_type, entity_id
      ) VALUES (
        'a2000000-0000-4000-a000-000000000001',
        'second-example',
        'group',
        'a3000000-0000-4000-a000-000000000001'
      )
    $sql$
  ),
  '23505',
  'an entity can be registered only once within a run'
);

GRANT SELECT ON public.app_tutorial_run TO authenticated;
GRANT SELECT ON public.app_tutorial_checkpoint_effect TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-a000-000000000001',
  true
);

SELECT results_eq(
  $sql$
    SELECT id
    FROM public.app_tutorial_run
    ORDER BY id
  $sql$,
  $sql$
    VALUES ('a2000000-0000-4000-a000-000000000001'::UUID)
  $sql$,
  'authenticated users see only their own tutorial run'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.app_tutorial_checkpoint_effect
  ),
  0,
  'checkpoint effects are not directly visible to authenticated users'
);

RESET ROLE;

UPDATE public."user"
SET tutorial_run_id = 'a2000000-0000-4000-a000-000000000001'
WHERE id = 'a1000000-0000-4000-a000-000000000001';

INSERT INTO public."group" (id, name, owner_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-000000000001',
  'Tutorial group',
  'a1000000-0000-4000-a000-000000000001',
  'a2000000-0000-4000-a000-000000000001'
);

INSERT INTO public.event (id, title, creator_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-000000000002',
  'Tutorial event',
  'a1000000-0000-4000-a000-000000000001',
  'a2000000-0000-4000-a000-000000000001'
);

INSERT INTO public.amendment (
  id,
  title,
  created_by_id,
  tutorial_run_id
)
VALUES (
  'a3000000-0000-4000-a000-000000000003',
  'Tutorial amendment',
  'a1000000-0000-4000-a000-000000000001',
  'a2000000-0000-4000-a000-000000000001'
);

INSERT INTO public.blog (id, title, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-000000000004',
  'Tutorial blog',
  'a2000000-0000-4000-a000-000000000001'
);

INSERT INTO public.statement (
  id,
  user_id,
  title,
  tutorial_run_id
)
VALUES (
  'a3000000-0000-4000-a000-000000000005',
  'a1000000-0000-4000-a000-000000000001',
  'Tutorial statement',
  'a2000000-0000-4000-a000-000000000001'
);

INSERT INTO public.todo (
  id,
  title,
  creator_id,
  tutorial_run_id
)
VALUES (
  'a3000000-0000-4000-a000-000000000006',
  'Tutorial todo',
  'a1000000-0000-4000-a000-000000000001',
  'a2000000-0000-4000-a000-000000000001'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document
    WHERE tutorial_run_id = 'a2000000-0000-4000-a000-000000000001'
      AND entity_id IN (
        'a1000000-0000-4000-a000-000000000001',
        'a3000000-0000-4000-a000-000000000001',
        'a3000000-0000-4000-a000-000000000002',
        'a3000000-0000-4000-a000-000000000003',
        'a3000000-0000-4000-a000-000000000004',
        'a3000000-0000-4000-a000-000000000005',
        'a3000000-0000-4000-a000-000000000006'
      )
  ),
  7,
  'tutorial tags propagate to every searchable tutorial entity'
);

INSERT INTO public.amendment (
  id,
  title,
  created_by_id,
  tutorial_run_id
)
VALUES (
  'a3000000-0000-4000-a000-000000000007',
  'Expired tutorial amendment',
  'a1000000-0000-4000-a000-000000000002',
  'a2000000-0000-4000-a000-000000000002'
);

UPDATE public."user"
SET tutorial_run_id = 'a2000000-0000-4000-a000-000000000002'
WHERE id = 'a1000000-0000-4000-a000-000000000002';

INSERT INTO public."group" (id, name, owner_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-000000000008',
  'Expired tutorial group',
  'a1000000-0000-4000-a000-000000000002',
  'a2000000-0000-4000-a000-000000000002'
);

INSERT INTO public.event (id, title, creator_id, group_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-000000000009',
  'Expired tutorial event',
  'a1000000-0000-4000-a000-000000000002',
  'a3000000-0000-4000-a000-000000000008',
  'a2000000-0000-4000-a000-000000000002'
);

UPDATE public.amendment
SET
  group_id = 'a3000000-0000-4000-a000-000000000008',
  event_id = 'a3000000-0000-4000-a000-000000000009'
WHERE id = 'a3000000-0000-4000-a000-000000000007';

INSERT INTO public.blog (id, title, group_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-00000000000a',
  'Expired tutorial blog',
  'a3000000-0000-4000-a000-000000000008',
  'a2000000-0000-4000-a000-000000000002'
);

INSERT INTO public.statement (id, user_id, title, group_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-00000000000b',
  'a1000000-0000-4000-a000-000000000002',
  'Expired tutorial statement',
  'a3000000-0000-4000-a000-000000000008',
  'a2000000-0000-4000-a000-000000000002'
);

INSERT INTO public.todo (id, title, creator_id, group_id, event_id, tutorial_run_id)
VALUES (
  'a3000000-0000-4000-a000-00000000000c',
  'Expired tutorial todo',
  'a1000000-0000-4000-a000-000000000002',
  'a3000000-0000-4000-a000-000000000008',
  'a3000000-0000-4000-a000-000000000009',
  'a2000000-0000-4000-a000-000000000002'
);

INSERT INTO public.amendment_process_run (
  id,
  amendment_id,
  created_by_id
)
VALUES (
  'a4000000-0000-4000-a000-000000000001',
  'a3000000-0000-4000-a000-000000000007',
  'a1000000-0000-4000-a000-000000000002'
);

SELECT is(
  public.cleanup_expired_app_tutorial_runs(),
  1,
  'cleanup reports the number of deleted expired runs'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.app_tutorial_run
    WHERE id = 'a2000000-0000-4000-a000-000000000002'
  ),
  0,
  'cleanup deletes expired tutorial runs'
);

SELECT is(
  (
    SELECT (
      (SELECT count(*) FROM public."user" WHERE id = 'a1000000-0000-4000-a000-000000000002')
      + (SELECT count(*) FROM public."group" WHERE id = 'a3000000-0000-4000-a000-000000000008')
      + (SELECT count(*) FROM public.event WHERE id = 'a3000000-0000-4000-a000-000000000009')
      + (SELECT count(*) FROM public.amendment WHERE id = 'a3000000-0000-4000-a000-000000000007')
      + (SELECT count(*) FROM public.blog WHERE id = 'a3000000-0000-4000-a000-00000000000a')
      + (SELECT count(*) FROM public.statement WHERE id = 'a3000000-0000-4000-a000-00000000000b')
      + (SELECT count(*) FROM public.todo WHERE id = 'a3000000-0000-4000-a000-00000000000c')
      + (SELECT count(*) FROM public.amendment_process_run WHERE id = 'a4000000-0000-4000-a000-000000000001')
    )::INTEGER
  ),
  0,
  'cleanup removes every tagged entity type and amendment process state'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.app_tutorial_run
    WHERE id = 'a2000000-0000-4000-a000-000000000001'
  ),
  1,
  'cleanup preserves unexpired tutorial runs'
);

SELECT * FROM finish();

ROLLBACK;
