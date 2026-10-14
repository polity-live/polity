-- 91_triggers.sql: canonical current definitions; historical upgrades are not replayed.

CREATE CONSTRAINT TRIGGER agenda_studio_structure AFTER INSERT OR DELETE OR UPDATE ON public.agenda_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_event_structure_changed();

CREATE TRIGGER amendment_city_design_content_revision BEFORE UPDATE OF design_state ON public.amendment_city_design FOR EACH ROW WHEN ((old.design_state IS DISTINCT FROM new.design_state)) EXECUTE FUNCTION public.project_content_revision();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.action_right FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.canvas_role_capability FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public."group" FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.group_membership FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.group_membership_role FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.role FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_authority_lock BEFORE INSERT OR DELETE OR UPDATE ON public.studio_project FOR EACH STATEMENT EXECUTE FUNCTION public.canvas_lock_authority();

CREATE TRIGGER canvas_record_revision AFTER INSERT OR UPDATE ON public.studio_state FOR EACH ROW EXECUTE FUNCTION public.canvas_record_revision();

CREATE TRIGGER canvas_sync_readers AFTER INSERT OR UPDATE OF shared_ids ON public.canvas_proposal FOR EACH ROW EXECUTE FUNCTION public.canvas_sync_readers();

CREATE TRIGGER delete_message_ai_trace AFTER UPDATE OF deleted_at ON public.message FOR EACH ROW EXECUTE FUNCTION public.delete_message_ai_trace();

CREATE TRIGGER document_content_revision BEFORE UPDATE OF content ON public.document FOR EACH ROW WHEN ((old.content IS DISTINCT FROM new.content)) EXECUTE FUNCTION public.project_content_revision();

CREATE CONSTRAINT TRIGGER event_studio_structure AFTER INSERT OR UPDATE ON public.event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_event_structure_changed();

CREATE TRIGGER notification_enqueue_push AFTER INSERT ON public.notification FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_notification();

CREATE TRIGGER on_user_preference_newsletter_language_changed AFTER UPDATE OF language ON public.user_preference FOR EACH ROW EXECUTE FUNCTION public.handle_newsletter_language_change();

CREATE CONSTRAINT TRIGGER studio_agenda_audio_activation AFTER UPDATE ON public.agenda_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_agenda_audio_activation();

CREATE CONSTRAINT TRIGGER studio_agenda_audio_activation AFTER UPDATE ON public.event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_agenda_audio_activation();

CREATE TRIGGER studio_editor_action_pending BEFORE INSERT OR UPDATE OF result ON public.studio_editor_action FOR EACH ROW EXECUTE FUNCTION public.studio_editor_action_pending();

CREATE TRIGGER studio_event_access_changed AFTER INSERT OR DELETE OR UPDATE ON public.action_right FOR EACH ROW EXECUTE FUNCTION public.studio_event_access_changed();

CREATE TRIGGER studio_event_access_changed AFTER INSERT OR DELETE OR UPDATE ON public.event_participant FOR EACH ROW EXECUTE FUNCTION public.studio_event_access_changed();

CREATE TRIGGER studio_event_access_changed AFTER INSERT OR DELETE OR UPDATE ON public.event_participant_role FOR EACH ROW EXECUTE FUNCTION public.studio_event_access_changed();

CREATE TRIGGER studio_event_access_changed AFTER INSERT OR DELETE OR UPDATE ON public.role FOR EACH ROW EXECUTE FUNCTION public.studio_event_access_changed();

CREATE TRIGGER studio_event_document_guard BEFORE UPDATE OF document ON public.studio_state FOR EACH ROW EXECUTE FUNCTION public.studio_event_document_guard();

CREATE TRIGGER studio_event_project_guard BEFORE DELETE OR UPDATE ON public.studio_project FOR EACH ROW EXECUTE FUNCTION public.studio_event_project_guard();

CREATE TRIGGER studio_membership_group_changed AFTER UPDATE OF group_id ON public.group_membership FOR EACH ROW WHEN ((old.group_id IS DISTINCT FROM new.group_id)) EXECUTE FUNCTION public.studio_membership_group_changed();

