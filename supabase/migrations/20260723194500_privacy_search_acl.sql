-- Keep private search results aligned with the same relationship rules as
-- entity reads. Public/authenticated documents do not need ACL rows.

CREATE OR REPLACE FUNCTION public.search_document_group_acl_users(target_group_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT g.owner_id
  FROM public."group" AS g
  WHERE g.id = target_group_id
    AND g.owner_id IS NOT NULL
  UNION
  SELECT gm.user_id
  FROM public.group_membership AS gm
  WHERE gm.group_id = target_group_id
    AND gm.status IN ('active', 'member', 'admin')
  UNION
  SELECT ga.user_id
  FROM public.group_guest_access AS ga
  WHERE ga.group_id = target_group_id
    AND ga.status = 'active';
$$;

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
    FROM public.search_document_group_acl_users(target_entity_id) AS access
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
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT bb.user_id
      FROM public.blog_blogger AS bb
      WHERE bb.blog_id = target_entity_id
        AND bb.status IN ('owner', 'admin', 'member', 'writer')
      UNION
      SELECT access.user_id
      FROM public.blog AS b
      CROSS JOIN LATERAL public.search_document_group_acl_users(b.group_id) AS access
      WHERE b.id = target_entity_id
        AND b.group_id IS NOT NULL
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'amendment' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT a.created_by_id AS user_id
      FROM public.amendment AS a
      WHERE a.id = target_entity_id
      UNION
      SELECT ac.user_id
      FROM public.amendment_collaborator AS ac
      WHERE ac.amendment_id = target_entity_id
        AND ac.status IN ('active', 'collaborator', 'member', 'admin')
      UNION
      SELECT access.user_id
      FROM public.amendment AS a
      CROSS JOIN LATERAL public.search_document_group_acl_users(a.group_id) AS access
      WHERE a.id = target_entity_id
        AND a.group_id IS NOT NULL
      UNION
      SELECT ep.user_id
      FROM public.amendment AS a
      JOIN public.event_participant AS ep ON ep.event_id = a.event_id
      WHERE a.id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
    ) AS candidates
    ON CONFLICT (document_id, user_id) DO NOTHING;

  ELSIF target_entity_type = 'event' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, candidates.user_id
    FROM (
      SELECT e.creator_id AS user_id
      FROM public.event AS e
      WHERE e.id = target_entity_id
      UNION
      SELECT ep.user_id
      FROM public.event_participant AS ep
      WHERE ep.event_id = target_entity_id
        AND ep.status IN ('active', 'confirmed', 'member', 'admin')
      UNION
      SELECT access.user_id
      FROM public.event AS e
      CROSS JOIN LATERAL public.search_document_group_acl_users(e.group_id) AS access
      WHERE e.id = target_entity_id
        AND e.group_id IS NOT NULL
    ) AS candidates
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

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_with_derivatives(
  target_entity_type TEXT,
  target_entity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  timeline_row RECORD;
BEGIN
  PERFORM public.sync_search_document_acl(target_entity_type, target_entity_id);

  IF target_entity_type = 'timeline_event' THEN
    RETURN;
  END IF;

  IF target_entity_type = 'event' THEN
    PERFORM public.sync_search_document_acl_with_derivatives('amendment', a.id)
    FROM public.amendment AS a
    WHERE a.event_id = target_entity_id;

    PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
    FROM public.todo AS t
    WHERE t.event_id = target_entity_id;
  ELSIF target_entity_type = 'amendment' THEN
    PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
    FROM public.todo AS t
    WHERE t.amendment_id = target_entity_id;
  END IF;

  FOR timeline_row IN
    SELECT te.id
    FROM public.timeline_event AS te
    WHERE
      (target_entity_type = 'todo' AND te.todo_id = target_entity_id)
      OR (target_entity_type = 'statement' AND te.statement_id = target_entity_id)
      OR (target_entity_type = 'amendment' AND te.amendment_id = target_entity_id)
      OR (target_entity_type = 'event' AND te.event_id = target_entity_id)
      OR (target_entity_type = 'blog' AND te.blog_id = target_entity_id)
      OR (target_entity_type = 'group' AND te.group_id = target_entity_id)
      OR (target_entity_type = 'election' AND te.election_id = target_entity_id)
      OR (
        target_entity_type = 'user'
        AND (te.user_id = target_entity_id OR te.actor_id = target_entity_id)
      )
  LOOP
    UPDATE public.search_document AS timeline_document
    SET visibility = coalesce((
      SELECT visibility
      FROM public.search_document
      WHERE id = public.search_document_id(target_entity_type, target_entity_id)
    ), timeline_document.visibility)
    WHERE timeline_document.id = public.search_document_id('timeline_event', timeline_row.id);

    PERFORM public.sync_search_document_acl('timeline_event', timeline_row.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_group_search_document_acls(target_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  document_row RECORD;
BEGIN
  FOR document_row IN
    SELECT sd.entity_type, sd.entity_id
    FROM public.search_document AS sd
    WHERE sd.group_id = target_group_id
      AND sd.entity_type IN (
        'group',
        'statement',
        'blog',
        'amendment',
        'event',
        'todo',
        'dataset',
        'election'
      )
  LOOP
    PERFORM public.sync_search_document_acl_with_derivatives(
      document_row.entity_type,
      document_row.entity_id
    );
  END LOOP;

  PERFORM public.sync_search_document_acl_with_derivatives('todo', t.id)
  FROM public.todo AS t
  LEFT JOIN public.event AS e ON e.id = t.event_id
  LEFT JOIN public.amendment AS a ON a.id = t.amendment_id
  WHERE e.group_id = target_group_id
     OR a.group_id = target_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_entity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  entity_type TEXT := TG_TABLE_NAME;
  entity_id UUID := NEW.id;
BEGIN
  IF entity_type = 'user' THEN
    entity_type := 'user';
  END IF;

  PERFORM public.sync_search_document_acl_with_derivatives(entity_type, entity_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_timeline_search_document_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  source_visibility TEXT;
BEGIN
  source_visibility := coalesce(
    (SELECT t.visibility FROM public.todo AS t WHERE t.id = NEW.todo_id),
    (SELECT s.visibility FROM public.statement AS s WHERE s.id = NEW.statement_id),
    (SELECT a.visibility FROM public.amendment AS a WHERE a.id = NEW.amendment_id),
    (SELECT e.visibility FROM public.event AS e WHERE e.id = NEW.event_id),
    (SELECT b.visibility FROM public.blog AS b WHERE b.id = NEW.blog_id),
    (SELECT g.visibility FROM public."group" AS g WHERE g.id = NEW.group_id),
    (SELECT e.visibility FROM public.election AS e WHERE e.id = NEW.election_id),
    (SELECT u.visibility FROM public."user" AS u WHERE u.id = coalesce(NEW.user_id, NEW.actor_id)),
    'public'
  );

  UPDATE public.search_document
  SET visibility = source_visibility
  WHERE id = public.search_document_id('timeline_event', NEW.id);

  PERFORM public.sync_search_document_acl('timeline_event', NEW.id);
  RETURN NEW;
END;
$$;

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

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_user ON public."user";
CREATE TRIGGER trg_zz_search_document_acl_user
AFTER INSERT OR UPDATE ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group ON public."group";
CREATE TRIGGER trg_zz_search_document_acl_group
AFTER INSERT OR UPDATE ON public."group"
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_statement ON public.statement;
CREATE TRIGGER trg_zz_search_document_acl_statement
AFTER INSERT OR UPDATE ON public.statement
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_blog ON public.blog;
CREATE TRIGGER trg_zz_search_document_acl_blog
AFTER INSERT OR UPDATE ON public.blog
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_amendment ON public.amendment;
CREATE TRIGGER trg_zz_search_document_acl_amendment
AFTER INSERT OR UPDATE ON public.amendment
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_event ON public.event;
CREATE TRIGGER trg_zz_search_document_acl_event
AFTER INSERT OR UPDATE ON public.event
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_todo ON public.todo;
CREATE TRIGGER trg_zz_search_document_acl_todo
AFTER INSERT OR UPDATE ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_dataset ON public.dataset;
CREATE TRIGGER trg_zz_search_document_acl_dataset
AFTER INSERT OR UPDATE ON public.dataset
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_election ON public.election;
CREATE TRIGGER trg_zz_search_document_acl_election
AFTER INSERT OR UPDATE ON public.election
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_timeline_event ON public.timeline_event;
CREATE TRIGGER trg_zz_search_document_acl_timeline_event
AFTER INSERT OR UPDATE ON public.timeline_event
FOR EACH ROW EXECUTE FUNCTION public.sync_timeline_search_document_privacy();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_membership ON public.group_membership;
CREATE TRIGGER trg_zz_search_document_acl_group_membership
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_group_guest_access ON public.group_guest_access;
CREATE TRIGGER trg_zz_search_document_acl_group_guest_access
AFTER INSERT OR UPDATE OR DELETE ON public.group_guest_access
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_event_participant ON public.event_participant;
CREATE TRIGGER trg_zz_search_document_acl_event_participant
AFTER INSERT OR UPDATE OR DELETE ON public.event_participant
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_amendment_collaborator
ON public.amendment_collaborator;
CREATE TRIGGER trg_zz_search_document_acl_amendment_collaborator
AFTER INSERT OR UPDATE OR DELETE ON public.amendment_collaborator
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_blog_blogger ON public.blog_blogger;
CREATE TRIGGER trg_zz_search_document_acl_blog_blogger
AFTER INSERT OR UPDATE OR DELETE ON public.blog_blogger
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_todo_assignment ON public.todo_assignment;
CREATE TRIGGER trg_zz_search_document_acl_todo_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.todo_assignment
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DROP TRIGGER IF EXISTS trg_zz_search_document_acl_elector ON public.elector;
CREATE TRIGGER trg_zz_search_document_acl_elector
AFTER INSERT OR UPDATE OR DELETE ON public.elector
FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

DO $$
DECLARE
  document_row RECORD;
BEGIN
  FOR document_row IN
    SELECT sd.entity_type, sd.entity_id
    FROM public.search_document AS sd
    WHERE sd.entity_type IN (
      'user',
      'group',
      'statement',
      'blog',
      'amendment',
      'event',
      'todo',
      'dataset',
      'election'
    )
  LOOP
    PERFORM public.sync_search_document_acl_with_derivatives(
      document_row.entity_type,
      document_row.entity_id
    );
  END LOOP;

  UPDATE public.search_document AS sd
  SET visibility = coalesce(
    (SELECT t.visibility FROM public.todo AS t WHERE t.id = te.todo_id),
    (SELECT s.visibility FROM public.statement AS s WHERE s.id = te.statement_id),
    (SELECT a.visibility FROM public.amendment AS a WHERE a.id = te.amendment_id),
    (SELECT e.visibility FROM public.event AS e WHERE e.id = te.event_id),
    (SELECT b.visibility FROM public.blog AS b WHERE b.id = te.blog_id),
    (SELECT g.visibility FROM public."group" AS g WHERE g.id = te.group_id),
    (SELECT e.visibility FROM public.election AS e WHERE e.id = te.election_id),
    (SELECT u.visibility FROM public."user" AS u WHERE u.id = coalesce(te.user_id, te.actor_id)),
    'public'
  )
  FROM public.timeline_event AS te
  WHERE sd.id = public.search_document_id('timeline_event', te.id);

  FOR document_row IN SELECT te.id FROM public.timeline_event AS te
  LOOP
    PERFORM public.sync_search_document_acl('timeline_event', document_row.id);
  END LOOP;
END;
$$;
