-- @covers schema 01_user.sql
-- @covers schema 02_group.sql
-- @covers schema 03_event.sql
-- @covers schema 05_1_network.sql
-- @covers schema 07_blog.sql
-- @covers schema 11_statement.sql
-- @covers schema 18_delegate.sql
-- @covers schema 20_0_amendment_vote.sql
-- @covers schema 25_currency.sql
-- @covers schema 26_voting_password.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(21);

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
VALUES (
  'e9700000-0000-4000-a000-000000000001',
  'constraint-user'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public."user"
      SET avatar = 'avatar.png', video_url = 'video.mp4'
      WHERE id = 'e9700000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'users cannot have avatar and video as simultaneous primary media'
);

INSERT INTO public."group" (id, name)
VALUES
  ('e9710000-0000-4000-a000-000000000001', 'Constraint group A'),
  ('e9710000-0000-4000-a000-000000000002', 'Constraint group B');

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public."group"
      SET image_url = 'image.png', video_url = 'video.mp4'
      WHERE id = 'e9710000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'groups enforce one primary media asset'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.event (
        id, title, creator_id, attendance_mode
      ) VALUES (
        'e9720000-0000-4000-a000-000000000001',
        'Invalid attendance',
        'e9700000-0000-4000-a000-000000000001',
        'virtual'
      )
    $sql$
  ),
  '23514',
  'events reject unsupported attendance modes'
);

INSERT INTO public.event (id, title, creator_id)
VALUES (
  'e9720000-0000-4000-a000-000000000002',
  'Constraint event',
  'e9700000-0000-4000-a000-000000000001'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.event
      SET image_url = 'image.png', video_url = 'video.mp4'
      WHERE id = 'e9720000-0000-4000-a000-000000000002'
    $sql$
  ),
  '23514',
  'events enforce one primary media asset'
);

INSERT INTO public.blog (id, title)
VALUES (
  'e9740000-0000-4000-a000-000000000001',
  'Constraint blog'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.blog
      SET image_url = 'image.png', video_url = 'video.mp4'
      WHERE id = 'e9740000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'blogs enforce one primary media asset'
);

INSERT INTO public.amendment (id, title, created_by_id)
VALUES (
  'e9730000-0000-4000-a000-000000000001',
  'Constraint amendment',
  'e9700000-0000-4000-a000-000000000001'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.amendment
      SET image_url = 'image.png', video_url = 'video.mp4'
      WHERE id = 'e9730000-0000-4000-a000-000000000001'
    $sql$
  ),
  '23514',
  'amendments enforce one primary media asset'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.statement (id, user_id)
      VALUES (
        'e9750000-0000-4000-a000-000000000001',
        'e9700000-0000-4000-a000-000000000001'
      )
    $sql$
  ),
  '23514',
  'statements require textual or media content'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.statement (
        id, user_id, title, image_url, video_url
      ) VALUES (
        'e9750000-0000-4000-a000-000000000002',
        'e9700000-0000-4000-a000-000000000001',
        'Invalid media statement',
        'image.png',
        'video.mp4'
      )
    $sql$
  ),
  '23514',
  'statements enforce one primary media asset'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.group_connection (
        id, group_a_id, group_b_id, connection_type
      ) VALUES (
        'e9760000-0000-4000-a000-000000000001',
        'e9710000-0000-4000-a000-000000000002',
        'e9710000-0000-4000-a000-000000000001',
        'peer'
      )
    $sql$
  ),
  '23514',
  'group connections require a canonical group order'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.group_connection (
        id, group_a_id, group_b_id, connection_type,
        parent_group_id, child_group_id
      ) VALUES (
        'e9760000-0000-4000-a000-000000000002',
        'e9710000-0000-4000-a000-000000000001',
        'e9710000-0000-4000-a000-000000000002',
        'peer',
        'e9710000-0000-4000-a000-000000000001',
        'e9710000-0000-4000-a000-000000000002'
      )
    $sql$
  ),
  '23514',
  'peer connections cannot contain hierarchy endpoints'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.group_connection (
        id, group_a_id, group_b_id, connection_type
      ) VALUES (
        'e9760000-0000-4000-a000-000000000003',
        'e9710000-0000-4000-a000-000000000001',
        'e9710000-0000-4000-a000-000000000002',
        'peer'
      )
    $sql$
  ),
  NULL,
  'a canonical peer connection is accepted'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.group_connection (
        id, group_a_id, group_b_id, connection_type
      ) VALUES (
        'e9760000-0000-4000-a000-000000000004',
        'e9710000-0000-4000-a000-000000000001',
        'e9710000-0000-4000-a000-000000000002',
        'peer'
      )
    $sql$
  ),
  '23505',
  'an unordered group pair can have only one connection'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.vote (id, status, purpose)
      VALUES (
        'e9770000-0000-4000-a000-000000000001',
        'unknown',
        'closing'
      )
    $sql$
  ),
  '23514',
  'votes reject unsupported statuses'
);