CREATE TRIGGER studio_membership_role_group BEFORE INSERT OR UPDATE OF group_membership_id, group_id ON public.group_membership_role FOR EACH ROW EXECUTE FUNCTION public.studio_membership_role_group();

CREATE TRIGGER studio_presentation_audio_rules BEFORE UPDATE OF frame_id, mode, running, results_visible, audio ON public.event_presentation FOR EACH ROW EXECUTE FUNCTION public.studio_presentation_audio_rules();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.agenda_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.agenda_item_change_request DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.amendment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.document DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.election DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.election_candidate DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.election_offline_tally DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.elector DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.final_candidate_selection DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.final_choice_decision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public."group" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.indicative_candidate_selection DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.indicative_choice_decision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.speaker_list DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public."user" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.vote DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.vote_choice DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.vote_offline_tally DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE CONSTRAINT TRIGGER studio_source_changed AFTER INSERT OR DELETE OR UPDATE ON public.voter DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.studio_source_changed();

CREATE TRIGGER todo_ensure_discussion_thread AFTER INSERT ON public.todo FOR EACH ROW EXECUTE FUNCTION public.ensure_todo_discussion_thread();

CREATE TRIGGER trg_dataset_snapshot_touch_dataset AFTER INSERT OR DELETE OR UPDATE ON public.dataset_snapshot FOR EACH ROW EXECUTE FUNCTION public.touch_dataset_from_snapshot();

CREATE TRIGGER trg_message_refresh_conversation_rollups AFTER INSERT OR DELETE OR UPDATE ON public.message FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_message();

CREATE TRIGGER trg_participant_refresh_conversation_rollups AFTER INSERT OR DELETE OR UPDATE OF last_read_at, left_at, user_id ON public.conversation_participant FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_participant();

CREATE TRIGGER trg_search_document_amendment AFTER INSERT OR DELETE OR UPDATE ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.upsert_amendment_search_document();

CREATE TRIGGER trg_search_document_amendment_group_decision AFTER INSERT OR DELETE OR UPDATE ON public.amendment_group_decision FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_amendment_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.amendment_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_blog AFTER INSERT OR DELETE OR UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.upsert_blog_search_document();

CREATE TRIGGER trg_search_document_blog_blogger_location_refresh AFTER INSERT OR DELETE OR UPDATE ON public.blog_blogger FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_from_blogger();

CREATE TRIGGER trg_search_document_blog_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.blog_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_dataset AFTER INSERT OR DELETE OR UPDATE ON public.dataset FOR EACH ROW EXECUTE FUNCTION public.upsert_dataset_search_document();

CREATE TRIGGER trg_search_document_election AFTER INSERT OR DELETE OR UPDATE ON public.election FOR EACH ROW EXECUTE FUNCTION public.upsert_election_search_document();

CREATE TRIGGER trg_search_document_event AFTER INSERT OR DELETE OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.upsert_event_search_document();

CREATE TRIGGER trg_search_document_event_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.event_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_event_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_group AFTER INSERT OR DELETE OR UPDATE ON public."group" FOR EACH ROW EXECUTE FUNCTION public.upsert_group_search_document();

CREATE TRIGGER trg_search_document_group_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.group_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_group_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_group_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds ON public."group" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_group_location();

CREATE TRIGGER trg_search_document_populate_location BEFORE INSERT OR UPDATE ON public.search_document FOR EACH ROW EXECUTE FUNCTION public.populate_search_document_location();

CREATE TRIGGER trg_search_document_statement AFTER INSERT OR DELETE OR UPDATE ON public.statement FOR EACH ROW EXECUTE FUNCTION public.upsert_statement_search_document();

CREATE TRIGGER trg_search_document_statement_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.statement_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_statement_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_studio AFTER INSERT OR DELETE OR UPDATE ON public.studio_project FOR EACH ROW EXECUTE FUNCTION public.upsert_studio_search_document();

CREATE TRIGGER trg_search_document_support_confirmation AFTER INSERT OR DELETE OR UPDATE ON public.support_confirmation FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_timeline_event AFTER INSERT OR DELETE OR UPDATE ON public.timeline_event FOR EACH ROW EXECUTE FUNCTION public.upsert_timeline_event_search_document();

CREATE TRIGGER trg_search_document_todo AFTER INSERT OR DELETE OR UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.upsert_todo_search_document();

