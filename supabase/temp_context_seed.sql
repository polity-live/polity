-- =============================================================================
-- Temporary one-time context seed
--
-- Run manually against a local/dev database after the normal seed has loaded.
-- This file is intentionally not imported by supabase/seed.sql.
-- It overwrites display/mock fields on existing users, groups, events, and
-- amendments, so do not run it against production data.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE TEMP TABLE tmp_context_location (
  seq INTEGER PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  post_code TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  house_number TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  location_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_context_location VALUES
  (1, 'Germany', 'Berlin', '10178', 'Berlin', 'Rathausstrasse', '15', 52.518611, 13.408333, 'Berlin City Hall - Louise Schroeder Hall', 'https://www.openstreetmap.org/?mlat=52.518611&mlon=13.408333#map=17/52.518611/13.408333'),
  (2, 'Germany', 'Hamburg', '20095', 'Hamburg', 'Rathausmarkt', '1', 53.550556, 9.992222, 'Hamburg Rathaus - Phoenix Hall', 'https://www.openstreetmap.org/?mlat=53.550556&mlon=9.992222#map=17/53.550556/9.992222'),
  (3, 'Germany', 'Bavaria', '80331', 'Munich', 'Marienplatz', '8', 48.137222, 11.575556, 'Munich New Town Hall - Committee Room 2', 'https://www.openstreetmap.org/?mlat=48.137222&mlon=11.575556#map=17/48.137222/11.575556'),
  (4, 'Germany', 'North Rhine-Westphalia', '50667', 'Cologne', 'Rathausplatz', '2', 50.938333, 6.959722, 'Cologne Historic Town Hall - Citizens Forum', 'https://www.openstreetmap.org/?mlat=50.938333&mlon=6.959722#map=17/50.938333/6.959722'),
  (5, 'Germany', 'Saxony', '04109', 'Leipzig', 'Martin-Luther-Ring', '4-6', 51.338889, 12.374722, 'Leipzig New Town Hall - Council Chamber', 'https://www.openstreetmap.org/?mlat=51.338889&mlon=12.374722#map=17/51.338889/12.374722'),
  (6, 'Germany', 'Baden-Wuerttemberg', '79098', 'Freiburg im Breisgau', 'Rathausplatz', '2-4', 47.995833, 7.852222, 'Freiburg New Council House - Green Room', 'https://www.openstreetmap.org/?mlat=47.995833&mlon=7.852222#map=17/47.995833/7.852222'),
  (7, 'Germany', 'Hesse', '60311', 'Frankfurt am Main', 'Roemerberg', '23', 50.110556, 8.682222, 'Frankfurt Roemer - Plenary Room', 'https://www.openstreetmap.org/?mlat=50.110556&mlon=8.682222#map=17/50.110556/8.682222'),
  (8, 'Germany', 'Lower Saxony', '30159', 'Hannover', 'Trammplatz', '2', 52.367222, 9.737222, 'Hannover New Town Hall - Mosaic Hall', 'https://www.openstreetmap.org/?mlat=52.367222&mlon=9.737222#map=17/52.367222/9.737222');

CREATE TEMP TABLE tmp_context_user_profile (
  seq INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  handle_slug TEXT NOT NULL,
  gender TEXT NOT NULL,
  role_title TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  bio TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_context_user_profile VALUES
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

CREATE TEMP TABLE tmp_context_group_profile (
  seq INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description_text TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  contact_slug TEXT NOT NULL,
  subscriber_count INTEGER NOT NULL,
  fallback_member_count INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_context_group_profile VALUES
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

CREATE TEMP TABLE tmp_context_event_profile (
  seq INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description_text TEXT NOT NULL,
  event_type TEXT NOT NULL,
  attendance_mode TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  agenda_management TEXT NOT NULL,
  capacity INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_context_event_profile VALUES
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

CREATE TEMP TABLE tmp_context_amendment_profile (
  seq INTEGER PRIMARY KEY,
  code_prefix TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL,
  preamble TEXT NOT NULL,
  tag_one TEXT NOT NULL,
  tag_two TEXT NOT NULL,
  tag_three TEXT NOT NULL,
  estimated_cost_minor INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_context_amendment_profile VALUES
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
  JOIN tmp_context_user_profile AS p
    ON p.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_user_profile)) + 1
  JOIN tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_location)) + 1
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
  JOIN tmp_context_group_profile AS gp
    ON gp.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_group_profile)) + 1
  JOIN tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_location)) + 1
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
  JOIN tmp_context_event_profile AS ep
    ON ep.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_event_profile)) + 1
  JOIN tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_location)) + 1
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
  JOIN tmp_context_amendment_profile AS ap
    ON ap.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_amendment_profile)) + 1
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

DELETE FROM public.amendment_street_design
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
  JOIN tmp_context_amendment_profile AS ap
    ON ap.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_amendment_profile)) + 1
  JOIN tmp_context_location AS l
    ON l.seq = ((n.rn - 1) % (SELECT count(*) FROM tmp_context_location)) + 1
)
INSERT INTO public.amendment_street_design (
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

COMMIT;
