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
