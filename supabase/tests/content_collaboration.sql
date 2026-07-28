-- @covers schema 04_document.sql
-- @covers schema 07_blog.sql
-- @covers schema 08_todo.sql
-- @covers schema 11_statement.sql
-- @covers schema 14_change_request.sql
-- @covers schema 15_discussion.sql
-- @covers schema 21_common.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(20);

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
  ('c1000000-0000-0000-0000-000000000001', 'content-user-1'),
  ('c1000000-0000-0000-0000-000000000002', 'content-user-2');

INSERT INTO public."group" (id, name, owner_id)
VALUES ('c2000000-0000-0000-0000-000000000001', 'Content group', 'c1000000-0000-0000-0000-000000000001');

INSERT INTO public.event (id, title, creator_id, group_id)
VALUES ('c3000000-0000-0000-0000-000000000001', 'Content event', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001');

INSERT INTO public.document (id, content, editing_mode)
VALUES ('c4000000-0000-0000-0000-000000000001', '{"type":"doc"}', 'edit');

INSERT INTO public.amendment (id, title, created_by_id, group_id, event_id, document_id)
VALUES ('c5000000-0000-0000-0000-000000000001', 'Content amendment', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001');

UPDATE public.document
SET amendment_id = 'c5000000-0000-0000-0000-000000000001'
WHERE id = 'c4000000-0000-0000-0000-000000000001';

INSERT INTO public.document_version (
  id, document_id, amendment_id, content, version_number, author_id
)
VALUES ('c4100000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '{"version":1}', 1, 'c1000000-0000-0000-0000-000000000001');

INSERT INTO public.document_collaborator (
  id, document_id, user_id, status
)
VALUES ('c4200000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'active');

INSERT INTO public.document_cursor (
  id, document_id, user_id, position
)
VALUES ('c4300000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '{"offset":1}');

INSERT INTO public.blog (id, title, group_id)
VALUES ('c6000000-0000-0000-0000-000000000001', 'Content blog', 'c2000000-0000-0000-0000-000000000001');

INSERT INTO public.blog_blogger (id, blog_id, user_id, status)
VALUES ('c6100000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'active');

INSERT INTO public.blog_support_vote (id, blog_id, user_id, vote)
VALUES ('c6200000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 1);

INSERT INTO public.statement (
  id, user_id, group_id, title, media_type
)
VALUES ('c7000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Survey statement', 'text');

INSERT INTO public.statement_survey (
  id, statement_id, question, ends_at
)
VALUES ('c7100000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'Question?', now() + INTERVAL '1 day');

INSERT INTO public.statement_survey_option (
  id, survey_id, label, position
)
VALUES ('c7200000-0000-0000-0000-000000000001', 'c7100000-0000-0000-0000-000000000001', 'Yes', 1);

INSERT INTO public.statement_survey_vote (id, option_id, user_id)
VALUES ('c7300000-0000-0000-0000-000000000001', 'c7200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');

INSERT INTO public.statement_support_vote (
  id, statement_id, user_id, vote
)
VALUES ('c7400000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 1);

INSERT INTO public.change_request (
  id, amendment_id, user_id, title, branch_sequence_number
)
VALUES ('c8000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Main change', 1);

INSERT INTO public.amendment_process_run (
  id, amendment_id, created_by_id
)
VALUES ('c8100000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001');

INSERT INTO public.amendment_process_branch (
  id, process_run_id, title
)
VALUES ('c8200000-0000-0000-0000-000000000001', 'c8100000-0000-0000-0000-000000000001', 'Content branch');

INSERT INTO public.change_request (
  id, amendment_id, process_branch_id, user_id, title,
  branch_sequence_number
)
VALUES (
  'c8000000-0000-0000-0000-000000000002',
  'c5000000-0000-0000-0000-000000000001',
  'c8200000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'Branch change',
  1
);

INSERT INTO public.thread (
  id, document_id, amendment_id, user_id, content
)
VALUES ('c9000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Document thread');

INSERT INTO public.comment (id, thread_id, user_id, content)
VALUES ('c9100000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Parent');

INSERT INTO public.comment (
  id, thread_id, user_id, parent_id, content
)
VALUES ('c9100000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'c9100000-0000-0000-0000-000000000001', 'Child');

INSERT INTO public.thread_vote (id, thread_id, user_id, vote)
VALUES ('c9200000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 1);

INSERT INTO public.comment_vote (id, comment_id, user_id, vote)
VALUES ('c9300000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 1);

INSERT INTO public.hashtag (id, tag)
VALUES ('ca000000-0000-0000-0000-000000000001', 'content-contract');

INSERT INTO public.user_hashtag (id, user_id, hashtag_id)
VALUES ('ca100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
INSERT INTO public.group_hashtag (id, group_id, hashtag_id)
VALUES ('ca200000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
INSERT INTO public.amendment_hashtag (id, amendment_id, hashtag_id)
VALUES ('ca300000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
INSERT INTO public.event_hashtag (id, event_id, hashtag_id)
VALUES ('ca400000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
INSERT INTO public.blog_hashtag (id, blog_id, hashtag_id)
VALUES ('ca500000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
INSERT INTO public.statement_hashtag (id, statement_id, hashtag_id)
VALUES ('ca600000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');

INSERT INTO public.link (id, label, url, event_id)
VALUES ('cb000000-0000-0000-0000-000000000001', 'Event', 'https://test.invalid/event', 'c3000000-0000-0000-0000-000000000001');

INSERT INTO public.timeline_event (
  id, event_type, entity_type, entity_id, title, user_id, group_id
)
VALUES ('cc000000-0000-0000-0000-000000000001', 'created', 'blog', 'c6000000-0000-0000-0000-000000000001', 'Blog created', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001');

INSERT INTO public.reaction (
  id, entity_id, entity_type, reaction_type, user_id, timeline_event_id
)
VALUES ('cd000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'blog', 'like', 'c1000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000001');

SELECT ok(
  EXISTS (SELECT 1 FROM public.document_cursor WHERE id = 'c4300000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.blog_support_vote WHERE id = 'c6200000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.statement_survey_vote WHERE id = 'c7300000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.comment_vote WHERE id = 'c9300000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.reaction WHERE id = 'cd000000-0000-0000-0000-000000000001'),
  'documents, content, discussions, hashtags, links, timeline, and reactions are accepted'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.statement SET media_type = 'invalid' WHERE id = 'c7000000-0000-0000-0000-000000000001'$sql$), '23514', 'statement media type is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.statement_survey (statement_id, question, ends_at) VALUES ('c7000000-0000-0000-0000-000000000001', 'Duplicate?', now())$sql$), '23505', 'a statement has at most one survey');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.statement_survey_vote (option_id, user_id) VALUES ('c7200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002')$sql$), '23505', 'survey votes are unique per option and user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.hashtag (tag) VALUES ('content-contract')$sql$), '23505', 'canonical hashtag tags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.user_hashtag (user_id, hashtag_id) VALUES ('c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'user hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_hashtag (group_id, hashtag_id) VALUES ('c2000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'group hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.amendment_hashtag (amendment_id, hashtag_id) VALUES ('c5000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'amendment hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.event_hashtag (event_id, hashtag_id) VALUES ('c3000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'event hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.blog_hashtag (blog_id, hashtag_id) VALUES ('c6000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'blog hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.statement_hashtag (statement_id, hashtag_id) VALUES ('c7000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001')$sql$), '23505', 'statement hashtags are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.change_request (amendment_id, user_id, title, branch_sequence_number) VALUES ('c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Duplicate sequence', 1)$sql$), '23505', 'main-branch change request sequence numbers are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.change_request (amendment_id, process_branch_id, user_id, title, branch_sequence_number) VALUES ('c5000000-0000-0000-0000-000000000001', 'c8200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Duplicate branch sequence', 1)$sql$), '23505', 'branch change request sequence numbers are unique within a branch');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.change_request (amendment_id, user_id, title) VALUES ('c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'No sequence')$sql$), NULL, 'change requests without a sequence remain allowed');

DELETE FROM public.comment
WHERE id = 'c9100000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.comment WHERE id = 'c9100000-0000-0000-0000-000000000002')
      + (SELECT count(*) FROM public.comment_vote WHERE id = 'c9300000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'deleting a parent comment removes descendants and their votes'
);

DELETE FROM public.document
WHERE id = 'c4000000-0000-0000-0000-000000000001';

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.document_version WHERE id = 'c4100000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.document_collaborator WHERE id = 'c4200000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.document_cursor WHERE id = 'c4300000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.thread WHERE id = 'c9000000-0000-0000-0000-000000000001')
  AND (SELECT document_id IS NULL FROM public.amendment WHERE id = 'c5000000-0000-0000-0000-000000000001'),
  'document deletion cascades owned collaboration data and nulls the amendment link'
);

DELETE FROM public.statement
WHERE id = 'c7000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.statement_survey WHERE id = 'c7100000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.statement_survey_option WHERE id = 'c7200000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.statement_survey_vote WHERE id = 'c7300000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.statement_support_vote WHERE id = 'c7400000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'statement deletion removes surveys and support data'
);

DELETE FROM public.hashtag
WHERE id = 'ca000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.user_hashtag WHERE hashtag_id = 'ca000000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.group_hashtag WHERE hashtag_id = 'ca000000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.amendment_hashtag WHERE hashtag_id = 'ca000000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.event_hashtag WHERE hashtag_id = 'ca000000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.blog_hashtag WHERE hashtag_id = 'ca000000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'hashtag deletion removes every entity association'
);

DELETE FROM public.event
WHERE id = 'c3000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::INTEGER FROM public.link WHERE id = 'cb000000-0000-0000-0000-000000000001'),
  0,
  'event deletion removes event links'
);

SELECT is(
  pg_temp.capture_sqlstate($sql$INSERT INTO public.thread (todo_id, user_id) VALUES ('c5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')$sql$),
  '23503',
  'discussion links reject dangling todo identifiers'
);

SELECT * FROM finish();

ROLLBACK;
