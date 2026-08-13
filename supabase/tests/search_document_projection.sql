-- @covers schema 21_search_document.sql
-- @covers schema 30_datasets.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO public."user" (
  id, handle, first_name, last_name, country, city, latitude, longitude
)
VALUES
  ('81000000-0000-0000-0000-000000000001', 'search-user-1', 'Search', 'User', 'DE', 'Berlin', 52.52, 13.405),
  ('81000000-0000-0000-0000-000000000002', 'search-user-2', 'Second', 'User', 'DE', 'Bonn', 50.737, 7.098);

INSERT INTO public."group" (
  id, name, owner_id, country, city, latitude, longitude
)
VALUES ('82000000-0000-0000-0000-000000000001', 'Search group', '81000000-0000-0000-0000-000000000001', 'DE', 'Munich', 48.137, 11.575);

INSERT INTO public.role (id, name, group_id)
VALUES ('83000000-0000-0000-0000-000000000001', 'Search role', '82000000-0000-0000-0000-000000000001');

INSERT INTO public.event (
  id, title, description, location_name, country, city, latitude, longitude,
  group_id, creator_id
)
VALUES ('84000000-0000-0000-0000-000000000001', 'Search event', '{"text":"Event summary"}', 'Hall', 'DE', 'Cologne', 50.938, 6.96, '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001');

INSERT INTO public.agenda_item (id, event_id, creator_id, title)
VALUES ('84100000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Search agenda');

INSERT INTO public.statement (
  id, user_id, group_id, title, text
)
VALUES ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Search statement', 'Statement body');

