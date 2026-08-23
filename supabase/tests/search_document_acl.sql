-- @covers schema 21_search_document.sql
-- @covers schema 30_datasets.sql
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
VALUES
  ('e9600000-0000-4000-a000-000000000001', 'acl-owner'),
  ('e9600000-0000-4000-a000-000000000002', 'acl-member'),
  ('e9600000-0000-4000-a000-000000000003', 'acl-invited-member'),
  ('e9600000-0000-4000-a000-000000000004', 'acl-guest'),
  ('e9600000-0000-4000-a000-000000000005', 'acl-event-participant'),
  ('e9600000-0000-4000-a000-000000000006', 'acl-inactive-participant'),
  ('e9600000-0000-4000-a000-000000000007', 'acl-creator'),
  ('e9600000-0000-4000-a000-000000000008', 'acl-collaborator'),
  ('e9600000-0000-4000-a000-000000000009', 'acl-inactive-collaborator'),
  ('e9600000-0000-4000-a000-000000000010', 'acl-assignee'),
  ('e9600000-0000-4000-a000-000000000011', 'acl-dataset-owner'),
  ('e9600000-0000-4000-a000-000000000012', 'acl-event-invited-view'),
  ('e9600000-0000-4000-a000-000000000013', 'acl-event-invited-no-view'),
  ('e9600000-0000-4000-a000-000000000014', 'acl-amendment-invited-view'),
  ('e9600000-0000-4000-a000-000000000015', 'acl-amendment-invited-no-view'),
  ('e9600000-0000-4000-a000-000000000016', 'acl-blog-owner'),
  ('e9600000-0000-4000-a000-000000000017', 'acl-blog-invited-view'),
  ('e9600000-0000-4000-a000-000000000018', 'acl-blog-invited-no-view');

INSERT INTO public."group" (id, name, owner_id, visibility)
VALUES (
  'e9610000-0000-4000-a000-000000000001',
  'Private ACL group',
  'e9600000-0000-4000-a000-000000000001',
  'private'
);

INSERT INTO public.group_membership (id, group_id, user_id, status)
VALUES
  (
    'e9611000-0000-4000-a000-000000000001',
    'e9610000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000002',
    'active'
  ),
  (
    'e9611000-0000-4000-a000-000000000002',
    'e9610000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000003',
    'invited'
  );

INSERT INTO public.group_guest_access (id, group_id, user_id, status)
VALUES (
  'e9612000-0000-4000-a000-000000000001',
  'e9610000-0000-4000-a000-000000000001',
  'e9600000-0000-4000-a000-000000000004',
  'active'
);

INSERT INTO public.role (id, name, scope, group_id)
VALUES
  ('e9613000-0000-4000-a000-000000000001', 'ACL member', 'group', 'e9610000-0000-4000-a000-000000000001'),
  ('e9613000-0000-4000-a000-000000000002', 'ACL invited member', 'group', 'e9610000-0000-4000-a000-000000000001'),
  ('e9613000-0000-4000-a000-000000000003', 'ACL guest', 'group', 'e9610000-0000-4000-a000-000000000001');

INSERT INTO public.action_right (id, resource, action, role_id, group_id)
VALUES
  ('e9614000-0000-4000-a000-000000000001', 'groups', 'view', 'e9613000-0000-4000-a000-000000000001', 'e9610000-0000-4000-a000-000000000001'),
  ('e9614000-0000-4000-a000-000000000002', 'groups', 'view', 'e9613000-0000-4000-a000-000000000002', 'e9610000-0000-4000-a000-000000000001'),
  ('e9614000-0000-4000-a000-000000000003', 'groups', 'manage', 'e9613000-0000-4000-a000-000000000003', 'e9610000-0000-4000-a000-000000000001');

INSERT INTO public.group_membership_role (id, group_membership_id, role_id)
VALUES
  ('e9615000-0000-4000-a000-000000000001', 'e9611000-0000-4000-a000-000000000001', 'e9613000-0000-4000-a000-000000000001'),
  ('e9615000-0000-4000-a000-000000000002', 'e9611000-0000-4000-a000-000000000002', 'e9613000-0000-4000-a000-000000000002');

INSERT INTO public.group_guest_role (id, group_guest_access_id, role_id)
VALUES (
  'e9616000-0000-4000-a000-000000000001',
  'e9612000-0000-4000-a000-000000000001',
  'e9613000-0000-4000-a000-000000000003'
);

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'group',
      'e9610000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000002'::UUID),
      ('e9600000-0000-4000-a000-000000000003'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID)
  $sql$,
  'private group ACLs contain owners plus invited or active roles with group view rights'
);

