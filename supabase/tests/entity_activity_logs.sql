-- @covers schema 01_user.sql
-- @covers schema 02_group.sql
-- @covers schema 03_event.sql
-- @covers schema 05_2_amendment.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN EXECUTE command; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END;
$$;

INSERT INTO public."user" (id, handle) VALUES
  ('e9900000-0000-4000-a000-000000000001', 'entity-owner'),
  ('e9900000-0000-4000-a000-000000000002', 'entity-actor');
INSERT INTO public."group" (id, name, owner_id) VALUES
  ('e9910000-0000-4000-a000-000000000001', 'Activity group', 'e9900000-0000-4000-a000-000000000001');
INSERT INTO public.event (id, title, creator_id) VALUES
  ('e9920000-0000-4000-a000-000000000001', 'Activity event', 'e9900000-0000-4000-a000-000000000001');
INSERT INTO public.amendment (id, title, created_by_id) VALUES
  ('e9930000-0000-4000-a000-000000000001', 'Activity amendment', 'e9900000-0000-4000-a000-000000000001');

INSERT INTO public.group_activity (id, group_id, actor_id, subject_user_id, action, severity, changes, context) VALUES
  ('e9940000-0000-4000-a000-000000000001', 'e9910000-0000-4000-a000-000000000001', 'e9900000-0000-4000-a000-000000000002', 'e9900000-0000-4000-a000-000000000002', 'updated', 'normal', '[]', '{}');
INSERT INTO public.event_activity (id, event_id, actor_id, action, severity, changes, context) VALUES
  ('e9950000-0000-4000-a000-000000000001', 'e9920000-0000-4000-a000-000000000001', 'e9900000-0000-4000-a000-000000000002', 'cancelled', 'high', '[]', '{}');
INSERT INTO public.amendment_activity (id, amendment_id, actor_id, action, severity, changes, context) VALUES
  ('e9960000-0000-4000-a000-000000000001', 'e9930000-0000-4000-a000-000000000001', 'e9900000-0000-4000-a000-000000000002', 'process_started', 'high', '[]', '{}');

SELECT is((SELECT count(*)::INTEGER FROM public.group_activity), 1, 'group activity accepts valid rows');
SELECT is((SELECT count(*)::INTEGER FROM public.event_activity), 1, 'event activity accepts valid rows');
SELECT is((SELECT count(*)::INTEGER FROM public.amendment_activity), 1, 'amendment activity accepts valid rows');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_activity SET severity='critical'$sql$), '23514', 'severity is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_activity SET actor_type='robot'$sql$), '23514', 'actor type is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.amendment_activity SET context='[]'$sql$), '23514', 'context must be an object');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_activity SET changes='{}'$sql$), '23514', 'changes must be an array');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_activity SET action='voted'$sql$), '23514', 'actions are domain constrained');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.amendment_activity (amendment_id, action, severity) VALUES ('e9930000-0000-4000-a000-999999999999', 'created', 'high')$sql$), '23503', 'entity foreign keys are enforced');
SELECT has_index('public', 'group_activity', 'idx_group_activity_created', 'group created index exists');
SELECT has_index('public', 'group_activity', 'idx_group_activity_severity_created', 'group severity index exists');
SELECT has_index('public', 'event_activity', 'idx_event_activity_created', 'event created index exists');
SELECT has_index('public', 'event_activity', 'idx_event_activity_severity_created', 'event severity index exists');
SELECT has_index('public', 'amendment_activity', 'idx_amendment_activity_created', 'amendment created index exists');
SELECT has_index('public', 'amendment_activity', 'idx_amendment_activity_severity_created', 'amendment severity index exists');

DELETE FROM public."user" WHERE id='e9900000-0000-4000-a000-000000000002';
SELECT is((SELECT count(*)::INTEGER FROM public.group_activity WHERE actor_id IS NULL), 1, 'actor deletion sets actor to null');
SELECT is((SELECT count(*)::INTEGER FROM public.group_activity WHERE subject_user_id IS NULL), 1, 'subject deletion sets subject to null');

DELETE FROM public."group" WHERE id='e9910000-0000-4000-a000-000000000001';
DELETE FROM public.event WHERE id='e9920000-0000-4000-a000-000000000001';
DELETE FROM public.amendment WHERE id='e9930000-0000-4000-a000-000000000001';
SELECT is((SELECT count(*)::INTEGER FROM public.group_activity), 0, 'group deletion cascades');
SELECT is((SELECT count(*)::INTEGER FROM public.event_activity), 0, 'event deletion cascades');
SELECT is((SELECT count(*)::INTEGER FROM public.amendment_activity), 0, 'amendment deletion cascades');

SELECT * FROM finish();
ROLLBACK;
