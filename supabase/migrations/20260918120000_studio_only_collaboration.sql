-- Roll back the editor migration while retaining Studio collaboration/history.
-- Existing entity projections remain the source of truth for legacy editors.
SELECT pg_advisory_xact_lock(1886351981);

DO $$ DECLARE item record; BEGIN
  FOR item IN
    SELECT t.tgname,c.relname FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE 'collaboration_%'
      AND c.relname NOT LIKE 'collaboration_%'
      AND c.relname NOT IN ('studio_project','studio_state','group','group_membership',
        'group_membership_role','role','action_right')
  LOOP EXECUTE format('DROP TRIGGER %I ON public.%I',item.tgname,item.relname); END LOOP;
END $$;

-- Historical migration proofs must not prevent legacy delete/cleanup commands.
-- Their recorded identifiers and immutable snapshots remain available to admins.
DO $$ DECLARE item record; BEGIN
  FOR item IN
    SELECT c.conname,source.relname FROM pg_constraint c
    JOIN pg_class source ON source.oid=c.conrelid
    JOIN pg_class target ON target.oid=c.confrelid
    JOIN pg_namespace n ON n.oid=source.relnamespace
    WHERE c.contype='f' AND n.nspname='public' AND source.relname LIKE 'collaboration_%'
      AND target.relname IN ('vote','change_request','document_version')
  LOOP EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',item.relname,item.conname); END LOOP;
END $$;

-- Return canonical comments to the old editor discussion store, preserving
-- existing threads and excluding private draft workspaces.
DO $$ DECLARE item record; legacy_threads jsonb; restored_threads jsonb; BEGIN
  FOR item IN
    SELECT d.id,d.kind,d.entity_id,d.branch_id,doc.amendment_id
      FROM collaboration_document d LEFT JOIN document doc ON d.kind='document' AND doc.id=d.entity_id
      WHERE d.kind IN ('document','blog') AND d.workspace_id IS NULL AND NOT d.deleted
  LOOP
    SELECT jsonb_agg(thread ORDER BY thread->>'id') INTO restored_threads FROM (
      SELECT jsonb_build_object('id',c.thread_id,'isResolved',bool_and(c.resolved),
        'visibilityScope',CASE WHEN bool_or(c.visibility='collaborators') THEN 'collaborators' ELSE 'public' END,
        'changeRequestEntityId',min(c.change_request_id::text),
        'comments',jsonb_agg(jsonb_build_object('id',c.id,'userId',c.author_id,
          'contentRich',c.content,'createdAt',to_timestamp(c.created_at/1000.0),
          'discussionId',c.thread_id,'isEdited',c.revision>1) ORDER BY c.created_at,c.id)) AS thread
      FROM collaboration_comment c WHERE c.document_id=item.id AND NOT c.deleted GROUP BY c.thread_id
    ) threads;
    IF restored_threads IS NULL THEN CONTINUE; END IF;
    IF item.kind='blog' THEN SELECT discussions INTO legacy_threads FROM blog WHERE id=item.entity_id;
    ELSIF item.branch_id IS NOT NULL THEN SELECT discussions INTO legacy_threads FROM amendment_process_branch WHERE id=item.branch_id;
    ELSIF item.amendment_id IS NOT NULL THEN SELECT discussions INTO legacy_threads FROM amendment WHERE id=item.amendment_id;
    ELSE CONTINUE; END IF;
    SELECT coalesce(jsonb_agg(thread),'[]'::jsonb) INTO legacy_threads
      FROM jsonb_array_elements(coalesce(legacy_threads,'[]'::jsonb)) thread
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(restored_threads) restored WHERE restored->>'id'=thread->>'id');
    IF item.kind='blog' THEN UPDATE blog SET discussions=legacy_threads||restored_threads WHERE id=item.entity_id;
    ELSIF item.branch_id IS NOT NULL THEN UPDATE amendment_process_branch SET discussions=legacy_threads||restored_threads WHERE id=item.branch_id;
    ELSE UPDATE amendment SET discussions=legacy_threads||restored_threads WHERE id=item.amendment_id; END IF;
  END LOOP;
END $$;

UPDATE collaboration_document SET deleted=true,generation=gen_random_uuid(),
  updated_at=(extract(epoch from clock_timestamp())*1000)::bigint WHERE kind<>'studio' AND NOT deleted;
UPDATE collaboration_outbox SET delivered_at=(extract(epoch from clock_timestamp())*1000)::bigint
  WHERE delivered_at IS NULL AND document_id IN (SELECT id FROM collaboration_document WHERE kind<>'studio');
ALTER TABLE collaboration_document ADD CONSTRAINT collaboration_studio_scope CHECK(kind='studio' OR deleted);

-- Studio has no legacy editor to migrate. Enable its transaction initialization
-- on fresh installs while preserving an operator's explicit maintenance fence.
UPDATE collaboration_control SET phase='active',
  updated_at=(extract(epoch from clock_timestamp())*1000)::bigint
  WHERE singleton AND phase='legacy';

CREATE OR REPLACE FUNCTION public.cleanup_expired_app_tutorial_runs()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cleaned_count integer;
BEGIN
  DELETE FROM amendment_process_run process_run USING amendment, app_tutorial_run tutorial_run
    WHERE process_run.amendment_id=amendment.id AND amendment.tutorial_run_id=tutorial_run.id AND tutorial_run.expires_at<=now();
  DELETE FROM app_tutorial_run WHERE expires_at<=now();
  GET DIAGNOSTICS cleaned_count=ROW_COUNT;
  RETURN cleaned_count;
END $$;
