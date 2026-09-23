-- Additive migration: original documents and IDs are preserved.
SELECT pg_advisory_xact_lock(1886351981);
ALTER TABLE public.studio_project DROP CONSTRAINT studio_project_kind_check;
ALTER TABLE public.studio_project ADD CONSTRAINT studio_project_kind_check CHECK (kind IN ('single','event','carousel','story','video','campaign','whiteboard'));
CREATE TABLE public.canvas_control (
 project_id uuid PRIMARY KEY REFERENCES public.studio_project(id) ON DELETE CASCADE,
 phase text NOT NULL DEFAULT 'edit' CHECK(phase IN ('edit','view','suggest_internal','vote_internal')),
 generation uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE public.canvas_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
 revision integer NOT NULL, generation uuid NOT NULL, document jsonb NOT NULL,
 created_at bigint NOT NULL, UNIQUE(project_id,revision)
);
CREATE TABLE public.canvas_proposal (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.studio_project(id), owner_id uuid NOT NULL REFERENCES public."user"(id),
 shared_ids uuid[] NOT NULL DEFAULT '{}', title text NOT NULL, reason text NOT NULL DEFAULT '',
 base_document jsonb NOT NULL, base_revision integer NOT NULL, base_generation uuid NOT NULL,
 document jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','submitted','voting','closed','withdrawn')),
 changes jsonb, checksum text, decision text CHECK(decision IN ('accepted','rejected')),
 application text NOT NULL DEFAULT 'pending' CHECK(application IN ('pending','applied','conflict','not_applicable')),
 conflicts jsonb NOT NULL DEFAULT '[]', electorate uuid[], deadline bigint,
 created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX canvas_proposal_project ON public.canvas_proposal(project_id,created_at);
CREATE TABLE public.canvas_vote (
 proposal_id uuid NOT NULL REFERENCES public.canvas_proposal(id), user_id uuid NOT NULL REFERENCES public."user"(id),
 choice text NOT NULL CHECK(choice IN ('accept','reject','abstain')), created_at bigint NOT NULL,
 PRIMARY KEY(proposal_id,user_id)
);
CREATE TABLE public.canvas_comment (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.studio_project(id), proposal_id uuid REFERENCES public.canvas_proposal(id),
 author_id uuid NOT NULL REFERENCES public."user"(id), element_id text, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
 resolved boolean NOT NULL DEFAULT false, created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE TABLE public.canvas_receipt (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.studio_project(id), actor_id uuid NOT NULL REFERENCES public."user"(id),
 input_hash text NOT NULL, result jsonb NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE public.canvas_library (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.studio_project(id),
 name text NOT NULL, content jsonb NOT NULL, created_by uuid NOT NULL REFERENCES public."user"(id), created_at bigint NOT NULL
);
CREATE FUNCTION public.canvas_manage(actor uuid,pid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM studio_project p WHERE p.id=pid AND
 ((p.group_id IS NULL AND p.owner_id=actor) OR EXISTS(SELECT 1 FROM "group" g WHERE g.id=p.group_id AND g.owner_id=actor)
 OR EXISTS(SELECT 1 FROM group_membership m WHERE m.group_id=p.group_id AND m.user_id=actor AND m.status IN ('active','member','admin') AND
 (m.status='admin' OR EXISTS(SELECT 1 FROM group_membership_role mr JOIN action_right a ON a.role_id=mr.role_id WHERE mr.group_membership_id=m.id AND a.group_id=p.group_id AND a.action='manage' AND a.resource IN ('groups','communicationStudio'))))));
$$;
CREATE FUNCTION public.canvas_proposal_access(actor uuid,wid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM canvas_proposal w WHERE w.id=wid AND studio_access(actor,w.project_id,false) AND (w.state<>'draft' OR w.owner_id=actor OR actor=ANY(w.shared_ids)));
$$;
REVOKE ALL ON FUNCTION public.canvas_manage(uuid,uuid),public.canvas_proposal_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_manage(uuid,uuid),public.canvas_proposal_access(uuid,uuid) TO service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['canvas_control','canvas_history','canvas_proposal','canvas_vote','canvas_comment','canvas_receipt','canvas_library'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
INSERT INTO canvas_control(project_id) SELECT id FROM studio_project;
INSERT INTO canvas_history(project_id,revision,generation,document,created_at)
 SELECT s.project_id,s.content_revision,c.generation,s.document,s.updated_at FROM studio_state s JOIN canvas_control c USING(project_id);
CREATE FUNCTION public.canvas_record_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
 DECLARE g uuid; phase_name text;
 BEGIN
 INSERT INTO canvas_control(project_id) VALUES(NEW.project_id) ON CONFLICT DO NOTHING;
 SELECT generation,phase INTO g,phase_name FROM canvas_control WHERE project_id=NEW.project_id FOR UPDATE;
 IF TG_OP='UPDATE' AND NEW.document IS DISTINCT FROM OLD.document AND phase_name<>'edit' AND current_setting('polity.canvas_command',true) IS DISTINCT FROM NEW.project_id::text THEN
 RAISE EXCEPTION 'Canvas content is locked by its procedure'; END IF;
 INSERT INTO canvas_history(project_id,revision,generation,document,created_at) VALUES(NEW.project_id,NEW.content_revision,g,NEW.document,NEW.updated_at) ON CONFLICT DO NOTHING;
 RETURN NEW;
 END $$;
CREATE TRIGGER canvas_record_revision AFTER INSERT OR UPDATE ON studio_state FOR EACH ROW EXECUTE FUNCTION canvas_record_revision();
CREATE OR REPLACE FUNCTION public.studio_realtime_access(topic text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN topic ~ '^studio:[0-9a-f-]{36}$' THEN studio_access(auth.uid(),substring(topic from 8)::uuid,false)
 WHEN topic ~ '^canvas-proposal:[0-9a-f-]{36}$' THEN canvas_proposal_access(auth.uid(),substring(topic from 17)::uuid) ELSE false END;
$$;