INSERT INTO public.search_document_topic (document_id, topic)
VALUES (
  public.search_document_id('group', 'e9610000-0000-4000-a000-000000000001'),
  'acl-unique-topic'
);

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.search_document_acl (document_id, user_id) VALUES (public.search_document_id('group', 'e9610000-0000-4000-a000-000000000001'), 'e9600000-0000-4000-a000-000000000001')$sql$), '23505', 'search ACL entries are unique per document and user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.search_document_topic (document_id, topic) VALUES (public.search_document_id('group', 'e9610000-0000-4000-a000-000000000001'), 'acl-unique-topic')$sql$), '23505', 'search topics are unique per document');

UPDATE public.group_membership
SET status = 'inactive'
WHERE id = 'e9611000-0000-4000-a000-000000000001';

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'group',
      'e9610000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000003'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID)
  $sql$,
  'membership status changes revoke group search access while invited roles remain visible'
);

UPDATE public."group"
SET visibility = 'public'
WHERE id = 'e9610000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'group',
      'e9610000-0000-4000-a000-000000000001'
    )
  ),
  0,
  'public search documents do not retain ACL rows'
);

UPDATE public."group"
SET visibility = 'private'
WHERE id = 'e9610000-0000-4000-a000-000000000001';

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'group',
      'e9610000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000003'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID)
  $sql$,
  'making a group private rebuilds its current ACL'
);

DELETE FROM public.action_right
WHERE id = 'e9614000-0000-4000-a000-000000000002';

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'group',
      'e9610000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID)
  $sql$,
  'removing a role right revokes only group discovery access'
);

INSERT INTO public.event (
  id,
  title,
  creator_id,
  group_id,
  visibility
)
VALUES (
  'e9620000-0000-4000-a000-000000000001',
  'Private ACL event',
  'e9600000-0000-4000-a000-000000000001',
  'e9610000-0000-4000-a000-000000000001',
  'private'
);

INSERT INTO public.event_participant (id, event_id, user_id, status)
VALUES
  (
    'e9621000-0000-4000-a000-000000000001',
    'e9620000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000005',
    'active'
  ),
  (
    'e9621000-0000-4000-a000-000000000002',
    'e9620000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000006',
    'inactive'
  ),
  (
    'e9621000-0000-4000-a000-000000000003',
    'e9620000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000012',
    'invited'
  ),
  (
    'e9621000-0000-4000-a000-000000000004',
    'e9620000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000013',
    'invited'
  );

INSERT INTO public.role (id, name, scope, event_id)
VALUES
  ('e9622000-0000-4000-a000-000000000001', 'Event viewer', 'event', 'e9620000-0000-4000-a000-000000000001'),
  ('e9622000-0000-4000-a000-000000000002', 'Event updater', 'event', 'e9620000-0000-4000-a000-000000000001');

INSERT INTO public.action_right (id, resource, action, role_id, event_id)
VALUES
  ('e9623000-0000-4000-a000-000000000001', 'events', 'view', 'e9622000-0000-4000-a000-000000000001', 'e9620000-0000-4000-a000-000000000001'),
  ('e9623000-0000-4000-a000-000000000002', 'events', 'update', 'e9622000-0000-4000-a000-000000000002', 'e9620000-0000-4000-a000-000000000001');

INSERT INTO public.event_participant_role (id, event_participant_id, role_id)
VALUES
  ('e9624000-0000-4000-a000-000000000001', 'e9621000-0000-4000-a000-000000000001', 'e9622000-0000-4000-a000-000000000001'),
  ('e9624000-0000-4000-a000-000000000002', 'e9621000-0000-4000-a000-000000000003', 'e9622000-0000-4000-a000-000000000001'),
  ('e9624000-0000-4000-a000-000000000003', 'e9621000-0000-4000-a000-000000000004', 'e9622000-0000-4000-a000-000000000002');

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'event',
      'e9620000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID),
      ('e9600000-0000-4000-a000-000000000005'::UUID),
      ('e9600000-0000-4000-a000-000000000012'::UUID)
  $sql$,
  'private event ACLs combine creator, active parents, and scoped invited or active view roles'
);

INSERT INTO public.amendment (
  id,
  title,
  created_by_id,
  group_id,
  event_id,
  visibility
)
VALUES (
  'e9630000-0000-4000-a000-000000000001',
  'Private ACL amendment',
  'e9600000-0000-4000-a000-000000000007',
  'e9610000-0000-4000-a000-000000000001',
  'e9620000-0000-4000-a000-000000000001',
  'private'
);