INSERT INTO public.blog (id, title, description, group_id)
VALUES ('86000000-0000-0000-0000-000000000001', 'Search blog', 'Blog body', '82000000-0000-0000-0000-000000000001');
INSERT INTO public.blog_blogger (id, blog_id, user_id, status)
VALUES ('86100000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'active');

INSERT INTO public.amendment (
  id, code, title, reason, created_by_id, group_id, event_id,
  country, city, latitude, longitude
)
VALUES ('87000000-0000-0000-0000-000000000001', 'S-1', 'Search amendment', 'Amendment body', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'DE', 'Hamburg', 53.551, 9.994);

INSERT INTO public.todo (
  id, title, description, status, priority, tags, creator_id, group_id, event_id
)
VALUES ('88000000-0000-0000-0000-000000000001', 'Search todo', 'Todo body', 'open', 'high', '["todo-topic"]', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001');

INSERT INTO public.election (
  id, agenda_item_id, role_id, title, status
)
VALUES ('89000000-0000-0000-0000-000000000001', '84100000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Search election', 'open');

INSERT INTO public.timeline_event (
  id, event_type, entity_type, entity_id, title, description, tags,
  stats, user_id, group_id
)
VALUES ('8a000000-0000-0000-0000-000000000001', 'created', 'timeline_event', '8a000000-0000-0000-0000-000000000001', 'Search timeline', 'Timeline body', '["timeline-topic"]', '{"score":4}', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001');

INSERT INTO public.dataset (
  id, provider, provider_dataset_id, title, description, topics,
  owner_user_id, group_id, created_by_id
)
VALUES ('8b000000-0000-0000-0000-000000000001', 'EUROSTAT', 'search-demo', 'Search dataset', 'Dataset body', '["dataset-topic"]', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001');

INSERT INTO public.hashtag (id, tag)
VALUES ('8c000000-0000-0000-0000-000000000001', 'shared-topic');
INSERT INTO public.user_hashtag (id, user_id, hashtag_id)
VALUES ('8c100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');
INSERT INTO public.group_hashtag (id, group_id, hashtag_id)
VALUES ('8c200000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');
INSERT INTO public.statement_hashtag (id, statement_id, hashtag_id)
VALUES ('8c300000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');
INSERT INTO public.blog_hashtag (id, blog_id, hashtag_id)
VALUES ('8c400000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');
INSERT INTO public.amendment_hashtag (id, amendment_id, hashtag_id)
VALUES ('8c500000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');
INSERT INTO public.event_hashtag (id, event_id, hashtag_id)
VALUES ('8c600000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001');

SELECT set_eq(
  $sql$
    SELECT entity_type || ':' || entity_id::TEXT
    FROM public.search_document
    WHERE id IN (
      public.search_document_id('user', '81000000-0000-0000-0000-000000000001'),
      public.search_document_id('group', '82000000-0000-0000-0000-000000000001'),
      public.search_document_id('event', '84000000-0000-0000-0000-000000000001'),
      public.search_document_id('statement', '85000000-0000-0000-0000-000000000001'),
      public.search_document_id('blog', '86000000-0000-0000-0000-000000000001'),
      public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001'),
      public.search_document_id('todo', '88000000-0000-0000-0000-000000000001'),
      public.search_document_id('election', '89000000-0000-0000-0000-000000000001'),
      public.search_document_id('timeline_event', '8a000000-0000-0000-0000-000000000001'),
      public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
    )
  $sql$,
  $sql$
    VALUES
      ('user:81000000-0000-0000-0000-000000000001'::TEXT),
      ('group:82000000-0000-0000-0000-000000000001'::TEXT),
      ('event:84000000-0000-0000-0000-000000000001'::TEXT),
      ('statement:85000000-0000-0000-0000-000000000001'::TEXT),
      ('blog:86000000-0000-0000-0000-000000000001'::TEXT),
      ('amendment:87000000-0000-0000-0000-000000000001'::TEXT),
      ('todo:88000000-0000-0000-0000-000000000001'::TEXT),
      ('election:89000000-0000-0000-0000-000000000001'::TEXT),
      ('timeline_event:8a000000-0000-0000-0000-000000000001'::TEXT),
      ('dataset:8b000000-0000-0000-0000-000000000001'::TEXT)
  $sql$,
  'all ten searchable entity types create deterministic projections'
);

SELECT set_eq(
  $sql$
    SELECT title
    FROM public.search_document
    WHERE id IN (
      public.search_document_id('user', '81000000-0000-0000-0000-000000000001'),
      public.search_document_id('group', '82000000-0000-0000-0000-000000000001'),
      public.search_document_id('event', '84000000-0000-0000-0000-000000000001'),
      public.search_document_id('statement', '85000000-0000-0000-0000-000000000001'),
      public.search_document_id('blog', '86000000-0000-0000-0000-000000000001'),
      public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001'),
      public.search_document_id('todo', '88000000-0000-0000-0000-000000000001'),
      public.search_document_id('election', '89000000-0000-0000-0000-000000000001'),
      public.search_document_id('timeline_event', '8a000000-0000-0000-0000-000000000001'),
      public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
    )
  $sql$,
  $sql$
    VALUES
      ('Search User'::TEXT),
      ('Search group'::TEXT),
      ('Search event'::TEXT),
      ('Statement body'::TEXT),
      ('Search blog'::TEXT),
      ('Search amendment'::TEXT),
      ('Search todo'::TEXT),
      ('Search election'::TEXT),
      ('Search timeline'::TEXT),
      ('Search dataset'::TEXT)
  $sql$,
  'projection titles map all source entities'
);

SELECT ok(
  (SELECT owner_user_id = '81000000-0000-0000-0000-000000000001' FROM public.search_document WHERE id = public.search_document_id('blog', '86000000-0000-0000-0000-000000000001'))
  AND (SELECT group_id = '82000000-0000-0000-0000-000000000001' FROM public.search_document WHERE id = public.search_document_id('election', '89000000-0000-0000-0000-000000000001'))
  AND (SELECT group_id = '82000000-0000-0000-0000-000000000001' FROM public.search_document WHERE id = public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')),
  'projection ownership and group relationships are derived correctly'
);

SELECT results_eq(
  $sql$
    SELECT entity_type, location_source
    FROM public.search_document
    WHERE id IN (
      public.search_document_id('user', '81000000-0000-0000-0000-000000000001'),
      public.search_document_id('group', '82000000-0000-0000-0000-000000000001'),
      public.search_document_id('event', '84000000-0000-0000-0000-000000000001'),
      public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001'),
      public.search_document_id('blog', '86000000-0000-0000-0000-000000000001')
    )
    ORDER BY entity_type
  $sql$,
  $sql$
    VALUES
      ('amendment'::TEXT, 'amendment'::TEXT),
      ('blog'::TEXT, 'group'::TEXT),
      ('event'::TEXT, 'event'::TEXT),
      ('group'::TEXT, 'group'::TEXT),
      ('user'::TEXT, 'user'::TEXT)
  $sql$,
  'location projection prefers own, group, and owner locations consistently'
);

SELECT ok(
  (SELECT count(*) = 6 FROM public.search_document_topic WHERE topic = 'shared-topic')
  AND EXISTS (SELECT 1 FROM public.search_document_topic WHERE topic = 'todo-topic')
  AND EXISTS (SELECT 1 FROM public.search_document_topic WHERE topic = 'timeline-topic')
  AND EXISTS (SELECT 1 FROM public.search_document_topic WHERE topic = 'dataset-topic'),
  'hashtags and JSON topic arrays synchronize into canonical search topics'
);

UPDATE public."user" SET first_name = 'Updated', last_name = 'Person' WHERE id = '81000000-0000-0000-0000-000000000001';
UPDATE public."group" SET name = 'Updated group' WHERE id = '82000000-0000-0000-0000-000000000001';
UPDATE public.event SET title = 'Updated event' WHERE id = '84000000-0000-0000-0000-000000000001';
UPDATE public.statement SET title = 'Updated statement' WHERE id = '85000000-0000-0000-0000-000000000001';
UPDATE public.blog SET title = 'Updated blog' WHERE id = '86000000-0000-0000-0000-000000000001';
UPDATE public.amendment SET title = 'Updated amendment' WHERE id = '87000000-0000-0000-0000-000000000001';
UPDATE public.todo SET title = 'Updated todo' WHERE id = '88000000-0000-0000-0000-000000000001';
UPDATE public.election SET title = 'Updated election' WHERE id = '89000000-0000-0000-0000-000000000001';
UPDATE public.timeline_event SET title = 'Updated timeline' WHERE id = '8a000000-0000-0000-0000-000000000001';
UPDATE public.dataset SET title = 'Updated dataset' WHERE id = '8b000000-0000-0000-0000-000000000001';

SELECT set_eq(
  $sql$
    SELECT title
    FROM public.search_document
    WHERE id IN (
      public.search_document_id('user', '81000000-0000-0000-0000-000000000001'),
      public.search_document_id('group', '82000000-0000-0000-0000-000000000001'),
      public.search_document_id('event', '84000000-0000-0000-0000-000000000001'),
      public.search_document_id('statement', '85000000-0000-0000-0000-000000000001'),
      public.search_document_id('blog', '86000000-0000-0000-0000-000000000001'),
      public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001'),
      public.search_document_id('todo', '88000000-0000-0000-0000-000000000001'),
      public.search_document_id('election', '89000000-0000-0000-0000-000000000001'),
      public.search_document_id('timeline_event', '8a000000-0000-0000-0000-000000000001'),
      public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
    )
  $sql$,
  $sql$
    VALUES
      ('Updated Person'::TEXT),
      ('Updated group'::TEXT),
      ('Updated event'::TEXT),
      ('Statement body'::TEXT),
      ('Updated blog'::TEXT),
      ('Updated amendment'::TEXT),
      ('Updated todo'::TEXT),
      ('Updated election'::TEXT),
      ('Updated timeline'::TEXT),
      ('Updated dataset'::TEXT)
  $sql$,
  'relevant updates refresh every search projection'
);

UPDATE public."user"
SET city = 'Leipzig', latitude = 51.34, longitude = 12.375
WHERE id = '81000000-0000-0000-0000-000000000001';

SELECT ok(
  (SELECT location_label LIKE '%Leipzig%' FROM public.search_document WHERE id = public.search_document_id('user', '81000000-0000-0000-0000-000000000001'))
  AND (SELECT location_label LIKE '%Munich%' FROM public.search_document WHERE id = public.search_document_id('blog', '86000000-0000-0000-0000-000000000001')),
  'user location changes refresh the user projection without overriding a blog group location'
);

UPDATE public."group"
SET city = 'Dresden', latitude = 51.05, longitude = 13.738
WHERE id = '82000000-0000-0000-0000-000000000001';

SELECT ok(
  (SELECT location_label LIKE '%Dresden%' FROM public.search_document WHERE id = public.search_document_id('statement', '85000000-0000-0000-0000-000000000001'))
  AND (SELECT location_label LIKE '%Dresden%' FROM public.search_document WHERE id = public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')),
  'group location changes refresh group-derived projections'
);

UPDATE public.dataset
SET status = 'archived'
WHERE id = '8b000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document
    WHERE id = public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
  ),
  0,
  'archiving a dataset removes its search projection'
);

UPDATE public.dataset
SET status = 'active'
WHERE id = '8b000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document
    WHERE id = public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
  ),
  1,
  'reactivating a dataset recreates its search projection'
);

INSERT INTO public.amendment_group_decision (
  id, amendment_id, group_id, status
)
VALUES ('8d000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'supported');

SELECT is(
  (
    SELECT (card_payload #>> '{stats,supporting_groups}')::INTEGER
    FROM public.search_document
    WHERE id = public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001')
  ),
  1,
  'supporting group decisions refresh amendment engagement data'
);

INSERT INTO public.support_confirmation (
  id, amendment_id, group_id, confirmed_by_id, status
)
VALUES ('8d100000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'declined');

SELECT is(
  (
    SELECT (card_payload #>> '{stats,supporting_groups}')::INTEGER
    FROM public.search_document
    WHERE id = public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001')
  ),
  0,
  'a latest declined confirmation removes the supporting group count'
);

UPDATE public.user_hashtag
SET user_id = '81000000-0000-0000-0000-000000000002'
WHERE id = '8c100000-0000-0000-0000-000000000001';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.search_document_topic
    WHERE document_id = public.search_document_id('user', '81000000-0000-0000-0000-000000000001')
      AND topic = 'shared-topic'
  )
  AND EXISTS (
    SELECT 1 FROM public.search_document_topic
    WHERE document_id = public.search_document_id('user', '81000000-0000-0000-0000-000000000002')
      AND topic = 'shared-topic'
  ),
  'moving a hashtag relation refreshes both old and new entity topics'
);

UPDATE public.todo
SET tags = '["replacement-topic"]'
WHERE id = '88000000-0000-0000-0000-000000000001';

SELECT set_eq(
  $sql$
    SELECT topic
    FROM public.search_document_topic
    WHERE document_id = public.search_document_id('todo', '88000000-0000-0000-0000-000000000001')
  $sql$,
  $sql$
    VALUES ('replacement-topic'::TEXT)
  $sql$,
  'updating JSON topics replaces stale canonical topics'
);

SELECT is(
  (
    SELECT engagement_score
    FROM public.search_document
    WHERE id = public.search_document_id('timeline_event', '8a000000-0000-0000-0000-000000000001')
  ),
  4,
  'timeline score metadata is converted into engagement and trending values'
);

SELECT is(
  public.search_document_format_location('Hall', 'DE', 'NRW', '50667', 'Cologne', 'Main Street', '1'),
  'Hall, Main Street 1, 50667 Cologne, NRW, DE',
  'location formatting omits empty components and preserves display order'
);

DELETE FROM public.timeline_event WHERE id = '8a000000-0000-0000-0000-000000000001';
DELETE FROM public.election WHERE id = '89000000-0000-0000-0000-000000000001';
DELETE FROM public.todo WHERE id = '88000000-0000-0000-0000-000000000001';
DELETE FROM public.dataset WHERE id = '8b000000-0000-0000-0000-000000000001';
DELETE FROM public.statement WHERE id = '85000000-0000-0000-0000-000000000001';
DELETE FROM public.blog WHERE id = '86000000-0000-0000-0000-000000000001';
DELETE FROM public.amendment WHERE id = '87000000-0000-0000-0000-000000000001';
DELETE FROM public.event WHERE id = '84000000-0000-0000-0000-000000000001';
DELETE FROM public."group" WHERE id = '82000000-0000-0000-0000-000000000001';
DELETE FROM public."user" WHERE id IN (
  '81000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000002'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.search_document
    WHERE id IN (
      public.search_document_id('user', '81000000-0000-0000-0000-000000000001'),
      public.search_document_id('user', '81000000-0000-0000-0000-000000000002'),
      public.search_document_id('group', '82000000-0000-0000-0000-000000000001'),
      public.search_document_id('event', '84000000-0000-0000-0000-000000000001'),
      public.search_document_id('statement', '85000000-0000-0000-0000-000000000001'),
      public.search_document_id('blog', '86000000-0000-0000-0000-000000000001'),
      public.search_document_id('amendment', '87000000-0000-0000-0000-000000000001'),
      public.search_document_id('todo', '88000000-0000-0000-0000-000000000001'),
      public.search_document_id('election', '89000000-0000-0000-0000-000000000001'),
      public.search_document_id('timeline_event', '8a000000-0000-0000-0000-000000000001'),
      public.search_document_id('dataset', '8b000000-0000-0000-0000-000000000001')
    )
  ),
  0,
  'deleting source entities removes every projection and derivative topic'
);

SELECT * FROM finish();

ROLLBACK;
