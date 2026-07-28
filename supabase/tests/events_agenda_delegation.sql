-- @covers schema 03_event.sql
-- @covers schema 06_agenda.sql
-- @covers schema 18_delegate.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

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
  ('b1000000-0000-0000-0000-000000000001', 'events-user-1'),
  ('b1000000-0000-0000-0000-000000000002', 'events-user-2');

INSERT INTO public."group" (id, name, owner_id)
VALUES ('b2000000-0000-0000-0000-000000000001', 'Events group', 'b1000000-0000-0000-0000-000000000001');

INSERT INTO public.role (id, name, group_id)
VALUES ('b3000000-0000-0000-0000-000000000001', 'Participant role', 'b2000000-0000-0000-0000-000000000001');

INSERT INTO public.group_offline_member (id, group_id, first_name, last_name)
VALUES ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'Offline', 'Delegate');

INSERT INTO public.event (
  id, title, attendance_mode, is_recurring, group_id, creator_id
)
VALUES (
  'b5000000-0000-0000-0000-000000000001',
  'Recurring assembly',
  'hybrid',
  true,
  'b2000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001'
);

INSERT INTO public.event_assembly_scope (
  id, event_id, host_group_id, source_group_id, scope_kind,
  participant_mode, required_role_id
)
VALUES (
  'b5100000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  'general_member_source',
  'role_members',
  'b3000000-0000-0000-0000-000000000001'
);

