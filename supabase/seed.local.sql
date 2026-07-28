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
    'online',
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
      'final',
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
    purpose,
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
      'closing',
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
      'final',
      'closing',
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
      'closing',
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

  INSERT INTO public.indicative_voter_participation (id, vote_id, user_id, created_at)
  VALUES
    ('d5300000-0000-4000-a000-000000000001', urgent_vote_id, user_mina_id, seed_now - INTERVAL '12 minutes'),
    ('d5300000-0000-4000-a000-000000000002', urgent_vote_id, user_omar_id, seed_now - INTERVAL '10 minutes'),
    ('d5300000-0000-4000-a000-000000000003', urgent_vote_id, user_leah_id, seed_now - INTERVAL '8 minutes'),
    ('d5300000-0000-4000-a000-000000000004', urgent_vote_id, user_jonas_id, seed_now - INTERVAL '6 minutes'),
    ('d5300000-0000-4000-a000-000000000005', final_vote_id, user_mina_id, seed_now - INTERVAL '42 minutes'),
    ('d5300000-0000-4000-a000-000000000006', final_vote_id, user_omar_id, seed_now - INTERVAL '40 minutes'),
    ('d5300000-0000-4000-a000-000000000007', final_vote_id, user_leah_id, seed_now - INTERVAL '38 minutes'),
    ('d5300000-0000-4000-a000-000000000008', final_vote_id, user_jonas_id, seed_now - INTERVAL '36 minutes'),
    ('d5300000-0000-4000-a000-000000000009', closed_vote_id, demo_user_id, seed_now - INTERVAL '70 minutes'),
    ('d5300000-0000-4000-a000-000000000010', closed_vote_id, user_mina_id, seed_now - INTERVAL '68 minutes'),
    ('d5300000-0000-4000-a000-000000000011', closed_vote_id, user_omar_id, seed_now - INTERVAL '66 minutes'),
    ('d5300000-0000-4000-a000-000000000012', closed_vote_id, user_leah_id, seed_now - INTERVAL '64 minutes');

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
    ('d6200000-0000-4000-a000-000000000006', closed_election_id, demo_user_id, seed_now),
    ('d6200000-0000-4000-a000-000000000007', closed_election_id, user_mina_id, seed_now),
    ('d6200000-0000-4000-a000-000000000008', closed_election_id, user_omar_id, seed_now),
    ('d6200000-0000-4000-a000-000000000009', closed_election_id, user_leah_id, seed_now),
    ('d6200000-0000-4000-a000-000000000010', closed_election_id, user_jonas_id, seed_now);

  INSERT INTO public.indicative_elector_participation (id, election_id, user_id, created_at)
  VALUES
    ('d6300000-0000-4000-a000-000000000001', live_election_id, user_mina_id, seed_now - INTERVAL '17 minutes'),
    ('d6300000-0000-4000-a000-000000000002', live_election_id, user_omar_id, seed_now - INTERVAL '16 minutes'),
    ('d6300000-0000-4000-a000-000000000003', live_election_id, user_leah_id, seed_now - INTERVAL '15 minutes'),
    ('d6300000-0000-4000-a000-000000000004', live_election_id, user_jonas_id, seed_now - INTERVAL '14 minutes'),
    ('d6300000-0000-4000-a000-000000000005', closed_election_id, demo_user_id, seed_now - INTERVAL '90 minutes'),
    ('d6300000-0000-4000-a000-000000000006', closed_election_id, user_mina_id, seed_now - INTERVAL '88 minutes'),
    ('d6300000-0000-4000-a000-000000000007', closed_election_id, user_omar_id, seed_now - INTERVAL '86 minutes');

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
    id, name, visibility, member_count, signed_up_member_count, subscriber_count, event_count, amendment_count,
    document_count, group_type, has_hierarchy_children, has_sibling_connections,
    connected_group_id, primary_sibling_membership_mode, sibling_membership_mode,
    owner_id, created_at, updated_at
  )
  SELECT
    id, name, 'public', member_count, member_count, 0, 0, 0, 0, group_type, has_hierarchy_children,
    has_sibling_connections, connected_group_id, primary_sibling_membership_mode,
    sibling_membership_mode, owner_id, seed_now, seed_now
  FROM acceptance_group_plan
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      member_count = EXCLUDED.member_count,
      signed_up_member_count = EXCLUDED.signed_up_member_count,
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
      'online',
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
      'online',
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
      attendance_mode = EXCLUDED.attendance_mode,
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

