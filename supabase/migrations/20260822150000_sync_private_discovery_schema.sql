-- Align the incremental private-discovery migrations with the declarative
-- search-document schema. The earlier migrations used temporary wrapper
-- functions and dedicated discovery triggers while the declarative schema
-- consolidates those paths in the canonical ACL functions.

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_membership_role_discovery
  ON public.group_membership_role;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_guest_role_discovery
  ON public.group_guest_role;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_action_right_discovery
  ON public.action_right;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_role_discovery
  ON public.role;

DROP FUNCTION IF EXISTS public.refresh_group_discovery_acl_relation_trigger();

CREATE OR REPLACE FUNCTION public.sync_search_document_acl(
  target_entity_type TEXT,
  target_entity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_document_id TEXT := public.search_document_id(target_entity_type, target_entity_id);
  target_visibility TEXT;
  source_type TEXT;
  source_id UUID;
BEGIN
  DELETE FROM public.search_document_acl
  WHERE document_id = target_document_id;

  SELECT visibility
  INTO target_visibility
  FROM public.search_document
  WHERE id = target_document_id;

  IF target_visibility IS DISTINCT FROM 'private' THEN
    RETURN;
  END IF;

  IF target_entity_type = 'user' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    VALUES (target_document_id, target_entity_id)
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'group' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_group_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'statement' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT s.user_id
      FROM public.statement AS s
      WHERE s.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.statement AS s
      CROSS JOIN LATERAL public.search_document_group_acl_users(s.group_id) AS access
      WHERE s.id = target_entity_id
        AND s.group_id IS NOT NULL
    ) AS candidates
    WHERE candidates.user_id IS NOT NULL
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'blog' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_blog_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'amendment' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_amendment_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'event' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_event_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'todo' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT t.creator_id AS user_id
      FROM public.todo AS t
      WHERE t.id = target_entity_id
      UNION
      SELECT ta.user_id
      FROM public.todo_assignment AS ta
      WHERE ta.todo_id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      CROSS JOIN LATERAL public.search_document_group_acl_users(t.group_id) AS access
      WHERE t.id = target_entity_id
        AND t.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.todo AS t
      JOIN public.event_participant AS ep ON ep.event_id = t.event_id
      WHERE t.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
      UNION
      SELECT e.creator_id
      FROM public.todo AS t
      JOIN public.event AS e ON e.id = t.event_id
      WHERE t.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      JOIN public.event AS e ON e.id = t.event_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(e.group_id) AS access
      WHERE t.id = target_entity_id
        AND e.group_id IS NOT NULL
      UNION
      SELECT a.created_by_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      WHERE t.id = target_entity_id
      UNION
      SELECT ac.user_id
      FROM public.todo AS t
      JOIN public.amendment_collaborator AS ac ON ac.amendment_id = t.amendment_id
      WHERE t.id = target_entity_id
        AND ac.status IN ('active', 'collaborator', 'member', 'admin')
      UNION
      SELECT access.user_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(a.group_id) AS access
      WHERE t.id = target_entity_id
        AND a.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.todo AS t
      JOIN public.amendment AS a ON a.id = t.amendment_id
      JOIN public.event_participant AS ep ON ep.event_id = a.event_id
      WHERE t.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'dataset' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT d.owner_user_id AS user_id
      FROM public.dataset AS d
      WHERE d.id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.dataset AS d
      CROSS JOIN LATERAL public.search_document_group_acl_users(d.group_id) AS access
      WHERE d.id = target_entity_id
        AND d.group_id IS NOT NULL
    ) AS candidates
    WHERE candidates.user_id IS NOT NULL
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'election' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT el.user_id
      FROM public.elector AS el
      WHERE el.election_id = target_entity_id
      UNION
      SELECT access.user_id
      FROM public.election AS e
      JOIN public.role AS r ON r.id = e.role_id
      CROSS JOIN LATERAL public.search_document_group_acl_users(r.group_id) AS access
      WHERE e.id = target_entity_id
        AND r.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.election AS e
      JOIN public.agenda_item AS ai ON ai.id = e.agenda_item_id
      JOIN public.event_participant AS ep ON ep.event_id = ai.event_id
      WHERE e.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'timeline_event' THEN
    SELECT
      CASE
        WHEN te.todo_id IS NOT NULL THEN 'todo'
        WHEN te.statement_id IS NOT NULL THEN 'statement'
        WHEN te.amendment_id IS NOT NULL THEN 'amendment'
        WHEN te.event_id IS NOT NULL THEN 'event'
        WHEN te.blog_id IS NOT NULL THEN 'blog'
        WHEN te.group_id IS NOT NULL THEN 'group'
        WHEN te.election_id IS NOT NULL THEN 'election'
        WHEN te.user_id IS NOT NULL THEN 'user'
        WHEN te.actor_id IS NOT NULL THEN 'user'
        ELSE NULL
      END,
      coalesce(
        te.todo_id,
        te.statement_id,
        te.amendment_id,
        te.event_id,
        te.blog_id,
        te.group_id,
        te.election_id,
        te.user_id,
        te.actor_id
      )
    INTO source_type, source_id
    FROM public.timeline_event AS te
    WHERE te.id = target_entity_id;

    IF source_type IS NOT NULL AND source_id IS NOT NULL THEN
      INSERT INTO public.search_document_acl (document_id, user_id)
      SELECT target_document_id, acl.user_id
      FROM public.search_document_acl AS acl
      WHERE acl.document_id = public.search_document_id(source_type, source_id)
      ON CONFLICT (document_id, user_id) DO NOTHING;
    END IF;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.sync_search_document_acl_legacy(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.refresh_search_document_acl_relation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_parent_id UUID;
  new_parent_id UUID;
BEGIN
  IF TG_TABLE_NAME IN ('group_membership', 'group_guest_access') THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.group_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.group_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'group_membership_role' THEN
    old_parent_id := CASE
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
        SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = OLD.group_membership_id
      )
      ELSE NULL
    END;
    new_parent_id := CASE
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
        SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = NEW.group_membership_id
      )
      ELSE NULL
    END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'group_guest_role' THEN
    old_parent_id := CASE
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
        SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = OLD.group_guest_access_id
      )
      ELSE NULL
    END;
    new_parent_id := CASE
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
        SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = NEW.group_guest_access_id
      )
      ELSE NULL
    END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'action_right' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT r.group_id FROM public.role AS r WHERE r.id = OLD.role_id
    ) ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT r.group_id FROM public.role AS r WHERE r.id = NEW.role_id
    ) ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'role' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.group_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.group_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.refresh_group_search_document_acls(old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.refresh_group_search_document_acls(new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'event_participant' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('event', old_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'amendment',
        a.id
      ) FROM public.amendment AS a WHERE a.event_id = old_parent_id;
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.event_id = old_parent_id;
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('event', new_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'amendment',
        a.id
      ) FROM public.amendment AS a WHERE a.event_id = new_parent_id;
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.event_id = new_parent_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'amendment_collaborator' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('amendment', old_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.amendment_id = old_parent_id;
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('amendment', new_parent_id);
      PERFORM public.sync_search_document_acl_with_derivatives(
        'todo',
        t.id
      ) FROM public.todo AS t WHERE t.amendment_id = new_parent_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'blog_blogger' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('blog', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('blog', new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'todo_assignment' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.todo_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.todo_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('todo', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('todo', new_parent_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'elector' THEN
    old_parent_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.election_id ELSE NULL END;
    new_parent_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.election_id ELSE NULL END;
    IF old_parent_id IS NOT NULL THEN
      PERFORM public.sync_search_document_acl_with_derivatives('election', old_parent_id);
    END IF;
    IF new_parent_id IS NOT NULL AND new_parent_id IS DISTINCT FROM old_parent_id THEN
      PERFORM public.sync_search_document_acl_with_derivatives('election', new_parent_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_event_id UUID;
  new_event_id UUID;
  old_amendment_id UUID;
  new_amendment_id UUID;
  old_blog_id UUID;
  new_blog_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'event_participant_role' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT ep.event_id
      FROM public.event_participant AS ep
      WHERE ep.id = OLD.event_participant_id
    ) END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT ep.event_id
      FROM public.event_participant AS ep
      WHERE ep.id = NEW.event_participant_id
    ) END;
  ELSIF TG_TABLE_NAME = 'action_right' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id END;
    old_amendment_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id END;
    new_amendment_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id END;
    old_blog_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id END;
    new_blog_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id END;
  ELSIF TG_TABLE_NAME = 'role' THEN
    old_event_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id END;
    old_amendment_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.amendment_id END;
    new_amendment_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.amendment_id END;
    old_blog_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.blog_id END;
    new_blog_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.blog_id END;
  END IF;

  IF old_event_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('event', old_event_id);
  END IF;
  IF new_event_id IS NOT NULL AND new_event_id IS DISTINCT FROM old_event_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('event', new_event_id);
  END IF;
  IF old_amendment_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', old_amendment_id);
  END IF;
  IF new_amendment_id IS NOT NULL AND new_amendment_id IS DISTINCT FROM old_amendment_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', new_amendment_id);
  END IF;
  IF old_blog_id IS NOT NULL THEN
    PERFORM public.sync_search_document_acl_with_derivatives('blog', old_blog_id);
  END IF;
  IF new_blog_id IS NOT NULL AND new_blog_id IS DISTINCT FROM old_blog_id THEN
    PERFORM public.sync_search_document_acl_with_derivatives('blog', new_blog_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_membership_role
  ON public.group_membership_role;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_guest_role
  ON public.group_guest_role;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_action_right
  ON public.action_right;
DROP TRIGGER IF EXISTS trg_zz_search_document_acl_role
  ON public.role;

CREATE TRIGGER trg_zz_search_document_acl_group_membership_role
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_role
AFTER INSERT OR UPDATE OR DELETE ON public.group_guest_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role
AFTER INSERT OR UPDATE OR DELETE ON public.role
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

-- Functions created after the least-privilege baseline must not inherit
-- PostgreSQL's default PUBLIC execution grant.
REVOKE ALL ON FUNCTION public.permission_action_implies_view(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_document_group_discovery_acl_users(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_document_event_discovery_acl_users(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_document_amendment_discovery_acl_users(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_document_blog_discovery_acl_users(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_search_document_acl(TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_private_entity_discovery_acl_role_trigger()
  FROM PUBLIC, anon, authenticated, service_role;
