-- Additive indexes for Zero query materialization and cursor-paged Postgres queries.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction. Keep this
-- migration non-transactional in production and run each statement independently
-- if the migration runner wraps SQL files in a transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_document_collaborator_user_document
  ON public.document_collaborator (user_id, document_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_collaborator_user_status_amendment
  ON public.amendment_collaborator (user_id, status, amendment_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_event_participant_user_status_event
  ON public.event_participant (user_id, status, event_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_blog_blogger_user_status_blog
  ON public.blog_blogger (user_id, status, blog_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_action_right_role_resource_action
  ON public.action_right (role_id, resource, action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_notification_read_notification_user_id
  ON public.notification_read (notification_id, read_by_user_id, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_role_amendment_scope_id
  ON public.role (amendment_id, scope, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_role_blog_scope_id
  ON public.role (blog_id, scope, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_statement_user_created_id
  ON public.statement (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_statement_group_created_id
  ON public.statement (group_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_group_membership_user_created_id
  ON public.group_membership (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_group_membership_group_created_id
  ON public.group_membership (group_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_collaborator_user_created_id
  ON public.amendment_collaborator (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_collaborator_amendment_created_id
  ON public.amendment_collaborator (amendment_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_group_created_id
  ON public.amendment (group_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_creator_created_id
  ON public.amendment (created_by_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_amendment_clone_source_created_id
  ON public.amendment (clone_source_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_document_amendment_updated_id
  ON public.document (amendment_id, updated_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_document_version_document_number_id
  ON public.document_version (document_id, version_number DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_document_collaborator_document_created_id
  ON public.document_collaborator (document_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_thread_document_created_id
  ON public.thread (document_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_event_participant_event_created_id
  ON public.event_participant (event_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_blog_group_created_id
  ON public.blog (group_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_blog_created_id
  ON public.blog (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_subscriber_created_id
  ON public.subscriber (subscriber_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_user_created_id
  ON public.subscriber (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_group_created_id
  ON public.subscriber (group_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_amendment_created_id
  ON public.subscriber (amendment_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_event_created_id
  ON public.subscriber (event_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_subscriber_blog_created_id
  ON public.subscriber (blog_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_notification_recipient_created_id_deleted
  ON public.notification (recipient_id, created_at DESC, id DESC, deleted_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_notification_entity_created_id_deleted
  ON public.notification (
    recipient_entity_type,
    recipient_entity_id,
    created_at DESC,
    id DESC,
    deleted_at
  );
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_notification_created_id_deleted
  ON public.notification (created_at DESC, id DESC, deleted_at);

-- Post-deploy validity check:
-- SELECT indexrelid::regclass AS index_name, indisvalid, indisready
-- FROM pg_index
-- WHERE indexrelid::regclass::text LIKE 'idx_zero_%'
-- ORDER BY index_name;
