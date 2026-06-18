-- =============================================================================
-- Seed the Aria & Kai system assistant user
-- This is a well-known bot user used for onboarding and in-app tutorials.
-- =============================================================================

INSERT INTO public."user" (
  id,
  email,
  handle,
  first_name,
  last_name,
  bio,
  visibility,
  subscriber_count,
  amendment_count,
  group_count,
  created_at,
  updated_at
) VALUES (
  'a12a0000-0000-4000-a000-000000000001',
  'aria-kai-assistants@polity.com',
  'aria-kai',
  'Aria & Kai',
  'Assistants',
  'Your personal assistants — here to help you navigate Polity!',
  'public',
  0,
  0,
  0,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notification_setting (user_id)
VALUES ('a12a0000-0000-4000-a000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_preference (user_id)
VALUES ('a12a0000-0000-4000-a000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- Decision Terminal demo data
-- Local login: decision-terminal-demo@polity.local / 123456
-- All timestamps are relative to this seed run.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
DECLARE
  seed_now TIMESTAMPTZ := clock_timestamp();

  demo_user_id UUID := 'd1000000-0000-4000-a000-000000000001';
  user_mina_id UUID := 'd1000000-0000-4000-a000-000000000002';
  user_omar_id UUID := 'd1000000-0000-4000-a000-000000000003';
  user_leah_id UUID := 'd1000000-0000-4000-a000-000000000004';
  user_jonas_id UUID := 'd1000000-0000-4000-a000-000000000005';

  demo_event_id UUID := 'd2000000-0000-4000-a000-000000000001';
  demo_role_id UUID := 'd3000000-0000-4000-a000-000000000001';
  office_role_id UUID := 'd3000000-0000-4000-a000-000000000002';

  agenda_budget_id UUID := 'd4000000-0000-4000-a000-000000000001';
  agenda_transport_id UUID := 'd4000000-0000-4000-a000-000000000002';
  agenda_chair_id UUID := 'd4000000-0000-4000-a000-000000000003';
  agenda_charter_id UUID := 'd4000000-0000-4000-a000-000000000004';
  agenda_secretary_id UUID := 'd4000000-0000-4000-a000-000000000005';

  urgent_vote_id UUID := 'd5000000-0000-4000-a000-000000000001';
  final_vote_id UUID := 'd5000000-0000-4000-a000-000000000002';
  closed_vote_id UUID := 'd5000000-0000-4000-a000-000000000003';

  live_election_id UUID := 'd6000000-0000-4000-a000-000000000001';
  closed_election_id UUID := 'd6000000-0000-4000-a000-000000000002';
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'decision-terminal-demo@polity.local',
    crypt('123456', gen_salt('bf')),
    seed_now,
    seed_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', 'Decision',
      'last_name', 'Terminal',
      'handle', 'decision-terminal-demo'
    ),
    seed_now,
    seed_now,
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    demo_user_id,
    demo_user_id,
    jsonb_build_object(
      'sub', demo_user_id::text,
      'email', 'decision-terminal-demo@polity.local',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'decision-terminal-demo@polity.local',
    seed_now,
    seed_now,
    seed_now
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public."user" (
    id,
    email,
    handle,
    first_name,
    last_name,
    bio,
    visibility,
    created_at,
    updated_at
  )
  VALUES
    (
      demo_user_id,
      'decision-terminal-demo@polity.local',
      'decision-terminal-demo',
      'Decision',
      'Terminal',
      'Local demo account for testing the Decision Terminal.',
      'public',
      seed_now - INTERVAL '90 minutes',
      seed_now
    ),
    (
      user_mina_id,
      'mina.bauer@polity.local',
      'mina-bauer',
      'Mina',
      'Bauer',
      'Demo delegate and candidate.',
      'public',
      seed_now - INTERVAL '90 minutes',
      seed_now
    ),
    (
      user_omar_id,
      'omar.stein@polity.local',
      'omar-stein',
      'Omar',
      'Stein',
      'Demo delegate and candidate.',
      'public',
      seed_now - INTERVAL '90 minutes',
      seed_now
    ),
    (
      user_leah_id,
      'leah.novak@polity.local',
      'leah-novak',
      'Leah',
      'Novak',
      'Demo delegate and candidate.',
      'public',
      seed_now - INTERVAL '90 minutes',
      seed_now
    ),
    (
      user_jonas_id,
      'jonas.richter@polity.local',
      'jonas-richter',
      'Jonas',
      'Richter',
      'Demo delegate.',
      'public',
      seed_now - INTERVAL '90 minutes',
      seed_now
    )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    handle = EXCLUDED.handle,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    bio = EXCLUDED.bio,
    visibility = EXCLUDED.visibility,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.notification_setting (user_id)
  VALUES
    (demo_user_id),
    (user_mina_id),
    (user_omar_id),
    (user_leah_id),
    (user_jonas_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preference (
    user_id,
    create_form_style,
    theme,
    language,
    navigation_view,
    group_network_layouts,
    decision_terminal_dashboard,
    created_at,
    updated_at
  )
  VALUES
    (demo_user_id, 'carousel', 'system', 'en', 'asButtonList', '{}'::jsonb, '{}'::jsonb, seed_now, seed_now),
    (user_mina_id, 'carousel', 'system', 'en', 'asButtonList', '{}'::jsonb, '{}'::jsonb, seed_now, seed_now),
    (user_omar_id, 'carousel', 'system', 'en', 'asButtonList', '{}'::jsonb, '{}'::jsonb, seed_now, seed_now),
    (user_leah_id, 'carousel', 'system', 'en', 'asButtonList', '{}'::jsonb, '{}'::jsonb, seed_now, seed_now),
    (user_jonas_id, 'carousel', 'system', 'en', 'asButtonList', '{}'::jsonb, '{}'::jsonb, seed_now, seed_now)
  ON CONFLICT (user_id) DO UPDATE
  SET
    decision_terminal_dashboard = '{}'::jsonb,
    updated_at = seed_now;

  DELETE FROM public.vote
  WHERE id IN (urgent_vote_id, final_vote_id, closed_vote_id);

  DELETE FROM public.election
  WHERE id IN (live_election_id, closed_election_id);

  INSERT INTO public.event (
    id,
    title,
    description,
    status,
    event_type,
    attendance_mode,
    location_type,
    location_name,
    visibility,
    start_date,
    end_date,
    timezone,
    capacity,
    participant_count,
    election_count,
    agenda_management,
    meeting_type,
    creator_id,
    created_at,
    updated_at
  )
  VALUES (
    demo_event_id,
    'Decision Terminal Demo Assembly',
    jsonb_build_object(
      'plain', 'A live local test event seeded for the Decision Terminal widgets.'
    ),
    'live',
    'assembly',
    'hybrid',
    'online',
    'Polity Demo Hall',
    'public',
    seed_now - INTERVAL '1 hour',
    seed_now + INTERVAL '4 hours',
    'Europe/Berlin',
    120,
    5,
    2,
    'structured',
    'assembly',
    demo_user_id,
    seed_now - INTERVAL '90 minutes',
    seed_now
  )
  ON CONFLICT (id) DO UPDATE
  SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    event_type = EXCLUDED.event_type,
    attendance_mode = EXCLUDED.attendance_mode,
    location_type = EXCLUDED.location_type,
    location_name = EXCLUDED.location_name,
    visibility = EXCLUDED.visibility,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    timezone = EXCLUDED.timezone,
    capacity = EXCLUDED.capacity,
    participant_count = EXCLUDED.participant_count,
    election_count = EXCLUDED.election_count,
    agenda_management = EXCLUDED.agenda_management,
    meeting_type = EXCLUDED.meeting_type,
    creator_id = EXCLUDED.creator_id,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.role (
    id,
    name,
    description,
    scope,
    event_id,
    assignment_mode,
    visibility,
    assignee_kind,
    sort_order,
    created_at
  )
  VALUES
    (
      demo_role_id,
      'Decision Terminal Demo Manager',
      'Can manage and test voting flows for the Decision Terminal demo event.',
      'event',
      demo_event_id,
      'assigned',
      'public',
      'member',
      1,
      seed_now - INTERVAL '90 minutes'
    ),
    (
      office_role_id,
      'Demo Session Chair',
      'Office used by the demo election.',
      'event',
      demo_event_id,
      'elected',
      'public',
      'member',
      2,
      seed_now - INTERVAL '90 minutes'
    )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    event_id = EXCLUDED.event_id,
    assignment_mode = EXCLUDED.assignment_mode,
    visibility = EXCLUDED.visibility,
    assignee_kind = EXCLUDED.assignee_kind,
    sort_order = EXCLUDED.sort_order;

  INSERT INTO public.action_right (
    id,
    resource,
    action,
    role_id,
    event_id,
    created_at
  )
  VALUES
    ('d3200000-0000-4000-a000-000000000001', 'events', 'manage_votes', demo_role_id, demo_event_id, seed_now),
    ('d3200000-0000-4000-a000-000000000002', 'elections', 'manage_votes', demo_role_id, demo_event_id, seed_now),
    ('d3200000-0000-4000-a000-000000000003', 'events', 'active_voting', demo_role_id, demo_event_id, seed_now),
    ('d3200000-0000-4000-a000-000000000004', 'events', 'passive_voting', demo_role_id, demo_event_id, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    role_id = EXCLUDED.role_id,
    event_id = EXCLUDED.event_id;

  INSERT INTO public.event_participant (
    id,
    event_id,
    user_id,
    status,
    visibility,
    created_at
  )
  VALUES
    ('d3100000-0000-4000-a000-000000000001', demo_event_id, demo_user_id, 'active', 'public', seed_now - INTERVAL '85 minutes'),
    ('d3100000-0000-4000-a000-000000000002', demo_event_id, user_mina_id, 'active', 'public', seed_now - INTERVAL '85 minutes'),
    ('d3100000-0000-4000-a000-000000000003', demo_event_id, user_omar_id, 'active', 'public', seed_now - INTERVAL '85 minutes'),
    ('d3100000-0000-4000-a000-000000000004', demo_event_id, user_leah_id, 'active', 'public', seed_now - INTERVAL '85 minutes'),
    ('d3100000-0000-4000-a000-000000000005', demo_event_id, user_jonas_id, 'active', 'public', seed_now - INTERVAL '85 minutes')
  ON CONFLICT (id) DO UPDATE
  SET
    event_id = EXCLUDED.event_id,
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility;

  INSERT INTO public.event_participant_role (
    id,
    event_participant_id,
    role_id,
    assigned_at,
    assigned_by_id,
    created_at
  )
  VALUES (
    'd3300000-0000-4000-a000-000000000001',
    'd3100000-0000-4000-a000-000000000001',
    demo_role_id,
    seed_now - INTERVAL '80 minutes',
    demo_user_id,
    seed_now - INTERVAL '80 minutes'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    event_participant_id = EXCLUDED.event_participant_id,
    role_id = EXCLUDED.role_id,
    assigned_at = EXCLUDED.assigned_at,
    assigned_by_id = EXCLUDED.assigned_by_id;

  INSERT INTO public.agenda_item (
    id,
    event_id,
    creator_id,
    title,
    description,
    type,
    status,
    order_index,
    duration,
    scheduled_time,
    start_time,
    end_time,
    activated_at,
    completed_at,
    majority_type,
    time_limit,
    voting_phase,
    created_at,
    updated_at
  )
  VALUES
    (
      agenda_budget_id,
      demo_event_id,
      demo_user_id,
      'Emergency field budget reallocation',
      'Indicative vote with urgent closing time.',
      'vote',
      'active',
      1,
      45,
      'now',
      seed_now - INTERVAL '25 minutes',
      seed_now + INTERVAL '20 minutes',
      seed_now - INTERVAL '25 minutes',
      NULL,
      'simple',
      1200,
      'indicative',
      seed_now - INTERVAL '70 minutes',
      seed_now
    ),
    (
      agenda_transport_id,
      demo_event_id,
      demo_user_id,
      'Final vote on transport coalition mandate',
      'Final vote with prior indicative pulse.',
      'vote',
      'active',
      2,
      70,
      'now',
      seed_now - INTERVAL '15 minutes',
      seed_now + INTERVAL '70 minutes',
      seed_now - INTERVAL '15 minutes',
      NULL,
      'simple',
      4200,
      'final_vote',
      seed_now - INTERVAL '65 minutes',
      seed_now
    ),
    (
      agenda_chair_id,
      demo_event_id,
      demo_user_id,
      'Election of the demo session chair',
      'Indicative election with visible leaderboard data.',
      'election',
      'active',
      3,
      90,
      'now',
      seed_now - INTERVAL '10 minutes',
      seed_now + INTERVAL '95 minutes',
      seed_now - INTERVAL '10 minutes',
      NULL,
      'relative',
      5700,
      'indicative',
      seed_now - INTERVAL '60 minutes',
      seed_now
    ),
    (
      agenda_charter_id,
      demo_event_id,
      demo_user_id,
      'Closed charter clarification vote',
      'Recently closed vote for result widgets.',
      'vote',
      'completed',
      4,
      30,
      'done',
      seed_now - INTERVAL '75 minutes',
      seed_now - INTERVAL '25 minutes',
      seed_now - INTERVAL '75 minutes',
      seed_now - INTERVAL '25 minutes',
      'simple',
      1800,
      'closed',
      seed_now - INTERVAL '100 minutes',
      seed_now
    ),
    (
      agenda_secretary_id,
      demo_event_id,
      demo_user_id,
      'Closed secretary election',
      'Recently closed election for result widgets.',
      'election',
      'completed',
      5,
      30,
      'done',
      seed_now - INTERVAL '95 minutes',
      seed_now - INTERVAL '50 minutes',
      seed_now - INTERVAL '95 minutes',
      seed_now - INTERVAL '50 minutes',
      'relative',
      2700,
      'closed',
      seed_now - INTERVAL '120 minutes',
      seed_now
    )
  ON CONFLICT (id) DO UPDATE
  SET
    event_id = EXCLUDED.event_id,
    creator_id = EXCLUDED.creator_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    order_index = EXCLUDED.order_index,
    duration = EXCLUDED.duration,
    scheduled_time = EXCLUDED.scheduled_time,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    activated_at = EXCLUDED.activated_at,
    completed_at = EXCLUDED.completed_at,
    majority_type = EXCLUDED.majority_type,
    time_limit = EXCLUDED.time_limit,
    voting_phase = EXCLUDED.voting_phase,
    updated_at = EXCLUDED.updated_at;

  UPDATE public.event
  SET current_agenda_item_id = agenda_budget_id,
      updated_at = seed_now
  WHERE id = demo_event_id;

  INSERT INTO public.accreditation (
    id,
    event_id,
    agenda_item_id,
    user_id,
    confirmed_at,
    created_at
  )
  VALUES
    ('d7000000-0000-4000-a000-000000000001', demo_event_id, agenda_budget_id, demo_user_id, seed_now - INTERVAL '55 minutes', seed_now - INTERVAL '55 minutes'),
    ('d7000000-0000-4000-a000-000000000002', demo_event_id, agenda_budget_id, user_mina_id, seed_now - INTERVAL '55 minutes', seed_now - INTERVAL '55 minutes'),
    ('d7000000-0000-4000-a000-000000000003', demo_event_id, agenda_budget_id, user_omar_id, seed_now - INTERVAL '55 minutes', seed_now - INTERVAL '55 minutes'),
    ('d7000000-0000-4000-a000-000000000004', demo_event_id, agenda_budget_id, user_leah_id, seed_now - INTERVAL '55 minutes', seed_now - INTERVAL '55 minutes'),
    ('d7000000-0000-4000-a000-000000000005', demo_event_id, agenda_budget_id, user_jonas_id, seed_now - INTERVAL '55 minutes', seed_now - INTERVAL '55 minutes')
  ON CONFLICT (event_id, user_id) DO UPDATE
  SET
    agenda_item_id = EXCLUDED.agenda_item_id,
    confirmed_at = EXCLUDED.confirmed_at;

  INSERT INTO public.vote (
    id,
    agenda_item_id,
    title,
    description,
    status,
    majority_type,
    closing_type,
    closing_duration_seconds,
    closing_end_time,
    visibility,
    ballot_visibility,
    created_at,
    updated_at
  )
  VALUES
    (
      urgent_vote_id,
      agenda_budget_id,
      'Emergency field budget reallocation',
      'Move 18% of outreach reserve into field operations before the evening session.',
      'indicative',
      'simple',
      'scheduled',
      1200,
      seed_now + INTERVAL '20 minutes',
      'public',
      'named',
      seed_now - INTERVAL '65 minutes',
      seed_now
    ),
    (
      final_vote_id,
      agenda_transport_id,
      'Transport coalition mandate',
      'Authorize the negotiating team to finalize the local transport coalition mandate.',
      'final_vote',
      'simple',
      'scheduled',
      4200,
      seed_now + INTERVAL '70 minutes',
      'public',
      'named',
      seed_now - INTERVAL '60 minutes',
      seed_now
    ),
    (
      closed_vote_id,
      agenda_charter_id,
      'Charter clarification package',
      'Approve the procedural clarification package for future hybrid assemblies.',
      'closed',
      'simple',
      'scheduled',
      1800,
      seed_now - INTERVAL '25 minutes',
      'public',
      'named',
      seed_now - INTERVAL '95 minutes',
      seed_now
    );

  INSERT INTO public.vote_choice (id, vote_id, label, order_index, created_at)
  VALUES
    ('d5100000-0000-4000-a000-000000000001', urgent_vote_id, 'Yes', 0, seed_now),
    ('d5100000-0000-4000-a000-000000000002', urgent_vote_id, 'No', 1, seed_now),
    ('d5100000-0000-4000-a000-000000000003', urgent_vote_id, 'Abstain', 2, seed_now),
    ('d5100000-0000-4000-a000-000000000004', final_vote_id, 'Yes', 0, seed_now),
    ('d5100000-0000-4000-a000-000000000005', final_vote_id, 'No', 1, seed_now),
    ('d5100000-0000-4000-a000-000000000006', final_vote_id, 'Abstain', 2, seed_now),
    ('d5100000-0000-4000-a000-000000000007', closed_vote_id, 'Yes', 0, seed_now),
    ('d5100000-0000-4000-a000-000000000008', closed_vote_id, 'No', 1, seed_now),
    ('d5100000-0000-4000-a000-000000000009', closed_vote_id, 'Abstain', 2, seed_now);

  INSERT INTO public.voter (id, vote_id, user_id, created_at)
  VALUES
    ('d5200000-0000-4000-a000-000000000001', urgent_vote_id, demo_user_id, seed_now),
    ('d5200000-0000-4000-a000-000000000002', urgent_vote_id, user_mina_id, seed_now),
    ('d5200000-0000-4000-a000-000000000003', urgent_vote_id, user_omar_id, seed_now),
    ('d5200000-0000-4000-a000-000000000004', urgent_vote_id, user_leah_id, seed_now),
    ('d5200000-0000-4000-a000-000000000005', urgent_vote_id, user_jonas_id, seed_now),
    ('d5200000-0000-4000-a000-000000000006', final_vote_id, demo_user_id, seed_now),
    ('d5200000-0000-4000-a000-000000000007', final_vote_id, user_mina_id, seed_now),
    ('d5200000-0000-4000-a000-000000000008', final_vote_id, user_omar_id, seed_now),
    ('d5200000-0000-4000-a000-000000000009', final_vote_id, user_leah_id, seed_now),
    ('d5200000-0000-4000-a000-000000000010', final_vote_id, user_jonas_id, seed_now),
    ('d5200000-0000-4000-a000-000000000011', closed_vote_id, demo_user_id, seed_now),
    ('d5200000-0000-4000-a000-000000000012', closed_vote_id, user_mina_id, seed_now),
    ('d5200000-0000-4000-a000-000000000013', closed_vote_id, user_omar_id, seed_now),
    ('d5200000-0000-4000-a000-000000000014', closed_vote_id, user_leah_id, seed_now),
    ('d5200000-0000-4000-a000-000000000015', closed_vote_id, user_jonas_id, seed_now);

  INSERT INTO public.indicative_voter_participation (id, vote_id, voter_id, created_at)
  VALUES
    ('d5300000-0000-4000-a000-000000000001', urgent_vote_id, 'd5200000-0000-4000-a000-000000000002', seed_now - INTERVAL '12 minutes'),
    ('d5300000-0000-4000-a000-000000000002', urgent_vote_id, 'd5200000-0000-4000-a000-000000000003', seed_now - INTERVAL '10 minutes'),
    ('d5300000-0000-4000-a000-000000000003', urgent_vote_id, 'd5200000-0000-4000-a000-000000000004', seed_now - INTERVAL '8 minutes'),
    ('d5300000-0000-4000-a000-000000000004', urgent_vote_id, 'd5200000-0000-4000-a000-000000000005', seed_now - INTERVAL '6 minutes'),
    ('d5300000-0000-4000-a000-000000000005', final_vote_id, 'd5200000-0000-4000-a000-000000000007', seed_now - INTERVAL '42 minutes'),
    ('d5300000-0000-4000-a000-000000000006', final_vote_id, 'd5200000-0000-4000-a000-000000000008', seed_now - INTERVAL '40 minutes'),
    ('d5300000-0000-4000-a000-000000000007', final_vote_id, 'd5200000-0000-4000-a000-000000000009', seed_now - INTERVAL '38 minutes'),
    ('d5300000-0000-4000-a000-000000000008', final_vote_id, 'd5200000-0000-4000-a000-000000000010', seed_now - INTERVAL '36 minutes'),
    ('d5300000-0000-4000-a000-000000000009', closed_vote_id, 'd5200000-0000-4000-a000-000000000011', seed_now - INTERVAL '70 minutes'),
    ('d5300000-0000-4000-a000-000000000010', closed_vote_id, 'd5200000-0000-4000-a000-000000000012', seed_now - INTERVAL '68 minutes'),
    ('d5300000-0000-4000-a000-000000000011', closed_vote_id, 'd5200000-0000-4000-a000-000000000013', seed_now - INTERVAL '66 minutes'),
    ('d5300000-0000-4000-a000-000000000012', closed_vote_id, 'd5200000-0000-4000-a000-000000000014', seed_now - INTERVAL '64 minutes');

  INSERT INTO public.indicative_choice_decision (id, vote_id, choice_id, voter_participation_id, created_at)
  VALUES
    ('d5400000-0000-4000-a000-000000000001', urgent_vote_id, 'd5100000-0000-4000-a000-000000000001', 'd5300000-0000-4000-a000-000000000001', seed_now - INTERVAL '12 minutes'),
    ('d5400000-0000-4000-a000-000000000002', urgent_vote_id, 'd5100000-0000-4000-a000-000000000001', 'd5300000-0000-4000-a000-000000000002', seed_now - INTERVAL '10 minutes'),
    ('d5400000-0000-4000-a000-000000000003', urgent_vote_id, 'd5100000-0000-4000-a000-000000000002', 'd5300000-0000-4000-a000-000000000003', seed_now - INTERVAL '8 minutes'),
    ('d5400000-0000-4000-a000-000000000004', urgent_vote_id, 'd5100000-0000-4000-a000-000000000001', 'd5300000-0000-4000-a000-000000000004', seed_now - INTERVAL '6 minutes'),
    ('d5400000-0000-4000-a000-000000000005', final_vote_id, 'd5100000-0000-4000-a000-000000000004', 'd5300000-0000-4000-a000-000000000005', seed_now - INTERVAL '42 minutes'),
    ('d5400000-0000-4000-a000-000000000006', final_vote_id, 'd5100000-0000-4000-a000-000000000004', 'd5300000-0000-4000-a000-000000000006', seed_now - INTERVAL '40 minutes'),
    ('d5400000-0000-4000-a000-000000000007', final_vote_id, 'd5100000-0000-4000-a000-000000000005', 'd5300000-0000-4000-a000-000000000007', seed_now - INTERVAL '38 minutes'),
    ('d5400000-0000-4000-a000-000000000008', final_vote_id, 'd5100000-0000-4000-a000-000000000004', 'd5300000-0000-4000-a000-000000000008', seed_now - INTERVAL '36 minutes'),
    ('d5400000-0000-4000-a000-000000000009', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5300000-0000-4000-a000-000000000009', seed_now - INTERVAL '70 minutes'),
    ('d5400000-0000-4000-a000-000000000010', closed_vote_id, 'd5100000-0000-4000-a000-000000000008', 'd5300000-0000-4000-a000-000000000010', seed_now - INTERVAL '68 minutes'),
    ('d5400000-0000-4000-a000-000000000011', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5300000-0000-4000-a000-000000000011', seed_now - INTERVAL '66 minutes'),
    ('d5400000-0000-4000-a000-000000000012', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5300000-0000-4000-a000-000000000012', seed_now - INTERVAL '64 minutes');

  INSERT INTO public.final_voter_participation (id, vote_id, voter_id, created_at)
  VALUES
    ('d5500000-0000-4000-a000-000000000001', final_vote_id, 'd5200000-0000-4000-a000-000000000007', seed_now - INTERVAL '8 minutes'),
    ('d5500000-0000-4000-a000-000000000002', final_vote_id, 'd5200000-0000-4000-a000-000000000008', seed_now - INTERVAL '7 minutes'),
    ('d5500000-0000-4000-a000-000000000003', closed_vote_id, 'd5200000-0000-4000-a000-000000000011', seed_now - INTERVAL '42 minutes'),
    ('d5500000-0000-4000-a000-000000000004', closed_vote_id, 'd5200000-0000-4000-a000-000000000012', seed_now - INTERVAL '40 minutes'),
    ('d5500000-0000-4000-a000-000000000005', closed_vote_id, 'd5200000-0000-4000-a000-000000000013', seed_now - INTERVAL '38 minutes'),
    ('d5500000-0000-4000-a000-000000000006', closed_vote_id, 'd5200000-0000-4000-a000-000000000014', seed_now - INTERVAL '36 minutes');

  INSERT INTO public.final_choice_decision (id, vote_id, choice_id, voter_participation_id, created_at)
  VALUES
    ('d5600000-0000-4000-a000-000000000001', final_vote_id, 'd5100000-0000-4000-a000-000000000004', 'd5500000-0000-4000-a000-000000000001', seed_now - INTERVAL '8 minutes'),
    ('d5600000-0000-4000-a000-000000000002', final_vote_id, 'd5100000-0000-4000-a000-000000000005', 'd5500000-0000-4000-a000-000000000002', seed_now - INTERVAL '7 minutes'),
    ('d5600000-0000-4000-a000-000000000003', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5500000-0000-4000-a000-000000000003', seed_now - INTERVAL '42 minutes'),
    ('d5600000-0000-4000-a000-000000000004', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5500000-0000-4000-a000-000000000004', seed_now - INTERVAL '40 minutes'),
    ('d5600000-0000-4000-a000-000000000005', closed_vote_id, 'd5100000-0000-4000-a000-000000000008', 'd5500000-0000-4000-a000-000000000005', seed_now - INTERVAL '38 minutes'),
    ('d5600000-0000-4000-a000-000000000006', closed_vote_id, 'd5100000-0000-4000-a000-000000000007', 'd5500000-0000-4000-a000-000000000006', seed_now - INTERVAL '36 minutes');

  INSERT INTO public.election (
    id,
    agenda_item_id,
    role_id,
    title,
    description,
    status,
    majority_type,
    closing_type,
    closing_duration_seconds,
    closing_end_time,
    visibility,
    ballot_visibility,
    election_mode,
    seat_count,
    max_votes,
    created_at,
    updated_at
  )
  VALUES
    (
      live_election_id,
      agenda_chair_id,
      office_role_id,
      'Election of the demo session chair',
      'Choose a chair for the remainder of the demo assembly.',
      'indicative',
      'relative',
      'scheduled',
      5700,
      seed_now + INTERVAL '95 minutes',
      'public',
      'secret',
      'single',
      1,
      1,
      seed_now - INTERVAL '58 minutes',
      seed_now
    ),
    (
      closed_election_id,
      agenda_secretary_id,
      office_role_id,
      'Election of the demo secretary',
      'Recently closed election used to verify result rendering.',
      'closed',
      'relative',
      'scheduled',
      2700,
      seed_now - INTERVAL '50 minutes',
      'public',
      'secret',
      'single',
      1,
      1,
      seed_now - INTERVAL '115 minutes',
      seed_now
    );

  INSERT INTO public.election_candidate (
    id,
    election_id,
    user_id,
    name,
    description,
    status,
    order_index,
    created_at
  )
  VALUES
    ('d6100000-0000-4000-a000-000000000001', live_election_id, user_mina_id, 'Mina Bauer', 'Continuity and fast facilitation.', 'nominated', 1, seed_now),
    ('d6100000-0000-4000-a000-000000000002', live_election_id, user_omar_id, 'Omar Stein', 'Consensus-first moderation.', 'nominated', 2, seed_now),
    ('d6100000-0000-4000-a000-000000000003', live_election_id, user_leah_id, 'Leah Novak', 'Structured debate and concise summaries.', 'nominated', 3, seed_now),
    ('d6100000-0000-4000-a000-000000000004', closed_election_id, user_mina_id, 'Mina Bauer', 'Final result winner.', 'nominated', 1, seed_now),
    ('d6100000-0000-4000-a000-000000000005', closed_election_id, user_omar_id, 'Omar Stein', 'Final result runner-up.', 'nominated', 2, seed_now),
    ('d6100000-0000-4000-a000-000000000006', closed_election_id, user_leah_id, 'Leah Novak', 'Final result candidate.', 'nominated', 3, seed_now);

  INSERT INTO public.elector (id, election_id, user_id, created_at)
  VALUES
    ('d6200000-0000-4000-a000-000000000001', live_election_id, demo_user_id, seed_now),
    ('d6200000-0000-4000-a000-000000000002', live_election_id, user_mina_id, seed_now),
    ('d6200000-0000-4000-a000-000000000003', live_election_id, user_omar_id, seed_now),
    ('d6200000-0000-4000-a000-000000000004', live_election_id, user_leah_id, seed_now),
    ('d6200000-0000-4000-a000-000000000005', live_election_id, user_jonas_id, seed_now),
    ('d6200000-0000-4000-a000-000000000006', closed_election_id, demo_user_id, seed_now),
    ('d6200000-0000-4000-a000-000000000007', closed_election_id, user_mina_id, seed_now),
    ('d6200000-0000-4000-a000-000000000008', closed_election_id, user_omar_id, seed_now),
    ('d6200000-0000-4000-a000-000000000009', closed_election_id, user_leah_id, seed_now),
    ('d6200000-0000-4000-a000-000000000010', closed_election_id, user_jonas_id, seed_now);

  INSERT INTO public.indicative_elector_participation (id, election_id, elector_id, created_at)
  VALUES
    ('d6300000-0000-4000-a000-000000000001', live_election_id, 'd6200000-0000-4000-a000-000000000002', seed_now - INTERVAL '17 minutes'),
    ('d6300000-0000-4000-a000-000000000002', live_election_id, 'd6200000-0000-4000-a000-000000000003', seed_now - INTERVAL '16 minutes'),
    ('d6300000-0000-4000-a000-000000000003', live_election_id, 'd6200000-0000-4000-a000-000000000004', seed_now - INTERVAL '15 minutes'),
    ('d6300000-0000-4000-a000-000000000004', live_election_id, 'd6200000-0000-4000-a000-000000000005', seed_now - INTERVAL '14 minutes'),
    ('d6300000-0000-4000-a000-000000000005', closed_election_id, 'd6200000-0000-4000-a000-000000000006', seed_now - INTERVAL '90 minutes'),
    ('d6300000-0000-4000-a000-000000000006', closed_election_id, 'd6200000-0000-4000-a000-000000000007', seed_now - INTERVAL '88 minutes'),
    ('d6300000-0000-4000-a000-000000000007', closed_election_id, 'd6200000-0000-4000-a000-000000000008', seed_now - INTERVAL '86 minutes');

  INSERT INTO public.indicative_candidate_selection (id, election_id, candidate_id, elector_participation_id, created_at)
  VALUES
    ('d6400000-0000-4000-a000-000000000001', live_election_id, 'd6100000-0000-4000-a000-000000000001', 'd6300000-0000-4000-a000-000000000001', seed_now - INTERVAL '17 minutes'),
    ('d6400000-0000-4000-a000-000000000002', live_election_id, 'd6100000-0000-4000-a000-000000000001', 'd6300000-0000-4000-a000-000000000002', seed_now - INTERVAL '16 minutes'),
    ('d6400000-0000-4000-a000-000000000003', live_election_id, 'd6100000-0000-4000-a000-000000000002', 'd6300000-0000-4000-a000-000000000003', seed_now - INTERVAL '15 minutes'),
    ('d6400000-0000-4000-a000-000000000004', live_election_id, 'd6100000-0000-4000-a000-000000000003', 'd6300000-0000-4000-a000-000000000004', seed_now - INTERVAL '14 minutes'),
    ('d6400000-0000-4000-a000-000000000005', closed_election_id, 'd6100000-0000-4000-a000-000000000004', 'd6300000-0000-4000-a000-000000000005', seed_now - INTERVAL '90 minutes'),
    ('d6400000-0000-4000-a000-000000000006', closed_election_id, 'd6100000-0000-4000-a000-000000000005', 'd6300000-0000-4000-a000-000000000006', seed_now - INTERVAL '88 minutes'),
    ('d6400000-0000-4000-a000-000000000007', closed_election_id, 'd6100000-0000-4000-a000-000000000004', 'd6300000-0000-4000-a000-000000000007', seed_now - INTERVAL '86 minutes');

  INSERT INTO public.final_elector_participation (id, election_id, elector_id, created_at)
  VALUES
    ('d6500000-0000-4000-a000-000000000001', closed_election_id, 'd6200000-0000-4000-a000-000000000006', seed_now - INTERVAL '65 minutes'),
    ('d6500000-0000-4000-a000-000000000002', closed_election_id, 'd6200000-0000-4000-a000-000000000007', seed_now - INTERVAL '63 minutes'),
    ('d6500000-0000-4000-a000-000000000003', closed_election_id, 'd6200000-0000-4000-a000-000000000008', seed_now - INTERVAL '61 minutes'),
    ('d6500000-0000-4000-a000-000000000004', closed_election_id, 'd6200000-0000-4000-a000-000000000009', seed_now - INTERVAL '59 minutes');

  INSERT INTO public.final_candidate_selection (id, election_id, candidate_id, elector_participation_id, created_at)
  VALUES
    ('d6600000-0000-4000-a000-000000000001', closed_election_id, 'd6100000-0000-4000-a000-000000000004', 'd6500000-0000-4000-a000-000000000001', seed_now - INTERVAL '65 minutes'),
    ('d6600000-0000-4000-a000-000000000002', closed_election_id, 'd6100000-0000-4000-a000-000000000004', 'd6500000-0000-4000-a000-000000000002', seed_now - INTERVAL '63 minutes'),
    ('d6600000-0000-4000-a000-000000000003', closed_election_id, 'd6100000-0000-4000-a000-000000000005', 'd6500000-0000-4000-a000-000000000003', seed_now - INTERVAL '61 minutes'),
    ('d6600000-0000-4000-a000-000000000004', closed_election_id, 'd6100000-0000-4000-a000-000000000004', 'd6500000-0000-4000-a000-000000000004', seed_now - INTERVAL '59 minutes');
END $$;

-- =============================================================================
-- Explicit Group/Membership/Network acceptance seed
-- Deterministic network for the explicit read-model redesign.
-- =============================================================================

DO $$
DECLARE
  seed_now TIMESTAMPTZ := clock_timestamp();
  owner_id UUID := 'e1000000-0000-4000-a000-000000000000';

  g_c_b1 UUID := 'e2000000-0000-4000-a000-000000000001';
  g_c_b2 UUID := 'e2000000-0000-4000-a000-000000000002';
  g_c_b3 UUID := 'e2000000-0000-4000-a000-000000000003';
  g_c_b4 UUID := 'e2000000-0000-4000-a000-000000000004';
  g_s_b5 UUID := 'e2000000-0000-4000-a000-000000000005';
  g_s_b6 UUID := 'e2000000-0000-4000-a000-000000000006';
  g_s_b7 UUID := 'e2000000-0000-4000-a000-000000000007';
  g_s_b8 UUID := 'e2000000-0000-4000-a000-000000000008';
  g_c_h1 UUID := 'e2000000-0000-4000-a000-000000000009';
  g_c_h2 UUID := 'e2000000-0000-4000-a000-000000000010';
  g_c_k1 UUID := 'e2000000-0000-4000-a000-000000000011';
  g_s_h3 UUID := 'e2000000-0000-4000-a000-000000000012';
  g_s_h4 UUID := 'e2000000-0000-4000-a000-000000000013';
  g_c_k2 UUID := 'e2000000-0000-4000-a000-000000000014';
  g_c_fraktion UUID := 'e2000000-0000-4000-a000-000000000015';
  g_s_fraktion UUID := 'e2000000-0000-4000-a000-000000000016';
  g_stadtparlament UUID := 'e2000000-0000-4000-a000-000000000017';
  g_bauausschuss UUID := 'e2000000-0000-4000-a000-000000000018';
  g_haushaltsausschuss UUID := 'e2000000-0000-4000-a000-000000000019';
  g_stadtverwaltung UUID := 'e2000000-0000-4000-a000-000000000020';

  general_event_id UUID := 'e6000000-0000-4000-a000-000000000001';
  delegate_event_id UUID := 'e6000000-0000-4000-a000-000000000002';
  workflow_id UUID := 'e7000000-0000-4000-a000-000000000001';

  v_user_index INTEGER;
  v_participant_index INTEGER;
  v_membership_seq INTEGER;
  v_membership_plan RECORD;
  v_membership_user_id UUID;
  v_membership_id UUID;
BEGIN
  INSERT INTO public."user" (
    id, email, handle, first_name, last_name, visibility,
    subscriber_count, amendment_count, group_count, created_at, updated_at
  )
  VALUES (
    owner_id,
    'acceptance-owner@polity.local',
    'acceptance-owner',
    'Acceptance',
    'Owner',
    'public',
    0,
    0,
    0,
    seed_now,
    seed_now
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      handle = EXCLUDED.handle,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = EXCLUDED.updated_at;

  FOR v_user_index IN 1..36 LOOP
    INSERT INTO public."user" (
      id, email, handle, first_name, last_name, visibility,
      subscriber_count, amendment_count, group_count, created_at, updated_at
    )
    VALUES (
      ('e1000000-0000-4000-a000-' || lpad(v_user_index::TEXT, 12, '0'))::UUID,
      'acceptance-member-' || v_user_index || '@polity.local',
      'acceptance-member-' || v_user_index,
      'Acceptance',
      'Member ' || v_user_index,
      'public',
      0,
      0,
      0,
      seed_now,
      seed_now
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        handle = EXCLUDED.handle,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = EXCLUDED.updated_at;
  END LOOP;

  CREATE TEMP TABLE IF NOT EXISTS acceptance_group_plan (
    id UUID,
    name TEXT,
    group_type TEXT,
    member_count INTEGER,
    has_hierarchy_children BOOLEAN,
    has_sibling_connections BOOLEAN,
    connected_group_id UUID,
    primary_sibling_membership_mode TEXT,
    sibling_membership_mode TEXT
  ) ON COMMIT DROP;
  TRUNCATE acceptance_group_plan;

  INSERT INTO acceptance_group_plan VALUES
    (g_c_b1, 'C_B1', 'base', 1, false, false, NULL, NULL, NULL),
    (g_c_b2, 'C_B2', 'base', 2, false, false, NULL, NULL, NULL),
    (g_c_b3, 'C_B3', 'base', 3, false, false, NULL, NULL, NULL),
    (g_c_b4, 'C_B4', 'base', 4, false, false, NULL, NULL, NULL),
    (g_s_b5, 'S_B5', 'base', 5, false, false, NULL, NULL, NULL),
    (g_s_b6, 'S_B6', 'base', 6, false, false, NULL, NULL, NULL),
    (g_s_b7, 'S_B7', 'base', 7, false, false, NULL, NULL, NULL),
    (g_s_b8, 'S_B8', 'base', 8, false, false, NULL, NULL, NULL),
    (g_c_h1, 'C_H1', 'hierarchical', 1, true, false, NULL, NULL, NULL),
    (g_c_h2, 'C_H2', 'hierarchical', 9, true, false, NULL, NULL, NULL),
    (g_c_k1, 'C_K1', 'hierarchical', 10, true, false, NULL, NULL, NULL),
    (g_s_h3, 'S_H3', 'hierarchical', 11, true, false, NULL, NULL, NULL),
    (g_s_h4, 'S_H4', 'hierarchical', 15, true, false, NULL, NULL, NULL),
    (g_c_k2, 'C_K2', 'hierarchical', 26, true, false, NULL, NULL, NULL),
    (g_c_fraktion, 'C_Fraktion', 'sibling', 3, false, true, g_c_b3, 'selected_source_groups', 'parliament'),
    (g_s_fraktion, 'S_Fraktion', 'sibling', 4, false, true, g_s_b5, 'selected_source_groups', 'parliament'),
    (g_stadtparlament, 'Stadtparlament', 'parliament', 7, false, true, NULL, NULL, NULL),
    (g_bauausschuss, 'Bauausschuss', 'committee', 2, false, true, g_stadtparlament, NULL, NULL),
    (g_haushaltsausschuss, 'Haushaltsausschuss', 'committee', 3, false, true, g_stadtparlament, NULL, NULL),
    (g_stadtverwaltung, 'Stadtverwaltung', 'institution', 0, false, true, g_stadtparlament, NULL, NULL);

  INSERT INTO public."group" (
    id, name, visibility, member_count, subscriber_count, event_count, amendment_count,
    document_count, group_type, has_hierarchy_children, has_sibling_connections,
    connected_group_id, primary_sibling_membership_mode, sibling_membership_mode,
    owner_id, created_at, updated_at
  )
  SELECT
    id, name, 'public', member_count, 0, 0, 0, 0, group_type, has_hierarchy_children,
    has_sibling_connections, connected_group_id, primary_sibling_membership_mode,
    sibling_membership_mode, owner_id, seed_now, seed_now
  FROM acceptance_group_plan
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      member_count = EXCLUDED.member_count,
      group_type = EXCLUDED.group_type,
      has_hierarchy_children = EXCLUDED.has_hierarchy_children,
      has_sibling_connections = EXCLUDED.has_sibling_connections,
      connected_group_id = EXCLUDED.connected_group_id,
      primary_sibling_membership_mode = EXCLUDED.primary_sibling_membership_mode,
      sibling_membership_mode = EXCLUDED.sibling_membership_mode,
      owner_id = EXCLUDED.owner_id,
      updated_at = EXCLUDED.updated_at;

  CREATE TEMP TABLE IF NOT EXISTS acceptance_connection_plan (
    seq INTEGER,
    from_group_id UUID,
    to_group_id UUID,
    connection_kind TEXT
  ) ON COMMIT DROP;
  TRUNCATE acceptance_connection_plan;

  INSERT INTO acceptance_connection_plan VALUES
    (1, g_c_b1, g_c_h1, 'hierarchy'),
    (2, g_c_b2, g_c_h2, 'hierarchy'),
    (3, g_c_b3, g_c_h2, 'hierarchy'),
    (4, g_c_b4, g_c_h2, 'hierarchy'),
    (5, g_c_h1, g_c_k1, 'hierarchy'),
    (6, g_c_h2, g_c_k1, 'hierarchy'),
    (7, g_s_b5, g_s_h3, 'hierarchy'),
    (8, g_s_b6, g_s_h3, 'hierarchy'),
    (9, g_s_b7, g_s_h4, 'hierarchy'),
    (10, g_s_b8, g_s_h4, 'hierarchy'),
    (11, g_s_h3, g_c_k2, 'hierarchy'),
    (12, g_s_h4, g_c_k2, 'hierarchy'),
    (13, g_c_b3, g_c_fraktion, 'sibling'),
    (14, g_s_b5, g_s_fraktion, 'sibling'),
    (15, g_c_fraktion, g_stadtparlament, 'parliament'),
    (16, g_s_fraktion, g_stadtparlament, 'parliament'),
    (17, g_stadtparlament, g_bauausschuss, 'committee'),
    (18, g_stadtparlament, g_haushaltsausschuss, 'committee'),
    (19, g_stadtparlament, g_stadtverwaltung, 'institution');

  INSERT INTO public.group_connection (
    id, group_a_id, group_b_id, connection_type, from_group_id, to_group_id,
    connection_kind, parent_group_id, child_group_id, status, created_by_id,
    created_at, updated_at
  )
  SELECT
    ('e4000000-0000-4000-a000-' || lpad(acp.seq::TEXT, 12, '0'))::UUID,
    LEAST(acp.from_group_id, acp.to_group_id),
    GREATEST(acp.from_group_id, acp.to_group_id),
    CASE WHEN acp.connection_kind = 'hierarchy' THEN 'hierarchy' ELSE 'peer' END,
    acp.from_group_id,
    acp.to_group_id,
    acp.connection_kind,
    CASE WHEN acp.connection_kind = 'hierarchy' THEN acp.to_group_id ELSE NULL END,
    CASE WHEN acp.connection_kind = 'hierarchy' THEN acp.from_group_id ELSE NULL END,
    'active',
    owner_id,
    seed_now,
    seed_now
  FROM acceptance_connection_plan AS acp
  ON CONFLICT (id) DO UPDATE
  SET group_a_id = EXCLUDED.group_a_id,
      group_b_id = EXCLUDED.group_b_id,
      connection_type = EXCLUDED.connection_type,
      from_group_id = EXCLUDED.from_group_id,
      to_group_id = EXCLUDED.to_group_id,
      connection_kind = EXCLUDED.connection_kind,
      parent_group_id = EXCLUDED.parent_group_id,
      child_group_id = EXCLUDED.child_group_id,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.group_right_grant (
    id, connection_id, right_key, holder_group_id, scope_group_id, status,
    initiator_group_id, created_at, updated_at
  )
  SELECT
    ('e4100000-0000-4000-a000-' || lpad(acp.seq::TEXT, 12, '0'))::UUID,
    ('e4000000-0000-4000-a000-' || lpad(acp.seq::TEXT, 12, '0'))::UUID,
    'rightToSpeak',
    acp.from_group_id,
    acp.to_group_id,
    'active',
    acp.from_group_id,
    seed_now,
    seed_now
  FROM acceptance_connection_plan AS acp
  ON CONFLICT (id) DO UPDATE
  SET right_key = EXCLUDED.right_key,
      holder_group_id = EXCLUDED.holder_group_id,
      scope_group_id = EXCLUDED.scope_group_id,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.group_membership_rule (
    id, connection_id, member_source_group_id, member_target_group_id,
    membership_mode, required_source_role_id, created_at, updated_at
  )
  SELECT
    ('e4200000-0000-4000-a000-' || lpad(acp.seq::TEXT, 12, '0'))::UUID,
    ('e4000000-0000-4000-a000-' || lpad(acp.seq::TEXT, 12, '0'))::UUID,
    acp.from_group_id,
    acp.to_group_id,
    'all_members',
    NULL,
    seed_now,
    seed_now
  FROM acceptance_connection_plan AS acp
  WHERE acp.connection_kind <> 'hierarchy'
  ON CONFLICT (id) DO UPDATE
  SET member_source_group_id = EXCLUDED.member_source_group_id,
      member_target_group_id = EXCLUDED.member_target_group_id,
      membership_mode = EXCLUDED.membership_mode,
      updated_at = EXCLUDED.updated_at;

  CREATE TEMP TABLE IF NOT EXISTS acceptance_membership_plan (
    group_id UUID,
    user_index INTEGER,
    source TEXT,
    source_group_id UUID,
    origin_kind TEXT,
    part_group_id UUID,
    base_group_id UUID,
    is_auto_managed BOOLEAN
  ) ON COMMIT DROP;
  TRUNCATE acceptance_membership_plan;

  INSERT INTO acceptance_membership_plan SELECT g_c_b1, gs.user_index, 'direct', NULL, 'direct', g_c_b1, g_c_b1, false FROM generate_series(1, 1) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_b2, gs.user_index, 'direct', NULL, 'direct', g_c_b2, g_c_b2, false FROM generate_series(2, 3) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_b3, gs.user_index, 'direct', NULL, 'direct', g_c_b3, g_c_b3, false FROM generate_series(4, 6) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_b4, gs.user_index, 'direct', NULL, 'direct', g_c_b4, g_c_b4, false FROM generate_series(7, 10) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_b5, gs.user_index, 'direct', NULL, 'direct', g_s_b5, g_s_b5, false FROM generate_series(11, 15) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_b6, gs.user_index, 'direct', NULL, 'direct', g_s_b6, g_s_b6, false FROM generate_series(16, 21) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_b7, gs.user_index, 'direct', NULL, 'direct', g_s_b7, g_s_b7, false FROM generate_series(22, 28) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_b8, gs.user_index, 'direct', NULL, 'direct', g_s_b8, g_s_b8, false FROM generate_series(29, 36) AS gs(user_index);

  INSERT INTO acceptance_membership_plan SELECT g_c_h1, gs.user_index, 'derived', g_c_b1, 'hierarchy', g_c_b1, g_c_b1, true FROM generate_series(1, 1) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_h2, gs.user_index, 'derived', g_c_b2, 'hierarchy', g_c_b2, g_c_b2, true FROM generate_series(2, 3) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_h2, gs.user_index, 'derived', g_c_b3, 'hierarchy', g_c_b3, g_c_b3, true FROM generate_series(4, 6) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_h2, gs.user_index, 'derived', g_c_b4, 'hierarchy', g_c_b4, g_c_b4, true FROM generate_series(7, 10) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k1, gs.user_index, 'derived', g_c_b1, 'hierarchy', g_c_h1, g_c_b1, true FROM generate_series(1, 1) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k1, gs.user_index, 'derived', g_c_b2, 'hierarchy', g_c_h2, g_c_b2, true FROM generate_series(2, 3) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k1, gs.user_index, 'derived', g_c_b3, 'hierarchy', g_c_h2, g_c_b3, true FROM generate_series(4, 6) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k1, gs.user_index, 'derived', g_c_b4, 'hierarchy', g_c_h2, g_c_b4, true FROM generate_series(7, 10) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_h3, gs.user_index, 'derived', g_s_b5, 'hierarchy', g_s_b5, g_s_b5, true FROM generate_series(11, 15) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_h3, gs.user_index, 'derived', g_s_b6, 'hierarchy', g_s_b6, g_s_b6, true FROM generate_series(16, 21) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_h4, gs.user_index, 'derived', g_s_b7, 'hierarchy', g_s_b7, g_s_b7, true FROM generate_series(22, 28) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_h4, gs.user_index, 'derived', g_s_b8, 'hierarchy', g_s_b8, g_s_b8, true FROM generate_series(29, 36) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k2, gs.user_index, 'derived', g_s_b5, 'hierarchy', g_s_h3, g_s_b5, true FROM generate_series(11, 15) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k2, gs.user_index, 'derived', g_s_b6, 'hierarchy', g_s_h3, g_s_b6, true FROM generate_series(16, 21) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k2, gs.user_index, 'derived', g_s_b7, 'hierarchy', g_s_h4, g_s_b7, true FROM generate_series(22, 28) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_c_k2, gs.user_index, 'derived', g_s_b8, 'hierarchy', g_s_h4, g_s_b8, true FROM generate_series(29, 36) AS gs(user_index);

  INSERT INTO acceptance_membership_plan SELECT g_c_fraktion, gs.user_index, 'sibling_parliament', g_c_b3, 'sibling_selected_source_groups', g_c_b3, g_c_b3, true FROM generate_series(4, 6) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_s_fraktion, gs.user_index, 'sibling_parliament', g_s_b5, 'sibling_selected_source_groups', g_s_b5, g_s_b5, true FROM generate_series(11, 14) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_stadtparlament, gs.user_index, 'sibling_parliament', g_c_fraktion, 'sibling_selected_source_groups', g_c_fraktion, g_c_fraktion, true FROM generate_series(4, 6) AS gs(user_index);
  INSERT INTO acceptance_membership_plan SELECT g_stadtparlament, gs.user_index, 'sibling_parliament', g_s_fraktion, 'sibling_selected_source_groups', g_s_fraktion, g_s_fraktion, true FROM generate_series(11, 14) AS gs(user_index);
  INSERT INTO acceptance_membership_plan VALUES
    (g_bauausschuss, 4, 'sibling_parliament', g_stadtparlament, 'sibling_selected_source_groups', g_stadtparlament, g_stadtparlament, true),
    (g_bauausschuss, 11, 'sibling_parliament', g_stadtparlament, 'sibling_selected_source_groups', g_stadtparlament, g_stadtparlament, true),
    (g_haushaltsausschuss, 5, 'sibling_parliament', g_stadtparlament, 'sibling_selected_source_groups', g_stadtparlament, g_stadtparlament, true),
    (g_haushaltsausschuss, 12, 'sibling_parliament', g_stadtparlament, 'sibling_selected_source_groups', g_stadtparlament, g_stadtparlament, true),
    (g_haushaltsausschuss, 13, 'sibling_parliament', g_stadtparlament, 'sibling_selected_source_groups', g_stadtparlament, g_stadtparlament, true);

  DELETE FROM public.group_membership_origin WHERE id::TEXT LIKE 'e3100000-0000-4000-a000-%';

  v_membership_seq := 0;
  FOR v_membership_plan IN
    SELECT amp.*
    FROM acceptance_membership_plan AS amp
    ORDER BY amp.group_id, amp.user_index
  LOOP
    v_membership_seq := v_membership_seq + 1;
    v_membership_user_id := ('e1000000-0000-4000-a000-' || lpad(v_membership_plan.user_index::TEXT, 12, '0'))::UUID;
    v_membership_id := ('e3000000-0000-4000-a000-' || lpad(v_membership_seq::TEXT, 12, '0'))::UUID;

    INSERT INTO public.group_membership (
      id, group_id, user_id, status, visibility, source, source_group_id,
      origin_kind, part_group_id, base_group_id, is_auto_managed, created_at
    )
    VALUES (
      v_membership_id, v_membership_plan.group_id, v_membership_user_id, 'active', 'public', v_membership_plan.source,
      v_membership_plan.source_group_id, v_membership_plan.origin_kind, v_membership_plan.part_group_id, v_membership_plan.base_group_id,
      v_membership_plan.is_auto_managed, seed_now
    )
    ON CONFLICT (user_id, group_id) DO UPDATE
    SET id = EXCLUDED.id,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility,
        source = EXCLUDED.source,
        source_group_id = EXCLUDED.source_group_id,
        origin_kind = EXCLUDED.origin_kind,
        part_group_id = EXCLUDED.part_group_id,
        base_group_id = EXCLUDED.base_group_id,
        is_auto_managed = EXCLUDED.is_auto_managed;

    INSERT INTO public.group_membership_origin (
      id, group_membership_id, origin_kind, source_group_id, source_membership_id,
      connection_id, membership_rule_id, source_role_id, part_group_id, base_group_id,
      depth, path_group_ids, created_at
    )
    VALUES (
      ('e3100000-0000-4000-a000-' || lpad(v_membership_seq::TEXT, 12, '0'))::UUID,
      v_membership_id,
      v_membership_plan.origin_kind,
      COALESCE(v_membership_plan.source_group_id, v_membership_plan.group_id),
      CASE WHEN v_membership_plan.source = 'direct' THEN v_membership_id ELSE NULL END,
      NULL,
      NULL,
      NULL,
      v_membership_plan.part_group_id,
      v_membership_plan.base_group_id,
      CASE WHEN v_membership_plan.source = 'direct' THEN 0 ELSE 1 END,
      ARRAY[COALESCE(v_membership_plan.base_group_id, v_membership_plan.group_id), v_membership_plan.group_id]::UUID[],
      seed_now
    )
    ON CONFLICT (id) DO UPDATE
    SET group_membership_id = EXCLUDED.group_membership_id,
        origin_kind = EXCLUDED.origin_kind,
        source_group_id = EXCLUDED.source_group_id,
        part_group_id = EXCLUDED.part_group_id,
        base_group_id = EXCLUDED.base_group_id,
        depth = EXCLUDED.depth,
        path_group_ids = EXCLUDED.path_group_ids;
  END LOOP;

  DELETE FROM public.group_hierarchy_path WHERE id::TEXT LIKE 'e5000000-0000-4000-a000-%';
  WITH RECURSIVE edges AS (
    SELECT id AS connection_id, child_group_id AS child_group_id, parent_group_id AS parent_group_id
    FROM public.group_connection
    WHERE id::TEXT LIKE 'e4000000-0000-4000-a000-%'
      AND connection_type = 'hierarchy'
      AND status = 'active'
  ),
  paths AS (
    SELECT
      connection_id,
      child_group_id AS base_group_id,
      child_group_id AS descendant_group_id,
      parent_group_id AS ancestor_group_id,
      child_group_id AS direct_child_group_id,
      ARRAY[child_group_id, parent_group_id]::UUID[] AS path_group_ids,
      1 AS depth
    FROM edges
    UNION ALL
    SELECT
      e.connection_id,
      p.base_group_id,
      p.descendant_group_id,
      e.parent_group_id,
      p.ancestor_group_id,
      p.path_group_ids || e.parent_group_id,
      p.depth + 1
    FROM paths p
    JOIN edges e ON e.child_group_id = p.ancestor_group_id
    WHERE NOT e.parent_group_id = ANY(p.path_group_ids)
  ),
  numbered AS (
    SELECT row_number() OVER (ORDER BY ancestor_group_id, descendant_group_id, depth) AS rn, *
    FROM paths
  )
  INSERT INTO public.group_hierarchy_path (
    id, ancestor_group_id, descendant_group_id, direct_child_group_id, base_group_id,
    depth, path_group_ids, status, connection_id, created_at, updated_at
  )
  SELECT
    ('e5000000-0000-4000-a000-' || lpad(rn::TEXT, 12, '0'))::UUID,
    ancestor_group_id,
    descendant_group_id,
    direct_child_group_id,
    base_group_id,
    depth,
    path_group_ids,
    'active',
    connection_id,
    seed_now,
    seed_now
  FROM numbered
  ON CONFLICT DO NOTHING;

  DELETE FROM public.group_effective_right WHERE id::TEXT LIKE 'e5100000-0000-4000-a000-%';
  INSERT INTO public.group_effective_right (
    id, holder_group_id, scope_group_id, right_key, source_connection_id,
    source_grant_id, status, created_at, updated_at
  )
  SELECT
    ('e5100000-0000-4000-a000-' || lpad(row_number() OVER (ORDER BY id)::TEXT, 12, '0'))::UUID,
    holder_group_id,
    scope_group_id,
    right_key,
    connection_id,
    id,
    'active',
    seed_now,
    seed_now
  FROM public.group_right_grant
  WHERE id::TEXT LIKE 'e4100000-0000-4000-a000-%'
    AND status = 'active'
  ON CONFLICT DO NOTHING;

  DELETE FROM public.group_membership_exclusivity_lock WHERE id::TEXT LIKE 'e5200000-0000-4000-a000-%';
  WITH lock_rows AS (
    SELECT DISTINCT ON (m.user_id, p.ancestor_group_id)
      m.user_id, p.ancestor_group_id, COALESCE(m.base_group_id, m.source_group_id, m.group_id) AS source_group_id, m.id AS membership_id
    FROM public.group_membership m
    JOIN public.group_hierarchy_path p ON p.base_group_id = COALESCE(m.base_group_id, m.source_group_id, m.group_id)
    WHERE m.id::TEXT LIKE 'e3000000-0000-4000-a000-%'
      AND m.status = 'active'
      AND p.status = 'active'
    ORDER BY m.user_id, p.ancestor_group_id, m.created_at
  ),
  numbered AS (
    SELECT row_number() OVER (ORDER BY lr.user_id, lr.ancestor_group_id) AS rn, lr.*
    FROM lock_rows AS lr
  )
  INSERT INTO public.group_membership_exclusivity_lock (
    id, user_id, hierarchy_group_id, source_group_id, group_membership_id,
    status, created_at, updated_at
  )
  SELECT
    ('e5200000-0000-4000-a000-' || lpad(n.rn::TEXT, 12, '0'))::UUID,
    n.user_id,
    n.ancestor_group_id,
    n.source_group_id,
    n.membership_id,
    'active',
    seed_now,
    seed_now
  FROM numbered AS n
  ON CONFLICT DO NOTHING;

  DELETE FROM public.group_sibling_source_lock WHERE id::TEXT LIKE 'e5300000-0000-4000-a000-%';
  WITH lock_rows AS (
    SELECT DISTINCT ON (gm.user_id, gm.group_id)
      gm.user_id, gm.group_id AS sibling_group_id, gm.source_group_id, gm.id AS membership_id
    FROM public.group_membership AS gm
    WHERE gm.id::TEXT LIKE 'e3000000-0000-4000-a000-%'
      AND gm.status = 'active'
      AND gm.source LIKE 'sibling_%'
      AND gm.source_group_id IS NOT NULL
    ORDER BY gm.user_id, gm.group_id, gm.created_at
  ),
  numbered AS (
    SELECT row_number() OVER (ORDER BY lr.user_id, lr.sibling_group_id) AS rn, lr.*
    FROM lock_rows AS lr
  )
  INSERT INTO public.group_sibling_source_lock (
    id, user_id, sibling_group_id, source_group_id, group_membership_id,
    status, created_at, updated_at
  )
  SELECT
    ('e5300000-0000-4000-a000-' || lpad(n.rn::TEXT, 12, '0'))::UUID,
    n.user_id,
    n.sibling_group_id,
    n.source_group_id,
    n.membership_id,
    'active',
    seed_now,
    seed_now
  FROM numbered AS n
  ON CONFLICT DO NOTHING;

  INSERT INTO public.event (
    id, title, description, status, event_type, attendance_mode, visibility,
    start_date, end_date, participant_count, has_delegates, delegate_count,
    group_id, creator_id, created_at, updated_at
  )
  VALUES
    (
      general_event_id,
      'General Assembly C_K2',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Acceptance general assembly for C_K2."}]}]}'::JSONB,
      'scheduled',
      'general_assembly',
      'offline',
      'public',
      seed_now + INTERVAL '14 days',
      seed_now + INTERVAL '14 days 2 hours',
      26,
      false,
      0,
      g_c_k2,
      owner_id,
      seed_now,
      seed_now
    ),
    (
      delegate_event_id,
      'Delegate Assembly C_H2',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Acceptance delegate assembly for C_H2."}]}]}'::JSONB,
      'scheduled',
      'delegate_assembly',
      'offline',
      'public',
      seed_now + INTERVAL '21 days',
      seed_now + INTERVAL '21 days 2 hours',
      0,
      true,
      7,
      g_c_h2,
      owner_id,
      seed_now,
      seed_now
    )
  ON CONFLICT (id) DO UPDATE
  SET title = EXCLUDED.title,
      status = EXCLUDED.status,
      event_type = EXCLUDED.event_type,
      participant_count = EXCLUDED.participant_count,
      has_delegates = EXCLUDED.has_delegates,
      delegate_count = EXCLUDED.delegate_count,
      group_id = EXCLUDED.group_id,
      updated_at = EXCLUDED.updated_at;

  FOR v_participant_index IN 11..36 LOOP
    INSERT INTO public.event_participant (
      id, event_id, user_id, group_id, status, visibility, instance_date, created_at
    )
    VALUES (
      ('e6100000-0000-4000-a000-' || lpad((v_participant_index - 10)::TEXT, 12, '0'))::UUID,
      general_event_id,
      ('e1000000-0000-4000-a000-' || lpad(v_participant_index::TEXT, 12, '0'))::UUID,
      g_c_k2,
      'active',
      'public',
      NULL,
      seed_now
    )
    ON CONFLICT (id) DO UPDATE
    SET event_id = EXCLUDED.event_id,
        user_id = EXCLUDED.user_id,
        group_id = EXCLUDED.group_id,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility;
  END LOOP;

  DELETE FROM public.event_assembly_scope WHERE id::TEXT LIKE 'e6200000-0000-4000-a000-%';
  INSERT INTO public.event_assembly_scope (
    id, event_id, host_group_id, source_group_id, scope_kind,
    participant_mode, required_role_id, status, created_at, updated_at
  )
  VALUES
    ('e6200000-0000-4000-a000-000000000001', general_event_id, g_c_k2, g_s_b5, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('e6200000-0000-4000-a000-000000000002', general_event_id, g_c_k2, g_s_b6, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('e6200000-0000-4000-a000-000000000003', general_event_id, g_c_k2, g_s_b7, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('e6200000-0000-4000-a000-000000000004', general_event_id, g_c_k2, g_s_b8, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('e6200000-0000-4000-a000-000000000005', delegate_event_id, g_c_h2, g_c_b3, 'delegate_source', 'delegates', NULL, 'active', seed_now, seed_now),
    ('e6200000-0000-4000-a000-000000000006', delegate_event_id, g_c_h2, g_c_b4, 'delegate_source', 'delegates', NULL, 'active', seed_now, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET event_id = EXCLUDED.event_id,
      host_group_id = EXCLUDED.host_group_id,
      source_group_id = EXCLUDED.source_group_id,
      scope_kind = EXCLUDED.scope_kind,
      participant_mode = EXCLUDED.participant_mode,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.group_delegate_allocation (id, event_id, group_id, allocated_seats, created_at)
  VALUES
    ('e6300000-0000-4000-a000-000000000001', delegate_event_id, g_c_b3, 3, seed_now),
    ('e6300000-0000-4000-a000-000000000002', delegate_event_id, g_c_b4, 4, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET event_id = EXCLUDED.event_id,
      group_id = EXCLUDED.group_id,
      allocated_seats = EXCLUDED.allocated_seats;

  INSERT INTO public.delegate_election_assignment (
    id, target_event_id, source_group_id, allocation_id, required_seats,
    confirmed_seats, linked_event_id, status, created_at, updated_at
  )
  VALUES
    ('e6400000-0000-4000-a000-000000000001', delegate_event_id, g_c_b3, 'e6300000-0000-4000-a000-000000000001', 3, 0, NULL, 'open', seed_now, seed_now),
    ('e6400000-0000-4000-a000-000000000002', delegate_event_id, g_c_b4, 'e6300000-0000-4000-a000-000000000002', 4, 0, NULL, 'open', seed_now, seed_now)
  ON CONFLICT (target_event_id, source_group_id) DO UPDATE
  SET allocation_id = EXCLUDED.allocation_id,
      required_seats = EXCLUDED.required_seats,
      confirmed_seats = EXCLUDED.confirmed_seats,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.group_workflow (
    id, group_id, start_group_id, name, description, is_default_entry,
    status, created_by_id, created_at, updated_at
  )
  VALUES (
    workflow_id,
    g_s_fraktion,
    g_s_b5,
    'Acceptance route S_Fraktion to Stadtverwaltung',
    'S_Fraktion -> Stadtparlament -> Bauausschuss -> Stadtparlament -> Bauausschuss -> Stadtparlament -> Stadtverwaltung, plus S_B5 entry.',
    true,
    'active',
    owner_id,
    seed_now,
    seed_now
  )
  ON CONFLICT (id) DO UPDATE
  SET group_id = EXCLUDED.group_id,
      start_group_id = EXCLUDED.start_group_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_default_entry = EXCLUDED.is_default_entry,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

  DELETE FROM public.group_workflow_step WHERE id::TEXT LIKE 'e7100000-0000-4000-a000-%';
  INSERT INTO public.group_workflow_step (
    id, workflow_id, group_id, order_index, label, step_kind, selection_mode,
    merge_strategy, event_rule, auto_task_on_missing_event, target_workflow_id, created_at
  )
  VALUES
    ('e7100000-0000-4000-a000-000000000001', workflow_id, g_s_b5, 0, 'S_B5 entry', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000002', workflow_id, g_s_fraktion, 1, 'S_Fraktion', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000003', workflow_id, g_stadtparlament, 2, 'Stadtparlament', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000004', workflow_id, g_bauausschuss, 3, 'Bauausschuss', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000005', workflow_id, g_stadtparlament, 4, 'Stadtparlament return', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000006', workflow_id, g_bauausschuss, 5, 'Bauausschuss return', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000007', workflow_id, g_stadtparlament, 6, 'Stadtparlament final', 'group_vote', 'default_target_workflow', NULL, NULL, false, NULL, seed_now),
    ('e7100000-0000-4000-a000-000000000008', workflow_id, g_stadtverwaltung, 7, 'Stadtverwaltung', 'workflow_handoff', 'default_target_workflow', NULL, NULL, false, NULL, seed_now);
END $$;