INSERT INTO public.amendment_collaborator (
  id,
  amendment_id,
  user_id,
  status
)
VALUES
  (
    'e9631000-0000-4000-a000-000000000001',
    'e9630000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000008',
    'active'
  ),
  (
    'e9631000-0000-4000-a000-000000000002',
    'e9630000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000009',
    'inactive'
  ),
  (
    'e9631000-0000-4000-a000-000000000003',
    'e9630000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000014',
    'invited'
  ),
  (
    'e9631000-0000-4000-a000-000000000004',
    'e9630000-0000-4000-a000-000000000001',
    'e9600000-0000-4000-a000-000000000015',
    'invited'
  );

INSERT INTO public.role (id, name, scope, amendment_id)
VALUES
  ('e9632000-0000-4000-a000-000000000001', 'Amendment manager', 'amendment', 'e9630000-0000-4000-a000-000000000001'),
  ('e9632000-0000-4000-a000-000000000002', 'Amendment updater', 'amendment', 'e9630000-0000-4000-a000-000000000001');

INSERT INTO public.action_right (id, resource, action, role_id, amendment_id)
VALUES
  ('e9633000-0000-4000-a000-000000000001', 'amendments', 'manage', 'e9632000-0000-4000-a000-000000000001', 'e9630000-0000-4000-a000-000000000001'),
  ('e9633000-0000-4000-a000-000000000002', 'amendments', 'update', 'e9632000-0000-4000-a000-000000000002', 'e9630000-0000-4000-a000-000000000001');

UPDATE public.amendment_collaborator
SET role_id = CASE
  WHEN id IN (
    'e9631000-0000-4000-a000-000000000001',
    'e9631000-0000-4000-a000-000000000003'
  ) THEN 'e9632000-0000-4000-a000-000000000001'::UUID
  ELSE 'e9632000-0000-4000-a000-000000000002'::UUID
END
WHERE id IN (
  'e9631000-0000-4000-a000-000000000001',
  'e9631000-0000-4000-a000-000000000003',
  'e9631000-0000-4000-a000-000000000004'
);

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'amendment',
      'e9630000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID),
      ('e9600000-0000-4000-a000-000000000005'::UUID),
      ('e9600000-0000-4000-a000-000000000007'::UUID),
      ('e9600000-0000-4000-a000-000000000008'::UUID),
      ('e9600000-0000-4000-a000-000000000014'::UUID)
  $sql$,
  'private amendment ACLs combine active parents and scoped invited or active view roles'
);

INSERT INTO public.blog (id, title, visibility)
VALUES (
  'e9670000-0000-4000-a000-000000000001',
  'Private ACL blog',
  'private'
);

INSERT INTO public.role (id, name, scope, blog_id)
VALUES
  ('e9672000-0000-4000-a000-000000000001', 'Blog manager', 'blog', 'e9670000-0000-4000-a000-000000000001'),
  ('e9672000-0000-4000-a000-000000000002', 'Blog updater', 'blog', 'e9670000-0000-4000-a000-000000000001');

INSERT INTO public.action_right (id, resource, action, role_id, blog_id)
VALUES
  ('e9673000-0000-4000-a000-000000000001', 'blogs', 'manage', 'e9672000-0000-4000-a000-000000000001', 'e9670000-0000-4000-a000-000000000001'),
  ('e9673000-0000-4000-a000-000000000002', 'blogs', 'update', 'e9672000-0000-4000-a000-000000000002', 'e9670000-0000-4000-a000-000000000001');

INSERT INTO public.blog_blogger (id, blog_id, user_id, role_id, status)
VALUES
  ('e9671000-0000-4000-a000-000000000001', 'e9670000-0000-4000-a000-000000000001', 'e9600000-0000-4000-a000-000000000016', NULL, 'owner'),
  ('e9671000-0000-4000-a000-000000000002', 'e9670000-0000-4000-a000-000000000001', 'e9600000-0000-4000-a000-000000000017', 'e9672000-0000-4000-a000-000000000001', 'invited'),
  ('e9671000-0000-4000-a000-000000000003', 'e9670000-0000-4000-a000-000000000001', 'e9600000-0000-4000-a000-000000000018', 'e9672000-0000-4000-a000-000000000002', 'invited');

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'blog',
      'e9670000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000016'::UUID),
      ('e9600000-0000-4000-a000-000000000017'::UUID)
  $sql$,
  'private blog ACLs contain owners and scoped invited view roles only'
);

INSERT INTO public.todo (
  id,
  title,
  creator_id,
  amendment_id,
  visibility
)
VALUES (
  'e9640000-0000-4000-a000-000000000001',
  'Private derivative todo',
  'e9600000-0000-4000-a000-000000000002',
  'e9630000-0000-4000-a000-000000000001',
  'private'
);

