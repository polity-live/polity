-- Private application API data, deliberately absent from the Zero publication.
CREATE TABLE public.collaboration_comment (
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  id text NOT NULL CHECK(length(id) BETWEEN 1 AND 200),
  thread_id text NOT NULL CHECK(length(thread_id) BETWEEN 1 AND 200),
  author_id uuid NOT NULL REFERENCES public."user"(id),
  content jsonb NOT NULL,
  anchor jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY(document_id,id)
);
CREATE TABLE public.collaboration_command (
  document_id uuid NOT NULL REFERENCES public.collaboration_document(id),
  operation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public."user"(id),
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY(document_id,operation_id)
);
CREATE TABLE public.collaboration_comment_history (
  document_id uuid NOT NULL,
  comment_id text NOT NULL,
  revision bigint NOT NULL,
  actor_id uuid NOT NULL REFERENCES public."user"(id),
  snapshot jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY(document_id,comment_id,revision),
  FOREIGN KEY(document_id,comment_id) REFERENCES public.collaboration_comment(document_id,id)
);
ALTER TABLE public.collaboration_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_command ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_comment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaboration_comment,public.collaboration_command,public.collaboration_comment_history FROM anon,authenticated;
GRANT ALL ON public.collaboration_comment,public.collaboration_command,public.collaboration_comment_history TO service_role;
CREATE TRIGGER collaboration_comment_history_immutable BEFORE UPDATE OR DELETE ON public.collaboration_comment_history FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();
CREATE TRIGGER collaboration_command_immutable BEFORE UPDATE OR DELETE ON public.collaboration_command FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();

-- Authority changes invalidate offline generations as well as active sockets.
-- First release conservatively invalidates all rooms on membership/RBAC changes.
CREATE FUNCTION public.collaboration_acl_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT (SELECT phase='active' FROM collaboration_control WHERE singleton) THEN RETURN NULL; END IF;
  IF TG_LEVEL='ROW' AND TG_OP='UPDATE' AND
    (to_jsonb(NEW)->'visibility') IS NOT DISTINCT FROM (to_jsonb(OLD)->'visibility') AND
    (to_jsonb(NEW)->'editing_mode') IS NOT DISTINCT FROM (to_jsonb(OLD)->'editing_mode') AND
    (to_jsonb(NEW)->'status') IS NOT DISTINCT FROM (to_jsonb(OLD)->'status') AND
    (to_jsonb(NEW)->'group_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->'group_id') THEN RETURN NULL; END IF;
  UPDATE collaboration_document SET generation=gen_random_uuid(),updated_at=(extract(epoch from clock_timestamp())*1000)::bigint WHERE NOT deleted;
  INSERT INTO collaboration_outbox(document_id,generation,revision,created_at)
    SELECT id,generation,revision,updated_at FROM collaboration_document WHERE NOT deleted;
  RETURN NULL;
END $$;
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['group_membership','group_membership_role','group_guest_access','event_participant','event_participant_role','amendment_collaborator','document_collaborator','blog_blogger','role','action_right','accreditation'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_acl AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_acl_changed()',target);
  END LOOP;
  FOREACH target IN ARRAY ARRAY['document','blog','amendment','amendment_process_branch','group','event','studio_project'] LOOP
    EXECUTE format('CREATE TRIGGER collaboration_acl AFTER UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.collaboration_acl_changed()',target);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.collaboration_acl_changed() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collaboration_acl_changed() TO service_role;
