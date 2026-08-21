-- Private groups are discoverable only by their owner or by invited/accepted
-- group roles that explicitly grant groups:view (or groups:manage).

CREATE OR REPLACE FUNCTION public.search_document_group_discovery_acl_users(target_group_id UUID)
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
  JOIN public.group_membership_role AS gmr ON gmr.group_membership_id = gm.id
  JOIN public.role AS r
    ON r.id = gmr.role_id
   AND r.scope = 'group'
   AND r.group_id = target_group_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.group_id = target_group_id
   AND ar.resource = 'groups'
   AND ar.action IN ('view', 'manage')
  WHERE gm.group_id = target_group_id
    AND gm.status IN ('invited', 'active', 'member', 'admin')
  UNION
  SELECT ga.user_id
  FROM public.group_guest_access AS ga
  JOIN public.group_guest_role AS ggr ON ggr.group_guest_access_id = ga.id
  JOIN public.role AS r
    ON r.id = ggr.role_id
   AND r.scope = 'group'
   AND r.group_id = target_group_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.group_id = target_group_id
   AND ar.resource = 'groups'
   AND ar.action IN ('view', 'manage')
  WHERE ga.group_id = target_group_id
    AND ga.status IN ('invited', 'active');
$$;

-- Retain the existing ACL behaviour for every child entity. The group branch
-- is replaced independently so invites cannot expose child documents.
ALTER FUNCTION public.sync_search_document_acl(TEXT, UUID)
  RENAME TO sync_search_document_acl_legacy;

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
BEGIN
  IF target_entity_type <> 'group' THEN
    PERFORM public.sync_search_document_acl_legacy(target_entity_type, target_entity_id);
    RETURN;
  END IF;

  DELETE FROM public.search_document_acl
  WHERE document_id = target_document_id;

  SELECT visibility
  INTO target_visibility
  FROM public.search_document
  WHERE id = target_document_id;

  IF target_visibility IS DISTINCT FROM 'private' THEN
    RETURN;
  END IF;

  INSERT INTO public.search_document_acl (document_id, user_id)
  SELECT target_document_id, access.user_id
  FROM public.search_document_group_discovery_acl_users(target_entity_id) AS access
  ON CONFLICT (document_id, user_id) DO NOTHING;
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

CREATE OR REPLACE FUNCTION public.refresh_group_discovery_acl_relation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_group_id UUID;
  new_group_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'group_membership_role' THEN
    old_group_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = OLD.group_membership_id
    ) END;
    new_group_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT gm.group_id FROM public.group_membership AS gm WHERE gm.id = NEW.group_membership_id
    ) END;
  ELSIF TG_TABLE_NAME = 'group_guest_role' THEN
    old_group_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = OLD.group_guest_access_id
    ) END;
    new_group_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT ga.group_id FROM public.group_guest_access AS ga WHERE ga.id = NEW.group_guest_access_id
    ) END;
  ELSIF TG_TABLE_NAME = 'action_right' THEN
    old_group_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN (
      SELECT r.group_id FROM public.role AS r WHERE r.id = OLD.role_id
    ) END;
    new_group_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT r.group_id FROM public.role AS r WHERE r.id = NEW.role_id
    ) END;
  ELSIF TG_TABLE_NAME = 'role' THEN
    old_group_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.group_id END;
    new_group_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.group_id END;
  END IF;

  IF old_group_id IS NOT NULL THEN
    PERFORM public.refresh_group_search_document_acls(old_group_id);
  END IF;
  IF new_group_id IS NOT NULL AND new_group_id IS DISTINCT FROM old_group_id THEN
    PERFORM public.refresh_group_search_document_acls(new_group_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_zz_search_document_acl_group_membership_role_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.group_membership_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_group_discovery_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_role_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.group_guest_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_group_discovery_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_group_discovery_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.role
FOR EACH ROW EXECUTE FUNCTION public.refresh_group_discovery_acl_relation_trigger();

-- Existing default Member roles acquire the same read right as newly created ones.
INSERT INTO public.action_right (id, resource, action, role_id, group_id, created_at)
SELECT gen_random_uuid(), 'groups', 'view', r.id, r.group_id, now()
FROM public.role AS r
WHERE r.scope = 'group'
  AND r.name = 'Member'
  AND r.default_request_role = true
  AND r.default_invite_role = true
  AND r.group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.action_right AS ar
    WHERE ar.role_id = r.id
      AND ar.group_id = r.group_id
      AND ar.resource = 'groups'
      AND ar.action = 'view'
  );

SELECT public.refresh_group_search_document_acls(g.id)
FROM public."group" AS g;