INSERT INTO public.todo_assignment (id, todo_id, user_id)
VALUES (
  'e9641000-0000-4000-a000-000000000001',
  'e9640000-0000-4000-a000-000000000001',
  'e9600000-0000-4000-a000-000000000010'
);

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'todo',
      'e9640000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000002'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID),
      ('e9600000-0000-4000-a000-000000000005'::UUID),
      ('e9600000-0000-4000-a000-000000000007'::UUID),
      ('e9600000-0000-4000-a000-000000000008'::UUID),
      ('e9600000-0000-4000-a000-000000000010'::UUID)
  $sql$,
  'todo ACLs inherit amendment access and include creator and assignees'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000012'
      AND document_id IN (
        public.search_document_id('amendment', 'e9630000-0000-4000-a000-000000000001'),
        public.search_document_id('todo', 'e9640000-0000-4000-a000-000000000001')
      )
  ),
  0,
  'an event invitation does not expose private amendment or todo children'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000014'
      AND document_id = public.search_document_id(
        'todo',
        'e9640000-0000-4000-a000-000000000001'
      )
  ),
  0,
  'an amendment invitation does not expose private todo children'
);

UPDATE public.action_right
SET action = 'update'
WHERE id = 'e9623000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000012'
      AND document_id = public.search_document_id(
        'event',
        'e9620000-0000-4000-a000-000000000001'
      )
  ),
  0,
  'changing an event role right revokes discovery immediately'
);

UPDATE public.action_right
SET action = 'update'
WHERE id = 'e9673000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000017'
      AND document_id = public.search_document_id(
        'blog',
        'e9670000-0000-4000-a000-000000000001'
      )
  ),
  0,
  'changing a blog role right revokes discovery immediately'
);

INSERT INTO public.dataset (
  id,
  provider,
  title,
  visibility,
  owner_user_id,
  group_id
)
VALUES (
  'e9650000-0000-4000-a000-000000000001',
  'UPLOAD',
  'Private ACL dataset',
  'private',
  'e9600000-0000-4000-a000-000000000011',
  'e9610000-0000-4000-a000-000000000001'
);

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'dataset',
      'e9650000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    VALUES
      ('e9600000-0000-4000-a000-000000000001'::UUID),
      ('e9600000-0000-4000-a000-000000000004'::UUID),
      ('e9600000-0000-4000-a000-000000000011'::UUID)
  $sql$,
  'private dataset ACLs combine owner and group access'
);

INSERT INTO public.timeline_event (id, title, todo_id)
VALUES (
  'e9660000-0000-4000-a000-000000000001',
  'Private todo timeline event',
  'e9640000-0000-4000-a000-000000000001'
);

SELECT is(
  (
    SELECT visibility
    FROM public.search_document
    WHERE id = public.search_document_id(
      'timeline_event',
      'e9660000-0000-4000-a000-000000000001'
    )
  ),
  'private',
  'timeline search documents inherit source visibility'
);

SELECT set_eq(
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'timeline_event',
      'e9660000-0000-4000-a000-000000000001'
    )
  $sql$,
  $sql$
    SELECT user_id
    FROM public.search_document_acl
    WHERE document_id = public.search_document_id(
      'todo',
      'e9640000-0000-4000-a000-000000000001'
    )
  $sql$,
  'timeline search documents inherit the source ACL'
);

UPDATE public.amendment_collaborator
SET status = 'inactive'
WHERE id = 'e9631000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000008'
      AND document_id IN (
        public.search_document_id(
          'amendment',
          'e9630000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'todo',
          'e9640000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'timeline_event',
          'e9660000-0000-4000-a000-000000000001'
        )
      )
  ),
  0,
  'collaborator status changes revoke derivative search access'
);

UPDATE public.event_participant
SET status = 'inactive'
WHERE id = 'e9621000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000005'
      AND document_id IN (
        public.search_document_id(
          'event',
          'e9620000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'amendment',
          'e9630000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'todo',
          'e9640000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'timeline_event',
          'e9660000-0000-4000-a000-000000000001'
        )
      )
  ),
  0,
  'participant status changes revoke event derivatives'
);

UPDATE public.group_guest_access
SET status = 'revoked'
WHERE id = 'e9612000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document_acl
    WHERE user_id = 'e9600000-0000-4000-a000-000000000004'
      AND document_id IN (
        public.search_document_id(
          'group',
          'e9610000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'event',
          'e9620000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'amendment',
          'e9630000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'todo',
          'e9640000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'dataset',
          'e9650000-0000-4000-a000-000000000001'
        ),
        public.search_document_id(
          'timeline_event',
          'e9660000-0000-4000-a000-000000000001'
        )
      )
  ),
  0,
  'guest revocation propagates across group-backed search documents'
);

SELECT * FROM finish();

ROLLBACK;