INSERT INTO public.event_participant (id, event_id, user_id, status)
VALUES ('b5200000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'confirmed');

INSERT INTO public.event_participant (
  id, event_id, user_id, status, instance_date
)
VALUES ('b5200000-0000-0000-0000-000000000002', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'confirmed', '2026-08-01 10:00:00+00');

INSERT INTO public.event_offline_participant (
  id, event_id, group_offline_member_id, source_type, first_name,
  last_name, connected_user_id, attendance_status, participation_channel
)
VALUES (
  'b5300000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001',
  'group_member',
  'Offline',
  'Delegate',
  'b1000000-0000-0000-0000-000000000002',
  'confirmed',
  'offline'
);

INSERT INTO public.event_participant_role (
  id, event_participant_id, role_id
)
VALUES ('b5400000-0000-0000-0000-000000000001', 'b5200000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001');

INSERT INTO public.participant (id, event_id, user_id, name)
VALUES ('b5500000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Generic participant');

INSERT INTO public.event_exception (
  id, parent_event_id, original_date, action
)
VALUES ('b5600000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', '2026-08-08 10:00:00+00', 'cancel');

INSERT INTO public.calendar_subscription (
  id, user_id, target_type, target_group_id
)
VALUES ('b5700000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'group', 'b2000000-0000-0000-0000-000000000001');

INSERT INTO public.calendar_subscription (
  id, user_id, target_type, target_user_id
)
VALUES ('b5700000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'user', 'b1000000-0000-0000-0000-000000000002');

INSERT INTO public.agenda_item (
  id, event_id, creator_id, title, voting_phase
)
VALUES ('b5800000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Agenda', 'internal');

INSERT INTO public.speaker_list (
  id, agenda_item_id, user_id, order_index
)
VALUES ('b5900000-0000-0000-0000-000000000001', 'b5800000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1);

INSERT INTO public.event_delegate (id, event_id, user_id, group_id, seat_count)
VALUES ('b5a00000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 1);

INSERT INTO public.group_delegate_allocation (
  id, event_id, group_id, allocated_seats
)
VALUES ('b5b00000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 1);

INSERT INTO public.delegate_election_assignment (
  id, target_event_id, source_group_id, allocation_id, required_seats, status
)
VALUES ('b5c00000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b5b00000-0000-0000-0000-000000000001', 1, 'open');

SELECT ok(
  EXISTS (SELECT 1 FROM public.event_assembly_scope WHERE id = 'b5100000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.event_offline_participant WHERE id = 'b5300000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.event_exception WHERE id = 'b5600000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.speaker_list WHERE id = 'b5900000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.delegate_election_assignment WHERE id = 'b5c00000-0000-0000-0000-000000000001'),
  'events, recurrence, agenda, and delegation records are accepted'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event SET attendance_mode = 'invalid' WHERE id = 'b5000000-0000-0000-0000-000000000001'$sql$), '23514', 'event attendance mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_assembly_scope SET scope_kind = 'invalid' WHERE id = 'b5100000-0000-0000-0000-000000000001'$sql$), '23514', 'assembly scope kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_assembly_scope SET participant_mode = 'invalid' WHERE id = 'b5100000-0000-0000-0000-000000000001'$sql$), '23514', 'assembly participant mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_assembly_scope SET status = 'invalid' WHERE id = 'b5100000-0000-0000-0000-000000000001'$sql$), '23514', 'assembly scope status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_offline_participant SET source_type = 'invalid' WHERE id = 'b5300000-0000-0000-0000-000000000001'$sql$), '23514', 'offline participant source is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_offline_participant SET attendance_status = 'invalid' WHERE id = 'b5300000-0000-0000-0000-000000000001'$sql$), '23514', 'offline attendance status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.event_offline_participant SET participation_channel = 'invalid' WHERE id = 'b5300000-0000-0000-0000-000000000001'$sql$), '23514', 'offline participation channel is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.calendar_subscription SET target_type = 'user' WHERE id = 'b5700000-0000-0000-0000-000000000001'$sql$), '23514', 'calendar subscriptions require exactly one matching target');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.agenda_item SET voting_phase = 'invalid' WHERE id = 'b5800000-0000-0000-0000-000000000001'$sql$), '23514', 'agenda voting phase is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.delegate_election_assignment SET status = 'invalid' WHERE id = 'b5c00000-0000-0000-0000-000000000001'$sql$), '23514', 'delegate assignment status is constrained');

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_participant (event_id, user_id) VALUES ('b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001')$sql$), '23505', 'non-recurring participation is unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_participant (event_id, user_id, instance_date) VALUES ('b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', '2026-08-01 10:00:00+00')$sql$), '23505', 'recurring participation is unique per occurrence');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_offline_participant (event_id, source_type, first_name, last_name, connected_user_id) VALUES ('b5000000-0000-0000-0000-000000000001', 'event_extra', 'Duplicate', 'User', 'b1000000-0000-0000-0000-000000000002')$sql$), '23505', 'connected offline participants are unique per event');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_offline_participant (event_id, source_type, first_name, last_name) VALUES ('b5000000-0000-0000-0000-000000000001', 'event_extra', 'Unconnected', 'One'), ('b5000000-0000-0000-0000-000000000001', 'event_extra', 'Unconnected', 'Two')$sql$), NULL, 'unconnected offline participants are outside connected-user uniqueness');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_exception (parent_event_id, original_date, action) VALUES ('b5000000-0000-0000-0000-000000000001', '2026-08-08 10:00:00+00', 'replace')$sql$), '23505', 'an occurrence has only one event exception');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_assembly_scope (event_id, host_group_id, source_group_id, scope_kind, participant_mode) VALUES ('b5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'general_member_source', 'role_members')$sql$), '23505', 'assembly scopes are unique by source, kind, and participant mode');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_participant_role (event_participant_id, role_id) VALUES ('b5200000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001')$sql$), '23505', 'participant roles are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.calendar_subscription (user_id, target_type, target_group_id) VALUES ('b1000000-0000-0000-0000-000000000001', 'group', 'b2000000-0000-0000-0000-000000000001')$sql$), '23505', 'group calendar subscriptions are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.calendar_subscription (user_id, target_type, target_user_id) VALUES ('b1000000-0000-0000-0000-000000000001', 'user', 'b1000000-0000-0000-0000-000000000002')$sql$), '23505', 'user calendar subscriptions are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.delegate_election_assignment (target_event_id, source_group_id) VALUES ('b5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001')$sql$), '23505', 'delegate assignments are unique per event and source group');

DELETE FROM public.event
WHERE id = 'b5000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.event_assembly_scope WHERE id = 'b5100000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.event_participant WHERE event_id = 'b5000000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.event_exception WHERE id = 'b5600000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.agenda_item WHERE id = 'b5800000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.event_delegate WHERE id = 'b5a00000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.delegate_election_assignment WHERE id = 'b5c00000-0000-0000-0000-000000000001')
  )::INTEGER,
  1,
  'deleting an event cascades constrained records and preserves the loosely linked agenda item'
);

SELECT * FROM finish();

ROLLBACK;