CREATE TRIGGER trg_search_document_user AFTER INSERT OR DELETE OR UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.upsert_user_search_document();

CREATE TRIGGER trg_search_document_user_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.user_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_user_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_user_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds ON public."user" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_user_location();

CREATE TRIGGER trg_zz_search_document_acl_action_right AFTER INSERT OR DELETE OR UPDATE ON public.action_right FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_action_right_entity_discovery AFTER INSERT OR DELETE OR UPDATE ON public.action_right FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_amendment AFTER INSERT OR UPDATE ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_amendment_collaborator AFTER INSERT OR DELETE OR UPDATE ON public.amendment_collaborator FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_blog AFTER INSERT OR UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_blog_blogger AFTER INSERT OR DELETE OR UPDATE ON public.blog_blogger FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_dataset AFTER INSERT OR UPDATE ON public.dataset FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_election AFTER INSERT OR UPDATE ON public.election FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_elector AFTER INSERT OR DELETE OR UPDATE ON public.elector FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_event AFTER INSERT OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_event_participant AFTER INSERT OR DELETE OR UPDATE ON public.event_participant FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_event_participant_role_discovery AFTER INSERT OR DELETE OR UPDATE ON public.event_participant_role FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group AFTER INSERT OR UPDATE ON public."group" FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_access AFTER INSERT OR DELETE OR UPDATE ON public.group_guest_access FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_guest_role AFTER INSERT OR DELETE OR UPDATE ON public.group_guest_role FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_membership AFTER INSERT OR DELETE OR UPDATE ON public.group_membership FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_group_membership_role AFTER INSERT OR DELETE OR UPDATE ON public.group_membership_role FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role AFTER INSERT OR DELETE OR UPDATE ON public.role FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_role_entity_discovery AFTER INSERT OR DELETE OR UPDATE ON public.role FOR EACH ROW EXECUTE FUNCTION public.refresh_private_entity_discovery_acl_role_trigger();

CREATE TRIGGER trg_zz_search_document_acl_statement AFTER INSERT OR UPDATE ON public.statement FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_timeline_event AFTER INSERT OR UPDATE ON public.timeline_event FOR EACH ROW EXECUTE FUNCTION public.sync_timeline_search_document_privacy();

CREATE TRIGGER trg_zz_search_document_acl_todo AFTER INSERT OR UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_todo_assignment AFTER INSERT OR DELETE OR UPDATE ON public.todo_assignment FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_zz_search_document_acl_user AFTER INSERT OR UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_dataset_archive AFTER INSERT OR UPDATE ON public.dataset FOR EACH ROW EXECUTE FUNCTION public.delete_inactive_dataset_search_document();

CREATE TRIGGER trg_zz_studio_search_acl_action_right AFTER INSERT OR DELETE OR UPDATE ON public.action_right FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER trg_zz_studio_search_acl_collaborator AFTER INSERT OR DELETE OR UPDATE ON public.studio_project_collaborator FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER trg_zz_studio_search_acl_group AFTER UPDATE OF owner_id ON public."group" FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER trg_zz_studio_search_acl_membership AFTER INSERT OR DELETE OR UPDATE ON public.group_membership FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER trg_zz_studio_search_acl_membership_role AFTER INSERT OR DELETE OR UPDATE ON public.group_membership_role FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER trg_zz_studio_search_acl_project AFTER INSERT OR UPDATE OF visibility, owner_id, group_id ON public.studio_project FOR EACH ROW EXECUTE FUNCTION public.refresh_studio_search_acl();

CREATE TRIGGER zz_tag_amendment_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('amendment');

CREATE TRIGGER zz_tag_blog_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.blog FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('blog');

CREATE TRIGGER zz_tag_event_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.event FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('event');

CREATE TRIGGER zz_tag_group_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public."group" FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('group');

CREATE TRIGGER zz_tag_statement_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.statement FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('statement');

CREATE TRIGGER zz_tag_todo_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.todo FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('todo');

CREATE TRIGGER zz_tag_user_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public."user" FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('user');

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

CREATE TRIGGER on_auth_user_newsletter_changed AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_newsletter_change();

CREATE TRIGGER on_auth_user_newsletter_deleted BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_newsletter_delete();
