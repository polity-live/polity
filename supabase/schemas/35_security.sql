-- MANUAL_SQL: Final least-privilege contract, applied after every application object.
-- migra does not emit function/schema/default ACLs. Extensions keep their own ACLs.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA ai_diagnostics, group_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public, ai_diagnostics, group_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, ai_diagnostics, group_invitations FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, ai_diagnostics, group_invitations
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, ai_diagnostics, group_invitations
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
-- PostgreSQL adds schema-specific ACLs to global defaults. A schema-specific
-- REVOKE cannot remove the implicit global PUBLIC EXECUTE on future functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, ai_diagnostics, group_invitations
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE app_function RECORD;
BEGIN
  FOR app_function IN
    SELECT namespace.nspname, procedure.proname, pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname IN ('public', 'ai_diagnostics', 'group_invitations')
      AND NOT EXISTS (SELECT 1 FROM pg_depend dependency WHERE dependency.classid = 'pg_proc'::regclass AND dependency.objid = procedure.oid AND dependency.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated, service_role', app_function.nspname, app_function.proname, app_function.identity_arguments);
  END LOOP;
END
$$;
GRANT EXECUTE ON FUNCTION public.current_user_has_password(), public.studio_presence_channel_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_capability(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_manage_without_events(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_manage(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_proposal_access(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_record_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_newsletter_sync_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_jobs(integer,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_notification_jobs(integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_app_tutorial_runs() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_push_delivery(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_studio_can_manage(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_studio_can_read(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expand_push_notification_job(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_content_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_access_without_events(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_access(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_agenda_audio_activation() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_clone_event_nodes(text,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_collaboration_access_without_events(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_collaboration_access(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_editor_action_pending() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_election_payload(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_event_access_changed() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_event_document_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_event_project_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_event_structure_changed() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_fire_show_cue(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_group_access(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_leave_intro_audio() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_membership_group_changed() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_membership_role_group() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_presence_channel_access(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_presentation_audio_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_refresh_source(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_resolve_show_audio(uuid,uuid,text[],jsonb,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_source_changed() TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_sync_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_vote_payload(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_studio_search_acl(uuid) TO service_role;