INSERT INTO public.vote (
  id,
  status,
  purpose,
  offline_electorate_size
)
VALUES (
  'e9770000-0000-4000-a000-000000000002',
  'final',
  'closing',
  0
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public.vote
      SET offline_electorate_size = -1
      WHERE id = 'e9770000-0000-4000-a000-000000000002'
    $sql$
  ),
  '23514',
  'offline electorate sizes cannot be negative'
);

INSERT INTO public.voter (id, vote_id, user_id)
VALUES (
  'e9790000-0000-4000-a000-000000000001',
  'e9770000-0000-4000-a000-000000000002',
  'e9700000-0000-4000-a000-000000000001'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.voter (id, vote_id, user_id)
      VALUES (
        'e9790000-0000-4000-a000-000000000002',
        'e9770000-0000-4000-a000-000000000002',
        'e9700000-0000-4000-a000-000000000001'
      )
    $sql$
  ),
  '23505',
  'a user can appear only once in a vote electorate'
);

INSERT INTO public.vote_choice (id, vote_id, label)
VALUES (
  'e9780000-0000-4000-a000-000000000001',
  'e9770000-0000-4000-a000-000000000002',
  'Yes'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.vote_offline_tally (
        id, vote_id, phase, choice_id, count
      ) VALUES (
        'e97a0000-0000-4000-a000-000000000001',
        'e9770000-0000-4000-a000-000000000002',
        'final',
        'e9780000-0000-4000-a000-000000000001',
        -1
      )
    $sql$
  ),
  '23514',
  'offline vote tallies cannot be negative'
);

INSERT INTO public.vote_offline_tally (
  id,
  vote_id,
  phase,
  choice_id,
  count
)
VALUES (
  'e97a0000-0000-4000-a000-000000000002',
  'e9770000-0000-4000-a000-000000000002',
  'final',
  'e9780000-0000-4000-a000-000000000001',
  2
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.vote_offline_tally (
        id, vote_id, phase, choice_id, count
      ) VALUES (
        'e97a0000-0000-4000-a000-000000000003',
        'e9770000-0000-4000-a000-000000000002',
        'final',
        'e9780000-0000-4000-a000-000000000001',
        3
      )
    $sql$
  ),
  '23505',
  'a vote phase has only one offline tally per choice'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.currency_exchange_rate_cache (
        base_currency, quote_currency, requested_date, rate_date, rate
      ) VALUES ('eur', 'USD', 'latest', DATE '2026-01-01', 1.1)
    $sql$
  ),
  '23514',
  'currency cache keys require uppercase ISO codes'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.currency_exchange_rate_cache (
        base_currency, quote_currency, requested_date, rate_date, rate
      ) VALUES ('EUR', 'USD', 'latest', DATE '2026-01-01', 0)
    $sql$
  ),
  '23514',
  'currency exchange rates must be positive'
);

INSERT INTO public.voting_password (id, user_id, password_hash)
VALUES (
  'e97b0000-0000-4000-a000-000000000001',
  'e9700000-0000-4000-a000-000000000001',
  'first-hash'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.voting_password (id, user_id, password_hash)
      VALUES (
        'e97b0000-0000-4000-a000-000000000002',
        'e9700000-0000-4000-a000-000000000001',
        'second-hash'
      )
    $sql$
  ),
  '23505',
  'a user can have only one voting password'
);

INSERT INTO public.delegate_election_assignment (
  id,
  target_event_id,
  source_group_id
)
VALUES (
  'e97c0000-0000-4000-a000-000000000001',
  'e9720000-0000-4000-a000-000000000002',
  'e9710000-0000-4000-a000-000000000001'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.delegate_election_assignment (
        id, target_event_id, source_group_id
      ) VALUES (
        'e97c0000-0000-4000-a000-000000000002',
        'e9720000-0000-4000-a000-000000000002',
        'e9710000-0000-4000-a000-000000000001'
      )
    $sql$
  ),
  '23505',
  'delegate-election assignments are unique per event and source group'
);

SELECT * FROM finish();

ROLLBACK;
