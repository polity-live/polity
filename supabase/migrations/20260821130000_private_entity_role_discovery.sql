-- Private event, amendment, and blog discovery follows scoped role rights.

CREATE OR REPLACE FUNCTION public.permission_action_implies_view(target_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT target_action IN (
    'view',
    'manage',
    'moderate',
    'manage_members',
    'manage_roles',
    'manage_participants',
    'manage_speakers',
    'manage_votes',
    'speak'
  );
$$;

CREATE OR REPLACE FUNCTION public.search_document_event_discovery_acl_users(target_event_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.creator_id
  FROM public.event AS e
  WHERE e.id = target_event_id
    AND e.creator_id IS NOT NULL
  UNION
  SELECT ep.user_id
  FROM public.event_participant AS ep
  JOIN public.event_participant_role AS epr ON epr.event_participant_id = ep.id
  JOIN public.role AS r
    ON r.id = epr.role_id
   AND r.scope = 'event'
   AND r.event_id = target_event_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.event_id = target_event_id
   AND ar.resource = 'events'
   AND public.permission_action_implies_view(ar.action)
  WHERE ep.event_id = target_event_id
    AND ep.status IN ('invited', 'active', 'confirmed', 'member', 'admin')
  UNION
  SELECT access.user_id
  FROM public.event AS e
  CROSS JOIN LATERAL public.search_document_group_acl_users(e.group_id) AS access
  WHERE e.id = target_event_id
    AND e.group_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.search_document_amendment_discovery_acl_users(
  target_amendment_id UUID
)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.created_by_id
  FROM public.amendment AS a
  WHERE a.id = target_amendment_id
    AND a.created_by_id IS NOT NULL
  UNION
  SELECT ac.user_id
  FROM public.amendment_collaborator AS ac
  JOIN public.role AS r
    ON r.id = ac.role_id
   AND r.scope = 'amendment'
   AND r.amendment_id = target_amendment_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.amendment_id = target_amendment_id
   AND ar.resource = 'amendments'
   AND public.permission_action_implies_view(ar.action)
  WHERE ac.amendment_id = target_amendment_id
    AND ac.status IN ('invited', 'active', 'collaborator', 'member', 'admin')
  UNION
  SELECT access.user_id
  FROM public.amendment AS a
  CROSS JOIN LATERAL public.search_document_group_acl_users(a.group_id) AS access
  WHERE a.id = target_amendment_id
    AND a.group_id IS NOT NULL
  UNION
  SELECT ep.user_id
  FROM public.amendment AS a
  JOIN public.event_participant AS ep ON ep.event_id = a.event_id
  WHERE a.id = target_amendment_id
    AND ep.status IN ('active', 'confirmed', 'member', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.search_document_blog_discovery_acl_users(target_blog_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT bb.user_id
  FROM public.blog_blogger AS bb
  WHERE bb.blog_id = target_blog_id
    AND bb.status = 'owner'
  UNION
  SELECT bb.user_id
  FROM public.blog_blogger AS bb
  JOIN public.role AS r
    ON r.id = bb.role_id
   AND r.scope = 'blog'
   AND r.blog_id = target_blog_id
  JOIN public.action_right AS ar
    ON ar.role_id = r.id
   AND ar.blog_id = target_blog_id
   AND ar.resource = 'blogs'
   AND public.permission_action_implies_view(ar.action)
  WHERE bb.blog_id = target_blog_id
    AND bb.status IN ('invited', 'admin', 'member', 'writer')
  UNION
  SELECT access.user_id
  FROM public.blog AS b
  CROSS JOIN LATERAL public.search_document_group_acl_users(b.group_id) AS access
  WHERE b.id = target_blog_id
    AND b.group_id IS NOT NULL;
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
BEGIN
  IF target_entity_type NOT IN ('group', 'event', 'amendment', 'blog') THEN
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

  IF target_entity_type = 'group' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_group_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;
  ELSIF target_entity_type = 'event' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_event_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;
  ELSIF target_entity_type = 'amendment' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_amendment_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;
  ELSIF target_entity_type = 'blog' THEN
    INSERT INTO public.search_document_acl (document_id, user_id)
    SELECT target_document_id, access.user_id
    FROM public.search_document_blog_discovery_acl_users(target_entity_id) AS access
    ON CONFLICT (document_id, user_id) DO NOTHING;
  END IF;
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
      SELECT ep.event_id FROM public.event_participant AS ep
      WHERE ep.id = OLD.event_participant_id
    ) END;
    new_event_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (
      SELECT ep.event_id FROM public.event_participant AS ep
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

CREATE TRIGGER trg_zz_search_document_acl_event_participant_role_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.event_participant_role
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right_entity_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.action_right
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role_entity_discovery
AFTER INSERT OR UPDATE OR DELETE ON public.role
FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

SELECT public.sync_search_document_acl_with_derivatives('event', e.id)
FROM public.event AS e;

SELECT public.sync_search_document_acl_with_derivatives('amendment', a.id)
FROM public.amendment AS a;

SELECT public.sync_search_document_acl_with_derivatives('blog', b.id)
FROM public.blog AS b;
