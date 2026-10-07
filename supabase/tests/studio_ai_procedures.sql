-- @covers schema 71_studio_ai_suggestions.sql
-- @covers schema 72_studio_personal_procedures.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(21);

INSERT INTO public."user" (id,handle) VALUES
('cb100000-0000-0000-0000-000000000001','ai-procedure-owner'),
('cb100000-0000-0000-0000-000000000002','ai-procedure-collaborator'),
('cb100000-0000-0000-0000-000000000003','ai-procedure-outsider');
INSERT INTO public.studio_project (id,owner_id,title,kind,created_at,updated_at) VALUES
('cb200000-0000-0000-0000-000000000001','cb100000-0000-0000-0000-000000000001','Presentation','presentation',0,0);
SELECT is((SELECT source_references FROM public.studio_project WHERE id='cb200000-0000-0000-0000-000000000001'),'[]'::jsonb,'New presentations start without source references');
SELECT throws_ok($$UPDATE public.studio_project SET source_references='{}' WHERE id='cb200000-0000-0000-0000-000000000001'$$,'23514',NULL,'Source references must be an array');
INSERT INTO public.studio_project_collaborator (id,project_id,user_id,invited_by_id,status,created_at,updated_at) VALUES
('cb300000-0000-0000-0000-000000000001','cb200000-0000-0000-0000-000000000001','cb100000-0000-0000-0000-000000000002','cb100000-0000-0000-0000-000000000001','invited',0,0);
SELECT ok(public.canvas_capability('cb100000-0000-0000-0000-000000000001','cb200000-0000-0000-0000-000000000001','vote'),'Owner belongs to the personal electorate');
SELECT ok(NOT public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','vote'),'Pending invitations cannot vote');
UPDATE public.studio_project_collaborator SET status='active' WHERE id='cb300000-0000-0000-0000-000000000001';
SELECT ok(public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','suggest'),'Accepted collaborator can suggest');
SELECT ok(public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','comment'),'Accepted collaborator can comment');
SELECT ok(public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','vote'),'Accepted collaborator can vote');
SELECT ok(NOT public.canvas_capability('cb100000-0000-0000-0000-000000000003','cb200000-0000-0000-0000-000000000001','vote'),'Outsiders cannot vote');
SELECT ok(NOT public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','manage'),'Collaboration does not grant owner management');
SELECT ok(NOT public.canvas_capability('cb100000-0000-0000-0000-000000000001','cb200000-0000-0000-0000-000000000001','unknown'),'Unknown capabilities are denied');

INSERT INTO public.canvas_proposal (id,project_id,owner_id,title,base_document,base_revision,base_generation,document,created_at,updated_at,origin,ai_request_key) VALUES
('cb400000-0000-0000-0000-000000000001','cb200000-0000-0000-0000-000000000001','cb100000-0000-0000-0000-000000000002','AI suggestion','{}',0,gen_random_uuid(),'{}',0,0,'ai','ai-procedure-request');
SELECT ok(public.canvas_proposal_access('cb100000-0000-0000-0000-000000000001','cb400000-0000-0000-0000-000000000001'),'Project owner can review a private AI suggestion');
SELECT ok(NOT public.canvas_proposal_access('cb100000-0000-0000-0000-000000000003','cb400000-0000-0000-0000-000000000001'),'Private AI suggestions remain inaccessible to outsiders');
UPDATE public.canvas_proposal SET origin='human' WHERE id='cb400000-0000-0000-0000-000000000001';
SELECT ok(NOT public.canvas_proposal_access('cb100000-0000-0000-0000-000000000001','cb400000-0000-0000-0000-000000000001'),'Human draft stays private to its author');
SELECT throws_ok($$UPDATE public.canvas_proposal SET origin='robot' WHERE id='cb400000-0000-0000-0000-000000000001'$$,'23514',NULL,'Proposal origin rejects unknown values');
SELECT throws_ok($$UPDATE public.canvas_proposal SET ai_mode='invalid' WHERE id='cb400000-0000-0000-0000-000000000001'$$,'23514',NULL,'AI mode rejects unknown values');
SELECT throws_ok($$UPDATE public.canvas_proposal SET ai_status='invalid' WHERE id='cb400000-0000-0000-0000-000000000001'$$,'23514',NULL,'AI status rejects unknown values');
SELECT throws_ok($$INSERT INTO public.canvas_proposal (id,project_id,owner_id,title,base_document,base_revision,base_generation,document,created_at,updated_at,ai_request_key) VALUES ('cb400000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','cb100000-0000-0000-0000-000000000001','Duplicate','{}',0,gen_random_uuid(),'{}',0,0,'ai-procedure-request')$$,'23505',NULL,'Request keys prevent duplicate AI proposals');
SELECT lives_ok($$UPDATE public.canvas_proposal SET ai_mode='template',ai_status='generating' WHERE id='cb400000-0000-0000-0000-000000000001'$$,'Template generation is supported');
SELECT lives_ok($$UPDATE public.canvas_proposal SET ai_mode='free',ai_status='ready' WHERE id='cb400000-0000-0000-0000-000000000001'$$,'Free suggestions can become ready');
UPDATE public.studio_project_collaborator SET status='declined' WHERE id='cb300000-0000-0000-0000-000000000001';
SELECT ok(NOT public.canvas_capability('cb100000-0000-0000-0000-000000000002','cb200000-0000-0000-0000-000000000001','suggest'),'Revocation removes suggestion capability');
SELECT ok(NOT public.canvas_proposal_access('cb100000-0000-0000-0000-000000000002','cb400000-0000-0000-0000-000000000001'),'Revocation removes access even for a proposal author');
SELECT * FROM finish();
ROLLBACK;