-- =============================================================================
-- Deterministic B/H/K fixture
-- Local logins:
--   Tobias Hassebrock / test1@gmail.com / 123456
--   Vidhisha Marak / test2@gmail.com / 123456
--   John Shaw / test3@gmail.com / 123456
--   Denis Doe / test4@gmail.com / 123456
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
DECLARE
  seed_now TIMESTAMPTZ := clock_timestamp();

  u_tobias UUID := 'f1000000-0000-4000-a000-000000000001';
  u_vidhisha UUID := 'f1000000-0000-4000-a000-000000000002';
  u_john UUID := 'f1000000-0000-4000-a000-000000000003';
  u_denis UUID := 'f1000000-0000-4000-a000-000000000004';

  g_b1 UUID := 'f2000000-0000-4000-a000-000000000001';
  g_b2 UUID := 'f2000000-0000-4000-a000-000000000002';
  g_h1 UUID := 'f2000000-0000-4000-a000-000000000003';
  g_h2 UUID := 'f2000000-0000-4000-a000-000000000004';
  g_k1 UUID := 'f2000000-0000-4000-a000-000000000005';

  r_b1_member UUID := 'f2100000-0000-4000-a000-000000000001';
  r_b2_member UUID := 'f2100000-0000-4000-a000-000000000002';
  r_h1_member UUID := 'f2100000-0000-4000-a000-000000000003';
  r_h2_member UUID := 'f2100000-0000-4000-a000-000000000004';
  r_k1_member UUID := 'f2100000-0000-4000-a000-000000000005';

  gm_b1_tobias UUID := 'f2200000-0000-4000-a000-000000000001';
  gm_b1_vidhisha UUID := 'f2200000-0000-4000-a000-000000000002';
  gm_b2_john UUID := 'f2200000-0000-4000-a000-000000000003';
  gm_b2_denis UUID := 'f2200000-0000-4000-a000-000000000004';
  gm_h1_tobias UUID := 'f2200000-0000-4000-a000-000000000005';
  gm_h1_vidhisha UUID := 'f2200000-0000-4000-a000-000000000006';
  gm_h2_john UUID := 'f2200000-0000-4000-a000-000000000007';
  gm_h2_denis UUID := 'f2200000-0000-4000-a000-000000000008';
  gm_k1_tobias UUID := 'f2200000-0000-4000-a000-000000000009';
  gm_k1_vidhisha UUID := 'f2200000-0000-4000-a000-000000000010';
  gm_k1_john UUID := 'f2200000-0000-4000-a000-000000000011';
  gm_k1_denis UUID := 'f2200000-0000-4000-a000-000000000012';

  c_b1_h1 UUID := 'f2400000-0000-4000-a000-000000000001';
  c_b2_h2 UUID := 'f2400000-0000-4000-a000-000000000002';
  c_h1_k1 UUID := 'f2400000-0000-4000-a000-000000000003';
  c_h2_k1 UUID := 'f2400000-0000-4000-a000-000000000004';

  e_eb1 UUID := 'f4000000-0000-4000-a000-000000000001';
  e_eb2 UUID := 'f4000000-0000-4000-a000-000000000002';
  e_eh1 UUID := 'f4000000-0000-4000-a000-000000000003';
  e_eh2 UUID := 'f4000000-0000-4000-a000-000000000004';
  e_ek1 UUID := 'f4000000-0000-4000-a000-000000000005';

  a_a1 UUID := 'f5000000-0000-4000-a000-000000000001';
  d_a1 UUID := 'f5000000-0000-4000-a000-000000000002';
  d_a1_branch UUID := 'f5000000-0000-4000-a000-000000000003';
  dv_a1_initial UUID := 'f5000000-0000-4000-a000-000000000004';
  a_a2 UUID := 'f5000000-0000-4000-a000-000000000005';
  d_a2 UUID := 'f5000000-0000-4000-a000-000000000006';
  a_a3 UUID := 'f5000000-0000-4000-a000-000000000007';
  d_a3 UUID := 'f5000000-0000-4000-a000-000000000008';
  r_a1_author UUID := 'f5100000-0000-4000-a000-000000000001';
  r_a1_collaborator UUID := 'f5100000-0000-4000-a000-000000000002';
  r_a2_author UUID := 'f5100000-0000-4000-a000-000000000003';
  r_a2_collaborator UUID := 'f5100000-0000-4000-a000-000000000004';
  r_a3_author UUID := 'f5100000-0000-4000-a000-000000000005';
  r_a3_collaborator UUID := 'f5100000-0000-4000-a000-000000000006';
  pr_a1 UUID := 'f5400000-0000-4000-a000-000000000001';
  b_a1_main UUID := 'f5400000-0000-4000-a000-000000000002';
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS bhk_user_plan (
    seq INTEGER,
    id UUID,
    email TEXT,
    handle TEXT,
    first_name TEXT,
    last_name TEXT
  ) ON COMMIT DROP;
  TRUNCATE bhk_user_plan;

  INSERT INTO bhk_user_plan VALUES
    (1, u_tobias, 'test1@gmail.com', 'tobias-hassebrock', 'Tobias', 'Hassebrock'),
    (2, u_vidhisha, 'test2@gmail.com', 'vidhisha-marak', 'Vidhisha', 'Marak'),
    (3, u_john, 'test3@gmail.com', 'john-shaw', 'John', 'Shaw'),
    (4, u_denis, 'test4@gmail.com', 'denis-doe', 'Denis', 'Doe');

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
  SELECT
    '00000000-0000-0000-0000-000000000000',
    id,
    'authenticated',
    'authenticated',
    email,
    crypt('123456', gen_salt('bf')),
    seed_now,
    seed_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', first_name, 'last_name', last_name, 'handle', handle),
    seed_now,
    seed_now,
    '',
    '',
    '',
    ''
  FROM bhk_user_plan
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
  SELECT
    id,
    id,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
    'email',
    email,
    seed_now,
    seed_now,
    seed_now
  FROM bhk_user_plan
  ON CONFLICT DO NOTHING;

  INSERT INTO public."user" (
    id,
    email,
    handle,
    first_name,
    last_name,
    visibility,
    subscriber_count,
    amendment_count,
    group_count,
    created_at,
    updated_at
  )
  SELECT
    id,
    email,
    handle,
    first_name,
    last_name,
    'public',
    0,
    CASE WHEN id = u_tobias THEN 3 ELSE 0 END,
    CASE WHEN id IN (u_tobias, u_vidhisha) THEN 3 ELSE 2 END,
    seed_now,
    seed_now
  FROM bhk_user_plan
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    handle = EXCLUDED.handle,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    visibility = EXCLUDED.visibility,
    amendment_count = EXCLUDED.amendment_count,
    group_count = EXCLUDED.group_count,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.notification_setting (user_id)
  SELECT id FROM bhk_user_plan
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preference (user_id)
  SELECT id FROM bhk_user_plan
  ON CONFLICT (user_id) DO NOTHING;

  CREATE TEMP TABLE IF NOT EXISTS bhk_group_plan (
    seq INTEGER,
    id UUID,
    name TEXT,
    group_type TEXT,
    member_count INTEGER,
    has_hierarchy_children BOOLEAN,
    owner_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_group_plan;

  INSERT INTO bhk_group_plan VALUES
    (1, g_b1, 'B1', 'base', 2, false, u_tobias),
    (2, g_b2, 'B2', 'base', 2, false, u_john),
    (3, g_h1, 'H1', 'hierarchical', 2, true, u_tobias),
    (4, g_h2, 'H2', 'hierarchical', 2, true, u_john),
    (5, g_k1, 'K1', 'hierarchical', 4, true, u_tobias);

  INSERT INTO public."group" (
    id,
    name,
    description,
    visibility,
    member_count,
    signed_up_member_count,
    subscriber_count,
    event_count,
    amendment_count,
    document_count,
    group_type,
    has_hierarchy_children,
    has_sibling_connections,
    owner_id,
    created_at,
    updated_at
  )
  SELECT
    id,
    name,
    jsonb_build_object('plain', name || ' deterministic seed fixture group.'),
    'public',
    member_count,
    member_count,
    0,
    1,
    CASE WHEN id = g_k1 THEN 3 ELSE 0 END,
    0,
    group_type,
    has_hierarchy_children,
    false,
    owner_id,
    seed_now,
    seed_now
  FROM bhk_group_plan
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    visibility = EXCLUDED.visibility,
    member_count = EXCLUDED.member_count,
    signed_up_member_count = EXCLUDED.signed_up_member_count,
    event_count = EXCLUDED.event_count,
    amendment_count = EXCLUDED.amendment_count,
    group_type = EXCLUDED.group_type,
    has_hierarchy_children = EXCLUDED.has_hierarchy_children,
    has_sibling_connections = EXCLUDED.has_sibling_connections,
    owner_id = EXCLUDED.owner_id,
    updated_at = EXCLUDED.updated_at;

  CREATE TEMP TABLE IF NOT EXISTS bhk_group_role_plan (
    seq INTEGER,
    id UUID,
    group_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_group_role_plan;

  INSERT INTO bhk_group_role_plan VALUES
    (1, r_b1_member, g_b1),
    (2, r_b2_member, g_b2),
    (3, r_h1_member, g_h1),
    (4, r_h2_member, g_h2),
    (5, r_k1_member, g_k1);

  INSERT INTO public.role (
    id,
    name,
    description,
    scope,
    group_id,
    assignment_mode,
    visibility,
    default_request_role,
    default_invite_role,
    assignee_kind,
    sort_order,
    created_at
  )
  SELECT
    id,
    'Member',
    'Default member role for the deterministic B/H/K fixture.',
    'group',
    group_id,
    'assigned',
    'public',
    true,
    true,
    'member',
    1,
    seed_now
  FROM bhk_group_role_plan
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    group_id = EXCLUDED.group_id,
    assignment_mode = EXCLUDED.assignment_mode,
    visibility = EXCLUDED.visibility,
    default_request_role = EXCLUDED.default_request_role,
    default_invite_role = EXCLUDED.default_invite_role,
    assignee_kind = EXCLUDED.assignee_kind,
    sort_order = EXCLUDED.sort_order;

  CREATE TEMP TABLE IF NOT EXISTS bhk_group_permission_plan (
    seq INTEGER,
    resource TEXT,
    action TEXT
  ) ON COMMIT DROP;
  TRUNCATE bhk_group_permission_plan;

  INSERT INTO bhk_group_permission_plan VALUES
    (1, 'groups', 'view'),
    (5, 'amendments', 'create'),
    (7, 'messages', 'manage');

  INSERT INTO public.action_right (
    id,
    resource,
    action,
    role_id,
    group_id,
    created_at
  )
  SELECT
    ('f2110000-0000-4000-a000-' || lpad(((grp.seq - 1) * 7 + perm.seq)::text, 12, '0'))::UUID,
    perm.resource,
    perm.action,
    grp.id,
    grp.group_id,
    seed_now
  FROM bhk_group_role_plan AS grp
  CROSS JOIN bhk_group_permission_plan AS perm
  ON CONFLICT (id) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    role_id = EXCLUDED.role_id,
    group_id = EXCLUDED.group_id;

  CREATE TEMP TABLE IF NOT EXISTS bhk_connection_plan (
    seq INTEGER,
    id UUID,
    child_group_id UUID,
    parent_group_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_connection_plan;

  INSERT INTO bhk_connection_plan VALUES
    (1, c_b1_h1, g_b1, g_h1),
    (2, c_b2_h2, g_b2, g_h2),
    (3, c_h1_k1, g_h1, g_k1),
    (4, c_h2_k1, g_h2, g_k1);

  INSERT INTO public.group_connection (
    id,
    group_a_id,
    group_b_id,
    connection_type,
    from_group_id,
    to_group_id,
    connection_kind,
    parent_group_id,
    child_group_id,
    status,
    created_by_id,
    created_at,
    updated_at
  )
  SELECT
    id,
    LEAST(child_group_id, parent_group_id),
    GREATEST(child_group_id, parent_group_id),
    'hierarchy',
    child_group_id,
    parent_group_id,
    'hierarchy',
    parent_group_id,
    child_group_id,
    'active',
    u_tobias,
    seed_now,
    seed_now
  FROM bhk_connection_plan
  ON CONFLICT (id) DO UPDATE
  SET
    group_a_id = EXCLUDED.group_a_id,
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
    id,
    connection_id,
    right_key,
    holder_group_id,
    scope_group_id,
    status,
    initiator_group_id,
    created_at,
    updated_at
  )
  SELECT
    ('f2500000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    id,
    'amendmentRight',
    child_group_id,
    parent_group_id,
    'active',
    child_group_id,
    seed_now,
    seed_now
  FROM bhk_connection_plan
  ON CONFLICT (id) DO UPDATE
  SET
    connection_id = EXCLUDED.connection_id,
    right_key = EXCLUDED.right_key,
    holder_group_id = EXCLUDED.holder_group_id,
    scope_group_id = EXCLUDED.scope_group_id,
    status = EXCLUDED.status,
    initiator_group_id = EXCLUDED.initiator_group_id,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM public.group_effective_right WHERE id::TEXT LIKE 'f2510000-0000-4000-a000-%';
  INSERT INTO public.group_effective_right (
    id,
    holder_group_id,
    scope_group_id,
    right_key,
    source_connection_id,
    source_grant_id,
    status,
    created_at,
    updated_at
  )
  SELECT
    ('f2510000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    child_group_id,
    parent_group_id,
    'amendmentRight',
    id,
    ('f2500000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    'active',
    seed_now,
    seed_now
  FROM bhk_connection_plan;

  CREATE TEMP TABLE IF NOT EXISTS bhk_hierarchy_path_plan (
    seq INTEGER,
    ancestor_group_id UUID,
    descendant_group_id UUID,
    direct_child_group_id UUID,
    base_group_id UUID,
    depth INTEGER,
    path_group_ids UUID[],
    connection_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_hierarchy_path_plan;

  INSERT INTO bhk_hierarchy_path_plan VALUES
    (1, g_h1, g_b1, g_b1, g_b1, 1, ARRAY[g_b1, g_h1]::UUID[], c_b1_h1),
    (2, g_h2, g_b2, g_b2, g_b2, 1, ARRAY[g_b2, g_h2]::UUID[], c_b2_h2),
    (3, g_k1, g_h1, g_h1, g_h1, 1, ARRAY[g_h1, g_k1]::UUID[], c_h1_k1),
    (4, g_k1, g_h2, g_h2, g_h2, 1, ARRAY[g_h2, g_k1]::UUID[], c_h2_k1),
    (5, g_k1, g_b1, g_h1, g_b1, 2, ARRAY[g_b1, g_h1, g_k1]::UUID[], c_h1_k1),
    (6, g_k1, g_b2, g_h2, g_b2, 2, ARRAY[g_b2, g_h2, g_k1]::UUID[], c_h2_k1);

  DELETE FROM public.group_hierarchy_path WHERE id::TEXT LIKE 'f2520000-0000-4000-a000-%';
  INSERT INTO public.group_hierarchy_path (
    id,
    ancestor_group_id,
    descendant_group_id,
    direct_child_group_id,
    base_group_id,
    depth,
    path_group_ids,
    status,
    connection_id,
    created_at,
    updated_at
  )
  SELECT
    ('f2520000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
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
  FROM bhk_hierarchy_path_plan
  ON CONFLICT DO NOTHING;

  CREATE TEMP TABLE IF NOT EXISTS bhk_membership_plan (
    seq INTEGER,
    id UUID,
    group_id UUID,
    user_id UUID,
    status TEXT,
    source TEXT,
    source_group_id UUID,
    origin_kind TEXT,
    connection_id UUID,
    part_group_id UUID,
    base_group_id UUID,
    source_membership_id UUID,
    path_group_ids UUID[],
    depth INTEGER,
    is_auto_managed BOOLEAN
  ) ON COMMIT DROP;
  TRUNCATE bhk_membership_plan;

  INSERT INTO bhk_membership_plan VALUES
    (1, gm_b1_tobias, g_b1, u_tobias, 'active', 'direct', NULL, 'direct', NULL, g_b1, g_b1, gm_b1_tobias, ARRAY[g_b1]::UUID[], 0, false),
    (2, gm_b1_vidhisha, g_b1, u_vidhisha, 'active', 'direct', NULL, 'direct', NULL, g_b1, g_b1, gm_b1_vidhisha, ARRAY[g_b1]::UUID[], 0, false),
    (3, gm_b2_john, g_b2, u_john, 'active', 'direct', NULL, 'direct', NULL, g_b2, g_b2, gm_b2_john, ARRAY[g_b2]::UUID[], 0, false),
    (4, gm_b2_denis, g_b2, u_denis, 'active', 'direct', NULL, 'direct', NULL, g_b2, g_b2, gm_b2_denis, ARRAY[g_b2]::UUID[], 0, false),
    (5, gm_h1_tobias, g_h1, u_tobias, 'active', 'derived', g_b1, 'hierarchy', c_b1_h1, g_b1, g_b1, gm_b1_tobias, ARRAY[g_b1, g_h1]::UUID[], 1, true),
    (6, gm_h1_vidhisha, g_h1, u_vidhisha, 'active', 'derived', g_b1, 'hierarchy', c_b1_h1, g_b1, g_b1, gm_b1_vidhisha, ARRAY[g_b1, g_h1]::UUID[], 1, true),
    (7, gm_h2_john, g_h2, u_john, 'active', 'derived', g_b2, 'hierarchy', c_b2_h2, g_b2, g_b2, gm_b2_john, ARRAY[g_b2, g_h2]::UUID[], 1, true),
    (8, gm_h2_denis, g_h2, u_denis, 'active', 'derived', g_b2, 'hierarchy', c_b2_h2, g_b2, g_b2, gm_b2_denis, ARRAY[g_b2, g_h2]::UUID[], 1, true),
    (9, gm_k1_tobias, g_k1, u_tobias, 'active', 'derived', g_b1, 'hierarchy', c_h1_k1, g_h1, g_b1, gm_b1_tobias, ARRAY[g_b1, g_h1, g_k1]::UUID[], 2, true),
    (10, gm_k1_vidhisha, g_k1, u_vidhisha, 'active', 'derived', g_b1, 'hierarchy', c_h1_k1, g_h1, g_b1, gm_b1_vidhisha, ARRAY[g_b1, g_h1, g_k1]::UUID[], 2, true),
    (11, gm_k1_john, g_k1, u_john, 'active', 'derived', g_b2, 'hierarchy', c_h2_k1, g_h2, g_b2, gm_b2_john, ARRAY[g_b2, g_h2, g_k1]::UUID[], 2, true),
    (12, gm_k1_denis, g_k1, u_denis, 'active', 'derived', g_b2, 'hierarchy', c_h2_k1, g_h2, g_b2, gm_b2_denis, ARRAY[g_b2, g_h2, g_k1]::UUID[], 2, true);

  INSERT INTO public.group_membership (
    id,
    group_id,
    user_id,
    status,
    visibility,
    source,
    source_group_id,
    origin_kind,
    connection_id,
    membership_rule_id,
    part_group_id,
    base_group_id,
    is_auto_managed,
    created_at
  )
  SELECT
    id,
    group_id,
    user_id,
    status,
    'public',
    source,
    source_group_id,
    origin_kind,
    connection_id,
    NULL,
    part_group_id,
    base_group_id,
    is_auto_managed,
    seed_now
  FROM bhk_membership_plan
  ON CONFLICT (user_id, group_id) DO UPDATE
  SET
    id = EXCLUDED.id,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility,
    source = EXCLUDED.source,
    source_group_id = EXCLUDED.source_group_id,
    origin_kind = EXCLUDED.origin_kind,
    connection_id = EXCLUDED.connection_id,
    membership_rule_id = EXCLUDED.membership_rule_id,
    part_group_id = EXCLUDED.part_group_id,
    base_group_id = EXCLUDED.base_group_id,
    is_auto_managed = EXCLUDED.is_auto_managed;

  DELETE FROM public.group_membership_origin WHERE id::TEXT LIKE 'f2210000-0000-4000-a000-%';
  INSERT INTO public.group_membership_origin (
    id,
    group_membership_id,
    origin_kind,
    source_group_id,
    source_membership_id,
    connection_id,
    membership_rule_id,
    source_role_id,
    part_group_id,
    base_group_id,
    depth,
    path_group_ids,
    created_at
  )
  SELECT
    ('f2210000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    id,
    origin_kind,
    COALESCE(source_group_id, group_id),
    source_membership_id,
    connection_id,
    NULL,
    NULL,
    part_group_id,
    base_group_id,
    depth,
    path_group_ids,
    seed_now
  FROM bhk_membership_plan;

  INSERT INTO public.group_membership_role (
    id,
    group_membership_id,
    role_id,
    assigned_at,
    assigned_by_id,
    created_at
  )
  SELECT
    ('f2300000-0000-4000-a000-' || lpad(m.seq::text, 12, '0'))::UUID,
    m.id,
    r.id,
    seed_now,
    u_tobias,
    seed_now
  FROM bhk_membership_plan AS m
  JOIN bhk_group_role_plan AS r ON r.group_id = m.group_id
  ON CONFLICT (group_membership_id, role_id) DO UPDATE
  SET
    assigned_at = EXCLUDED.assigned_at,
    assigned_by_id = EXCLUDED.assigned_by_id;

  DELETE FROM public.group_membership_exclusivity_lock WHERE id::TEXT LIKE 'f2530000-0000-4000-a000-%';
  INSERT INTO public.group_membership_exclusivity_lock (
    id,
    user_id,
    hierarchy_group_id,
    source_group_id,
    group_membership_id,
    status,
    created_at,
    updated_at
  )
  VALUES
    ('f2530000-0000-4000-a000-000000000001', u_tobias, g_h1, g_b1, gm_b1_tobias, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000002', u_vidhisha, g_h1, g_b1, gm_b1_vidhisha, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000003', u_john, g_h2, g_b2, gm_b2_john, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000004', u_denis, g_h2, g_b2, gm_b2_denis, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000005', u_tobias, g_k1, g_b1, gm_b1_tobias, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000006', u_vidhisha, g_k1, g_b1, gm_b1_vidhisha, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000007', u_john, g_k1, g_b2, gm_b2_john, 'active', seed_now, seed_now),
    ('f2530000-0000-4000-a000-000000000008', u_denis, g_k1, g_b2, gm_b2_denis, 'active', seed_now, seed_now)
  ON CONFLICT DO NOTHING;

  CREATE TEMP TABLE IF NOT EXISTS bhk_event_plan (
    seq INTEGER,
    id UUID,
    title TEXT,
    group_id UUID,
    participant_count INTEGER
  ) ON COMMIT DROP;
  TRUNCATE bhk_event_plan;

  INSERT INTO bhk_event_plan VALUES
    (1, e_eb1, 'EB1', g_b1, 2),
    (2, e_eb2, 'EB2', g_b2, 2),
    (3, e_eh1, 'EH1', g_h1, 2),
    (4, e_eh2, 'EH2', g_h2, 2),
    (5, e_ek1, 'EK1', g_k1, 4);

  INSERT INTO public.event (
    id,
    title,
    description,
    status,
    event_type,
    attendance_mode,
    visibility,
    start_date,
    end_date,
    timezone,
    participant_count,
    group_id,
    creator_id,
    created_at,
    updated_at
  )
  SELECT
    id,
    title,
    jsonb_build_object('plain', title || ' deterministic seed general assembly.'),
    'scheduled',
    'general_assembly',
    'online',
    'public',
    seed_now + (seq || ' days')::INTERVAL,
    seed_now + (seq || ' days')::INTERVAL + INTERVAL '2 hours',
    'Europe/Berlin',
    participant_count,
    group_id,
    u_tobias,
    seed_now,
    seed_now
  FROM bhk_event_plan
  ON CONFLICT (id) DO UPDATE
  SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    event_type = EXCLUDED.event_type,
    attendance_mode = EXCLUDED.attendance_mode,
    visibility = EXCLUDED.visibility,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    timezone = EXCLUDED.timezone,
    participant_count = EXCLUDED.participant_count,
    group_id = EXCLUDED.group_id,
    creator_id = EXCLUDED.creator_id,
    updated_at = EXCLUDED.updated_at;

  CREATE TEMP TABLE IF NOT EXISTS bhk_event_role_plan (
    seq INTEGER,
    id UUID,
    event_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_event_role_plan;

  INSERT INTO bhk_event_role_plan
  SELECT
    seq,
    ('f4100000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    id
  FROM bhk_event_plan;

  INSERT INTO public.role (
    id,
    name,
    description,
    scope,
    event_id,
    assignment_mode,
    visibility,
    default_request_role,
    default_invite_role,
    assignee_kind,
    sort_order,
    created_at
  )
  SELECT
    id,
    'Organizer',
    'Event organizer with full permissions for the deterministic B/H/K fixture.',
    'event',
    event_id,
    'assigned',
    'public',
    false,
    false,
    'member',
    1,
    seed_now
  FROM bhk_event_role_plan
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    event_id = EXCLUDED.event_id,
    assignment_mode = EXCLUDED.assignment_mode,
    visibility = EXCLUDED.visibility,
    default_request_role = EXCLUDED.default_request_role,
    default_invite_role = EXCLUDED.default_invite_role,
    assignee_kind = EXCLUDED.assignee_kind,
    sort_order = EXCLUDED.sort_order;

  CREATE TEMP TABLE IF NOT EXISTS bhk_event_permission_plan (
    seq INTEGER,
    resource TEXT,
    action TEXT
  ) ON COMMIT DROP;
  TRUNCATE bhk_event_permission_plan;

  INSERT INTO bhk_event_permission_plan VALUES
    (1, 'events', 'view'),
    (2, 'events', 'update'),
    (3, 'events', 'delete'),
    (4, 'events', 'manage'),
    (5, 'events', 'manage_participants'),
    (6, 'events', 'manage_speakers'),
    (7, 'events', 'manage_votes'),
    (8, 'events', 'speak'),
    (9, 'events', 'active_voting'),
    (10, 'events', 'passive_voting'),
    (12, 'agendaItems', 'create'),
    (13, 'agendaItems', 'update'),
    (14, 'agendaItems', 'delete'),
    (15, 'agendaItems', 'manage'),
    (16, 'notifications', 'manageNotifications'),
    (17, 'notifications', 'viewNotifications');

  INSERT INTO public.action_right (
    id,
    resource,
    action,
    role_id,
    event_id,
    created_at
  )
  SELECT
    ('f4110000-0000-4000-a000-' || lpad(((role.seq - 1) * 17 + perm.seq)::text, 12, '0'))::UUID,
    perm.resource,
    perm.action,
    role.id,
    role.event_id,
    seed_now
  FROM bhk_event_role_plan AS role
  CROSS JOIN bhk_event_permission_plan AS perm
  ON CONFLICT (id) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    role_id = EXCLUDED.role_id,
    event_id = EXCLUDED.event_id;

  CREATE TEMP TABLE IF NOT EXISTS bhk_event_participant_plan (
    seq INTEGER,
    event_id UUID,
    user_id UUID,
    group_id UUID
  ) ON COMMIT DROP;
  TRUNCATE bhk_event_participant_plan;

  INSERT INTO bhk_event_participant_plan VALUES
    (1, e_eb1, u_tobias, g_b1),
    (2, e_eb1, u_vidhisha, g_b1),
    (3, e_eb2, u_john, g_b2),
    (4, e_eb2, u_denis, g_b2),
    (5, e_eh1, u_tobias, g_h1),
    (6, e_eh1, u_vidhisha, g_h1),
    (7, e_eh2, u_john, g_h2),
    (8, e_eh2, u_denis, g_h2),
    (9, e_ek1, u_tobias, g_k1),
    (10, e_ek1, u_vidhisha, g_k1),
    (11, e_ek1, u_john, g_k1),
    (12, e_ek1, u_denis, g_k1);

  INSERT INTO public.event_participant (
    id,
    event_id,
    user_id,
    group_id,
    status,
    visibility,
    instance_date,
    created_at
  )
  SELECT
    ('f4200000-0000-4000-a000-' || lpad(seq::text, 12, '0'))::UUID,
    event_id,
    user_id,
    group_id,
    'active',
    'public',
    NULL,
    seed_now
  FROM bhk_event_participant_plan
  ON CONFLICT (event_id, user_id) WHERE instance_date IS NULL DO UPDATE
  SET
    id = EXCLUDED.id,
    group_id = EXCLUDED.group_id,
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
  SELECT
    ('f4300000-0000-4000-a000-' || lpad(p.seq::text, 12, '0'))::UUID,
    ('f4200000-0000-4000-a000-' || lpad(p.seq::text, 12, '0'))::UUID,
    r.id,
    seed_now,
    u_tobias,
    seed_now
  FROM bhk_event_participant_plan AS p
  JOIN bhk_event_role_plan AS r ON r.event_id = p.event_id
  ON CONFLICT (event_participant_id, role_id) DO UPDATE
  SET
    assigned_at = EXCLUDED.assigned_at,
    assigned_by_id = EXCLUDED.assigned_by_id;

  DELETE FROM public.event_assembly_scope WHERE id::TEXT LIKE 'f4400000-0000-4000-a000-%';
  INSERT INTO public.event_assembly_scope (
    id,
    event_id,
    host_group_id,
    source_group_id,
    scope_kind,
    participant_mode,
    required_role_id,
    status,
    created_at,
    updated_at
  )
  VALUES
    ('f4400000-0000-4000-a000-000000000001', e_eb1, g_b1, g_b1, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('f4400000-0000-4000-a000-000000000002', e_eb2, g_b2, g_b2, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('f4400000-0000-4000-a000-000000000003', e_eh1, g_h1, g_b1, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('f4400000-0000-4000-a000-000000000004', e_eh2, g_h2, g_b2, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('f4400000-0000-4000-a000-000000000005', e_ek1, g_k1, g_b1, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now),
    ('f4400000-0000-4000-a000-000000000006', e_ek1, g_k1, g_b2, 'general_member_source', 'all_members', NULL, 'active', seed_now, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    event_id = EXCLUDED.event_id,
    host_group_id = EXCLUDED.host_group_id,
    source_group_id = EXCLUDED.source_group_id,
    scope_kind = EXCLUDED.scope_kind,
    participant_mode = EXCLUDED.participant_mode,
    required_role_id = EXCLUDED.required_role_id,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

  -- Keep the amendment fixtures as clean drafts without a preselected target group or process path.
  UPDATE public.amendment
  SET
    group_id = NULL,
    event_id = NULL,
    current_process_run_id = NULL,
    updated_at = seed_now
  WHERE id IN (a_a1, a_a2, a_a3);

  UPDATE public.amendment_process_run
  SET
    active_branch_id = NULL,
    terminal_step_run_id = NULL,
    updated_at = seed_now
  WHERE id = pr_a1;

  DELETE FROM public.amendment_path
  WHERE amendment_id = a_a1
     OR process_run_id = pr_a1;

  DELETE FROM public.amendment_process_branch
  WHERE id = b_a1_main
     OR process_run_id = pr_a1;

  DELETE FROM public.amendment_process_run
  WHERE id = pr_a1
     OR amendment_id = a_a1;

  DELETE FROM public.document_version
  WHERE id = dv_a1_initial;

  DELETE FROM public.document
  WHERE id = d_a1_branch;

  INSERT INTO public.document (
    id,
    amendment_id,
    content,
    editing_mode,
    created_at,
    updated_at
  )
  VALUES
    (
      d_a1,
      a_a1,
      jsonb_build_array(
        jsonb_build_object('type', 'h1', 'children', jsonb_build_array(jsonb_build_object('text', 'A1'))),
        jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', 'Deterministic seed amendment A1.')))
      ),
      'edit',
      seed_now,
      seed_now
    ),
    (
      d_a2,
      a_a2,
      jsonb_build_array(
        jsonb_build_object('type', 'h1', 'children', jsonb_build_array(jsonb_build_object('text', 'A2'))),
        jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', 'Deterministic seed amendment A2.')))
      ),
      'edit',
      seed_now,
      seed_now
    ),
    (
      d_a3,
      a_a3,
      jsonb_build_array(
        jsonb_build_object('type', 'h1', 'children', jsonb_build_array(jsonb_build_object('text', 'A3'))),
        jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', 'Deterministic seed amendment A3.')))
      ),
      'edit',
      seed_now,
      seed_now
    )
  ON CONFLICT (id) DO UPDATE
  SET
    amendment_id = EXCLUDED.amendment_id,
    content = EXCLUDED.content,
    editing_mode = EXCLUDED.editing_mode,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.amendment (
    id,
    code,
    title,
    reason,
    preamble,
    created_by_id,
    group_id,
    document_id,
    visibility,
    collaborator_count,
    created_at,
    updated_at
  )
  VALUES
    (a_a1, 'A1', 'A1', 'Deterministic seed amendment for B1 and B2 authors.', 'A1 fixture preamble.', u_tobias, NULL, d_a1, 'public', 4, seed_now, seed_now),
    (a_a2, 'A2', 'A2', 'Deterministic seed amendment for B1 and B2 authors.', 'A2 fixture preamble.', u_tobias, NULL, d_a2, 'public', 4, seed_now, seed_now),
    (a_a3, 'A3', 'A3', 'Deterministic seed amendment for B1 and B2 authors.', 'A3 fixture preamble.', u_tobias, NULL, d_a3, 'public', 4, seed_now, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    reason = EXCLUDED.reason,
    preamble = EXCLUDED.preamble,
    created_by_id = EXCLUDED.created_by_id,
    group_id = EXCLUDED.group_id,
    event_id = NULL,
    document_id = EXCLUDED.document_id,
    visibility = EXCLUDED.visibility,
    collaborator_count = EXCLUDED.collaborator_count,
    current_process_run_id = NULL,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.role (
    id,
    name,
    description,
    scope,
    amendment_id,
    assignment_mode,
    visibility,
    assignee_kind,
    sort_order,
    created_at
  )
  VALUES
    (r_a1_author, 'Author', 'Full amendment control for A1.', 'amendment', a_a1, 'assigned', 'public', 'member', 1, seed_now),
    (r_a1_collaborator, 'Collaborator', 'Can edit A1.', 'amendment', a_a1, 'assigned', 'public', 'member', 2, seed_now),
    (r_a2_author, 'Author', 'Full amendment control for A2.', 'amendment', a_a2, 'assigned', 'public', 'member', 1, seed_now),
    (r_a2_collaborator, 'Collaborator', 'Can edit A2.', 'amendment', a_a2, 'assigned', 'public', 'member', 2, seed_now),
    (r_a3_author, 'Author', 'Full amendment control for A3.', 'amendment', a_a3, 'assigned', 'public', 'member', 1, seed_now),
    (r_a3_collaborator, 'Collaborator', 'Can edit A3.', 'amendment', a_a3, 'assigned', 'public', 'member', 2, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    amendment_id = EXCLUDED.amendment_id,
    assignment_mode = EXCLUDED.assignment_mode,
    visibility = EXCLUDED.visibility,
    assignee_kind = EXCLUDED.assignee_kind,
    sort_order = EXCLUDED.sort_order;

  CREATE TEMP TABLE IF NOT EXISTS bhk_amendment_permission_plan (
    seq INTEGER,
    resource TEXT,
    action TEXT
  ) ON COMMIT DROP;
  TRUNCATE bhk_amendment_permission_plan;

  INSERT INTO bhk_amendment_permission_plan VALUES
    (1, 'amendments', 'manage'),
    (2, 'amendments', 'view'),
    (4, 'amendments', 'update'),
    (5, 'amendments', 'delete'),
    (6, 'amendments', 'vote'),
    (9, 'documents', 'update'),
    (10, 'threads', 'create'),
    (11, 'threads', 'update'),
    (12, 'threads', 'delete'),
    (16, 'notifications', 'manageNotifications'),
    (17, 'notifications', 'viewNotifications');

  INSERT INTO public.action_right (
    id,
    resource,
    action,
    role_id,
    amendment_id,
    created_at
  )
  SELECT
    ('f5110000-0000-4000-a000-' || lpad((role_plan.id_offset + permission.seq)::text, 12, '0'))::UUID,
    permission.resource,
    permission.action,
    role_plan.role_id,
    role_plan.amendment_id,
    seed_now
  FROM bhk_amendment_permission_plan AS permission
  CROSS JOIN (
    VALUES
      (0, r_a1_author, a_a1),
      (17, r_a2_author, a_a2),
      (34, r_a3_author, a_a3)
  ) AS role_plan(id_offset, role_id, amendment_id)
  ON CONFLICT (id) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    role_id = EXCLUDED.role_id,
    amendment_id = EXCLUDED.amendment_id;

  INSERT INTO public.action_right (
    id,
    resource,
    action,
    role_id,
    amendment_id,
    created_at
  )
  VALUES
    ('f5120000-0000-4000-a000-000000000001', 'amendments', 'view', r_a1_collaborator, a_a1, seed_now),
    ('f5120000-0000-4000-a000-000000000002', 'amendments', 'update', r_a1_collaborator, a_a1, seed_now),
    ('f5120000-0000-4000-a000-000000000003', 'notifications', 'viewNotifications', r_a1_collaborator, a_a1, seed_now),
    ('f5120000-0000-4000-a000-000000000004', 'amendments', 'view', r_a2_collaborator, a_a2, seed_now),
    ('f5120000-0000-4000-a000-000000000005', 'amendments', 'update', r_a2_collaborator, a_a2, seed_now),
    ('f5120000-0000-4000-a000-000000000006', 'notifications', 'viewNotifications', r_a2_collaborator, a_a2, seed_now),
    ('f5120000-0000-4000-a000-000000000007', 'amendments', 'view', r_a3_collaborator, a_a3, seed_now),
    ('f5120000-0000-4000-a000-000000000008', 'amendments', 'update', r_a3_collaborator, a_a3, seed_now),
    ('f5120000-0000-4000-a000-000000000009', 'notifications', 'viewNotifications', r_a3_collaborator, a_a3, seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    role_id = EXCLUDED.role_id,
    amendment_id = EXCLUDED.amendment_id;

  INSERT INTO public.amendment_collaborator (
    id,
    amendment_id,
    user_id,
    role_id,
    status,
    visibility,
    created_at
  )
  VALUES
    ('f5200000-0000-4000-a000-000000000001', a_a1, u_tobias, r_a1_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000002', a_a1, u_vidhisha, r_a1_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000003', a_a1, u_john, r_a1_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000004', a_a1, u_denis, r_a1_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000005', a_a2, u_tobias, r_a2_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000006', a_a2, u_vidhisha, r_a2_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000007', a_a2, u_john, r_a2_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000008', a_a2, u_denis, r_a2_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000009', a_a3, u_tobias, r_a3_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000010', a_a3, u_vidhisha, r_a3_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000011', a_a3, u_john, r_a3_author, 'admin', 'public', seed_now),
    ('f5200000-0000-4000-a000-000000000012', a_a3, u_denis, r_a3_author, 'admin', 'public', seed_now)
  ON CONFLICT (id) DO UPDATE
  SET
    amendment_id = EXCLUDED.amendment_id,
    user_id = EXCLUDED.user_id,
    role_id = EXCLUDED.role_id,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility;

END $$;

-- =============================================================================
-- Local fixture context enrichment
-- Runs after the demo, acceptance, and deterministic test fixtures above.
-- Overwrites display/mock fields and must never be executed against production.
-- =============================================================================
INSERT INTO public.tmp_context_location VALUES
  (1, 'Germany', 'Berlin', '10178', 'Berlin', 'Rathausstrasse', '15', 52.518611, 13.408333, 'Berlin City Hall - Louise Schroeder Hall', 'https://www.openstreetmap.org/?mlat=52.518611&mlon=13.408333#map=17/52.518611/13.408333'),
  (2, 'Germany', 'Hamburg', '20095', 'Hamburg', 'Rathausmarkt', '1', 53.550556, 9.992222, 'Hamburg Rathaus - Phoenix Hall', 'https://www.openstreetmap.org/?mlat=53.550556&mlon=9.992222#map=17/53.550556/9.992222'),
  (3, 'Germany', 'Bavaria', '80331', 'Munich', 'Marienplatz', '8', 48.137222, 11.575556, 'Munich New Town Hall - Committee Room 2', 'https://www.openstreetmap.org/?mlat=48.137222&mlon=11.575556#map=17/48.137222/11.575556'),
  (4, 'Germany', 'North Rhine-Westphalia', '50667', 'Cologne', 'Rathausplatz', '2', 50.938333, 6.959722, 'Cologne Historic Town Hall - Citizens Forum', 'https://www.openstreetmap.org/?mlat=50.938333&mlon=6.959722#map=17/50.938333/6.959722'),
  (5, 'Germany', 'Saxony', '04109', 'Leipzig', 'Martin-Luther-Ring', '4-6', 51.338889, 12.374722, 'Leipzig New Town Hall - Council Chamber', 'https://www.openstreetmap.org/?mlat=51.338889&mlon=12.374722#map=17/51.338889/12.374722'),
  (6, 'Germany', 'Baden-Wuerttemberg', '79098', 'Freiburg im Breisgau', 'Rathausplatz', '2-4', 47.995833, 7.852222, 'Freiburg New Council House - Green Room', 'https://www.openstreetmap.org/?mlat=47.995833&mlon=7.852222#map=17/47.995833/7.852222'),
  (7, 'Germany', 'Hesse', '60311', 'Frankfurt am Main', 'Roemerberg', '23', 50.110556, 8.682222, 'Frankfurt Roemer - Plenary Room', 'https://www.openstreetmap.org/?mlat=50.110556&mlon=8.682222#map=17/50.110556/8.682222'),
  (8, 'Germany', 'Lower Saxony', '30159', 'Hannover', 'Trammplatz', '2', 52.367222, 9.737222, 'Hannover New Town Hall - Mosaic Hall', 'https://www.openstreetmap.org/?mlat=52.367222&mlon=9.737222#map=17/52.367222/9.737222');

INSERT INTO public.tmp_context_user_profile VALUES
  (1, 'Mara', 'Schneider', 'mara-schneider', 'female', 'mobility delegate', 'safer crossings and school streets', 'Neighborhood mobility delegate focused on safer crossings, school streets, and transparent implementation notes.'),
  (2, 'Jonas', 'Keller', 'jonas-keller', 'male', 'budget rapporteur', 'participatory budgeting', 'Budget rapporteur turning resident proposals into readable funding options and vote-ready agenda items.'),
  (3, 'Aylin', 'Demir', 'aylin-demir', 'female', 'housing organizer', 'tenant support and retrofits', 'Housing organizer coordinating tenant clinics, retrofit pilots, and practical mediation formats.'),
  (4, 'Noah', 'Fischer', 'noah-fischer', 'male', 'climate policy lead', 'heat resilience', 'Climate policy lead working on heat shelters, tree canopy data, and resilient public-space planning.'),
  (5, 'Lea', 'Brandt', 'lea-brandt', 'female', 'community facilitator', 'public meetings', 'Community facilitator keeping assemblies clear, inclusive, and anchored in local evidence.'),
  (6, 'Samira', 'Kowalski', 'samira-kowalski', 'diverse', 'digital services steward', 'open data and access', 'Digital services steward helping groups publish open data, accessible forms, and clear audit trails.'),
  (7, 'Oskar', 'Vogel', 'oskar-vogel', 'male', 'parks advocate', 'green corridors', 'Parks advocate focused on maintenance backlogs, green corridors, and practical volunteer coordination.'),
  (8, 'Elena', 'Weiss', 'elena-weiss', 'female', 'youth council liaison', 'youth participation', 'Youth council liaison building simple ways for students and apprentices to shape municipal priorities.'),
  (9, 'Tariq', 'Hansen', 'tariq-hansen', 'male', 'procurement reviewer', 'contract transparency', 'Procurement reviewer translating contract data into public checkpoints and plain-language summaries.'),
  (10, 'Nina', 'Hartmann', 'nina-hartmann', 'female', 'library campaign lead', 'civic learning spaces', 'Library campaign lead organizing pilots for Sunday hours, learning rooms, and neighborhood advice desks.'),
  (11, 'Milan', 'Becker', 'milan-becker', 'male', 'transport planner', 'night bus reliability', 'Transport planner testing service guarantees for late shifts, students, and cultural venues.'),
  (12, 'Hanna', 'Lorenz', 'hanna-lorenz', 'female', 'accessibility auditor', 'barrier-free streets', 'Accessibility auditor mapping curb cuts, tactile paving gaps, and routes to public buildings.');

INSERT INTO public.tmp_context_group_profile VALUES
  (1, 'Riverside Mobility Forum', 'Residents, planners, and local businesses coordinating safer crossings, bus priority, and delivery access near the riverfront.', 'mobility', 'riverside-mobility', 146, 28),
  (2, 'North Quarter Neighborhood Council', 'A district council turning street-level feedback into agenda-ready proposals for safety, parks, and social infrastructure.', 'neighborhood governance', 'north-quarter-council', 233, 42),
  (3, 'Green Budget Working Group', 'A finance working group reviewing climate adaptation requests, grant matches, and implementation milestones.', 'climate budget', 'green-budget', 119, 19),
  (4, 'Public Space Stewardship Committee', 'A committee coordinating maintenance priorities, volunteer days, and design reviews for shared civic spaces.', 'public space', 'public-space-stewards', 88, 16),
  (5, 'Digital Services Assembly', 'An assembly improving open data, multilingual forms, and transparent service metrics for residents.', 'digital services', 'digital-services', 174, 31),
  (6, 'Housing Mediation Board', 'A practical board for tenant support, retrofit sequencing, and negotiated neighborhood housing commitments.', 'housing', 'housing-mediation', 102, 21),
  (7, 'Climate Adaptation Taskforce', 'A taskforce preparing heat-response routes, shade plans, and emergency cooling partnerships.', 'climate resilience', 'climate-adaptation', 197, 34),
  (8, 'Youth Civic Lab', 'A lab where young residents prototype agenda items, surveys, and campaign material for local assemblies.', 'youth participation', 'youth-civic-lab', 76, 18),
  (9, 'Culture and Libraries Roundtable', 'A roundtable aligning libraries, cultural venues, and schools around access, opening hours, and shared programming.', 'culture and libraries', 'culture-libraries', 133, 24),
  (10, 'Open Procurement Review Panel', 'A review panel checking major local contracts against public-benefit goals, data quality, and delivery dates.', 'procurement', 'procurement-review', 61, 14);

INSERT INTO public.tmp_context_event_profile VALUES
  (1, 'Mobility Budget Public Hearing', 'Public hearing on reallocating mobility funds toward safer junctions, night buses, and protected school routes.', 'public_hearing', 'hybrid', 'assembly', 'structured', 180),
  (2, 'Neighborhood Safety Walkthrough', 'On-site walkthrough with residents to document lighting gaps, crossing conflicts, and maintenance issues.', 'site_visit', 'offline', 'working_session', 'lightweight', 45),
  (3, 'Climate Resilience Assembly', 'Assembly for heat-response planning, shade corridors, and cooling-center coordination before summer.', 'general_assembly', 'hybrid', 'assembly', 'structured', 220),
  (4, 'Open Data Sprint', 'Working session to clean contract, mobility, and facility data for public dashboards and amendment evidence.', 'workshop', 'online', 'working_session', 'lightweight', 90),
  (5, 'Housing Retrofit Vote', 'Formal session to decide retrofit sequencing principles and resident support commitments.', 'general_assembly', 'offline', 'assembly', 'structured', 140),
  (6, 'School Streets Workshop', 'Design workshop for temporary car-free school streets, volunteer stewarding, and emergency access.', 'workshop', 'hybrid', 'working_session', 'structured', 120),
  (7, 'Riverfront Design Review', 'Design review for seating, shade, delivery access, and accessible paths along the riverfront.', 'design_review', 'offline', 'committee', 'structured', 80),
  (8, 'Library Hours Consultation', 'Consultation on extended library hours, Sunday pilots, and shared learning-room governance.', 'consultation', 'hybrid', 'assembly', 'lightweight', 160),
  (9, 'Volunteer Dispatch Briefing', 'Operational briefing for volunteer coordinators supporting surveys, assembly check-in, and field observations.', 'briefing', 'online', 'working_session', 'lightweight', 70),
  (10, 'Delegates Coordination Council', 'Coordination session for delegates aligning mandate wording, amendment timelines, and voting logistics.', 'delegate_assembly', 'hybrid', 'assembly', 'structured', 110);

INSERT INTO public.tmp_context_amendment_profile VALUES
  (1, 'MOB', 'Safe Routes to School Pilot', 'Create a six-month pilot for protected school routes around three high-risk intersections, with before-and-after safety reporting.', 'mobility', 'Every child should be able to reach school without navigating avoidable traffic danger.', 'mobility', 'school-streets', 'safety', 18500000),
  (2, 'CLM', 'Heat Shelter Network', 'Open a coordinated network of cooling rooms in libraries, community centers, and sports halls during heat warnings.', 'climate_resilience', 'Rising heat requires visible, reachable, and well-staffed public places for immediate relief.', 'climate', 'heat', 'public-health', 9400000),
  (3, 'DAT', 'Open Contract Data Standard', 'Publish major procurement milestones, suppliers, values, and delivery dates in a reusable public format.', 'transparency', 'Public money is easier to trust when contracts can be inspected without specialist knowledge.', 'open-data', 'procurement', 'transparency', 6200000),
  (4, 'BUS', 'Night Bus Frequency Guarantee', 'Guarantee minimum late-night headways on key routes serving shift workers, students, and cultural venues.', 'transport', 'Reliable night service is core civic infrastructure, not a luxury add-on.', 'transit', 'night-bus', 'access', 24750000),
  (5, 'GRN', 'Community Garden Conversion', 'Convert a vacant municipal lot into a managed community garden with water access and inclusive plot allocation.', 'public_space', 'Unused land can become shared food, shade, and neighborhood learning infrastructure.', 'gardens', 'public-space', 'food', 7800000),
  (6, 'HOU', 'Tenant Retrofit Support Desk', 'Create a support desk helping tenants understand retrofit schedules, temporary relocation options, and rent protections.', 'housing', 'Energy upgrades work better when residents can understand and shape the process.', 'housing', 'retrofit', 'tenants', 5100000),
  (7, 'ACC', 'Accessible Sidewalk Audit', 'Audit priority routes to public buildings for curb cuts, tactile paving, obstruction points, and repair urgency.', 'accessibility', 'A city route is only public when everyone can actually use it.', 'accessibility', 'sidewalks', 'audit', 4300000),
  (8, 'TRE', 'Tree Canopy Participation Plan', 'Let residents propose shade corridors, watering partnerships, and priority blocks for street-tree planting.', 'environment', 'Tree canopy decisions should combine climate data with resident knowledge of daily routes.', 'trees', 'shade', 'participation', 12200000),
  (9, 'LIB', 'Sunday Library Hours Trial', 'Run a twelve-week Sunday opening pilot at two libraries, with usage data and staffing impact review.', 'culture', 'Libraries are civic rooms; access should include people who cannot visit during weekday hours.', 'libraries', 'learning', 'access', 8800000),
  (10, 'WIF', 'Public Wifi in Civic Buildings', 'Provide reliable public wifi and clear signage in town halls, libraries, and selected community centers.', 'digital_access', 'Digital participation starts with dependable access in the places where civic work happens.', 'wifi', 'digital-access', 'services', 6900000);

-- Move user handles through unique staging values before assigning new readable handles.
UPDATE public."user" AS u
SET handle = 'context-seed-staging-' || replace(u.id::TEXT, '-', '')
WHERE COALESCE(u.email, '') <> 'aria-kai-assistants@polity.com';

WITH numbered AS (
  SELECT
    u.id,
    row_number() OVER (ORDER BY u.created_at, u.id) AS rn
  FROM public."user" AS u
  WHERE COALESCE(u.email, '') <> 'aria-kai-assistants@polity.com'
),
profiled AS (
  SELECT
    n.id,
    n.rn,
    p.*,
    l.*
  FROM numbered AS n
  JOIN public.tmp_context_user_profile AS p
    ON p.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_user_profile)) + 1
  JOIN public.tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_location)) + 1
)
UPDATE public."user" AS u
SET
  handle = 'member-' || lpad(p.rn::TEXT, 2, '0') || '-' || p.handle_slug,
  first_name = p.first_name,
  last_name = p.last_name,
  bio = p.bio,
  gender = p.gender,
  about = jsonb_build_object(
    'plain', p.bio,
    'role', p.role_title,
    'focus', p.focus_area,
    'home_base', p.location_name
  ),
  avatar = 'https://api.dicebear.com/8.x/initials/svg?seed=' || p.first_name || '-' || p.last_name,
  x = 'https://x.com/' || p.handle_slug,
  linkedin = 'https://www.linkedin.com/in/' || p.handle_slug,
  website = 'https://polity.local/people/' || p.handle_slug,
  instagram = 'https://www.instagram.com/' || replace(p.handle_slug, '-', '.'),
  country = p.country,
  region = p.region,
  post_code = p.post_code,
  city = p.city,
  street = p.street,
  house_number = p.house_number,
  latitude = p.latitude,
  longitude = p.longitude,
  visibility = 'public',
  subscriber_count = 12 + (p.rn * 3),
  amendment_count = (
    SELECT count(*)::INTEGER
    FROM public.amendment AS a
    WHERE a.created_by_id = u.id
  ),
  group_count = (
    SELECT count(*)::INTEGER
    FROM public.group_membership AS gm
    WHERE gm.user_id = u.id
      AND COALESCE(gm.status, 'active') = 'active'
  ),
  tutorial_step = 4,
  assistant_introduction = true,
  updated_at = now()
FROM profiled AS p
WHERE u.id = p.id;

WITH numbered AS (
  SELECT
    g.id,
    g.group_type,
    row_number() OVER (ORDER BY g.created_at, g.id) AS rn
  FROM public."group" AS g
),
profiled AS (
  SELECT
    n.id,
    n.group_type,
    n.rn,
    gp.*,
    l.*
  FROM numbered AS n
  JOIN public.tmp_context_group_profile AS gp
    ON gp.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_group_profile)) + 1
  JOIN public.tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_location)) + 1
)
UPDATE public."group" AS g
SET
  name = p.name,
  description = jsonb_build_object(
    'plain', p.description_text,
    'focus', p.focus_area,
    'service_area', p.city,
    'group_type', p.group_type
  ),
  email = p.contact_slug || '@polity.local',
  country = p.country,
  region = p.region,
  post_code = p.post_code,
  city = p.city,
  street = p.street,
  house_number = p.house_number,
  latitude = p.latitude,
  longitude = p.longitude,
  image_url = 'https://api.dicebear.com/8.x/shapes/svg?seed=' || p.contact_slug,
  visibility = 'public',
  member_count = GREATEST(
    p.fallback_member_count,
    (
      SELECT count(*)::INTEGER
      FROM public.group_membership AS gm
      WHERE gm.group_id = g.id
        AND COALESCE(gm.status, 'active') = 'active'
    ) + (
      SELECT count(*)::INTEGER
      FROM public.group_offline_membership AS gom
      WHERE gom.group_id = g.id
        AND COALESCE(gom.status, 'active') = 'active'
    )
  ),
  subscriber_count = p.subscriber_count,
  event_count = GREATEST(
    1,
    (
      SELECT count(*)::INTEGER
      FROM public.event AS e
      WHERE e.group_id = g.id
    )
  ),
  amendment_count = (
    SELECT count(*)::INTEGER
    FROM public.amendment AS a
    WHERE a.group_id = g.id
  ),
  document_count = (
    SELECT count(DISTINCT d.id)::INTEGER
    FROM public.document AS d
    JOIN public.amendment AS a
      ON a.id = d.amendment_id
      OR a.document_id = d.id
    WHERE a.group_id = g.id
  ),
  x = 'https://x.com/' || p.contact_slug,
  youtube = 'https://www.youtube.com/@' || p.contact_slug,
  linkedin = 'https://www.linkedin.com/company/' || p.contact_slug,
  website = 'https://polity.local/groups/' || p.contact_slug,
  instagram = 'https://www.instagram.com/' || replace(p.contact_slug, '-', '.'),
  facebook = 'https://www.facebook.com/' || replace(p.contact_slug, '-', '.'),
  updated_at = now()
FROM profiled AS p
WHERE g.id = p.id;

WITH numbered AS (
  SELECT
    e.id,
    row_number() OVER (ORDER BY e.start_date NULLS LAST, e.created_at, e.id) AS rn
  FROM public.event AS e
),
profiled AS (
  SELECT
    n.id,
    n.rn,
    ep.*,
    l.*,
    CASE
      WHEN n.rn % 9 = 0 THEN 'completed'
      WHEN n.rn % 7 = 0 THEN 'live'
      ELSE 'scheduled'
    END AS seeded_status,
    CASE
      WHEN n.rn % 9 = 0 THEN now() - ((n.rn + 2) || ' days')::INTERVAL
      WHEN n.rn % 7 = 0 THEN now() - INTERVAL '30 minutes'
      ELSE now() + ((n.rn + 2) || ' days')::INTERVAL
    END AS seeded_start_date,
    CASE
      WHEN n.rn % 9 = 0 THEN now() - ((n.rn + 2) || ' days')::INTERVAL + INTERVAL '2 hours'
      WHEN n.rn % 7 = 0 THEN now() + INTERVAL '90 minutes'
      ELSE now() + ((n.rn + 2) || ' days')::INTERVAL + INTERVAL '2 hours'
    END AS seeded_end_date
  FROM numbered AS n
  JOIN public.tmp_context_event_profile AS ep
    ON ep.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_event_profile)) + 1
  JOIN public.tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_location)) + 1
)
UPDATE public.event AS e
SET
  title = p.title,
  description = jsonb_build_object(
    'plain', p.description_text,
    'venue', p.location_name,
    'city', p.city
  ),
  status = p.seeded_status,
  event_type = p.event_type,
  attendance_mode = p.attendance_mode,
  location_type = CASE WHEN p.attendance_mode = 'online' THEN 'video' ELSE 'venue' END,
  location_name = p.location_name,
  country = p.country,
  region = p.region,
  post_code = p.post_code,
  city = p.city,
  street = p.street,
  house_number = p.house_number,
  latitude = p.latitude,
  longitude = p.longitude,
  location_url = p.location_url,
  location_coordinates = p.latitude::TEXT || ',' || p.longitude::TEXT,
  visibility = 'public',
  start_date = p.seeded_start_date,
  end_date = p.seeded_end_date,
  timezone = 'Europe/Berlin',
  default_final_vote_duration_seconds = 3600,
  capacity = p.capacity,
  participant_count = GREATEST(
    8,
    (
      SELECT count(*)::INTEGER
      FROM public.event_participant AS participant
      WHERE participant.event_id = e.id
        AND COALESCE(participant.status, 'active') = 'active'
    ) + (
      SELECT count(*)::INTEGER
      FROM public.event_offline_participant AS offline_participant
      WHERE offline_participant.event_id = e.id
    )
  ),
  agenda_management = p.agenda_management,
  meeting_type = p.meeting_type,
  is_bookable = p.rn % 4 = 0,
  max_bookings = CASE WHEN p.rn % 4 = 0 THEN 12 ELSE 1 END,
  x = 'https://x.com/polity_' || lower(replace(p.city, ' ', '_')),
  youtube = 'https://www.youtube.com/@polity-' || lower(replace(p.city, ' ', '-')),
  linkedin = 'https://www.linkedin.com/company/polity-' || lower(replace(p.city, ' ', '-')),
  website = 'https://polity.local/events/context-' || lpad(p.rn::TEXT, 3, '0'),
  stream_url = CASE
    WHEN p.attendance_mode IN ('online', 'hybrid') THEN 'https://meet.polity.local/context-' || lpad(p.rn::TEXT, 3, '0')
    ELSE NULL
  END,
  image_url = 'https://api.dicebear.com/8.x/glass/svg?seed=event-' || p.rn::TEXT,
  amendment_deadline = p.seeded_start_date - INTERVAL '5 days',
  registration_deadline = p.seeded_start_date - INTERVAL '2 days',
  updated_at = now()
FROM profiled AS p
WHERE e.id = p.id;

WITH numbered AS (
  SELECT
    a.id,
    row_number() OVER (ORDER BY a.created_at, a.id) AS rn
  FROM public.amendment AS a
),
profiled AS (
  SELECT
    n.id,
    n.rn,
    ap.*
  FROM numbered AS n
  JOIN public.tmp_context_amendment_profile AS ap
    ON ap.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_amendment_profile)) + 1
)
UPDATE public.amendment AS a
SET
  code = p.code_prefix || '-' || lpad(p.rn::TEXT, 3, '0'),
  title = p.title,
  reason = p.reason,
  category = p.category,
  preamble = p.preamble,
  tags = jsonb_build_array(p.tag_one, p.tag_two, p.tag_three),
  visibility = 'public',
  subscriber_count = 18 + (p.rn * 2),
  upvotes = 5 + (p.rn * 3),
  downvotes = p.rn % 4,
  clone_count = p.rn % 3,
  change_request_count = GREATEST(
    0,
    (
      SELECT count(*)::INTEGER
      FROM public.change_request AS cr
      WHERE cr.amendment_id = a.id
    )
  ),
  internal_cr_voting_close_trigger = 'all_collaborators_voted',
  internal_cr_voting_duration_minutes = 1440,
  internal_cr_resolution_visibility = 'public',
  discussions = jsonb_build_object(
    'summary', 'Context seed discussion space for field notes, committee comments, and resident objections.',
    'primary_location_hint', p.tag_two
  ),
  comment_count = 2 + (p.rn % 5),
  collaborator_count = GREATEST(
    1,
    (
      SELECT count(*)::INTEGER
      FROM public.amendment_collaborator AS collaborator
      WHERE collaborator.amendment_id = a.id
    )
  ),
  image_url = 'https://api.dicebear.com/8.x/shapes/svg?seed=' || lower(p.code_prefix) || '-' || p.rn::TEXT,
  x = 'https://x.com/polity_' || lower(p.code_prefix) || '_' || lpad(p.rn::TEXT, 3, '0'),
  youtube = 'https://www.youtube.com/@polity-amendments',
  linkedin = 'https://www.linkedin.com/company/polity-amendments',
  website = 'https://polity.local/amendments/' || lower(p.code_prefix) || '-' || lpad(p.rn::TEXT, 3, '0'),
  updated_at = now()
FROM profiled AS p
WHERE a.id = p.id;

DELETE FROM public.amendment_city_design
WHERE title LIKE 'Context seed:%';

WITH numbered AS (
  SELECT
    a.id,
    a.created_by_id,
    a.title,
    row_number() OVER (ORDER BY a.created_at, a.id) AS rn
  FROM public.amendment AS a
),
profiled AS (
  SELECT
    n.*,
    ap.category,
    ap.estimated_cost_minor,
    l.*
  FROM numbered AS n
  JOIN public.tmp_context_amendment_profile AS ap
    ON ap.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_amendment_profile)) + 1
  JOIN public.tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM public.tmp_context_location)) + 1
)
INSERT INTO public.amendment_city_design (
  id,
  amendment_id,
  created_by_id,
  title,
  bbox,
  center_lat,
  center_lon,
  osm_snapshot,
  design_state,
  currency,
  estimated_total_cost_minor,
  cost_catalog_version,
  cost_summary,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id,
  p.created_by_id,
  'Context seed: ' || p.title || ' location study',
  jsonb_build_object(
    'south', p.latitude - 0.004,
    'west', p.longitude - 0.006,
    'north', p.latitude + 0.004,
    'east', p.longitude + 0.006
  ),
  p.latitude::NUMERIC,
  p.longitude::NUMERIC,
  jsonb_build_object(
    'source', 'mock_context_seed',
    'location_name', p.location_name,
    'street', p.street,
    'city', p.city,
    'captured_at', now()
  ),
  jsonb_build_object(
    'category', p.category,
    'center', jsonb_build_object('lat', p.latitude, 'lon', p.longitude),
    'interventions', jsonb_build_array(
      jsonb_build_object('kind', 'survey_zone', 'label', 'Resident feedback zone', 'status', 'planned'),
      jsonb_build_object('kind', 'implementation_marker', 'label', p.location_name, 'status', 'draft')
    )
  ),
  'EUR',
  p.estimated_cost_minor,
  'context-seed-2026-06',
  jsonb_build_object(
    'planning_minor', round(p.estimated_cost_minor * 0.18),
    'delivery_minor', round(p.estimated_cost_minor * 0.72),
    'contingency_minor', round(p.estimated_cost_minor * 0.10)
  ),
  now(),
  now()
FROM profiled AS p;

DROP TABLE IF EXISTS
  public.tmp_context_amendment_profile,
  public.tmp_context_event_profile,
  public.tmp_context_group_profile,
  public.tmp_context_user_profile,
  public.tmp_context_location;
