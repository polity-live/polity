-- 90_foreign_keys.sql: canonical current definitions; historical upgrades are not replayed.

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace_operation
    ADD CONSTRAINT ai_trace_operation_parent_operation_id_fkey FOREIGN KEY (parent_operation_id) REFERENCES ai_diagnostics.ai_trace_operation(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace_operation
    ADD CONSTRAINT ai_trace_operation_trace_id_fkey FOREIGN KEY (trace_id) REFERENCES ai_diagnostics.ai_trace(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_origin_message_id_fkey FOREIGN KEY (origin_message_id) REFERENCES public.message(id) ON DELETE CASCADE;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_response_message_id_fkey FOREIGN KEY (response_message_id) REFERENCES public.message(id) ON DELETE SET NULL;

ALTER TABLE ONLY ai_diagnostics.ai_trace
    ADD CONSTRAINT ai_trace_studio_project_id_fkey FOREIGN KEY (studio_project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation
    ADD CONSTRAINT group_email_invitation_accepted_by_id_fkey FOREIGN KEY (accepted_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY group_invitations.group_email_invitation_batch
    ADD CONSTRAINT group_email_invitation_batch_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation_batch
    ADD CONSTRAINT group_email_invitation_batch_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation_delivery
    ADD CONSTRAINT group_email_invitation_delivery_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES group_invitations.group_email_invitation_batch(id) ON DELETE SET NULL;

ALTER TABLE ONLY group_invitations.group_email_invitation_delivery
    ADD CONSTRAINT group_email_invitation_delivery_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES group_invitations.group_email_invitation(id) ON DELETE SET NULL;

ALTER TABLE ONLY group_invitations.group_email_invitation
    ADD CONSTRAINT group_email_invitation_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation
    ADD CONSTRAINT group_email_invitation_invited_by_id_fkey FOREIGN KEY (invited_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation_role
    ADD CONSTRAINT group_email_invitation_role_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES group_invitations.group_email_invitation(id) ON DELETE CASCADE;

ALTER TABLE ONLY group_invitations.group_email_invitation_role
    ADD CONSTRAINT group_email_invitation_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation
    ADD CONSTRAINT accreditation_agenda_item_id_fkey FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation_audit
    ADD CONSTRAINT accreditation_audit_accreditation_id_fkey FOREIGN KEY (accreditation_id) REFERENCES public.accreditation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation_audit
    ADD CONSTRAINT accreditation_audit_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.accreditation_audit
    ADD CONSTRAINT accreditation_audit_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation_audit
    ADD CONSTRAINT accreditation_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation
    ADD CONSTRAINT accreditation_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.accreditation
    ADD CONSTRAINT accreditation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accreditation
    ADD CONSTRAINT accreditation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.action_right
    ADD CONSTRAINT action_right_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agenda_item_change_request
    ADD CONSTRAINT agenda_item_change_request_agenda_item_id_fkey FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agenda_item_change_request
    ADD CONSTRAINT agenda_item_change_request_change_request_id_fkey FOREIGN KEY (change_request_id) REFERENCES public.change_request(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agenda_item_change_request
    ADD CONSTRAINT agenda_item_change_request_process_branch_id_fkey FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.agenda_item_change_request
    ADD CONSTRAINT agenda_item_change_request_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.agenda_item
    ADD CONSTRAINT agenda_item_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_change_set
    ADD CONSTRAINT ai_change_set_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_change_set
    ADD CONSTRAINT ai_change_set_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_change_set
    ADD CONSTRAINT ai_change_set_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_context_snapshot
    ADD CONSTRAINT ai_context_snapshot_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_provider_credential
    ADD CONSTRAINT ai_provider_credential_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_run
    ADD CONSTRAINT ai_run_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_run
    ADD CONSTRAINT ai_run_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_skill
    ADD CONSTRAINT ai_skill_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_tool_call
    ADD CONSTRAINT ai_tool_call_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_tool
    ADD CONSTRAINT ai_tool_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_activity
    ADD CONSTRAINT amendment_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_activity
    ADD CONSTRAINT amendment_activity_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_activity
    ADD CONSTRAINT amendment_activity_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_city_design
    ADD CONSTRAINT amendment_city_design_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_city_design
    ADD CONSTRAINT amendment_city_design_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_collaborator
    ADD CONSTRAINT amendment_collaborator_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_collaborator
    ADD CONSTRAINT amendment_collaborator_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_collaborator
    ADD CONSTRAINT amendment_collaborator_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment
    ADD CONSTRAINT amendment_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment
    ADD CONSTRAINT amendment_current_process_run_fk FOREIGN KEY (current_process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment
    ADD CONSTRAINT amendment_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_group_decision
    ADD CONSTRAINT amendment_group_decision_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_group_decision
    ADD CONSTRAINT amendment_group_decision_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_group_decision
    ADD CONSTRAINT amendment_group_decision_process_branch_id_fkey FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_group_decision
    ADD CONSTRAINT amendment_group_decision_process_run_id_fkey FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_group_decision
    ADD CONSTRAINT amendment_group_decision_process_step_run_id_fkey FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_hashtag
    ADD CONSTRAINT amendment_hashtag_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_hashtag
    ADD CONSTRAINT amendment_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment
    ADD CONSTRAINT amendment_origin_amendment_fk FOREIGN KEY (origin_amendment_id) REFERENCES public.amendment(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_path
    ADD CONSTRAINT amendment_path_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_path
    ADD CONSTRAINT amendment_path_process_run_fk FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_path_segment
    ADD CONSTRAINT amendment_path_segment_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.amendment_path(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_path_segment
    ADD CONSTRAINT amendment_path_segment_process_branch_fk FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_path_segment
    ADD CONSTRAINT amendment_path_segment_process_step_run_fk FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_path
    ADD CONSTRAINT amendment_path_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_document_version_id_fkey FOREIGN KEY (document_version_id) REFERENCES public.document_version(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_merged_into_branch_id_fkey FOREIGN KEY (merged_into_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_parent_branch_id_fkey FOREIGN KEY (parent_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_process_run_id_fkey FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_process_branch
    ADD CONSTRAINT amendment_process_branch_source_step_fk FOREIGN KEY (source_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_active_branch_fk FOREIGN KEY (active_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_root_workflow_id_fkey FOREIGN KEY (root_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_selected_source_group_id_fkey FOREIGN KEY (selected_source_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_selected_target_group_id_fkey FOREIGN KEY (selected_target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_selected_target_workflow_id_fkey FOREIGN KEY (selected_target_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_run
    ADD CONSTRAINT amendment_process_run_terminal_step_fk FOREIGN KEY (terminal_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_agenda_item_fk FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_process_run_id_fkey FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_support_confirmation_id_fkey FOREIGN KEY (support_confirmation_id) REFERENCES public.support_confirmation(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_target_group_id_fkey FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_vote_fk FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_process_step_run
    ADD CONSTRAINT amendment_process_step_run_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.group_workflow_step(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.amendment_support_vote
    ADD CONSTRAINT amendment_support_vote_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_support_vote
    ADD CONSTRAINT amendment_support_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment
    ADD CONSTRAINT amendment_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_vote_entry
    ADD CONSTRAINT amendment_vote_entry_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.amendment_vote_entry
    ADD CONSTRAINT amendment_vote_entry_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_tutorial_checkpoint_effect
    ADD CONSTRAINT app_tutorial_checkpoint_effect_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_tutorial_entity
    ADD CONSTRAINT app_tutorial_entity_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_tutorial_run
    ADD CONSTRAINT app_tutorial_run_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.appearance_theme
    ADD CONSTRAINT appearance_theme_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appearance_theme
    ADD CONSTRAINT appearance_theme_current_revision_fkey FOREIGN KEY (current_revision_id) REFERENCES public.appearance_theme_revision(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.appearance_theme
    ADD CONSTRAINT appearance_theme_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.appearance_theme_revision
    ADD CONSTRAINT appearance_theme_revision_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appearance_theme_revision
    ADD CONSTRAINT appearance_theme_revision_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.appearance_theme(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_blogger
    ADD CONSTRAINT blog_blogger_blog_id_fkey FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_blogger
    ADD CONSTRAINT blog_blogger_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.blog_blogger
    ADD CONSTRAINT blog_blogger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_hashtag
    ADD CONSTRAINT blog_hashtag_blog_id_fkey FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_hashtag
    ADD CONSTRAINT blog_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_support_vote
    ADD CONSTRAINT blog_support_vote_blog_id_fkey FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog_support_vote
    ADD CONSTRAINT blog_support_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blog
    ADD CONSTRAINT blog_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_subscription
    ADD CONSTRAINT calendar_subscription_target_group_id_fkey FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_subscription
    ADD CONSTRAINT calendar_subscription_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_subscription
    ADD CONSTRAINT calendar_subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.canvas_comment
    ADD CONSTRAINT canvas_comment_author_id_fkey FOREIGN KEY (author_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_comment
    ADD CONSTRAINT canvas_comment_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id);

ALTER TABLE ONLY public.canvas_comment
    ADD CONSTRAINT canvas_comment_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.canvas_proposal(id);

ALTER TABLE ONLY public.canvas_control
    ADD CONSTRAINT canvas_control_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.canvas_history
    ADD CONSTRAINT canvas_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.canvas_library
    ADD CONSTRAINT canvas_library_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_library
    ADD CONSTRAINT canvas_library_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id);

ALTER TABLE ONLY public.canvas_proposal
    ADD CONSTRAINT canvas_proposal_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_proposal
    ADD CONSTRAINT canvas_proposal_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id);

ALTER TABLE ONLY public.canvas_proposal
    ADD CONSTRAINT canvas_proposal_resolves_id_fkey FOREIGN KEY (resolves_id) REFERENCES public.canvas_proposal(id);

ALTER TABLE ONLY public.canvas_receipt
    ADD CONSTRAINT canvas_receipt_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_receipt
    ADD CONSTRAINT canvas_receipt_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id);

ALTER TABLE ONLY public.canvas_role_capability
    ADD CONSTRAINT canvas_role_capability_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.canvas_vote
    ADD CONSTRAINT canvas_vote_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.canvas_proposal(id);

ALTER TABLE ONLY public.canvas_vote
    ADD CONSTRAINT canvas_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_workspace_reader
    ADD CONSTRAINT canvas_workspace_reader_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.canvas_workspace_reader
    ADD CONSTRAINT canvas_workspace_reader_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.canvas_proposal(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_request
    ADD CONSTRAINT change_request_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_request
    ADD CONSTRAINT change_request_process_branch_id_fkey FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.change_request
    ADD CONSTRAINT change_request_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_request_vote
    ADD CONSTRAINT change_request_vote_change_request_id_fkey FOREIGN KEY (change_request_id) REFERENCES public.change_request(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_request_vote
    ADD CONSTRAINT change_request_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comment
    ADD CONSTRAINT comment_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comment
    ADD CONSTRAINT comment_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comment
    ADD CONSTRAINT comment_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comment_vote
    ADD CONSTRAINT comment_vote_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comment_vote
    ADD CONSTRAINT comment_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_assistant_for_user_id_fkey FOREIGN KEY (assistant_for_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_studio_project_id_fkey FOREIGN KEY (studio_project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dataset_import_job
    ADD CONSTRAINT dataset_import_job_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dataset_import_job
    ADD CONSTRAINT dataset_import_job_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dataset_import_job
    ADD CONSTRAINT dataset_import_job_result_snapshot_id_fkey FOREIGN KEY (result_snapshot_id) REFERENCES public.dataset_snapshot(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dataset_snapshot
    ADD CONSTRAINT dataset_snapshot_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dataset_snapshot
    ADD CONSTRAINT dataset_snapshot_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.delegate_election_assignment
    ADD CONSTRAINT delegate_election_assignment_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.group_delegate_allocation(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.delegate_election_assignment
    ADD CONSTRAINT delegate_election_assignment_linked_event_id_fkey FOREIGN KEY (linked_event_id) REFERENCES public.event(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.delegate_election_assignment
    ADD CONSTRAINT delegate_election_assignment_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.delegate_election_assignment
    ADD CONSTRAINT delegate_election_assignment_target_event_id_fkey FOREIGN KEY (target_event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_collaborator
    ADD CONSTRAINT document_collaborator_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_collaborator
    ADD CONSTRAINT document_collaborator_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_cursor
    ADD CONSTRAINT document_cursor_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_cursor
    ADD CONSTRAINT document_cursor_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_version
    ADD CONSTRAINT document_version_author_id_fkey FOREIGN KEY (author_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_version
    ADD CONSTRAINT document_version_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.election_candidate
    ADD CONSTRAINT election_candidate_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.election_candidate
    ADD CONSTRAINT election_candidate_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.election_offline_tally
    ADD CONSTRAINT election_offline_tally_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.election_offline_tally
    ADD CONSTRAINT election_offline_tally_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.election_offline_tally
    ADD CONSTRAINT election_offline_tally_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.election
    ADD CONSTRAINT election_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.elector
    ADD CONSTRAINT elector_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.elector
    ADD CONSTRAINT elector_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_activity
    ADD CONSTRAINT event_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_activity
    ADD CONSTRAINT event_activity_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_activity
    ADD CONSTRAINT event_activity_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_assembly_scope
    ADD CONSTRAINT event_assembly_scope_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_assembly_scope
    ADD CONSTRAINT event_assembly_scope_host_group_id_fkey FOREIGN KEY (host_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_assembly_scope
    ADD CONSTRAINT event_assembly_scope_required_role_id_fkey FOREIGN KEY (required_role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_assembly_scope
    ADD CONSTRAINT event_assembly_scope_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_delegate
    ADD CONSTRAINT event_delegate_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_delegate
    ADD CONSTRAINT event_delegate_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_exception
    ADD CONSTRAINT event_exception_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_hashtag
    ADD CONSTRAINT event_hashtag_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_hashtag
    ADD CONSTRAINT event_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_offline_participant
    ADD CONSTRAINT event_offline_participant_connected_user_id_fkey FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_offline_participant
    ADD CONSTRAINT event_offline_participant_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_offline_participant
    ADD CONSTRAINT event_offline_participant_group_offline_member_id_fkey FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_participant
    ADD CONSTRAINT event_participant_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participant_role
    ADD CONSTRAINT event_participant_role_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_participant_role
    ADD CONSTRAINT event_participant_role_event_participant_id_fkey FOREIGN KEY (event_participant_id) REFERENCES public.event_participant(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participant_role
    ADD CONSTRAINT event_participant_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participant
    ADD CONSTRAINT event_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation
    ADD CONSTRAINT event_presentation_controller_id_fkey FOREIGN KEY (controller_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_presentation_device
    ADD CONSTRAINT event_presentation_device_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation_device
    ADD CONSTRAINT event_presentation_device_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation
    ADD CONSTRAINT event_presentation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation_operation
    ADD CONSTRAINT event_presentation_operation_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation_operation
    ADD CONSTRAINT event_presentation_operation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_presentation
    ADD CONSTRAINT event_presentation_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_candidate_selection
    ADD CONSTRAINT final_candidate_selection_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_candidate_selection
    ADD CONSTRAINT final_candidate_selection_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_candidate_selection
    ADD CONSTRAINT final_candidate_selection_elector_participation_id_fkey FOREIGN KEY (elector_participation_id) REFERENCES public.final_elector_participation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_choice_decision
    ADD CONSTRAINT final_choice_decision_choice_id_fkey FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_choice_decision
    ADD CONSTRAINT final_choice_decision_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_choice_decision
    ADD CONSTRAINT final_choice_decision_voter_participation_id_fkey FOREIGN KEY (voter_participation_id) REFERENCES public.final_voter_participation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_elector_participation
    ADD CONSTRAINT final_elector_participation_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_elector_participation
    ADD CONSTRAINT final_elector_participation_elector_id_fkey FOREIGN KEY (elector_id) REFERENCES public.elector(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_voter_participation
    ADD CONSTRAINT final_voter_participation_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.final_voter_participation
    ADD CONSTRAINT final_voter_participation_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.voter(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.follow
    ADD CONSTRAINT follow_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.follow
    ADD CONSTRAINT follow_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_activity
    ADD CONSTRAINT group_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_activity
    ADD CONSTRAINT group_activity_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_activity
    ADD CONSTRAINT group_activity_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public."group"
    ADD CONSTRAINT group_connected_group_id_fkey FOREIGN KEY (connected_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_child_group_id_fkey FOREIGN KEY (child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_from_group_id_fkey FOREIGN KEY (from_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_group_a_id_fkey FOREIGN KEY (group_a_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_group_b_id_fkey FOREIGN KEY (group_b_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_active_connection_id_fkey FOREIGN KEY (active_connection_id) REFERENCES public.group_connection(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_desired_child_group_id_fkey FOREIGN KEY (desired_child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_desired_parent_group_id_fkey FOREIGN KEY (desired_parent_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_group_a_id_fkey FOREIGN KEY (group_a_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_group_b_id_fkey FOREIGN KEY (group_b_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection_request
    ADD CONSTRAINT group_connection_request_initiator_group_id_fkey FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_connection
    ADD CONSTRAINT group_connection_to_group_id_fkey FOREIGN KEY (to_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_delegate_allocation
    ADD CONSTRAINT group_delegate_allocation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_effective_right
    ADD CONSTRAINT group_effective_right_holder_group_id_fkey FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_effective_right
    ADD CONSTRAINT group_effective_right_scope_group_id_fkey FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_effective_right
    ADD CONSTRAINT group_effective_right_source_connection_id_fkey FOREIGN KEY (source_connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_effective_right
    ADD CONSTRAINT group_effective_right_source_grant_id_fkey FOREIGN KEY (source_grant_id) REFERENCES public.group_right_grant(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_guest_access
    ADD CONSTRAINT group_guest_access_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_guest_access
    ADD CONSTRAINT group_guest_access_invited_by_id_fkey FOREIGN KEY (invited_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_guest_access
    ADD CONSTRAINT group_guest_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_guest_role
    ADD CONSTRAINT group_guest_role_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_guest_role
    ADD CONSTRAINT group_guest_role_group_guest_access_id_fkey FOREIGN KEY (group_guest_access_id) REFERENCES public.group_guest_access(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_guest_role
    ADD CONSTRAINT group_guest_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hashtag
    ADD CONSTRAINT group_hashtag_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hashtag
    ADD CONSTRAINT group_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hierarchy_path
    ADD CONSTRAINT group_hierarchy_path_ancestor_group_id_fkey FOREIGN KEY (ancestor_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hierarchy_path
    ADD CONSTRAINT group_hierarchy_path_base_group_id_fkey FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hierarchy_path
    ADD CONSTRAINT group_hierarchy_path_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hierarchy_path
    ADD CONSTRAINT group_hierarchy_path_descendant_group_id_fkey FOREIGN KEY (descendant_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_hierarchy_path
    ADD CONSTRAINT group_hierarchy_path_direct_child_group_id_fkey FOREIGN KEY (direct_child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership
    ADD CONSTRAINT group_membership_base_group_id_fkey FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_exclusivity_lock
    ADD CONSTRAINT group_membership_exclusivity_lock_group_membership_id_fkey FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_exclusivity_lock
    ADD CONSTRAINT group_membership_exclusivity_lock_hierarchy_group_id_fkey FOREIGN KEY (hierarchy_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_exclusivity_lock
    ADD CONSTRAINT group_membership_exclusivity_lock_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_exclusivity_lock
    ADD CONSTRAINT group_membership_exclusivity_lock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership
    ADD CONSTRAINT group_membership_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_origin
    ADD CONSTRAINT group_membership_origin_base_group_id_fkey FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_origin
    ADD CONSTRAINT group_membership_origin_group_membership_id_fkey FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_origin
    ADD CONSTRAINT group_membership_origin_part_group_id_fkey FOREIGN KEY (part_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_origin
    ADD CONSTRAINT group_membership_origin_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_origin
    ADD CONSTRAINT group_membership_origin_source_membership_id_fkey FOREIGN KEY (source_membership_id) REFERENCES public.group_membership(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership
    ADD CONSTRAINT group_membership_part_group_id_fkey FOREIGN KEY (part_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_role
    ADD CONSTRAINT group_membership_role_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_role
    ADD CONSTRAINT group_membership_role_group_membership_id_fkey FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_role
    ADD CONSTRAINT group_membership_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule
    ADD CONSTRAINT group_membership_rule_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule
    ADD CONSTRAINT group_membership_rule_member_source_group_id_fkey FOREIGN KEY (member_source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule
    ADD CONSTRAINT group_membership_rule_member_target_group_id_fkey FOREIGN KEY (member_target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_origin
    ADD CONSTRAINT group_membership_rule_origin_eligible_origin_group_id_fkey FOREIGN KEY (eligible_origin_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_origin
    ADD CONSTRAINT group_membership_rule_origin_membership_rule_id_fkey FOREIGN KEY (membership_rule_id) REFERENCES public.group_membership_rule(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request
    ADD CONSTRAINT group_membership_rule_request_connection_request_id_fkey FOREIGN KEY (connection_request_id) REFERENCES public.group_connection_request(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request
    ADD CONSTRAINT group_membership_rule_request_existing_membership_rule_id_fkey FOREIGN KEY (existing_membership_rule_id) REFERENCES public.group_membership_rule(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_rule_request
    ADD CONSTRAINT group_membership_rule_request_member_source_group_id_fkey FOREIGN KEY (member_source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request
    ADD CONSTRAINT group_membership_rule_request_member_target_group_id_fkey FOREIGN KEY (member_target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request_origin
    ADD CONSTRAINT group_membership_rule_request_o_membership_rule_request_id_fkey FOREIGN KEY (membership_rule_request_id) REFERENCES public.group_membership_rule_request(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request_origin
    ADD CONSTRAINT group_membership_rule_request_ori_eligible_origin_group_id_fkey FOREIGN KEY (eligible_origin_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership_rule_request
    ADD CONSTRAINT group_membership_rule_request_required_source_role_id_fkey FOREIGN KEY (required_source_role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership_rule
    ADD CONSTRAINT group_membership_rule_required_source_role_id_fkey FOREIGN KEY (required_source_role_id) REFERENCES public.role(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_membership
    ADD CONSTRAINT group_membership_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership
    ADD CONSTRAINT group_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_member
    ADD CONSTRAINT group_offline_member_connected_user_id_fkey FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_offline_member
    ADD CONSTRAINT group_offline_member_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_offline_member
    ADD CONSTRAINT group_offline_member_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_membership
    ADD CONSTRAINT group_offline_membership_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_membership
    ADD CONSTRAINT group_offline_membership_group_offline_member_id_fkey FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_membership_role
    ADD CONSTRAINT group_offline_membership_role_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_offline_membership_role
    ADD CONSTRAINT group_offline_membership_role_group_offline_membership_id_fkey FOREIGN KEY (group_offline_membership_id) REFERENCES public.group_offline_membership(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_membership_role
    ADD CONSTRAINT group_offline_membership_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_offline_membership
    ADD CONSTRAINT group_offline_membership_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public."group"
    ADD CONSTRAINT group_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_right_grant
    ADD CONSTRAINT group_right_grant_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant
    ADD CONSTRAINT group_right_grant_holder_group_id_fkey FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant
    ADD CONSTRAINT group_right_grant_initiator_group_id_fkey FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_right_grant_request
    ADD CONSTRAINT group_right_grant_request_connection_request_id_fkey FOREIGN KEY (connection_request_id) REFERENCES public.group_connection_request(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant_request
    ADD CONSTRAINT group_right_grant_request_existing_grant_id_fkey FOREIGN KEY (existing_grant_id) REFERENCES public.group_right_grant(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_right_grant_request
    ADD CONSTRAINT group_right_grant_request_holder_group_id_fkey FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant_request
    ADD CONSTRAINT group_right_grant_request_initiator_group_id_fkey FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant_request
    ADD CONSTRAINT group_right_grant_request_scope_group_id_fkey FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_right_grant
    ADD CONSTRAINT group_right_grant_scope_group_id_fkey FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_sibling_source_lock
    ADD CONSTRAINT group_sibling_source_lock_group_membership_id_fkey FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_sibling_source_lock
    ADD CONSTRAINT group_sibling_source_lock_sibling_group_id_fkey FOREIGN KEY (sibling_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_sibling_source_lock
    ADD CONSTRAINT group_sibling_source_lock_source_group_id_fkey FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_sibling_source_lock
    ADD CONSTRAINT group_sibling_source_lock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public."group"
    ADD CONSTRAINT group_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow_approval
    ADD CONSTRAINT group_workflow_approval_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow_approval
    ADD CONSTRAINT group_workflow_approval_requested_by_group_id_fkey FOREIGN KEY (requested_by_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow_approval
    ADD CONSTRAINT group_workflow_approval_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow
    ADD CONSTRAINT group_workflow_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow
    ADD CONSTRAINT group_workflow_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow
    ADD CONSTRAINT group_workflow_start_group_id_fkey FOREIGN KEY (start_group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow_step
    ADD CONSTRAINT group_workflow_step_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_workflow_step
    ADD CONSTRAINT group_workflow_step_target_workflow_id_fkey FOREIGN KEY (target_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_workflow_step
    ADD CONSTRAINT group_workflow_step_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_candidate_selection
    ADD CONSTRAINT indicative_candidate_selection_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_candidate_selection
    ADD CONSTRAINT indicative_candidate_selection_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_candidate_selection
    ADD CONSTRAINT indicative_candidate_selection_elector_participation_id_fkey FOREIGN KEY (elector_participation_id) REFERENCES public.indicative_elector_participation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_choice_decision
    ADD CONSTRAINT indicative_choice_decision_choice_id_fkey FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_choice_decision
    ADD CONSTRAINT indicative_choice_decision_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_choice_decision
    ADD CONSTRAINT indicative_choice_decision_voter_participation_id_fkey FOREIGN KEY (voter_participation_id) REFERENCES public.indicative_voter_participation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_elector_participation
    ADD CONSTRAINT indicative_elector_participation_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_elector_participation
    ADD CONSTRAINT indicative_elector_participation_elector_id_fkey FOREIGN KEY (elector_id) REFERENCES public.elector(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.indicative_elector_participation
    ADD CONSTRAINT indicative_elector_participation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_voter_participation
    ADD CONSTRAINT indicative_voter_participation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_voter_participation
    ADD CONSTRAINT indicative_voter_participation_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.indicative_voter_participation
    ADD CONSTRAINT indicative_voter_participation_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.voter(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.link
    ADD CONSTRAINT link_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_subscription
    ADD CONSTRAINT newsletter_subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notification_read
    ADD CONSTRAINT notification_read_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_read
    ADD CONSTRAINT notification_read_read_by_user_id_fkey FOREIGN KEY (read_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notification_setting
    ADD CONSTRAINT notification_setting_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_user_state
    ADD CONSTRAINT notification_user_state_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_user_state
    ADD CONSTRAINT notification_user_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.participant
    ADD CONSTRAINT participant_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.participant
    ADD CONSTRAINT participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_payer_user_id_fkey FOREIGN KEY (payer_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_receiver_user_id_fkey FOREIGN KEY (receiver_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pql_filter
    ADD CONSTRAINT pql_filter_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pql_filter
    ADD CONSTRAINT pql_filter_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_agenda_item_fk FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_process_run_id_fkey FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_step_run_id_fkey FOREIGN KEY (step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_support_confirmation_id_fkey FOREIGN KEY (support_confirmation_id) REFERENCES public.support_confirmation(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.process_task
    ADD CONSTRAINT process_task_target_group_id_fkey FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.push_delivery_outbox
    ADD CONSTRAINT push_delivery_outbox_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_delivery_outbox
    ADD CONSTRAINT push_delivery_outbox_notification_job_id_fkey FOREIGN KEY (notification_job_id) REFERENCES public.push_notification_outbox(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_delivery_outbox
    ADD CONSTRAINT push_delivery_outbox_push_subscription_id_fkey FOREIGN KEY (push_subscription_id) REFERENCES public.push_subscription(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.push_delivery_outbox
    ADD CONSTRAINT push_delivery_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_notification_outbox
    ADD CONSTRAINT push_notification_outbox_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_subscription
    ADD CONSTRAINT push_subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reaction
    ADD CONSTRAINT reaction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_holder_history
    ADD CONSTRAINT role_holder_history_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_holder_history
    ADD CONSTRAINT role_holder_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.search_document_acl
    ADD CONSTRAINT search_document_acl_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.search_document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.search_document_acl
    ADD CONSTRAINT search_document_acl_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.search_document
    ADD CONSTRAINT search_document_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.search_document
    ADD CONSTRAINT search_document_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.search_document_topic
    ADD CONSTRAINT search_document_topic_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.search_document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.search_document
    ADD CONSTRAINT search_document_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.speaker_list
    ADD CONSTRAINT speaker_list_agenda_item_id_fkey FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.speaker_list
    ADD CONSTRAINT speaker_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement
    ADD CONSTRAINT statement_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.statement_hashtag
    ADD CONSTRAINT statement_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_hashtag
    ADD CONSTRAINT statement_hashtag_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_support_vote
    ADD CONSTRAINT statement_support_vote_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_support_vote
    ADD CONSTRAINT statement_support_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_survey_option
    ADD CONSTRAINT statement_survey_option_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.statement_survey(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_survey
    ADD CONSTRAINT statement_survey_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_survey_vote
    ADD CONSTRAINT statement_survey_vote_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.statement_survey_option(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_survey_vote
    ADD CONSTRAINT statement_survey_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement
    ADD CONSTRAINT statement_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement
    ADD CONSTRAINT statement_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stripe_customer
    ADD CONSTRAINT stripe_customer_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stripe_payment
    ADD CONSTRAINT stripe_payment_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.stripe_customer(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stripe_subscription
    ADD CONSTRAINT stripe_subscription_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.stripe_customer(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_asset
    ADD CONSTRAINT studio_asset_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_asset
    ADD CONSTRAINT studio_asset_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.canvas_proposal(id);

ALTER TABLE ONLY public.studio_command_receipt
    ADD CONSTRAINT studio_command_receipt_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_editor_action
    ADD CONSTRAINT studio_editor_action_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_editor_action
    ADD CONSTRAINT studio_editor_action_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_element_set_asset
    ADD CONSTRAINT studio_element_set_asset_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.studio_element_set_revision(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_element_set
    ADD CONSTRAINT studio_element_set_current_revision_fkey FOREIGN KEY (current_revision_id) REFERENCES public.studio_element_set_revision(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.studio_element_set
    ADD CONSTRAINT studio_element_set_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_element_set
    ADD CONSTRAINT studio_element_set_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_element_set_revision
    ADD CONSTRAINT studio_element_set_revision_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.studio_element_set_revision
    ADD CONSTRAINT studio_element_set_revision_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.studio_element_set(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_export
    ADD CONSTRAINT studio_export_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_export
    ADD CONSTRAINT studio_export_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_export
    ADD CONSTRAINT studio_export_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.studio_revision(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_agenda_item_id_fkey FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_live_source
    ADD CONSTRAINT studio_live_source_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_operation
    ADD CONSTRAINT studio_operation_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_operation
    ADD CONSTRAINT studio_operation_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_project_collaborator
    ADD CONSTRAINT studio_project_collaborator_invited_by_id_fkey FOREIGN KEY (invited_by_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_project_collaborator
    ADD CONSTRAINT studio_project_collaborator_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_project_collaborator
    ADD CONSTRAINT studio_project_collaborator_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_project
    ADD CONSTRAINT studio_project_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_project
    ADD CONSTRAINT studio_project_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_project
    ADD CONSTRAINT studio_project_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_revision
    ADD CONSTRAINT studio_revision_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);

ALTER TABLE ONLY public.studio_revision
    ADD CONSTRAINT studio_revision_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.studio_state
    ADD CONSTRAINT studio_state_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_project(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.subscriber
    ADD CONSTRAINT subscriber_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.support_confirmation
    ADD CONSTRAINT support_confirmation_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.support_confirmation
    ADD CONSTRAINT support_confirmation_confirmed_by_id_fkey FOREIGN KEY (confirmed_by_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.support_confirmation
    ADD CONSTRAINT support_confirmation_process_run_fk FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.support_confirmation
    ADD CONSTRAINT support_confirmation_process_step_run_fk FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.support_confirmation
    ADD CONSTRAINT support_confirmation_process_task_fk FOREIGN KEY (process_task_id) REFERENCES public.process_task(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_blog_id_fkey FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread_vote
    ADD CONSTRAINT thread_vote_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.thread_vote
    ADD CONSTRAINT thread_vote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.todo_activity
    ADD CONSTRAINT todo_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.todo_activity
    ADD CONSTRAINT todo_activity_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.todo_activity
    ADD CONSTRAINT todo_activity_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.todo_assignment
    ADD CONSTRAINT todo_assignment_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.todo_assignment
    ADD CONSTRAINT todo_assignment_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_hashtag
    ADD CONSTRAINT user_hashtag_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_hashtag
    ADD CONSTRAINT user_hashtag_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_appearance_theme_id_fkey FOREIGN KEY (appearance_theme_id) REFERENCES public.appearance_theme(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_tutorial_run_id_fkey FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vote_choice
    ADD CONSTRAINT vote_choice_process_branch_id_fkey FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vote_choice
    ADD CONSTRAINT vote_choice_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vote
    ADD CONSTRAINT vote_closed_by_id_fkey FOREIGN KEY (closed_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vote_offline_tally
    ADD CONSTRAINT vote_offline_tally_choice_id_fkey FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vote_offline_tally
    ADD CONSTRAINT vote_offline_tally_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vote_offline_tally
    ADD CONSTRAINT vote_offline_tally_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.voter
    ADD CONSTRAINT voter_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.voter
    ADD CONSTRAINT voter_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.voting_password
    ADD CONSTRAINT voting_password_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
