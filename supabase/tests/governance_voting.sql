-- @covers schema 05_2_amendment.sql
-- @covers schema 14_change_request.sql
-- @covers schema 16_position_election.sql
-- @covers schema 20_0_amendment_vote.sql
-- @covers schema 20_1_amendment_choices_vote.sql
-- @covers schema 20_2_election_candidate_vote.sql
-- @covers schema 20_3_indicative_amendment_choice_vote.sql
-- @covers schema 20_4_indicative_election_candidate_vote.sql
-- @covers schema 20_5_agenda_item_change_request.sql
-- @covers schema 27_accreditation.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(32);

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
  ('d1000000-0000-0000-0000-000000000001', 'governance-user-1'),
  ('d1000000-0000-0000-0000-000000000002', 'governance-user-2');

INSERT INTO public."group" (id, name, owner_id)
VALUES ('d2000000-0000-0000-0000-000000000001', 'Governance group', 'd1000000-0000-0000-0000-000000000001');

INSERT INTO public.role (id, name, group_id, assignment_mode)
VALUES ('d3000000-0000-0000-0000-000000000001', 'Elected office', 'd2000000-0000-0000-0000-000000000001', 'elected');

INSERT INTO public.event (id, title, creator_id, group_id)
VALUES ('d4000000-0000-0000-0000-000000000001', 'Governance event', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001');

INSERT INTO public.agenda_item (id, event_id, creator_id, title)
VALUES ('d4100000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Decision');

INSERT INTO public.amendment (id, title, created_by_id, group_id, event_id)
VALUES ('d5000000-0000-0000-0000-000000000001', 'Governance amendment', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001');

INSERT INTO public.amendment_city_design (id, amendment_id, created_by_id, title)
VALUES ('d5100000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'City design');

INSERT INTO public.amendment_process_run (id, amendment_id, created_by_id)
VALUES ('d5200000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001');

INSERT INTO public.amendment_process_branch (
  id, process_run_id, title, editing_mode
)
VALUES ('d5300000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'Main branch', 'edit');

INSERT INTO public.amendment_process_step_run (
  id, process_run_id, branch_id, event_id, agenda_item_id
)
VALUES ('d5400000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001');

INSERT INTO public.process_task (
  id, process_run_id, branch_id, step_run_id, task_type, agenda_item_id
)
VALUES ('d5500000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001', 'd5400000-0000-0000-0000-000000000001', 'schedule_event', 'd4100000-0000-0000-0000-000000000001');

INSERT INTO public.support_confirmation (
  id, amendment_id, process_run_id, process_step_run_id, process_task_id,
  group_id, event_id, confirmed_by_id, status
)
VALUES ('d5600000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'd5400000-0000-0000-0000-000000000001', 'd5500000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'confirmed');

UPDATE public.amendment_process_step_run
SET support_confirmation_id = 'd5600000-0000-0000-0000-000000000001'
WHERE id = 'd5400000-0000-0000-0000-000000000001';

INSERT INTO public.amendment_path (id, amendment_id, process_run_id, title)
VALUES ('d5700000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'Decision path');

INSERT INTO public.amendment_path_segment (
  id, path_id, process_branch_id, process_step_run_id, group_id, event_id, order_index
)
VALUES ('d5800000-0000-0000-0000-000000000001', 'd5700000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001', 'd5400000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 1);

INSERT INTO public.amendment_group_decision (
  id, amendment_id, group_id, process_run_id, process_branch_id,
  process_step_run_id, status
)
VALUES ('d5900000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd5200000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001', 'd5400000-0000-0000-0000-000000000001', 'supported');

INSERT INTO public.amendment_support_vote (id, amendment_id, user_id, vote)
VALUES ('d5a00000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 1);
INSERT INTO public.amendment_vote_entry (id, amendment_id, user_id, vote)
VALUES ('d5b00000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 1);

INSERT INTO public.change_request (
  id, amendment_id, process_branch_id, user_id, title
)
VALUES ('d6000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'Governance change');

INSERT INTO public.change_request_vote (
  id, change_request_id, user_id, vote
)
VALUES ('d6100000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'yes');

INSERT INTO public.election (
  id, agenda_item_id, role_id, title, ballot_visibility, offline_electorate_size
)
VALUES ('d7000000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'Office election', 'named', 1);

INSERT INTO public.election_candidate (id, election_id, user_id, name)
VALUES ('d7100000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Candidate');

INSERT INTO public.elector (id, election_id, user_id)
VALUES ('d7200000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002');

INSERT INTO public.indicative_elector_participation (
  id, election_id, user_id, elector_id
)
VALUES ('d7300000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'd7200000-0000-0000-0000-000000000001');

INSERT INTO public.indicative_candidate_selection (
  id, election_id, candidate_id, elector_participation_id
)
VALUES ('d7400000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7100000-0000-0000-0000-000000000001', 'd7300000-0000-0000-0000-000000000001');

INSERT INTO public.final_elector_participation (id, election_id, elector_id)
VALUES ('d7500000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7200000-0000-0000-0000-000000000001');

INSERT INTO public.final_candidate_selection (
  id, election_id, candidate_id, elector_participation_id
)
VALUES ('d7600000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7100000-0000-0000-0000-000000000001', 'd7500000-0000-0000-0000-000000000001');

INSERT INTO public.election_offline_tally (
  id, election_id, phase, candidate_id, count
)
VALUES ('d7700000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'final', 'd7100000-0000-0000-0000-000000000001', 1);

INSERT INTO public.vote (
  id, agenda_item_id, amendment_id, title, status, purpose,
  ballot_visibility, offline_electorate_size
)
VALUES ('d8000000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'Closing vote', 'final', 'closing', 'named', 1);

INSERT INTO public.vote_choice (id, vote_id, label, semantic_key)
VALUES ('d8100000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'Yes', 'yes');

INSERT INTO public.voter (id, vote_id, user_id)
VALUES ('d8200000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002');

INSERT INTO public.indicative_voter_participation (
  id, vote_id, user_id, voter_id
)
VALUES ('d8300000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'd8200000-0000-0000-0000-000000000001');

INSERT INTO public.indicative_choice_decision (
  id, vote_id, choice_id, voter_participation_id
)
VALUES ('d8400000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd8100000-0000-0000-0000-000000000001', 'd8300000-0000-0000-0000-000000000001');

INSERT INTO public.final_voter_participation (id, vote_id, voter_id)
VALUES ('d8500000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd8200000-0000-0000-0000-000000000001');

INSERT INTO public.final_choice_decision (
  id, vote_id, choice_id, voter_participation_id
)
VALUES ('d8600000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd8100000-0000-0000-0000-000000000001', 'd8500000-0000-0000-0000-000000000001');

INSERT INTO public.vote_offline_tally (
  id, vote_id, phase, choice_id, count
)
VALUES ('d8700000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'final', 'd8100000-0000-0000-0000-000000000001', 1);

INSERT INTO public.agenda_item_change_request (
  id, agenda_item_id, change_request_id, vote_id, process_branch_id
)
VALUES ('d8800000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'd5300000-0000-0000-0000-000000000001');

INSERT INTO public.accreditation (
  id, event_id, agenda_item_id, user_id, status
)
VALUES ('d9000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'approved');

INSERT INTO public.accreditation_audit (
  id, accreditation_id, event_id, user_id, from_status, to_status, actor_id
)
VALUES ('d9100000-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'pending', 'approved', 'd1000000-0000-0000-0000-000000000001');

SELECT ok(
  EXISTS (SELECT 1 FROM public.amendment_city_design WHERE id = 'd5100000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.amendment_path_segment WHERE id = 'd5800000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.process_task WHERE id = 'd5500000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.indicative_candidate_selection WHERE id = 'd7400000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.final_choice_decision WHERE id = 'd8600000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.accreditation_audit WHERE id = 'd9100000-0000-0000-0000-000000000001'),
  'amendment processes, elections, votes, and accreditation records are accepted'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.amendment_process_branch SET editing_mode = 'invalid' WHERE id = 'd5300000-0000-0000-0000-000000000001'$sql$), '23514', 'branch editing mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.election SET ballot_visibility = 'invalid' WHERE id = 'd7000000-0000-0000-0000-000000000001'$sql$), '23514', 'election ballot visibility is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.election SET offline_electorate_size = -1 WHERE id = 'd7000000-0000-0000-0000-000000000001'$sql$), '23514', 'election offline electorate cannot be negative');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.elector SET participation_channel = 'invalid' WHERE id = 'd7200000-0000-0000-0000-000000000001'$sql$), '23514', 'elector participation channel is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.election_offline_tally SET phase = 'invalid' WHERE id = 'd7700000-0000-0000-0000-000000000001'$sql$), '23514', 'election tally phase is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.election_offline_tally SET count = -1 WHERE id = 'd7700000-0000-0000-0000-000000000001'$sql$), '23514', 'election tally cannot be negative');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote SET status = 'invalid' WHERE id = 'd8000000-0000-0000-0000-000000000001'$sql$), '23514', 'vote status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote SET purpose = 'invalid' WHERE id = 'd8000000-0000-0000-0000-000000000001'$sql$), '23514', 'vote purpose is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote SET ballot_visibility = 'invalid' WHERE id = 'd8000000-0000-0000-0000-000000000001'$sql$), '23514', 'vote ballot visibility is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote SET offline_electorate_size = -1 WHERE id = 'd8000000-0000-0000-0000-000000000001'$sql$), '23514', 'vote offline electorate cannot be negative');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.voter SET participation_channel = 'invalid' WHERE id = 'd8200000-0000-0000-0000-000000000001'$sql$), '23514', 'voter participation channel is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote_offline_tally SET phase = 'invalid' WHERE id = 'd8700000-0000-0000-0000-000000000001'$sql$), '23514', 'vote tally phase is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.vote_offline_tally SET count = -1 WHERE id = 'd8700000-0000-0000-0000-000000000001'$sql$), '23514', 'vote tally cannot be negative');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.agenda_item_change_request SET step_kind = 'invalid' WHERE id = 'd8800000-0000-0000-0000-000000000001'$sql$), '23514', 'agenda change-request step kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.accreditation SET status = 'invalid' WHERE id = 'd9000000-0000-0000-0000-000000000001'$sql$), '23514', 'accreditation status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.accreditation_audit SET to_status = 'invalid' WHERE id = 'd9100000-0000-0000-0000-000000000001'$sql$), '23514', 'accreditation audit status is constrained');

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.amendment_group_decision (amendment_id, group_id, status) VALUES ('d5000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'duplicate')$sql$), '23505', 'amendment group decisions are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.elector (election_id, user_id) VALUES ('d7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002')$sql$), '23505', 'electors are unique per election');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.indicative_elector_participation (election_id, user_id) VALUES ('d7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002')$sql$), '23505', 'indicative election participation is unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.final_elector_participation (election_id, elector_id) VALUES ('d7000000-0000-0000-0000-000000000001', 'd7200000-0000-0000-0000-000000000001')$sql$), '23505', 'final election participation is unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.election_offline_tally (election_id, phase, candidate_id) VALUES ('d7000000-0000-0000-0000-000000000001', 'final', 'd7100000-0000-0000-0000-000000000001')$sql$), '23505', 'election tallies are unique per phase and candidate');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.voter (vote_id, user_id) VALUES ('d8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002')$sql$), '23505', 'voters are unique per vote');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.indicative_voter_participation (vote_id, user_id) VALUES ('d8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002')$sql$), '23505', 'indicative vote participation is unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.final_voter_participation (vote_id, voter_id) VALUES ('d8000000-0000-0000-0000-000000000001', 'd8200000-0000-0000-0000-000000000001')$sql$), '23505', 'final vote participation is unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.vote_offline_tally (vote_id, phase, choice_id) VALUES ('d8000000-0000-0000-0000-000000000001', 'final', 'd8100000-0000-0000-0000-000000000001')$sql$), '23505', 'vote tallies are unique per phase and choice');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.agenda_item_change_request (agenda_item_id, change_request_id) VALUES ('d4100000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001')$sql$), '23505', 'agenda change requests are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.agenda_item_change_request (agenda_item_id, order_index) VALUES ('d4100000-0000-0000-0000-000000000001', 10), ('d4100000-0000-0000-0000-000000000001', 11)$sql$), NULL, 'agenda links without change requests are outside partial uniqueness');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.accreditation (event_id, agenda_item_id, user_id) VALUES ('d4000000-0000-0000-0000-000000000001', 'd4100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002')$sql$), '23505', 'accreditation is unique per event and user');

DELETE FROM public.vote WHERE id = 'd8000000-0000-0000-0000-000000000001';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vote_choice WHERE id = 'd8100000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.voter WHERE id = 'd8200000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.indicative_choice_decision WHERE id = 'd8400000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.final_choice_decision WHERE id = 'd8600000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.vote_offline_tally WHERE id = 'd8700000-0000-0000-0000-000000000001')
  AND (SELECT vote_id IS NULL FROM public.agenda_item_change_request WHERE id = 'd8800000-0000-0000-0000-000000000001'),
  'vote deletion removes ballot data and nulls external vote links'
);

DELETE FROM public.election WHERE id = 'd7000000-0000-0000-0000-000000000001';
SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.election_candidate WHERE id = 'd7100000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.elector WHERE id = 'd7200000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.indicative_candidate_selection WHERE id = 'd7400000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.final_candidate_selection WHERE id = 'd7600000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.election_offline_tally WHERE id = 'd7700000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'election deletion removes candidates, electors, selections, and tallies'
);

DELETE FROM public.amendment WHERE id = 'd5000000-0000-0000-0000-000000000001';
SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.amendment_city_design WHERE id = 'd5100000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.amendment_process_run WHERE id = 'd5200000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.amendment_path WHERE id = 'd5700000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.support_confirmation WHERE id = 'd5600000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.amendment_group_decision WHERE id = 'd5900000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.amendment_support_vote WHERE id = 'd5a00000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.change_request WHERE id = 'd6000000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'amendment deletion removes its process, support, and change-request graph'
);

SELECT * FROM finish();

ROLLBACK;
