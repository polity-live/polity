create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "pg_trgm" with schema "public";


  create table "public"."accreditation" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "agenda_item_id" uuid not null,
    "user_id" uuid not null,
    "status" text not null default 'pending'::text,
    "requested_at" timestamp with time zone not null default now(),
    "decided_at" timestamp with time zone,
    "decided_by" uuid,
    "decision_reason" text,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."accreditation" enable row level security;


  create table "public"."accreditation_audit" (
    "id" uuid not null default gen_random_uuid(),
    "accreditation_id" uuid not null,
    "event_id" uuid not null,
    "user_id" uuid not null,
    "from_status" text,
    "to_status" text not null,
    "actor_id" uuid,
    "reason" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."accreditation_audit" enable row level security;


  create table "public"."action_right" (
    "id" uuid not null default gen_random_uuid(),
    "resource" text,
    "action" text,
    "role_id" uuid not null,
    "group_id" uuid,
    "event_id" uuid,
    "amendment_id" uuid,
    "blog_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."action_right" enable row level security;


  create table "public"."agenda_item" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid,
    "amendment_id" uuid,
    "creator_id" uuid not null,
    "title" text,
    "description" text,
    "type" text,
    "status" text,
    "forwarding_status" text,
    "order_index" integer,
    "duration" integer,
    "scheduled_time" text,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "majority_type" text,
    "time_limit" integer,
    "voting_phase" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."agenda_item" enable row level security;


  create table "public"."agenda_item_change_request" (
    "id" uuid not null default gen_random_uuid(),
    "agenda_item_id" uuid not null,
    "change_request_id" uuid,
    "vote_id" uuid,
    "order_index" integer not null default 0,
    "step_kind" text not null default 'change_request'::text,
    "process_branch_id" uuid,
    "is_closing_vote" boolean not null default false,
    "status" text not null default 'pending'::text,
    "blocked_reason" text,
    "result_status" text,
    "obsolete_reason" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."agenda_item_change_request" enable row level security;


  create table "public"."ai_provider_credential" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "provider" text not null,
    "encrypted_key" text not null,
    "key_hint" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "last_used_at" timestamp with time zone
      );


alter table "public"."ai_provider_credential" enable row level security;


  create table "public"."ai_skill" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "slug" text not null,
    "name" text not null,
    "aliases" text not null default ''::text,
    "system_prompt" text not null,
    "enabled" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_skill" enable row level security;


  create table "public"."ai_tool" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "tool_name" text not null,
    "enabled" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_tool" enable row level security;


  create table "public"."amendment" (
    "id" uuid not null default gen_random_uuid(),
    "code" text,
    "title" text,
    "reason" text,
    "category" text,
    "preamble" text,
    "created_by_id" uuid not null,
    "group_id" uuid,
    "event_id" uuid,
    "clone_source_id" uuid,
    "origin_amendment_id" uuid,
    "document_id" uuid,
    "country" text,
    "region" text,
    "post_code" text,
    "city" text,
    "street" text,
    "house_number" text,
    "latitude" double precision,
    "longitude" double precision,
    "location_kind" text,
    "location_place_id" text,
    "location_boundary_source" text,
    "location_geometry" jsonb,
    "location_bounds" jsonb,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "tags" jsonb,
    "visibility" text not null default 'public'::text,
    "subscriber_count" integer not null default 0,
    "clone_count" integer not null default 0,
    "change_request_count" integer not null default 0,
    "internal_cr_voting_close_trigger" text not null default 'all_collaborators_voted'::text,
    "internal_cr_voting_duration_minutes" integer,
    "internal_cr_resolution_visibility" text not null default 'public'::text,
    "discussions" jsonb,
    "comment_count" integer not null default 0,
    "collaborator_count" integer not null default 0,
    "image_url" text,
    "video_url" text,
    "x" text,
    "youtube" text,
    "linkedin" text,
    "website" text,
    "current_process_run_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."amendment" enable row level security;


  create table "public"."amendment_city_design" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "created_by_id" uuid not null,
    "title" text,
    "bbox" jsonb,
    "center_lat" numeric,
    "center_lon" numeric,
    "osm_snapshot" jsonb,
    "design_state" jsonb,
    "currency" text not null default 'EUR'::text,
    "estimated_total_cost_minor" integer not null default 0,
    "cost_catalog_version" text,
    "cost_summary" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_city_design" enable row level security;


  create table "public"."amendment_collaborator" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "user_id" uuid not null,
    "role_id" uuid,
    "status" text,
    "visibility" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_collaborator" enable row level security;


  create table "public"."amendment_group_decision" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "group_id" uuid not null,
    "process_run_id" uuid,
    "process_branch_id" uuid,
    "process_step_run_id" uuid,
    "status" text not null,
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_group_decision" enable row level security;


  create table "public"."amendment_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_hashtag" enable row level security;


  create table "public"."amendment_path" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "process_run_id" uuid,
    "title" text,
    "workflow_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_path" enable row level security;


  create table "public"."amendment_path_segment" (
    "id" uuid not null default gen_random_uuid(),
    "path_id" uuid not null,
    "process_branch_id" uuid,
    "process_step_run_id" uuid,
    "group_id" uuid,
    "event_id" uuid,
    "order_index" integer,
    "status" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_path_segment" enable row level security;


  create table "public"."amendment_process_branch" (
    "id" uuid not null default gen_random_uuid(),
    "process_run_id" uuid not null,
    "parent_branch_id" uuid,
    "merged_into_branch_id" uuid,
    "source_step_run_id" uuid,
    "document_version_id" uuid,
    "document_id" uuid,
    "discussions" jsonb,
    "title" text,
    "status" text not null default 'pending_event'::text,
    "editing_mode" text not null default 'edit'::text,
    "resolution" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_process_branch" enable row level security;


  create table "public"."amendment_process_run" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "root_workflow_id" uuid,
    "selected_source_group_id" uuid,
    "selected_target_group_id" uuid,
    "selected_target_workflow_id" uuid,
    "active_branch_id" uuid,
    "terminal_step_run_id" uuid,
    "status" text not null default 'pending_event'::text,
    "evaluation_mode" text,
    "evaluation_date" timestamp with time zone,
    "evaluation_offset_months" integer,
    "evaluation_offset_years" integer,
    "implementation_status" text,
    "created_by_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_process_run" enable row level security;


  create table "public"."amendment_process_step_run" (
    "id" uuid not null default gen_random_uuid(),
    "process_run_id" uuid not null,
    "branch_id" uuid not null,
    "workflow_id" uuid,
    "workflow_step_id" uuid,
    "step_kind" text not null default 'group_vote'::text,
    "selection_mode" text,
    "merge_strategy" text,
    "status" text not null default 'pending_event'::text,
    "source_group_id" uuid,
    "target_group_id" uuid,
    "event_id" uuid,
    "agenda_item_id" uuid,
    "vote_id" uuid,
    "support_confirmation_id" uuid,
    "decision_status" text,
    "order_index" integer not null default 0,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_process_step_run" enable row level security;


  create table "public"."amendment_support_vote" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_support_vote" enable row level security;


  create table "public"."amendment_vote_entry" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "is_indication" boolean not null default false,
    "indicated_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_vote_entry" enable row level security;


  create table "public"."app_tutorial_checkpoint_effect" (
    "run_id" uuid not null,
    "checkpoint_id" text not null,
    "effect_key" text not null,
    "applied_at" timestamp with time zone not null default now()
      );


alter table "public"."app_tutorial_checkpoint_effect" enable row level security;


  create table "public"."app_tutorial_entity" (
    "run_id" uuid not null,
    "alias" text not null,
    "entity_type" text not null,
    "entity_id" uuid not null
      );


alter table "public"."app_tutorial_entity" enable row level security;


  create table "public"."app_tutorial_run" (
    "id" uuid not null,
    "user_id" uuid not null,
    "status" text not null default 'active'::text,
    "current_checkpoint_id" text not null,
    "fixture_version" integer not null,
    "revision" integer not null default 0,
    "started_at" timestamp with time zone not null default now(),
    "last_activity_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '30 days'::interval)
      );


alter table "public"."app_tutorial_run" enable row level security;


  create table "public"."appearance_theme" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "name" text not null,
    "description" text,
    "kind" text not null,
    "group_id" uuid,
    "created_by_id" uuid,
    "current_revision_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."appearance_theme" enable row level security;


  create table "public"."appearance_theme_revision" (
    "id" uuid not null default gen_random_uuid(),
    "theme_id" uuid not null,
    "version" integer not null,
    "status" text not null,
    "light_palette" jsonb not null,
    "dark_palette" jsonb not null,
    "fonts" jsonb not null,
    "created_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "published_at" timestamp with time zone
      );


alter table "public"."appearance_theme_revision" enable row level security;


  create table "public"."blog" (
    "id" uuid not null default gen_random_uuid(),
    "title" text,
    "description" text,
    "content" jsonb,
    "date" text,
    "image_url" text,
    "video_url" text,
    "visibility" text not null default 'public'::text,
    "subscriber_count" integer not null default 0,
    "supporter_count" integer not null default 0,
    "like_count" integer not null default 0,
    "comment_count" integer not null default 0,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "editing_mode" text,
    "discussions" jsonb,
    "group_id" uuid,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."blog" enable row level security;


  create table "public"."blog_blogger" (
    "id" uuid not null default gen_random_uuid(),
    "blog_id" uuid not null,
    "user_id" uuid not null,
    "role_id" uuid,
    "status" text,
    "visibility" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."blog_blogger" enable row level security;


  create table "public"."blog_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "blog_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."blog_hashtag" enable row level security;


  create table "public"."blog_support_vote" (
    "id" uuid not null default gen_random_uuid(),
    "blog_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."blog_support_vote" enable row level security;


  create table "public"."calendar_subscription" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "target_type" text not null,
    "target_group_id" uuid,
    "target_user_id" uuid,
    "is_visible" boolean not null default true,
    "color" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."calendar_subscription" enable row level security;


  create table "public"."change_request" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "process_branch_id" uuid,
    "suggestion_id" text,
    "user_id" uuid not null,
    "title" text,
    "description" text,
    "status" text,
    "reason" text,
    "source_type" text,
    "source_id" uuid,
    "source_title" text,
    "change_type" text,
    "original_text" text,
    "new_text" text,
    "original_properties" jsonb,
    "new_properties" jsonb,
    "changed_character_count" integer not null default 0,
    "votes_for" integer not null default 0,
    "votes_against" integer not null default 0,
    "votes_abstain" integer not null default 0,
    "voting_status" text not null default 'open'::text,
    "voting_deadline" timestamp with time zone,
    "voting_majority_type" text,
    "quorum_required" integer,
    "branch_sequence_number" integer,
    "created_in_mode" text,
    "resolved_in_mode" text,
    "resolution_method" text,
    "visibility_scope" text not null default 'public'::text,
    "obsolete_reason" text,
    "obsolete_at" timestamp with time zone,
    "obsolete_by_vote_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."change_request" enable row level security;


  create table "public"."change_request_vote" (
    "id" uuid not null default gen_random_uuid(),
    "change_request_id" uuid not null,
    "user_id" uuid not null,
    "vote" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."change_request_vote" enable row level security;


  create table "public"."comment" (
    "id" uuid not null default gen_random_uuid(),
    "thread_id" uuid not null,
    "user_id" uuid not null,
    "parent_id" uuid,
    "content" text,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."comment" enable row level security;


  create table "public"."comment_vote" (
    "id" uuid not null default gen_random_uuid(),
    "comment_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."comment_vote" enable row level security;


  create table "public"."conversation" (
    "id" uuid not null default gen_random_uuid(),
    "type" text,
    "name" text,
    "status" text,
    "pinned" boolean,
    "last_message_at" timestamp with time zone,
    "last_message_id" uuid,
    "last_message_preview" text,
    "assistant_for_user_id" uuid,
    "group_id" uuid,
    "event_id" uuid,
    "requested_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."conversation" enable row level security;


  create table "public"."conversation_participant" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid not null,
    "user_id" uuid not null,
    "joined_at" timestamp with time zone not null default now(),
    "last_read_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    "unread_count" integer not null default 0
      );


alter table "public"."conversation_participant" enable row level security;


  create table "public"."currency_exchange_rate_cache" (
    "base_currency" text not null,
    "quote_currency" text not null,
    "requested_date" text not null,
    "rate_date" date not null,
    "rate" numeric(24,12) not null,
    "source" text not null default 'frankfurter'::text,
    "fetched_at" timestamp with time zone not null default now()
      );


alter table "public"."currency_exchange_rate_cache" enable row level security;


  create table "public"."dataset" (
    "id" uuid not null,
    "provider" text not null,
    "provider_dataset_id" text,
    "provider_resource_id" text,
    "title" text not null,
    "description" text,
    "license" text,
    "publisher" text,
    "language" text not null default 'en'::text,
    "source_url" text,
    "structure_summary" text,
    "dimensions" jsonb not null default '[]'::jsonb,
    "columns" jsonb not null default '[]'::jsonb,
    "column_profiles" jsonb not null default '[]'::jsonb,
    "time_coverage" jsonb not null default '{}'::jsonb,
    "spatial_coverage" jsonb not null default '{}'::jsonb,
    "topics" jsonb not null default '[]'::jsonb,
    "metadata" jsonb not null default '{}'::jsonb,
    "visibility" text not null default 'public'::text,
    "owner_user_id" uuid,
    "group_id" uuid,
    "status" text not null default 'active'::text,
    "created_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dataset" enable row level security;


  create table "public"."dataset_import_job" (
    "id" uuid not null,
    "dataset_id" uuid,
    "provider" text not null,
    "status" text not null default 'pending'::text,
    "requested_by_id" uuid,
    "request_payload" jsonb not null default '{}'::jsonb,
    "result_snapshot_id" uuid,
    "error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dataset_import_job" enable row level security;


  create table "public"."dataset_snapshot" (
    "id" uuid not null,
    "dataset_id" uuid not null,
    "snapshot_key" text not null,
    "storage_bucket" text not null default 'dataset-snapshots'::text,
    "storage_path" text not null,
    "format" text not null default 'csv'::text,
    "content_hash" text not null,
    "byte_size" bigint not null default 0,
    "row_count" bigint not null default 0,
    "column_count" integer not null default 0,
    "columns" jsonb not null default '[]'::jsonb,
    "column_profiles" jsonb not null default '[]'::jsonb,
    "dimensions" jsonb not null default '[]'::jsonb,
    "metadata" jsonb not null default '{}'::jsonb,
    "status" text not null default 'pending'::text,
    "snapshot_taken_at" timestamp with time zone not null default now(),
    "created_by_id" uuid,
    "error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dataset_snapshot" enable row level security;


  create table "public"."delegate_election_assignment" (
    "id" uuid not null default gen_random_uuid(),
    "target_event_id" uuid not null,
    "source_group_id" uuid not null,
    "allocation_id" uuid,
    "required_seats" integer not null default 0,
    "confirmed_seats" integer not null default 0,
    "linked_event_id" uuid,
    "status" text not null default 'open'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."delegate_election_assignment" enable row level security;


  create table "public"."document" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid,
    "content" jsonb,
    "editing_mode" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."document" enable row level security;


  create table "public"."document_collaborator" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid not null,
    "user_id" uuid not null,
    "role_id" uuid,
    "status" text,
    "visibility" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."document_collaborator" enable row level security;


  create table "public"."document_cursor" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid not null,
    "user_id" uuid not null,
    "position" jsonb,
    "selection" jsonb,
    "color" text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."document_cursor" enable row level security;


  create table "public"."document_version" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid not null,
    "amendment_id" uuid,
    "blog_id" uuid,
    "content" jsonb,
    "version_number" integer,
    "change_summary" text,
    "author_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."document_version" enable row level security;


  create table "public"."election" (
    "id" uuid not null default gen_random_uuid(),
    "agenda_item_id" uuid,
    "role_id" uuid,
    "title" text,
    "description" text,
    "status" text,
    "majority_type" text,
    "closing_type" text,
    "closing_duration_seconds" integer,
    "closing_end_time" timestamp with time zone,
    "visibility" character varying not null default 'public'::character varying,
    "ballot_visibility" text not null default 'secret'::text,
    "election_mode" text not null default 'single'::text,
    "seat_count" integer not null default 1,
    "max_votes" integer not null default 1,
    "electorate_snapshotted_at" timestamp with time zone,
    "offline_electorate_size" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."election" enable row level security;


  create table "public"."election_candidate" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "user_id" uuid not null,
    "name" text,
    "description" text,
    "image_url" text,
    "status" text not null default 'nominated'::text,
    "order_index" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."election_candidate" enable row level security;


  create table "public"."election_offline_tally" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "phase" text not null,
    "candidate_id" uuid not null,
    "count" integer not null default 0,
    "updated_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."election_offline_tally" enable row level security;


  create table "public"."elector" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "user_id" uuid not null,
    "participation_channel" text not null default 'online'::text,
    "snapshotted_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."elector" enable row level security;


  create table "public"."event" (
    "id" uuid not null default gen_random_uuid(),
    "title" text,
    "description" jsonb,
    "status" text,
    "event_type" text,
    "attendance_mode" text not null default 'offline'::text,
    "location_type" text,
    "location_name" text,
    "country" text,
    "region" text,
    "post_code" text,
    "city" text,
    "street" text,
    "house_number" text,
    "latitude" double precision,
    "longitude" double precision,
    "location_kind" text,
    "location_place_id" text,
    "location_boundary_source" text,
    "location_geometry" jsonb,
    "location_bounds" jsonb,
    "location_url" text,
    "location_coordinates" text,
    "visibility" text not null default 'public'::text,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "timezone" text,
    "default_final_vote_duration_seconds" integer,
    "change_request_vote_order" text not null default 'text_position'::text,
    "gender_quota_enabled" boolean not null default false,
    "accreditation_required" boolean not null default false,
    "capacity" integer,
    "participant_count" integer not null default 0,
    "subscriber_count" integer not null default 0,
    "election_count" integer not null default 0,
    "amendment_count" integer not null default 0,
    "open_change_request_count" integer not null default 0,
    "agenda_management" text,
    "meeting_type" text,
    "is_bookable" boolean not null default false,
    "max_bookings" integer default 1,
    "is_recurring" boolean not null default false,
    "recurrence_pattern" text,
    "recurrence_rule" text,
    "recurrence_interval" integer default 1,
    "recurrence_days" integer[],
    "recurrence_end_date" timestamp with time zone,
    "original_event_id" uuid,
    "cancel_reason" text,
    "cancelled_at" timestamp with time zone,
    "cancelled_by_id" uuid,
    "x" text,
    "youtube" text,
    "linkedin" text,
    "website" text,
    "stream_url" text,
    "image_url" text,
    "video_url" text,
    "has_delegates" boolean not null default false,
    "delegate_count" integer not null default 0,
    "delegate_distribution_method" text,
    "delegate_distribution_status" text,
    "delegate_seat_allocation_type" text,
    "total_delegate_seats" integer,
    "delegate_quorum_percentage" numeric,
    "delegate_vote_weight_type" text,
    "delegate_vote_threshold_percentage" numeric,
    "delegate_accepted_states" jsonb,
    "delegate_finalized_at" timestamp with time zone,
    "delegate_approval_type" text,
    "delegate_check_mode" text,
    "main_group_delegate_allocation_mode" text,
    "delegate_election_mode" text not null default 'list'::text,
    "current_agenda_item_id" uuid,
    "amendment_deadline" timestamp with time zone,
    "registration_deadline" timestamp with time zone,
    "candidacy_deadline" timestamp with time zone,
    "delegates_nomination_deadline" timestamp with time zone,
    "group_id" uuid,
    "creator_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."event" enable row level security;


  create table "public"."event_assembly_scope" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "host_group_id" uuid not null,
    "source_group_id" uuid not null,
    "scope_kind" text not null,
    "participant_mode" text not null,
    "required_role_id" uuid,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."event_assembly_scope" enable row level security;


  create table "public"."event_delegate" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "user_id" uuid not null,
    "group_id" uuid,
    "status" text,
    "seat_count" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."event_delegate" enable row level security;


  create table "public"."event_exception" (
    "id" uuid not null default gen_random_uuid(),
    "parent_event_id" uuid not null,
    "original_date" timestamp with time zone not null,
    "action" text not null,
    "new_title" text,
    "new_description" text,
    "new_start_date" timestamp with time zone,
    "new_end_date" timestamp with time zone,
    "new_location_name" text,
    "new_country" text,
    "new_region" text,
    "new_post_code" text,
    "new_city" text,
    "new_street" text,
    "new_house_number" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."event_exception" enable row level security;


  create table "public"."event_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."event_hashtag" enable row level security;


  create table "public"."event_offline_participant" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "group_offline_member_id" uuid,
    "source_type" text not null,
    "first_name" text not null,
    "last_name" text not null,
    "reason_not_signed_up" text,
    "connected_user_id" uuid,
    "attendance_status" text not null default 'listed'::text,
    "participation_channel" text not null default 'offline'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."event_offline_participant" enable row level security;


  create table "public"."event_participant" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "user_id" uuid not null,
    "group_id" uuid,
    "status" text,
    "visibility" text not null default 'public'::text,
    "instance_date" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."event_participant" enable row level security;


  create table "public"."event_participant_role" (
    "id" uuid not null default gen_random_uuid(),
    "event_participant_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."event_participant_role" enable row level security;


  create table "public"."file" (
    "id" uuid not null default gen_random_uuid(),
    "path" text,
    "url" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."file" enable row level security;


  create table "public"."final_candidate_selection" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "candidate_id" uuid not null,
    "elector_participation_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."final_candidate_selection" enable row level security;


  create table "public"."final_choice_decision" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "choice_id" uuid not null,
    "voter_participation_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."final_choice_decision" enable row level security;


  create table "public"."final_elector_participation" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "elector_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."final_elector_participation" enable row level security;


  create table "public"."final_voter_participation" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "voter_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."final_voter_participation" enable row level security;


  create table "public"."follow" (
    "id" uuid not null default gen_random_uuid(),
    "follower_id" uuid not null,
    "followee_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."follow" enable row level security;


  create table "public"."group" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "description" jsonb,
    "email" text,
    "country" text,
    "region" text,
    "post_code" text,
    "city" text,
    "street" text,
    "house_number" text,
    "latitude" double precision,
    "longitude" double precision,
    "location_kind" text,
    "location_place_id" text,
    "location_boundary_source" text,
    "location_geometry" jsonb,
    "location_bounds" jsonb,
    "image_url" text,
    "video_url" text,
    "visibility" text not null default 'public'::text,
    "member_count" integer not null default 0,
    "signed_up_member_count" integer not null default 0,
    "subscriber_count" integer not null default 0,
    "event_count" integer not null default 0,
    "amendment_count" integer not null default 0,
    "document_count" integer not null default 0,
    "group_type" text not null default 'base'::text,
    "has_hierarchy_children" boolean not null default false,
    "has_sibling_connections" boolean not null default false,
    "connected_group_id" uuid,
    "primary_sibling_membership_mode" text,
    "sibling_membership_mode" text,
    "sibling_role_id" uuid,
    "x" text,
    "youtube" text,
    "linkedin" text,
    "website" text,
    "whatsapp" text,
    "instagram" text,
    "twitter" text,
    "facebook" text,
    "snapchat" text,
    "tiktok" text,
    "owner_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."group" enable row level security;


  create table "public"."group_connection" (
    "id" uuid not null default gen_random_uuid(),
    "group_a_id" uuid not null,
    "group_b_id" uuid not null,
    "connection_type" text not null,
    "from_group_id" uuid,
    "to_group_id" uuid,
    "connection_kind" text,
    "parent_group_id" uuid,
    "child_group_id" uuid,
    "status" text not null default 'active'::text,
    "created_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_connection" enable row level security;


  create table "public"."group_connection_request" (
    "id" uuid not null default gen_random_uuid(),
    "active_connection_id" uuid,
    "proposed_connection_id" uuid not null,
    "group_a_id" uuid not null,
    "group_b_id" uuid not null,
    "desired_connection_type" text not null,
    "desired_parent_group_id" uuid,
    "desired_child_group_id" uuid,
    "structure_status" text not null default 'pending'::text,
    "status" text not null default 'pending'::text,
    "initiator_group_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_connection_request" enable row level security;


  create table "public"."group_delegate_allocation" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "group_id" uuid,
    "allocated_seats" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_delegate_allocation" enable row level security;


  create table "public"."group_effective_right" (
    "id" uuid not null default gen_random_uuid(),
    "holder_group_id" uuid not null,
    "scope_group_id" uuid not null,
    "right_key" text not null,
    "source_connection_id" uuid,
    "source_grant_id" uuid,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_effective_right" enable row level security;


  create table "public"."group_guest_access" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "user_id" uuid not null,
    "status" text not null default 'invited'::text,
    "invited_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_guest_access" enable row level security;


  create table "public"."group_guest_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_guest_access_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_guest_role" enable row level security;


  create table "public"."group_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_hashtag" enable row level security;


  create table "public"."group_hierarchy_path" (
    "id" uuid not null default gen_random_uuid(),
    "ancestor_group_id" uuid not null,
    "descendant_group_id" uuid not null,
    "direct_child_group_id" uuid,
    "base_group_id" uuid not null,
    "depth" integer not null,
    "path_group_ids" uuid[] not null default ARRAY[]::uuid[],
    "status" text not null default 'active'::text,
    "connection_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_hierarchy_path" enable row level security;


  create table "public"."group_membership" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "user_id" uuid not null,
    "status" text,
    "visibility" text not null default 'public'::text,
    "source" text not null default 'direct'::text,
    "source_group_id" uuid,
    "origin_kind" text not null default 'direct'::text,
    "connection_id" uuid,
    "membership_rule_id" uuid,
    "part_group_id" uuid,
    "base_group_id" uuid,
    "is_auto_managed" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership" enable row level security;


  create table "public"."group_membership_exclusivity_lock" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "hierarchy_group_id" uuid not null,
    "source_group_id" uuid not null,
    "group_membership_id" uuid not null,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_exclusivity_lock" enable row level security;


  create table "public"."group_membership_origin" (
    "id" uuid not null default gen_random_uuid(),
    "group_membership_id" uuid not null,
    "origin_kind" text not null,
    "source_group_id" uuid,
    "source_membership_id" uuid,
    "connection_id" uuid,
    "membership_rule_id" uuid,
    "source_role_id" uuid,
    "part_group_id" uuid,
    "base_group_id" uuid,
    "depth" integer not null default 0,
    "path_group_ids" uuid[] not null default ARRAY[]::uuid[],
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_origin" enable row level security;


  create table "public"."group_membership_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_membership_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_role" enable row level security;


  create table "public"."group_membership_rule" (
    "id" uuid not null default gen_random_uuid(),
    "connection_id" uuid not null,
    "member_source_group_id" uuid not null,
    "member_target_group_id" uuid not null,
    "membership_mode" text not null,
    "required_source_role_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_rule" enable row level security;


  create table "public"."group_membership_rule_origin" (
    "id" uuid not null default gen_random_uuid(),
    "membership_rule_id" uuid not null,
    "eligible_origin_group_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_rule_origin" enable row level security;


  create table "public"."group_membership_rule_request" (
    "id" uuid not null default gen_random_uuid(),
    "connection_request_id" uuid not null,
    "existing_membership_rule_id" uuid,
    "operation" text not null,
    "member_source_group_id" uuid,
    "member_target_group_id" uuid,
    "membership_mode" text,
    "required_source_role_id" uuid,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_rule_request" enable row level security;


  create table "public"."group_membership_rule_request_origin" (
    "id" uuid not null default gen_random_uuid(),
    "membership_rule_request_id" uuid not null,
    "eligible_origin_group_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_rule_request_origin" enable row level security;


  create table "public"."group_offline_member" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "first_name" text not null,
    "last_name" text not null,
    "reason_not_signed_up" text,
    "connected_user_id" uuid,
    "created_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_member" enable row level security;


  create table "public"."group_offline_membership" (
    "id" uuid not null default gen_random_uuid(),
    "group_offline_member_id" uuid not null,
    "group_id" uuid not null,
    "status" text,
    "visibility" text not null default 'public'::text,
    "source" text not null default 'direct'::text,
    "source_group_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_membership" enable row level security;


  create table "public"."group_offline_membership_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_offline_membership_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_membership_role" enable row level security;


  create table "public"."group_right_grant" (
    "id" uuid not null default gen_random_uuid(),
    "connection_id" uuid not null,
    "right_key" text not null,
    "holder_group_id" uuid not null,
    "scope_group_id" uuid not null,
    "status" text not null default 'active'::text,
    "initiator_group_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_right_grant" enable row level security;


  create table "public"."group_right_grant_request" (
    "id" uuid not null default gen_random_uuid(),
    "connection_request_id" uuid not null,
    "existing_grant_id" uuid,
    "operation" text not null,
    "right_key" text not null,
    "holder_group_id" uuid not null,
    "scope_group_id" uuid not null,
    "status" text not null default 'pending'::text,
    "initiator_group_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_right_grant_request" enable row level security;


  create table "public"."group_sibling_source_lock" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "sibling_group_id" uuid not null,
    "source_group_id" uuid not null,
    "group_membership_id" uuid not null,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_sibling_source_lock" enable row level security;


  create table "public"."group_workflow" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "start_group_id" uuid,
    "name" text,
    "description" text,
    "is_default_entry" boolean not null default false,
    "status" text,
    "created_by_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_workflow" enable row level security;


  create table "public"."group_workflow_approval" (
    "id" uuid not null default gen_random_uuid(),
    "workflow_id" uuid not null,
    "group_id" uuid not null,
    "requested_by_group_id" uuid not null,
    "status" text not null default 'pending'::text,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_workflow_approval" enable row level security;


  create table "public"."group_workflow_step" (
    "id" uuid not null default gen_random_uuid(),
    "workflow_id" uuid not null,
    "group_id" uuid not null,
    "order_index" integer not null default 0,
    "label" text,
    "step_kind" text not null default 'group_vote'::text,
    "selection_mode" text not null default 'default_target_workflow'::text,
    "merge_strategy" text,
    "event_rule" text,
    "auto_task_on_missing_event" boolean not null default false,
    "target_workflow_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_workflow_step" enable row level security;


  create table "public"."hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "tag" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."hashtag" enable row level security;


  create table "public"."indicative_candidate_selection" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "candidate_id" uuid not null,
    "elector_participation_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."indicative_candidate_selection" enable row level security;


  create table "public"."indicative_choice_decision" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "choice_id" uuid not null,
    "voter_participation_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."indicative_choice_decision" enable row level security;


  create table "public"."indicative_elector_participation" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "user_id" uuid not null,
    "elector_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."indicative_elector_participation" enable row level security;


  create table "public"."indicative_voter_participation" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "user_id" uuid not null,
    "voter_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."indicative_voter_participation" enable row level security;


  create table "public"."link" (
    "id" uuid not null default gen_random_uuid(),
    "label" text,
    "url" text,
    "user_id" uuid,
    "group_id" uuid,
    "event_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."link" enable row level security;


  create table "public"."message" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid not null,
    "sender_id" uuid not null,
    "content" text,
    "context_json" text not null default '[]'::text,
    "is_read" boolean not null default false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."message" enable row level security;


  create table "public"."newsletter_subscription" (
    "user_id" uuid not null,
    "email" text not null,
    "language" text not null default 'en'::text,
    "subscribed" boolean not null default true,
    "sync_status" text not null default 'pending'::text,
    "resend_contact_id" text,
    "subscription_source" text not null default 'automatic_signup'::text,
    "subscribed_at" timestamp with time zone not null default now(),
    "unsubscribed_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."newsletter_subscription" enable row level security;


  create table "public"."newsletter_sync_outbox" (
    "id" bigint generated by default as identity not null,
    "user_id" uuid,
    "operation" text not null,
    "email" text not null,
    "previous_email" text,
    "resend_contact_id" text,
    "language" text not null default 'en'::text,
    "subscribed" boolean not null default true,
    "status" text not null default 'pending'::text,
    "attempt_count" integer not null default 0,
    "available_at" timestamp with time zone not null default now(),
    "locked_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."newsletter_sync_outbox" enable row level security;


  create table "public"."notification" (
    "id" uuid not null default gen_random_uuid(),
    "recipient_id" uuid,
    "sender_id" uuid,
    "title" text,
    "message" text,
    "type" text,
    "action_url" text,
    "is_read" boolean not null default false,
    "related_entity_type" text,
    "on_behalf_of_entity_type" text,
    "on_behalf_of_entity_id" uuid,
    "recipient_entity_type" text,
    "recipient_entity_id" uuid,
    "related_user_id" uuid,
    "related_group_id" uuid,
    "related_amendment_id" uuid,
    "related_event_id" uuid,
    "related_blog_id" uuid,
    "on_behalf_of_group_id" uuid,
    "on_behalf_of_event_id" uuid,
    "on_behalf_of_amendment_id" uuid,
    "on_behalf_of_blog_id" uuid,
    "recipient_group_id" uuid,
    "recipient_event_id" uuid,
    "recipient_amendment_id" uuid,
    "recipient_blog_id" uuid,
    "category" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone,
    "deleted_by_user_id" uuid,
    "tutorial_run_id" uuid
      );


alter table "public"."notification" enable row level security;


  create table "public"."notification_read" (
    "id" uuid not null default gen_random_uuid(),
    "notification_id" uuid not null,
    "entity_type" text not null,
    "entity_id" uuid not null,
    "read_by_user_id" uuid,
    "read_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_read" enable row level security;


  create table "public"."notification_setting" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "group_notifications" jsonb,
    "event_notifications" jsonb,
    "amendment_notifications" jsonb,
    "blog_notifications" jsonb,
    "todo_notifications" jsonb,
    "social_notifications" jsonb,
    "delivery_settings" jsonb,
    "timeline_settings" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_setting" enable row level security;


  create table "public"."notification_user_state" (
    "id" uuid not null default gen_random_uuid(),
    "notification_id" uuid not null,
    "user_id" uuid not null,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "purged_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_user_state" enable row level security;


  create table "public"."participant" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "user_id" uuid not null,
    "name" text,
    "email" text,
    "role" text,
    "status" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."participant" enable row level security;


  create table "public"."payment" (
    "id" uuid not null default gen_random_uuid(),
    "amount" numeric(16,4),
    "currency" text not null default 'EUR'::text,
    "label" text,
    "type" text,
    "payer_user_id" uuid,
    "payer_group_id" uuid,
    "receiver_user_id" uuid,
    "receiver_group_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."payment" enable row level security;


  create table "public"."pql_filter" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "group_id" uuid,
    "storage_key" text not null,
    "label" text not null,
    "query" text not null,
    "is_active" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."pql_filter" enable row level security;


  create table "public"."process_task" (
    "id" uuid not null default gen_random_uuid(),
    "process_run_id" uuid not null,
    "branch_id" uuid,
    "step_run_id" uuid,
    "task_type" text not null,
    "status" text not null default 'open'::text,
    "title" text,
    "description" text,
    "group_id" uuid,
    "target_group_id" uuid,
    "event_id" uuid,
    "agenda_item_id" uuid,
    "support_confirmation_id" uuid,
    "due_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."process_task" enable row level security;


  create table "public"."push_delivery_outbox" (
    "id" bigint generated by default as identity not null,
    "notification_job_id" bigint,
    "notification_id" uuid,
    "user_id" uuid not null,
    "push_subscription_id" uuid,
    "kind" text not null default 'notification'::text,
    "dedupe_key" text not null,
    "payload" jsonb not null,
    "status" text not null default 'pending'::text,
    "attempt_count" integer not null default 0,
    "available_at" timestamp with time zone not null default now(),
    "locked_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_error" text,
    "skip_reason" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."push_delivery_outbox" enable row level security;


  create table "public"."push_notification_outbox" (
    "id" bigint generated by default as identity not null,
    "notification_id" uuid not null,
    "status" text not null default 'pending'::text,
    "attempt_count" integer not null default 0,
    "available_at" timestamp with time zone not null default now(),
    "locked_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."push_notification_outbox" enable row level security;


  create table "public"."push_subscription" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "device_id" uuid,
    "endpoint" text not null,
    "auth" text,
    "p256dh" text,
    "user_agent" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."push_subscription" enable row level security;


  create table "public"."reaction" (
    "id" uuid not null default gen_random_uuid(),
    "entity_id" uuid,
    "entity_type" text,
    "reaction_type" text,
    "user_id" uuid not null,
    "timeline_event_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."reaction" enable row level security;


  create table "public"."resend_webhook_event" (
    "svix_id" text not null,
    "event_type" text not null,
    "event_created_at" timestamp with time zone,
    "payload" jsonb not null,
    "processed_at" timestamp with time zone not null default now()
      );


alter table "public"."resend_webhook_event" enable row level security;


  create table "public"."role" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "description" text,
    "scope" text,
    "group_id" uuid,
    "event_id" uuid,
    "amendment_id" uuid,
    "blog_id" uuid,
    "assignment_mode" text not null default 'assigned'::text,
    "visibility" text not null default 'public'::text,
    "term_start_date" timestamp with time zone,
    "is_recurring" boolean not null default false,
    "recurrence_pattern" text,
    "recurrence_rule" text,
    "recurrence_interval" integer,
    "recurrence_days" integer[],
    "recurrence_end_date" timestamp with time zone,
    "scheduled_revote_date" timestamp with time zone,
    "default_request_role" boolean not null default false,
    "default_invite_role" boolean not null default false,
    "assignee_kind" text not null default 'member'::text,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."role" enable row level security;


  create table "public"."role_holder_history" (
    "id" uuid not null default gen_random_uuid(),
    "role_id" uuid not null,
    "user_id" uuid not null,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "reason" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."role_holder_history" enable row level security;


  create table "public"."search_document" (
    "id" text not null,
    "entity_type" text not null,
    "entity_id" uuid not null,
    "title" text not null,
    "subtitle" text,
    "summary" text,
    "search_text" text not null,
    "visibility" text not null default 'public'::text,
    "owner_user_id" uuid,
    "group_id" uuid,
    "image_url" text,
    "location_latitude" double precision,
    "location_longitude" double precision,
    "location_label" text,
    "location_source" text,
    "location_kind" text,
    "location_place_id" text,
    "location_boundary_source" text,
    "location_geometry" jsonb,
    "location_bounds" jsonb,
    "card_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "engagement_score" integer not null default 0,
    "trending_score" double precision not null default 0,
    "tutorial_run_id" uuid
      );


alter table "public"."search_document" enable row level security;


  create table "public"."search_document_acl" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" text not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."search_document_acl" enable row level security;


  create table "public"."search_document_topic" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" text not null,
    "topic" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."search_document_topic" enable row level security;


  create table "public"."speaker_list" (
    "id" uuid not null default gen_random_uuid(),
    "agenda_item_id" uuid not null,
    "user_id" uuid not null,
    "title" text,
    "order_index" integer,
    "time" integer,
    "completed" boolean not null default false,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."speaker_list" enable row level security;


  create table "public"."statement" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "group_id" uuid,
    "title" text,
    "text" text,
    "image_url" text,
    "video_url" text,
    "media_type" text not null default 'text'::text,
    "is_story" boolean not null default false,
    "expires_at" timestamp with time zone,
    "visibility" text not null default 'public'::text,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "comment_count" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."statement" enable row level security;


  create table "public"."statement_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "statement_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."statement_hashtag" enable row level security;


  create table "public"."statement_support_vote" (
    "id" uuid not null default gen_random_uuid(),
    "statement_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."statement_support_vote" enable row level security;


  create table "public"."statement_survey" (
    "id" uuid not null default gen_random_uuid(),
    "statement_id" uuid not null,
    "question" text not null,
    "ends_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."statement_survey" enable row level security;


  create table "public"."statement_survey_option" (
    "id" uuid not null default gen_random_uuid(),
    "survey_id" uuid not null,
    "label" text not null,
    "vote_count" integer not null default 0,
    "position" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."statement_survey_option" enable row level security;


  create table "public"."statement_survey_vote" (
    "id" uuid not null default gen_random_uuid(),
    "option_id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."statement_survey_vote" enable row level security;


  create table "public"."stripe_customer" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_customer_id" text not null,
    "email" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."stripe_customer" enable row level security;


  create table "public"."stripe_payment" (
    "id" uuid not null default gen_random_uuid(),
    "customer_id" uuid not null,
    "stripe_invoice_id" text not null,
    "stripe_customer_id" text,
    "stripe_subscription_id" text,
    "amount" integer,
    "currency" text,
    "status" text,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."stripe_payment" enable row level security;


  create table "public"."stripe_subscription" (
    "id" uuid not null default gen_random_uuid(),
    "customer_id" uuid not null,
    "stripe_subscription_id" text not null,
    "stripe_customer_id" text,
    "status" text,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean,
    "amount" integer,
    "currency" text,
    "interval_period" text,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."stripe_subscription" enable row level security;


  create table "public"."subscriber" (
    "id" uuid not null default gen_random_uuid(),
    "subscriber_id" uuid not null,
    "user_id" uuid,
    "group_id" uuid,
    "amendment_id" uuid,
    "event_id" uuid,
    "blog_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."subscriber" enable row level security;


  create table "public"."support_confirmation" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "process_run_id" uuid,
    "process_step_run_id" uuid,
    "process_task_id" uuid,
    "group_id" uuid,
    "event_id" uuid,
    "confirmed_by_id" uuid not null,
    "status" text,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."support_confirmation" enable row level security;


  create table "public"."thread" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid,
    "amendment_id" uuid,
    "statement_id" uuid,
    "blog_id" uuid,
    "todo_id" uuid,
    "user_id" uuid not null,
    "content" text,
    "status" text not null default 'open'::text,
    "resolved_at" timestamp with time zone,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "position" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."thread" enable row level security;


  create table "public"."thread_vote" (
    "id" uuid not null default gen_random_uuid(),
    "thread_id" uuid not null,
    "user_id" uuid not null,
    "vote" integer,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."thread_vote" enable row level security;


  create table "public"."timeline_event" (
    "id" uuid not null default gen_random_uuid(),
    "event_type" text,
    "entity_type" text,
    "entity_id" uuid,
    "title" text,
    "description" text,
    "metadata" jsonb,
    "image_url" text,
    "video_url" text,
    "video_thumbnail_url" text,
    "content_type" text,
    "tags" jsonb,
    "stats" jsonb,
    "vote_status" text,
    "election_status" text,
    "ends_at" timestamp with time zone,
    "user_id" uuid,
    "group_id" uuid,
    "amendment_id" uuid,
    "event_id" uuid,
    "todo_id" uuid,
    "blog_id" uuid,
    "statement_id" uuid,
    "actor_id" uuid,
    "election_id" uuid,
    "amendment_vote_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."timeline_event" enable row level security;


  create table "public"."todo" (
    "id" uuid not null default gen_random_uuid(),
    "title" text,
    "description" text,
    "status" text,
    "priority" text,
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "tags" jsonb,
    "visibility" text not null default 'public'::text,
    "creator_id" uuid not null,
    "group_id" uuid,
    "event_id" uuid,
    "amendment_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."todo" enable row level security;


  create table "public"."todo_assignment" (
    "id" uuid not null default gen_random_uuid(),
    "todo_id" uuid not null,
    "user_id" uuid not null,
    "role" text,
    "assigned_at" timestamp with time zone not null default now()
      );


alter table "public"."todo_assignment" enable row level security;


  create table "public"."user" (
    "id" uuid not null default gen_random_uuid(),
    "email" text,
    "handle" text,
    "first_name" text,
    "last_name" text,
    "bio" text,
    "gender" text,
    "about" jsonb,
    "avatar" text,
    "video_url" text,
    "x" text,
    "youtube" text,
    "linkedin" text,
    "website" text,
    "whatsapp" text,
    "instagram" text,
    "twitter" text,
    "facebook" text,
    "snapchat" text,
    "tiktok" text,
    "country" text,
    "region" text,
    "post_code" text,
    "city" text,
    "street" text,
    "house_number" text,
    "latitude" double precision,
    "longitude" double precision,
    "location_kind" text,
    "location_place_id" text,
    "location_boundary_source" text,
    "location_geometry" jsonb,
    "location_bounds" jsonb,
    "visibility" text not null default 'public'::text,
    "subscriber_count" integer not null default 0,
    "amendment_count" integer not null default 0,
    "group_count" integer not null default 0,
    "tutorial_step" integer,
    "assistant_introduction" boolean,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "tutorial_run_id" uuid
      );


alter table "public"."user" enable row level security;


  create table "public"."user_hashtag" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "hashtag_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_hashtag" enable row level security;


  create table "public"."user_preference" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "create_form_style" text not null default 'carousel'::text,
    "theme" text not null default 'system'::text,
    "language" text not null default 'en'::text,
    "display_currency" text not null default 'EUR'::text,
    "navigation_view" text not null default 'asButtonList'::text,
    "group_network_layouts" jsonb not null default '{}'::jsonb,
    "decision_terminal_dashboard" jsonb not null default '{}'::jsonb,
    "app_tutorial_completed_at" timestamp with time zone,
    "appearance_theme_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_preference" enable row level security;


  create table "public"."vote" (
    "id" uuid not null default gen_random_uuid(),
    "agenda_item_id" uuid,
    "amendment_id" uuid,
    "title" text,
    "description" text,
    "status" text not null default 'pending'::text,
    "purpose" text not null,
    "majority_type" text not null default 'relative'::text,
    "closing_type" text not null default 'moderator'::text,
    "closing_duration_seconds" integer,
    "closing_end_time" timestamp with time zone,
    "closed_reason" text,
    "closed_at" timestamp with time zone,
    "closed_by_id" uuid,
    "visibility" character varying not null default 'public'::character varying,
    "ballot_visibility" text not null default 'named'::text,
    "electorate_snapshotted_at" timestamp with time zone,
    "offline_electorate_size" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."vote" enable row level security;


  create table "public"."vote_choice" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "label" text not null,
    "semantic_key" text,
    "process_branch_id" uuid,
    "order_index" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."vote_choice" enable row level security;


  create table "public"."vote_offline_tally" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "phase" text not null,
    "choice_id" uuid not null,
    "count" integer not null default 0,
    "updated_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."vote_offline_tally" enable row level security;


  create table "public"."voter" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "user_id" uuid not null,
    "participation_channel" text not null default 'online'::text,
    "snapshotted_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."voter" enable row level security;


  create table "public"."voting_password" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "password_hash" text not null,
    "last_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."voting_password" enable row level security;

CREATE UNIQUE INDEX accreditation_audit_pkey ON public.accreditation_audit USING btree (id);

CREATE UNIQUE INDEX accreditation_event_id_user_id_key ON public.accreditation USING btree (event_id, user_id);

CREATE UNIQUE INDEX accreditation_pkey ON public.accreditation USING btree (id);

CREATE UNIQUE INDEX action_right_pkey ON public.action_right USING btree (id);

CREATE UNIQUE INDEX agenda_item_change_request_pkey ON public.agenda_item_change_request USING btree (id);

CREATE UNIQUE INDEX agenda_item_pkey ON public.agenda_item USING btree (id);

CREATE UNIQUE INDEX ai_provider_credential_pkey ON public.ai_provider_credential USING btree (id);

CREATE UNIQUE INDEX ai_skill_pkey ON public.ai_skill USING btree (id);

CREATE UNIQUE INDEX ai_tool_pkey ON public.ai_tool USING btree (id);

CREATE UNIQUE INDEX amendment_city_design_pkey ON public.amendment_city_design USING btree (id);

CREATE UNIQUE INDEX amendment_collaborator_pkey ON public.amendment_collaborator USING btree (id);

CREATE UNIQUE INDEX amendment_group_decision_pkey ON public.amendment_group_decision USING btree (id);

CREATE UNIQUE INDEX amendment_hashtag_amendment_id_hashtag_id_key ON public.amendment_hashtag USING btree (amendment_id, hashtag_id);

CREATE UNIQUE INDEX amendment_hashtag_pkey ON public.amendment_hashtag USING btree (id);

CREATE UNIQUE INDEX amendment_path_pkey ON public.amendment_path USING btree (id);

CREATE UNIQUE INDEX amendment_path_segment_pkey ON public.amendment_path_segment USING btree (id);

CREATE UNIQUE INDEX amendment_pkey ON public.amendment USING btree (id);

CREATE UNIQUE INDEX amendment_process_branch_pkey ON public.amendment_process_branch USING btree (id);

CREATE UNIQUE INDEX amendment_process_run_pkey ON public.amendment_process_run USING btree (id);

CREATE UNIQUE INDEX amendment_process_step_run_pkey ON public.amendment_process_step_run USING btree (id);

CREATE UNIQUE INDEX amendment_support_vote_pkey ON public.amendment_support_vote USING btree (id);

CREATE INDEX amendment_tutorial_run_id_idx ON public.amendment USING btree (tutorial_run_id);

CREATE UNIQUE INDEX amendment_vote_entry_pkey ON public.amendment_vote_entry USING btree (id);

CREATE UNIQUE INDEX app_tutorial_checkpoint_effect_pkey ON public.app_tutorial_checkpoint_effect USING btree (run_id, checkpoint_id, effect_key);

CREATE UNIQUE INDEX app_tutorial_entity_pkey ON public.app_tutorial_entity USING btree (run_id, alias);

CREATE UNIQUE INDEX app_tutorial_entity_run_type_id_key ON public.app_tutorial_entity USING btree (run_id, entity_type, entity_id);

CREATE INDEX app_tutorial_run_expires_at_idx ON public.app_tutorial_run USING btree (expires_at);

CREATE UNIQUE INDEX app_tutorial_run_one_open_per_user ON public.app_tutorial_run USING btree (user_id) WHERE (status = ANY (ARRAY['active'::text, 'paused'::text]));

CREATE UNIQUE INDEX app_tutorial_run_pkey ON public.app_tutorial_run USING btree (id);

CREATE UNIQUE INDEX appearance_theme_group_slug_unique ON public.appearance_theme USING btree (group_id, slug) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX appearance_theme_pkey ON public.appearance_theme USING btree (id);

CREATE UNIQUE INDEX appearance_theme_revision_pkey ON public.appearance_theme_revision USING btree (id);

CREATE UNIQUE INDEX appearance_theme_revision_theme_id_version_key ON public.appearance_theme_revision USING btree (theme_id, version);

CREATE UNIQUE INDEX blog_blogger_pkey ON public.blog_blogger USING btree (id);

CREATE UNIQUE INDEX blog_hashtag_blog_id_hashtag_id_key ON public.blog_hashtag USING btree (blog_id, hashtag_id);

CREATE UNIQUE INDEX blog_hashtag_pkey ON public.blog_hashtag USING btree (id);

CREATE UNIQUE INDEX blog_pkey ON public.blog USING btree (id);

CREATE UNIQUE INDEX blog_support_vote_pkey ON public.blog_support_vote USING btree (id);

CREATE INDEX blog_tutorial_run_id_idx ON public.blog USING btree (tutorial_run_id);

CREATE UNIQUE INDEX calendar_subscription_pkey ON public.calendar_subscription USING btree (id);

CREATE UNIQUE INDEX change_request_pkey ON public.change_request USING btree (id);

CREATE UNIQUE INDEX change_request_vote_pkey ON public.change_request_vote USING btree (id);

CREATE UNIQUE INDEX comment_pkey ON public.comment USING btree (id);

CREATE UNIQUE INDEX comment_vote_pkey ON public.comment_vote USING btree (id);

CREATE UNIQUE INDEX conversation_participant_pkey ON public.conversation_participant USING btree (id);

CREATE UNIQUE INDEX conversation_pkey ON public.conversation USING btree (id);

CREATE INDEX conversation_tutorial_run_id_idx ON public.conversation USING btree (tutorial_run_id);

CREATE UNIQUE INDEX currency_exchange_rate_cache_pkey ON public.currency_exchange_rate_cache USING btree (base_currency, quote_currency, requested_date);

CREATE UNIQUE INDEX dataset_import_job_pkey ON public.dataset_import_job USING btree (id);

CREATE UNIQUE INDEX dataset_pkey ON public.dataset USING btree (id);

CREATE UNIQUE INDEX dataset_snapshot_pkey ON public.dataset_snapshot USING btree (id);

CREATE UNIQUE INDEX dataset_snapshot_snapshot_key_key ON public.dataset_snapshot USING btree (snapshot_key);

CREATE UNIQUE INDEX delegate_election_assignment_pkey ON public.delegate_election_assignment USING btree (id);

CREATE UNIQUE INDEX delegate_election_assignment_target_event_id_source_group_i_key ON public.delegate_election_assignment USING btree (target_event_id, source_group_id);

CREATE UNIQUE INDEX document_collaborator_pkey ON public.document_collaborator USING btree (id);

CREATE UNIQUE INDEX document_cursor_pkey ON public.document_cursor USING btree (id);

CREATE UNIQUE INDEX document_pkey ON public.document USING btree (id);

CREATE UNIQUE INDEX document_version_pkey ON public.document_version USING btree (id);

CREATE UNIQUE INDEX election_candidate_pkey ON public.election_candidate USING btree (id);

CREATE UNIQUE INDEX election_offline_tally_election_id_phase_candidate_id_key ON public.election_offline_tally USING btree (election_id, phase, candidate_id);

CREATE UNIQUE INDEX election_offline_tally_pkey ON public.election_offline_tally USING btree (id);

CREATE UNIQUE INDEX election_pkey ON public.election USING btree (id);

CREATE UNIQUE INDEX elector_election_id_user_id_key ON public.elector USING btree (election_id, user_id);

CREATE UNIQUE INDEX elector_pkey ON public.elector USING btree (id);

CREATE UNIQUE INDEX event_assembly_scope_event_id_source_group_id_scope_kind_pa_key ON public.event_assembly_scope USING btree (event_id, source_group_id, scope_kind, participant_mode);

CREATE UNIQUE INDEX event_assembly_scope_pkey ON public.event_assembly_scope USING btree (id);

CREATE UNIQUE INDEX event_delegate_pkey ON public.event_delegate USING btree (id);

CREATE UNIQUE INDEX event_exception_pkey ON public.event_exception USING btree (id);

CREATE UNIQUE INDEX event_hashtag_event_id_hashtag_id_key ON public.event_hashtag USING btree (event_id, hashtag_id);

CREATE UNIQUE INDEX event_hashtag_pkey ON public.event_hashtag USING btree (id);

CREATE UNIQUE INDEX event_offline_participant_pkey ON public.event_offline_participant USING btree (id);

CREATE UNIQUE INDEX event_participant_pkey ON public.event_participant USING btree (id);

CREATE UNIQUE INDEX event_participant_role_event_participant_id_role_id_key ON public.event_participant_role USING btree (event_participant_id, role_id);

CREATE UNIQUE INDEX event_participant_role_pkey ON public.event_participant_role USING btree (id);

CREATE UNIQUE INDEX event_pkey ON public.event USING btree (id);

CREATE INDEX event_tutorial_run_id_idx ON public.event USING btree (tutorial_run_id);

CREATE UNIQUE INDEX file_pkey ON public.file USING btree (id);

CREATE UNIQUE INDEX final_candidate_selection_pkey ON public.final_candidate_selection USING btree (id);

CREATE UNIQUE INDEX final_choice_decision_pkey ON public.final_choice_decision USING btree (id);

CREATE UNIQUE INDEX final_elector_participation_election_id_elector_id_key ON public.final_elector_participation USING btree (election_id, elector_id);

CREATE UNIQUE INDEX final_elector_participation_pkey ON public.final_elector_participation USING btree (id);

CREATE UNIQUE INDEX final_voter_participation_pkey ON public.final_voter_participation USING btree (id);

CREATE UNIQUE INDEX final_voter_participation_vote_id_voter_id_key ON public.final_voter_participation USING btree (vote_id, voter_id);

CREATE UNIQUE INDEX follow_pkey ON public.follow USING btree (id);

CREATE UNIQUE INDEX group_connection_group_a_id_group_b_id_key ON public.group_connection USING btree (group_a_id, group_b_id);

CREATE UNIQUE INDEX group_connection_pkey ON public.group_connection USING btree (id);

CREATE UNIQUE INDEX group_connection_request_group_a_id_group_b_id_key ON public.group_connection_request USING btree (group_a_id, group_b_id);

CREATE UNIQUE INDEX group_connection_request_pkey ON public.group_connection_request USING btree (id);

CREATE UNIQUE INDEX group_delegate_allocation_pkey ON public.group_delegate_allocation USING btree (id);

CREATE UNIQUE INDEX group_effective_right_holder_group_id_scope_group_id_right__key ON public.group_effective_right USING btree (holder_group_id, scope_group_id, right_key, source_connection_id, source_grant_id);

CREATE UNIQUE INDEX group_effective_right_pkey ON public.group_effective_right USING btree (id);

CREATE UNIQUE INDEX group_guest_access_group_id_user_id_key ON public.group_guest_access USING btree (group_id, user_id);

CREATE UNIQUE INDEX group_guest_access_pkey ON public.group_guest_access USING btree (id);

CREATE UNIQUE INDEX group_guest_role_group_guest_access_id_role_id_key ON public.group_guest_role USING btree (group_guest_access_id, role_id);

CREATE UNIQUE INDEX group_guest_role_pkey ON public.group_guest_role USING btree (id);

CREATE UNIQUE INDEX group_hashtag_group_id_hashtag_id_key ON public.group_hashtag USING btree (group_id, hashtag_id);

CREATE UNIQUE INDEX group_hashtag_pkey ON public.group_hashtag USING btree (id);

CREATE UNIQUE INDEX group_hierarchy_path_ancestor_group_id_descendant_group_id__key ON public.group_hierarchy_path USING btree (ancestor_group_id, descendant_group_id, base_group_id, path_group_ids);

CREATE UNIQUE INDEX group_hierarchy_path_pkey ON public.group_hierarchy_path USING btree (id);

CREATE UNIQUE INDEX group_membership_exclusivity_lock_pkey ON public.group_membership_exclusivity_lock USING btree (id);

CREATE UNIQUE INDEX group_membership_origin_group_membership_id_origin_kind_sou_key ON public.group_membership_origin USING btree (group_membership_id, origin_kind, source_group_id, connection_id, membership_rule_id, source_role_id);

CREATE UNIQUE INDEX group_membership_origin_pkey ON public.group_membership_origin USING btree (id);

CREATE UNIQUE INDEX group_membership_pkey ON public.group_membership USING btree (id);

CREATE UNIQUE INDEX group_membership_role_group_membership_id_role_id_key ON public.group_membership_role USING btree (group_membership_id, role_id);

CREATE UNIQUE INDEX group_membership_role_pkey ON public.group_membership_role USING btree (id);

CREATE UNIQUE INDEX group_membership_rule_connection_id_key ON public.group_membership_rule USING btree (connection_id);

CREATE UNIQUE INDEX group_membership_rule_origin_membership_rule_id_eligible_or_key ON public.group_membership_rule_origin USING btree (membership_rule_id, eligible_origin_group_id);

CREATE UNIQUE INDEX group_membership_rule_origin_pkey ON public.group_membership_rule_origin USING btree (id);

CREATE UNIQUE INDEX group_membership_rule_pkey ON public.group_membership_rule USING btree (id);

CREATE UNIQUE INDEX group_membership_rule_request_connection_request_id_key ON public.group_membership_rule_request USING btree (connection_request_id);

CREATE UNIQUE INDEX group_membership_rule_request_membership_rule_request_id_el_key ON public.group_membership_rule_request_origin USING btree (membership_rule_request_id, eligible_origin_group_id);

CREATE UNIQUE INDEX group_membership_rule_request_origin_pkey ON public.group_membership_rule_request_origin USING btree (id);

CREATE UNIQUE INDEX group_membership_rule_request_pkey ON public.group_membership_rule_request USING btree (id);

CREATE UNIQUE INDEX group_membership_user_id_group_id_key ON public.group_membership USING btree (user_id, group_id);

CREATE UNIQUE INDEX group_offline_member_pkey ON public.group_offline_member USING btree (id);

CREATE UNIQUE INDEX group_offline_membership_group_offline_member_id_group_id_key ON public.group_offline_membership USING btree (group_offline_member_id, group_id);

CREATE UNIQUE INDEX group_offline_membership_pkey ON public.group_offline_membership USING btree (id);

CREATE UNIQUE INDEX group_offline_membership_role_group_offline_membership_id_r_key ON public.group_offline_membership_role USING btree (group_offline_membership_id, role_id);

CREATE UNIQUE INDEX group_offline_membership_role_pkey ON public.group_offline_membership_role USING btree (id);

CREATE UNIQUE INDEX group_pkey ON public."group" USING btree (id);

CREATE UNIQUE INDEX group_right_grant_connection_id_right_key_holder_group_id_s_key ON public.group_right_grant USING btree (connection_id, right_key, holder_group_id, scope_group_id);

CREATE UNIQUE INDEX group_right_grant_pkey ON public.group_right_grant USING btree (id);

CREATE UNIQUE INDEX group_right_grant_request_connection_request_id_right_key_h_key ON public.group_right_grant_request USING btree (connection_request_id, right_key, holder_group_id, scope_group_id);

CREATE UNIQUE INDEX group_right_grant_request_pkey ON public.group_right_grant_request USING btree (id);

CREATE UNIQUE INDEX group_sibling_source_lock_pkey ON public.group_sibling_source_lock USING btree (id);

CREATE INDEX group_tutorial_run_id_idx ON public."group" USING btree (tutorial_run_id);

CREATE UNIQUE INDEX group_workflow_approval_pkey ON public.group_workflow_approval USING btree (id);

CREATE UNIQUE INDEX group_workflow_pkey ON public.group_workflow USING btree (id);

CREATE UNIQUE INDEX group_workflow_step_pkey ON public.group_workflow_step USING btree (id);

CREATE UNIQUE INDEX hashtag_pkey ON public.hashtag USING btree (id);

CREATE INDEX idx_accreditation_agenda_item ON public.accreditation USING btree (agenda_item_id);

CREATE INDEX idx_accreditation_audit_accreditation ON public.accreditation_audit USING btree (accreditation_id);

CREATE INDEX idx_accreditation_audit_event ON public.accreditation_audit USING btree (event_id);

CREATE INDEX idx_accreditation_event ON public.accreditation USING btree (event_id);

CREATE INDEX idx_accreditation_user ON public.accreditation USING btree (user_id);

CREATE INDEX idx_action_right_role ON public.action_right USING btree (role_id);

CREATE INDEX idx_agenda_item_creator ON public.agenda_item USING btree (creator_id);

CREATE INDEX idx_agenda_item_event ON public.agenda_item USING btree (event_id);

CREATE INDEX idx_ai_provider_credential_user ON public.ai_provider_credential USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_provider_credential_user_provider ON public.ai_provider_credential USING btree (user_id, provider);

CREATE INDEX idx_ai_skill_user ON public.ai_skill USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_skill_user_slug ON public.ai_skill USING btree (user_id, slug);

CREATE INDEX idx_ai_tool_user ON public.ai_tool USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_tool_user_name ON public.ai_tool USING btree (user_id, tool_name);

CREATE INDEX idx_aicr_agenda_item ON public.agenda_item_change_request USING btree (agenda_item_id);

CREATE INDEX idx_aicr_change_request ON public.agenda_item_change_request USING btree (change_request_id);

CREATE INDEX idx_aicr_process_branch ON public.agenda_item_change_request USING btree (process_branch_id);

CREATE INDEX idx_aicr_step_kind ON public.agenda_item_change_request USING btree (agenda_item_id, step_kind);

CREATE UNIQUE INDEX idx_aicr_unique ON public.agenda_item_change_request USING btree (agenda_item_id, change_request_id) WHERE (change_request_id IS NOT NULL);

CREATE INDEX idx_aicr_vote ON public.agenda_item_change_request USING btree (vote_id);

CREATE INDEX idx_amendment_city_design_amendment ON public.amendment_city_design USING btree (amendment_id);

CREATE INDEX idx_amendment_city_design_created_by ON public.amendment_city_design USING btree (created_by_id);

CREATE INDEX idx_amendment_city_design_updated_at ON public.amendment_city_design USING btree (updated_at DESC);

CREATE INDEX idx_amendment_collaborator_amendment ON public.amendment_collaborator USING btree (amendment_id);

CREATE INDEX idx_amendment_collaborator_user ON public.amendment_collaborator USING btree (user_id);

CREATE INDEX idx_amendment_created_by ON public.amendment USING btree (created_by_id);

CREATE INDEX idx_amendment_event ON public.amendment USING btree (event_id);

CREATE INDEX idx_amendment_group ON public.amendment USING btree (group_id);

CREATE INDEX idx_amendment_group_decision_group ON public.amendment_group_decision USING btree (group_id);

CREATE INDEX idx_amendment_group_decision_process_run ON public.amendment_group_decision USING btree (process_run_id);

CREATE INDEX idx_amendment_group_decision_status ON public.amendment_group_decision USING btree (status);

CREATE UNIQUE INDEX idx_amendment_group_decision_unique ON public.amendment_group_decision USING btree (amendment_id, group_id);

CREATE INDEX idx_amendment_hashtag_amendment ON public.amendment_hashtag USING btree (amendment_id);

CREATE INDEX idx_amendment_hashtag_hashtag ON public.amendment_hashtag USING btree (hashtag_id);

CREATE INDEX idx_amendment_origin ON public.amendment USING btree (origin_amendment_id);

CREATE INDEX idx_amendment_path_amendment ON public.amendment_path USING btree (amendment_id);

CREATE INDEX idx_amendment_path_segment_path ON public.amendment_path_segment USING btree (path_id);

CREATE INDEX idx_amendment_process_branch_document ON public.amendment_process_branch USING btree (document_id);

CREATE INDEX idx_amendment_process_branch_editing_mode ON public.amendment_process_branch USING btree (editing_mode);

CREATE INDEX idx_amendment_process_branch_parent ON public.amendment_process_branch USING btree (parent_branch_id);

CREATE INDEX idx_amendment_process_branch_run ON public.amendment_process_branch USING btree (process_run_id);

CREATE INDEX idx_amendment_process_branch_status ON public.amendment_process_branch USING btree (status);

CREATE INDEX idx_amendment_process_run_amendment ON public.amendment_process_run USING btree (amendment_id);

CREATE INDEX idx_amendment_process_run_status ON public.amendment_process_run USING btree (status);

CREATE INDEX idx_amendment_process_step_run_branch ON public.amendment_process_step_run USING btree (branch_id);

CREATE INDEX idx_amendment_process_step_run_event ON public.amendment_process_step_run USING btree (event_id);

CREATE INDEX idx_amendment_process_step_run_process ON public.amendment_process_step_run USING btree (process_run_id);

CREATE INDEX idx_amendment_process_step_run_status ON public.amendment_process_step_run USING btree (status);

CREATE INDEX idx_amendment_support_vote_amendment ON public.amendment_support_vote USING btree (amendment_id);

CREATE INDEX idx_amendment_support_vote_user ON public.amendment_support_vote USING btree (user_id);

CREATE INDEX idx_amendment_vote_entry_amendment ON public.amendment_vote_entry USING btree (amendment_id);

CREATE INDEX idx_amendment_vote_entry_user ON public.amendment_vote_entry USING btree (user_id);

CREATE INDEX idx_appearance_theme_group ON public.appearance_theme USING btree (group_id, updated_at DESC);

CREATE INDEX idx_appearance_theme_kind ON public.appearance_theme USING btree (kind, slug);

CREATE UNIQUE INDEX idx_appearance_theme_one_draft ON public.appearance_theme_revision USING btree (theme_id) WHERE (status = 'draft'::text);

CREATE INDEX idx_appearance_theme_revision_theme_status ON public.appearance_theme_revision USING btree (theme_id, status, version DESC);

CREATE INDEX idx_blog_blogger_blog ON public.blog_blogger USING btree (blog_id);

CREATE INDEX idx_blog_blogger_user ON public.blog_blogger USING btree (user_id);

CREATE INDEX idx_blog_group ON public.blog USING btree (group_id);

CREATE INDEX idx_blog_hashtag_blog ON public.blog_hashtag USING btree (blog_id);

CREATE INDEX idx_blog_hashtag_hashtag ON public.blog_hashtag USING btree (hashtag_id);

CREATE INDEX idx_blog_support_vote_blog ON public.blog_support_vote USING btree (blog_id);

CREATE INDEX idx_blog_support_vote_user ON public.blog_support_vote USING btree (user_id);

CREATE INDEX idx_calendar_sub_user ON public.calendar_subscription USING btree (user_id);

CREATE UNIQUE INDEX idx_calendar_sub_user_group ON public.calendar_subscription USING btree (user_id, target_group_id) WHERE (target_group_id IS NOT NULL);

CREATE UNIQUE INDEX idx_calendar_sub_user_user ON public.calendar_subscription USING btree (user_id, target_user_id) WHERE (target_user_id IS NOT NULL);

CREATE INDEX idx_change_request_amendment ON public.change_request USING btree (amendment_id);

CREATE UNIQUE INDEX idx_change_request_branch_sequence ON public.change_request USING btree (amendment_id, process_branch_id, branch_sequence_number) WHERE ((branch_sequence_number IS NOT NULL) AND (process_branch_id IS NOT NULL));

CREATE INDEX idx_change_request_changed_character_count ON public.change_request USING btree (changed_character_count);

CREATE UNIQUE INDEX idx_change_request_main_sequence ON public.change_request USING btree (amendment_id, branch_sequence_number) WHERE ((branch_sequence_number IS NOT NULL) AND (process_branch_id IS NULL));

CREATE INDEX idx_change_request_process_branch ON public.change_request USING btree (process_branch_id);

CREATE INDEX idx_change_request_suggestion_id ON public.change_request USING btree (suggestion_id) WHERE (suggestion_id IS NOT NULL);

CREATE INDEX idx_change_request_user ON public.change_request USING btree (user_id);

CREATE INDEX idx_change_request_vote_cr ON public.change_request_vote USING btree (change_request_id);

CREATE INDEX idx_change_request_vote_user ON public.change_request_vote USING btree (user_id);

CREATE INDEX idx_comment_parent ON public.comment USING btree (parent_id);

CREATE INDEX idx_comment_thread ON public.comment USING btree (thread_id);

CREATE INDEX idx_comment_user ON public.comment USING btree (user_id);

CREATE INDEX idx_comment_vote_comment ON public.comment_vote USING btree (comment_id);

CREATE INDEX idx_comment_vote_user ON public.comment_vote USING btree (user_id);

CREATE INDEX idx_conversation_assistant_for_user ON public.conversation USING btree (assistant_for_user_id);

CREATE INDEX idx_conversation_event ON public.conversation USING btree (event_id);

CREATE INDEX idx_conversation_group ON public.conversation USING btree (group_id);

CREATE INDEX idx_conversation_last_message ON public.conversation USING btree (last_message_at DESC, id DESC);

CREATE INDEX idx_conversation_participant_conversation ON public.conversation_participant USING btree (conversation_id);

CREATE UNIQUE INDEX idx_conversation_participant_unique_membership ON public.conversation_participant USING btree (conversation_id, user_id);

CREATE INDEX idx_conversation_participant_user ON public.conversation_participant USING btree (user_id);

CREATE INDEX idx_conversation_participant_user_left ON public.conversation_participant USING btree (user_id, left_at, conversation_id);

CREATE INDEX idx_conversation_requested_by ON public.conversation USING btree (requested_by_id);

CREATE INDEX idx_currency_exchange_rate_cache_fetched ON public.currency_exchange_rate_cache USING btree (fetched_at);

CREATE INDEX idx_dataset_description_trgm ON public.dataset USING gin (description public.gin_trgm_ops);

CREATE INDEX idx_dataset_group ON public.dataset USING btree (group_id, updated_at DESC);

CREATE INDEX idx_dataset_import_job_dataset ON public.dataset_import_job USING btree (dataset_id, created_at DESC);

CREATE INDEX idx_dataset_import_job_status ON public.dataset_import_job USING btree (status, created_at DESC);

CREATE INDEX idx_dataset_metadata_gin ON public.dataset USING gin (metadata jsonb_path_ops);

CREATE INDEX idx_dataset_owner ON public.dataset USING btree (owner_user_id, updated_at DESC);

CREATE INDEX idx_dataset_provider_code ON public.dataset USING btree (provider, provider_dataset_id);

CREATE UNIQUE INDEX idx_dataset_provider_identity ON public.dataset USING btree (provider, COALESCE(provider_dataset_id, ''::text), COALESCE(provider_resource_id, ''::text), COALESCE((group_id)::text, ''::text));

CREATE INDEX idx_dataset_snapshot_dataset_created ON public.dataset_snapshot USING btree (dataset_id, snapshot_taken_at DESC);

CREATE INDEX idx_dataset_snapshot_hash ON public.dataset_snapshot USING btree (content_hash);

CREATE INDEX idx_dataset_snapshot_status ON public.dataset_snapshot USING btree (status);

CREATE INDEX idx_dataset_status ON public.dataset USING btree (status);

CREATE INDEX idx_dataset_title_trgm ON public.dataset USING gin (title public.gin_trgm_ops);

CREATE INDEX idx_delegate_election_assignment_linked_event ON public.delegate_election_assignment USING btree (linked_event_id);

CREATE INDEX idx_delegate_election_assignment_source_group ON public.delegate_election_assignment USING btree (source_group_id, status);

CREATE INDEX idx_delegate_election_assignment_target_event ON public.delegate_election_assignment USING btree (target_event_id, status);

CREATE INDEX idx_document_amendment ON public.document USING btree (amendment_id);

CREATE INDEX idx_document_collaborator_document ON public.document_collaborator USING btree (document_id);

CREATE INDEX idx_document_collaborator_user ON public.document_collaborator USING btree (user_id);

CREATE INDEX idx_document_cursor_document ON public.document_cursor USING btree (document_id);

CREATE INDEX idx_document_version_author ON public.document_version USING btree (author_id);

CREATE INDEX idx_document_version_document ON public.document_version USING btree (document_id);

CREATE INDEX idx_election_agenda_item ON public.election USING btree (agenda_item_id);

CREATE INDEX idx_election_candidate_election ON public.election_candidate USING btree (election_id);

CREATE INDEX idx_election_candidate_user ON public.election_candidate USING btree (user_id);

CREATE INDEX idx_election_offline_tally_candidate ON public.election_offline_tally USING btree (candidate_id);

CREATE INDEX idx_election_offline_tally_election ON public.election_offline_tally USING btree (election_id);

CREATE INDEX idx_election_role_id ON public.election USING btree (role_id);

CREATE INDEX idx_elector_election ON public.elector USING btree (election_id);

CREATE INDEX idx_elector_user ON public.elector USING btree (user_id);

CREATE INDEX idx_event_assembly_scope_event ON public.event_assembly_scope USING btree (event_id, status);

CREATE INDEX idx_event_assembly_scope_host_group ON public.event_assembly_scope USING btree (host_group_id, status);

CREATE INDEX idx_event_assembly_scope_source_group ON public.event_assembly_scope USING btree (source_group_id, status);

CREATE INDEX idx_event_creator ON public.event USING btree (creator_id);

CREATE INDEX idx_event_delegate_event ON public.event_delegate USING btree (event_id);

CREATE INDEX idx_event_delegate_user ON public.event_delegate USING btree (user_id);

CREATE INDEX idx_event_exception_parent ON public.event_exception USING btree (parent_event_id);

CREATE INDEX idx_event_group ON public.event USING btree (group_id);

CREATE INDEX idx_event_hashtag_event ON public.event_hashtag USING btree (event_id);

CREATE INDEX idx_event_hashtag_hashtag ON public.event_hashtag USING btree (hashtag_id);

CREATE INDEX idx_event_offline_participant_connected_user ON public.event_offline_participant USING btree (connected_user_id);

CREATE INDEX idx_event_offline_participant_event ON public.event_offline_participant USING btree (event_id);

CREATE INDEX idx_event_offline_participant_group_offline_member ON public.event_offline_participant USING btree (group_offline_member_id);

CREATE UNIQUE INDEX idx_event_offline_participant_unique_connected_user ON public.event_offline_participant USING btree (event_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_event_participant_event ON public.event_participant USING btree (event_id);

CREATE INDEX idx_event_participant_instance ON public.event_participant USING btree (event_id, instance_date);

CREATE INDEX idx_event_participant_role_assigned_by ON public.event_participant_role USING btree (assigned_by_id);

CREATE INDEX idx_event_participant_role_participant ON public.event_participant_role USING btree (event_participant_id);

CREATE INDEX idx_event_participant_role_role ON public.event_participant_role USING btree (role_id);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user ON public.event_participant USING btree (event_id, user_id) WHERE (instance_date IS NULL);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user_instance ON public.event_participant USING btree (event_id, user_id, instance_date) WHERE (instance_date IS NOT NULL);

CREATE INDEX idx_event_participant_user ON public.event_participant USING btree (user_id);

CREATE INDEX idx_event_start_date ON public.event USING btree (start_date);

CREATE INDEX idx_event_status ON public.event USING btree (status);

CREATE INDEX idx_final_candidate_selection_candidate ON public.final_candidate_selection USING btree (candidate_id);

CREATE INDEX idx_final_candidate_selection_election ON public.final_candidate_selection USING btree (election_id);

CREATE INDEX idx_final_candidate_selection_participation ON public.final_candidate_selection USING btree (elector_participation_id);

CREATE INDEX idx_final_choice_decision_choice ON public.final_choice_decision USING btree (choice_id);

CREATE INDEX idx_final_choice_decision_participation ON public.final_choice_decision USING btree (voter_participation_id);

CREATE INDEX idx_final_choice_decision_vote ON public.final_choice_decision USING btree (vote_id);

CREATE INDEX idx_final_elector_participation_election ON public.final_elector_participation USING btree (election_id);

CREATE INDEX idx_final_elector_participation_elector ON public.final_elector_participation USING btree (elector_id);

CREATE INDEX idx_final_voter_participation_vote ON public.final_voter_participation USING btree (vote_id);

CREATE INDEX idx_final_voter_participation_voter ON public.final_voter_participation USING btree (voter_id);

CREATE INDEX idx_follow_followee ON public.follow USING btree (followee_id);

CREATE INDEX idx_follow_follower ON public.follow USING btree (follower_id);

CREATE INDEX idx_group_connected_group ON public."group" USING btree (connected_group_id);

CREATE INDEX idx_group_connection_child ON public.group_connection USING btree (child_group_id);

CREATE INDEX idx_group_connection_from ON public.group_connection USING btree (from_group_id);

CREATE INDEX idx_group_connection_group_a ON public.group_connection USING btree (group_a_id);

CREATE INDEX idx_group_connection_group_b ON public.group_connection USING btree (group_b_id);

CREATE INDEX idx_group_connection_kind ON public.group_connection USING btree (connection_kind);

CREATE INDEX idx_group_connection_parent ON public.group_connection USING btree (parent_group_id);

CREATE INDEX idx_group_connection_request_active ON public.group_connection_request USING btree (active_connection_id);

CREATE INDEX idx_group_connection_request_group_a ON public.group_connection_request USING btree (group_a_id);

CREATE INDEX idx_group_connection_request_group_b ON public.group_connection_request USING btree (group_b_id);

CREATE INDEX idx_group_connection_request_status ON public.group_connection_request USING btree (status);

CREATE INDEX idx_group_connection_to ON public.group_connection USING btree (to_group_id);

CREATE INDEX idx_group_connection_type ON public.group_connection USING btree (connection_type);

CREATE INDEX idx_group_delegate_allocation_event ON public.group_delegate_allocation USING btree (event_id);

CREATE INDEX idx_group_effective_right_holder ON public.group_effective_right USING btree (holder_group_id, right_key, status);

CREATE INDEX idx_group_effective_right_pair ON public.group_effective_right USING btree (holder_group_id, scope_group_id, right_key, status);

CREATE INDEX idx_group_effective_right_scope ON public.group_effective_right USING btree (scope_group_id, right_key, status);

CREATE INDEX idx_group_guest_access_group ON public.group_guest_access USING btree (group_id);

CREATE INDEX idx_group_guest_access_status ON public.group_guest_access USING btree (status);

CREATE INDEX idx_group_guest_access_user ON public.group_guest_access USING btree (user_id);

CREATE INDEX idx_group_guest_role_access ON public.group_guest_role USING btree (group_guest_access_id);

CREATE INDEX idx_group_guest_role_assigned_by ON public.group_guest_role USING btree (assigned_by_id);

CREATE INDEX idx_group_guest_role_role ON public.group_guest_role USING btree (role_id);

CREATE INDEX idx_group_hashtag_group ON public.group_hashtag USING btree (group_id);

CREATE INDEX idx_group_hashtag_hashtag ON public.group_hashtag USING btree (hashtag_id);

CREATE INDEX idx_group_hierarchy_children ON public."group" USING btree (has_hierarchy_children);

CREATE INDEX idx_group_hierarchy_path_ancestor ON public.group_hierarchy_path USING btree (ancestor_group_id, status);

CREATE INDEX idx_group_hierarchy_path_base ON public.group_hierarchy_path USING btree (base_group_id, status);

CREATE INDEX idx_group_hierarchy_path_descendant ON public.group_hierarchy_path USING btree (descendant_group_id, status);

CREATE INDEX idx_group_hierarchy_path_direct_child ON public.group_hierarchy_path USING btree (direct_child_group_id);

CREATE INDEX idx_group_membership_base_group ON public.group_membership USING btree (base_group_id);

CREATE INDEX idx_group_membership_connection ON public.group_membership USING btree (connection_id);

CREATE INDEX idx_group_membership_exclusivity_hierarchy ON public.group_membership_exclusivity_lock USING btree (hierarchy_group_id, status);

CREATE INDEX idx_group_membership_exclusivity_source ON public.group_membership_exclusivity_lock USING btree (source_group_id, status);

CREATE UNIQUE INDEX idx_group_membership_exclusivity_unique_active ON public.group_membership_exclusivity_lock USING btree (user_id, hierarchy_group_id) WHERE (status = 'active'::text);

CREATE INDEX idx_group_membership_exclusivity_user ON public.group_membership_exclusivity_lock USING btree (user_id, status);

CREATE INDEX idx_group_membership_group ON public.group_membership USING btree (group_id);

CREATE INDEX idx_group_membership_group_status ON public.group_membership USING btree (group_id, status);

CREATE INDEX idx_group_membership_membership_rule ON public.group_membership USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_origin_base_group ON public.group_membership_origin USING btree (base_group_id);

CREATE INDEX idx_group_membership_origin_connection ON public.group_membership_origin USING btree (connection_id);

CREATE INDEX idx_group_membership_origin_kind ON public.group_membership USING btree (origin_kind);

CREATE INDEX idx_group_membership_origin_membership ON public.group_membership_origin USING btree (group_membership_id);

CREATE INDEX idx_group_membership_origin_part_group ON public.group_membership_origin USING btree (part_group_id);

CREATE INDEX idx_group_membership_origin_rule ON public.group_membership_origin USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_origin_source_group ON public.group_membership_origin USING btree (source_group_id);

CREATE INDEX idx_group_membership_origin_source_membership ON public.group_membership_origin USING btree (source_membership_id);

CREATE INDEX idx_group_membership_part_group ON public.group_membership USING btree (part_group_id);

CREATE INDEX idx_group_membership_role_assigned_by ON public.group_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_membership_role_membership ON public.group_membership_role USING btree (group_membership_id);

CREATE INDEX idx_group_membership_role_role ON public.group_membership_role USING btree (role_id);

CREATE INDEX idx_group_membership_rule_connection ON public.group_membership_rule USING btree (connection_id);

CREATE INDEX idx_group_membership_rule_mode ON public.group_membership_rule USING btree (membership_mode);

CREATE INDEX idx_group_membership_rule_origin_group ON public.group_membership_rule_origin USING btree (eligible_origin_group_id);

CREATE INDEX idx_group_membership_rule_origin_rule ON public.group_membership_rule_origin USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_rule_request_header ON public.group_membership_rule_request USING btree (connection_request_id);

CREATE INDEX idx_group_membership_rule_request_origin_group ON public.group_membership_rule_request_origin USING btree (eligible_origin_group_id);

CREATE INDEX idx_group_membership_rule_request_origin_request ON public.group_membership_rule_request_origin USING btree (membership_rule_request_id);

CREATE INDEX idx_group_membership_rule_request_status ON public.group_membership_rule_request USING btree (status);

CREATE INDEX idx_group_membership_rule_source ON public.group_membership_rule USING btree (member_source_group_id);

CREATE INDEX idx_group_membership_rule_target ON public.group_membership_rule USING btree (member_target_group_id);

CREATE INDEX idx_group_membership_source_group ON public.group_membership USING btree (source_group_id);

CREATE INDEX idx_group_membership_user ON public.group_membership USING btree (user_id);

CREATE INDEX idx_group_membership_user_status ON public.group_membership USING btree (user_id, status);

CREATE INDEX idx_group_offline_member_connected_user ON public.group_offline_member USING btree (connected_user_id);

CREATE INDEX idx_group_offline_member_group ON public.group_offline_member USING btree (group_id);

CREATE UNIQUE INDEX idx_group_offline_member_unique_connected_user ON public.group_offline_member USING btree (group_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_group_offline_membership_group ON public.group_offline_membership USING btree (group_id);

CREATE INDEX idx_group_offline_membership_member ON public.group_offline_membership USING btree (group_offline_member_id);

CREATE INDEX idx_group_offline_membership_role_assigned_by ON public.group_offline_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_offline_membership_role_membership ON public.group_offline_membership_role USING btree (group_offline_membership_id);

CREATE INDEX idx_group_offline_membership_role_role ON public.group_offline_membership_role USING btree (role_id);

CREATE INDEX idx_group_offline_membership_source_group ON public.group_offline_membership USING btree (source_group_id);

CREATE INDEX idx_group_owner ON public."group" USING btree (owner_id);

CREATE INDEX idx_group_right_grant_connection ON public.group_right_grant USING btree (connection_id);

CREATE INDEX idx_group_right_grant_holder ON public.group_right_grant USING btree (holder_group_id);

CREATE INDEX idx_group_right_grant_initiator ON public.group_right_grant USING btree (initiator_group_id);

CREATE INDEX idx_group_right_grant_request_header ON public.group_right_grant_request USING btree (connection_request_id);

CREATE INDEX idx_group_right_grant_request_holder ON public.group_right_grant_request USING btree (holder_group_id);

CREATE INDEX idx_group_right_grant_request_status ON public.group_right_grant_request USING btree (status);

CREATE INDEX idx_group_right_grant_scope ON public.group_right_grant USING btree (scope_group_id);

CREATE INDEX idx_group_right_grant_traversal ON public.group_right_grant USING btree (holder_group_id, right_key, status);

CREATE INDEX idx_group_sibling_connections ON public."group" USING btree (has_sibling_connections);

CREATE INDEX idx_group_sibling_source_lock_sibling ON public.group_sibling_source_lock USING btree (sibling_group_id, status);

CREATE INDEX idx_group_sibling_source_lock_source ON public.group_sibling_source_lock USING btree (source_group_id, status);

CREATE UNIQUE INDEX idx_group_sibling_source_lock_unique_active ON public.group_sibling_source_lock USING btree (user_id, sibling_group_id) WHERE (status = 'active'::text);

CREATE INDEX idx_group_sibling_source_lock_user ON public.group_sibling_source_lock USING btree (user_id, status);

CREATE INDEX idx_group_type ON public."group" USING btree (group_type);

CREATE INDEX idx_group_workflow_approval_group ON public.group_workflow_approval USING btree (group_id);

CREATE INDEX idx_group_workflow_approval_requested_by ON public.group_workflow_approval USING btree (requested_by_group_id);

CREATE INDEX idx_group_workflow_approval_status ON public.group_workflow_approval USING btree (status);

CREATE UNIQUE INDEX idx_group_workflow_approval_unique ON public.group_workflow_approval USING btree (workflow_id, group_id);

CREATE INDEX idx_group_workflow_approval_workflow ON public.group_workflow_approval USING btree (workflow_id);

CREATE INDEX idx_group_workflow_created_by ON public.group_workflow USING btree (created_by_id);

CREATE UNIQUE INDEX idx_group_workflow_default_entry ON public.group_workflow USING btree (group_id) WHERE (is_default_entry = true);

CREATE INDEX idx_group_workflow_group ON public.group_workflow USING btree (group_id);

CREATE INDEX idx_group_workflow_start_group ON public.group_workflow USING btree (start_group_id);

CREATE INDEX idx_group_workflow_step_group ON public.group_workflow_step USING btree (group_id);

CREATE INDEX idx_group_workflow_step_target_workflow ON public.group_workflow_step USING btree (target_workflow_id);

CREATE INDEX idx_group_workflow_step_workflow ON public.group_workflow_step USING btree (workflow_id);

CREATE UNIQUE INDEX idx_hashtag_tag ON public.hashtag USING btree (tag);

CREATE INDEX idx_indicative_candidate_selection_candidate ON public.indicative_candidate_selection USING btree (candidate_id);

CREATE INDEX idx_indicative_candidate_selection_election ON public.indicative_candidate_selection USING btree (election_id);

CREATE INDEX idx_indicative_candidate_selection_participation ON public.indicative_candidate_selection USING btree (elector_participation_id);

CREATE INDEX idx_indicative_choice_decision_choice ON public.indicative_choice_decision USING btree (choice_id);

CREATE INDEX idx_indicative_choice_decision_participation ON public.indicative_choice_decision USING btree (voter_participation_id);

CREATE INDEX idx_indicative_choice_decision_vote ON public.indicative_choice_decision USING btree (vote_id);

CREATE INDEX idx_indicative_elector_participation_election ON public.indicative_elector_participation USING btree (election_id);

CREATE INDEX idx_indicative_elector_participation_elector ON public.indicative_elector_participation USING btree (elector_id);

CREATE INDEX idx_indicative_elector_participation_user ON public.indicative_elector_participation USING btree (user_id);

CREATE INDEX idx_indicative_voter_participation_user ON public.indicative_voter_participation USING btree (user_id);

CREATE INDEX idx_indicative_voter_participation_vote ON public.indicative_voter_participation USING btree (vote_id);

CREATE INDEX idx_indicative_voter_participation_voter ON public.indicative_voter_participation USING btree (voter_id);

CREATE INDEX idx_link_event ON public.link USING btree (event_id);

CREATE INDEX idx_link_group ON public.link USING btree (group_id);

CREATE INDEX idx_link_user ON public.link USING btree (user_id);

CREATE INDEX idx_message_content_trgm ON public.message USING gin (content public.gin_trgm_ops);

CREATE INDEX idx_message_conversation ON public.message USING btree (conversation_id);

CREATE INDEX idx_message_conversation_created_id ON public.message USING btree (conversation_id, created_at DESC, id DESC);

CREATE INDEX idx_message_sender ON public.message USING btree (sender_id);

CREATE INDEX idx_notification_active_created ON public.notification USING btree (created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_notification_category ON public.notification USING btree (category);

CREATE INDEX idx_notification_is_read ON public.notification USING btree (is_read);

CREATE INDEX idx_notification_read_entity ON public.notification_read USING btree (entity_type, entity_id);

CREATE INDEX idx_notification_recipient ON public.notification USING btree (recipient_id);

CREATE INDEX idx_notification_recipient_amendment ON public.notification USING btree (recipient_amendment_id, created_at);

CREATE INDEX idx_notification_recipient_blog ON public.notification USING btree (recipient_blog_id, created_at);

CREATE INDEX idx_notification_recipient_entity ON public.notification USING btree (recipient_entity_id, created_at);

CREATE INDEX idx_notification_recipient_event ON public.notification USING btree (recipient_event_id, created_at);

CREATE INDEX idx_notification_recipient_group ON public.notification USING btree (recipient_group_id, created_at);

CREATE INDEX idx_notification_recipient_read ON public.notification USING btree (recipient_id, is_read);

CREATE INDEX idx_notification_sender ON public.notification USING btree (sender_id);

CREATE INDEX idx_notification_user_state_notification ON public.notification_user_state USING btree (notification_id, user_id);

CREATE INDEX idx_notification_user_state_user ON public.notification_user_state USING btree (user_id, dismissed_at, purged_at, read_at);

CREATE INDEX idx_participant_event ON public.participant USING btree (event_id);

CREATE INDEX idx_participant_user ON public.participant USING btree (user_id);

CREATE INDEX idx_payment_payer_user ON public.payment USING btree (payer_user_id);

CREATE INDEX idx_payment_receiver_user ON public.payment USING btree (receiver_user_id);

CREATE INDEX idx_pql_filter_active_scope ON public.pql_filter USING btree (user_id, storage_key, group_id, is_active);

CREATE INDEX idx_pql_filter_user_scope ON public.pql_filter USING btree (user_id, storage_key, group_id);

CREATE INDEX idx_process_task_due_at ON public.process_task USING btree (due_at);

CREATE INDEX idx_process_task_group ON public.process_task USING btree (group_id);

CREATE INDEX idx_process_task_process_run ON public.process_task USING btree (process_run_id);

CREATE INDEX idx_process_task_status ON public.process_task USING btree (status);

CREATE INDEX idx_process_task_type ON public.process_task USING btree (task_type);

CREATE UNIQUE INDEX idx_push_delivery_dedupe_subscription ON public.push_delivery_outbox USING btree (dedupe_key, push_subscription_id) WHERE (push_subscription_id IS NOT NULL);

CREATE UNIQUE INDEX idx_push_delivery_notification_subscription ON public.push_delivery_outbox USING btree (notification_id, push_subscription_id) WHERE ((notification_id IS NOT NULL) AND (push_subscription_id IS NOT NULL));

CREATE INDEX idx_push_delivery_outbox_pending ON public.push_delivery_outbox USING btree (available_at, id) WHERE (status = 'pending'::text);

CREATE INDEX idx_push_delivery_outbox_user ON public.push_delivery_outbox USING btree (user_id, created_at DESC);

CREATE INDEX idx_push_notification_outbox_pending ON public.push_notification_outbox USING btree (available_at, id) WHERE (status = 'pending'::text);

CREATE INDEX idx_push_subscription_user ON public.push_subscription USING btree (user_id);

CREATE UNIQUE INDEX idx_push_subscription_user_device ON public.push_subscription USING btree (user_id, device_id) WHERE (device_id IS NOT NULL);

CREATE INDEX idx_reaction_entity ON public.reaction USING btree (entity_type, entity_id);

CREATE INDEX idx_reaction_timeline ON public.reaction USING btree (timeline_event_id);

CREATE INDEX idx_reaction_user ON public.reaction USING btree (user_id);

CREATE INDEX idx_role_assignee_kind ON public.role USING btree (assignee_kind);

CREATE INDEX idx_role_event ON public.role USING btree (event_id);

CREATE INDEX idx_role_group ON public.role USING btree (group_id);

CREATE INDEX idx_role_holder_history_role ON public.role_holder_history USING btree (role_id);

CREATE INDEX idx_role_holder_history_user ON public.role_holder_history USING btree (user_id);

CREATE INDEX idx_role_scope ON public.role USING btree (scope);

CREATE INDEX idx_search_document_acl_user_document ON public.search_document_acl USING btree (user_id, document_id);

CREATE INDEX idx_search_document_engagement ON public.search_document USING btree (engagement_score DESC, created_at DESC, id DESC);

CREATE INDEX idx_search_document_group ON public.search_document USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_search_document_location ON public.search_document USING btree (location_latitude, location_longitude) WHERE ((location_latitude IS NOT NULL) AND (location_longitude IS NOT NULL));

CREATE INDEX idx_search_document_location_kind ON public.search_document USING btree (location_kind) WHERE (location_kind IS NOT NULL);

CREATE INDEX idx_search_document_owner ON public.search_document USING btree (owner_user_id, created_at DESC, id DESC);

CREATE INDEX idx_search_document_recent ON public.search_document USING btree (created_at DESC, id DESC);

CREATE INDEX idx_search_document_search_text_trgm ON public.search_document USING gin (search_text public.gin_trgm_ops);

CREATE INDEX idx_search_document_title_trgm ON public.search_document USING gin (title public.gin_trgm_ops);

CREATE INDEX idx_search_document_topic_topic_document ON public.search_document_topic USING btree (topic, document_id);

CREATE INDEX idx_search_document_trending ON public.search_document USING btree (trending_score DESC, created_at DESC, id DESC);

CREATE INDEX idx_search_document_type_recent ON public.search_document USING btree (entity_type, created_at DESC, id DESC);

CREATE INDEX idx_speaker_list_agenda_item ON public.speaker_list USING btree (agenda_item_id);

CREATE INDEX idx_statement_expires ON public.statement USING btree (expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX idx_statement_group ON public.statement USING btree (group_id);

CREATE INDEX idx_statement_hashtag_hashtag ON public.statement_hashtag USING btree (hashtag_id);

CREATE INDEX idx_statement_hashtag_statement ON public.statement_hashtag USING btree (statement_id);

CREATE INDEX idx_statement_story_created ON public.statement USING btree (is_story, created_at DESC);

CREATE INDEX idx_statement_support_vote_statement ON public.statement_support_vote USING btree (statement_id);

CREATE INDEX idx_statement_support_vote_user ON public.statement_support_vote USING btree (user_id);

CREATE INDEX idx_statement_survey_option_survey ON public.statement_survey_option USING btree (survey_id);

CREATE INDEX idx_statement_survey_statement ON public.statement_survey USING btree (statement_id);

CREATE INDEX idx_statement_survey_vote_option ON public.statement_survey_vote USING btree (option_id);

CREATE INDEX idx_statement_survey_vote_user ON public.statement_survey_vote USING btree (user_id);

CREATE INDEX idx_statement_user ON public.statement USING btree (user_id);

CREATE INDEX idx_stripe_payment_customer ON public.stripe_payment USING btree (customer_id);

CREATE INDEX idx_stripe_subscription_customer ON public.stripe_subscription USING btree (customer_id);

CREATE INDEX idx_subscriber_group ON public.subscriber USING btree (group_id);

CREATE INDEX idx_subscriber_subscriber ON public.subscriber USING btree (subscriber_id);

CREATE INDEX idx_subscriber_user ON public.subscriber USING btree (user_id);

CREATE INDEX idx_support_confirmation_amendment ON public.support_confirmation USING btree (amendment_id);

CREATE INDEX idx_support_confirmation_user ON public.support_confirmation USING btree (confirmed_by_id);

CREATE INDEX idx_thread_blog ON public.thread USING btree (blog_id);

CREATE INDEX idx_thread_document ON public.thread USING btree (document_id);

CREATE INDEX idx_thread_statement ON public.thread USING btree (statement_id);

CREATE UNIQUE INDEX idx_thread_todo_unique ON public.thread USING btree (todo_id);

CREATE INDEX idx_thread_user ON public.thread USING btree (user_id);

CREATE INDEX idx_thread_vote_thread ON public.thread_vote USING btree (thread_id);

CREATE INDEX idx_thread_vote_user ON public.thread_vote USING btree (user_id);

CREATE INDEX idx_timeline_event_created ON public.timeline_event USING btree (created_at);

CREATE INDEX idx_timeline_event_entity ON public.timeline_event USING btree (entity_type, entity_id);

CREATE INDEX idx_timeline_event_group ON public.timeline_event USING btree (group_id);

CREATE INDEX idx_timeline_event_user ON public.timeline_event USING btree (user_id);

CREATE INDEX idx_todo_active_status ON public.todo USING btree (status) WHERE (archived_at IS NULL);

CREATE INDEX idx_todo_archived_at ON public.todo USING btree (archived_at DESC) WHERE (archived_at IS NOT NULL);

CREATE INDEX idx_todo_assignment_todo ON public.todo_assignment USING btree (todo_id);

CREATE INDEX idx_todo_assignment_user ON public.todo_assignment USING btree (user_id);

CREATE INDEX idx_todo_creator ON public.todo USING btree (creator_id);

CREATE INDEX idx_todo_group ON public.todo USING btree (group_id);

CREATE INDEX idx_todo_status ON public.todo USING btree (status);

CREATE INDEX idx_user_email ON public."user" USING btree (email);

CREATE UNIQUE INDEX idx_user_handle ON public."user" USING btree (handle);

CREATE INDEX idx_user_hashtag_hashtag ON public.user_hashtag USING btree (hashtag_id);

CREATE INDEX idx_user_hashtag_user ON public.user_hashtag USING btree (user_id);

CREATE INDEX idx_user_preference_appearance_theme ON public.user_preference USING btree (appearance_theme_id);

CREATE INDEX idx_user_preference_user ON public.user_preference USING btree (user_id);

CREATE INDEX idx_vote_agenda_item ON public.vote USING btree (agenda_item_id);

CREATE INDEX idx_vote_agenda_item_purpose ON public.vote USING btree (agenda_item_id, purpose);

CREATE INDEX idx_vote_amendment ON public.vote USING btree (amendment_id);

CREATE INDEX idx_vote_choice_process_branch ON public.vote_choice USING btree (process_branch_id);

CREATE INDEX idx_vote_choice_vote ON public.vote_choice USING btree (vote_id);

CREATE INDEX idx_vote_offline_tally_choice ON public.vote_offline_tally USING btree (choice_id);

CREATE INDEX idx_vote_offline_tally_vote ON public.vote_offline_tally USING btree (vote_id);

CREATE INDEX idx_voter_user ON public.voter USING btree (user_id);

CREATE INDEX idx_voter_vote ON public.voter USING btree (vote_id);

CREATE INDEX idx_voting_password_user ON public.voting_password USING btree (user_id);

CREATE INDEX idx_zero_action_right_role_resource_action ON public.action_right USING btree (role_id, resource, action);

CREATE INDEX idx_zero_agenda_item_event_order_id ON public.agenda_item USING btree (event_id, order_index, id);

CREATE INDEX idx_zero_amendment_clone_source_created_id ON public.amendment USING btree (clone_source_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_amendment_created_id ON public.amendment_collaborator USING btree (amendment_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_user_created_id ON public.amendment_collaborator USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_user_status_amendment ON public.amendment_collaborator USING btree (user_id, status, amendment_id);

CREATE INDEX idx_zero_amendment_creator_created_id ON public.amendment USING btree (created_by_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_group_created_id ON public.amendment USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_blog_blogger_user_blog ON public.blog_blogger USING btree (user_id, blog_id);

CREATE INDEX idx_zero_blog_blogger_user_status_blog ON public.blog_blogger USING btree (user_id, status, blog_id);

CREATE INDEX idx_zero_blog_created_id ON public.blog USING btree (created_at DESC, id DESC);

CREATE INDEX idx_zero_blog_group_created_id ON public.blog USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_document_amendment_updated_id ON public.document USING btree (amendment_id, updated_at DESC, id DESC);

CREATE INDEX idx_zero_document_collaborator_document_created_id ON public.document_collaborator USING btree (document_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_document_collaborator_user_document ON public.document_collaborator USING btree (user_id, document_id);

CREATE INDEX idx_zero_document_version_document_number_id ON public.document_version USING btree (document_id, version_number DESC, id DESC);

CREATE INDEX idx_zero_election_candidate_election_order_id ON public.election_candidate USING btree (election_id, order_index, id);

CREATE INDEX idx_zero_election_created_id ON public.election USING btree (created_at DESC, id DESC);

CREATE INDEX idx_zero_event_participant_event_created_id ON public.event_participant USING btree (event_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_event_participant_event_user_id ON public.event_participant USING btree (event_id, user_id, id);

CREATE INDEX idx_zero_event_participant_user_created_id ON public.event_participant USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_event_participant_user_status_event ON public.event_participant USING btree (user_id, status, event_id);

CREATE INDEX idx_zero_group_membership_group_created_id ON public.group_membership USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_group_membership_user_created_id ON public.group_membership USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_notification_created_id_deleted ON public.notification USING btree (created_at DESC, id DESC, deleted_at);

CREATE INDEX idx_zero_notification_entity_created_id_deleted ON public.notification USING btree (recipient_entity_type, recipient_entity_id, created_at DESC, id DESC, deleted_at);

CREATE INDEX idx_zero_notification_read_notification_user_id ON public.notification_read USING btree (notification_id, read_by_user_id, id);

CREATE INDEX idx_zero_notification_recipient_created_id_deleted ON public.notification USING btree (recipient_id, created_at DESC, id DESC, deleted_at);

CREATE INDEX idx_zero_role_amendment_scope_id ON public.role USING btree (amendment_id, scope, id);

CREATE INDEX idx_zero_role_blog_scope_id ON public.role USING btree (blog_id, scope, id);

CREATE INDEX idx_zero_role_group_scope_order_id ON public.role USING btree (group_id, scope, sort_order, id);

CREATE INDEX idx_zero_role_holder_history_role_end_id ON public.role_holder_history USING btree (role_id, end_date, id);

CREATE INDEX idx_zero_statement_group_created_id ON public.statement USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_statement_user_created_id ON public.statement USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_amendment_created_id ON public.subscriber USING btree (amendment_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_blog_created_id ON public.subscriber USING btree (blog_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_event_created_id ON public.subscriber USING btree (event_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_group_created_id ON public.subscriber USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_subscriber_created_id ON public.subscriber USING btree (subscriber_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_user_created_id ON public.subscriber USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_thread_document_created_id ON public.thread USING btree (document_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_user_hashtag_user_created_id ON public.user_hashtag USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_vote_choice_vote_order_id ON public.vote_choice USING btree (vote_id, order_index, id);

CREATE INDEX idx_zero_vote_created_id ON public.vote USING btree (created_at DESC, id DESC);

CREATE UNIQUE INDEX indicative_candidate_selection_pkey ON public.indicative_candidate_selection USING btree (id);

CREATE UNIQUE INDEX indicative_choice_decision_pkey ON public.indicative_choice_decision USING btree (id);

CREATE UNIQUE INDEX indicative_elector_participation_election_id_user_id_key ON public.indicative_elector_participation USING btree (election_id, user_id);

CREATE UNIQUE INDEX indicative_elector_participation_pkey ON public.indicative_elector_participation USING btree (id);

CREATE UNIQUE INDEX indicative_voter_participation_pkey ON public.indicative_voter_participation USING btree (id);

CREATE UNIQUE INDEX indicative_voter_participation_vote_id_user_id_key ON public.indicative_voter_participation USING btree (vote_id, user_id);

CREATE UNIQUE INDEX link_pkey ON public.link USING btree (id);

CREATE UNIQUE INDEX message_pkey ON public.message USING btree (id);

CREATE UNIQUE INDEX newsletter_subscription_email_key ON public.newsletter_subscription USING btree (lower(email));

CREATE UNIQUE INDEX newsletter_subscription_pkey ON public.newsletter_subscription USING btree (user_id);

CREATE UNIQUE INDEX newsletter_subscription_resend_contact_id_key ON public.newsletter_subscription USING btree (resend_contact_id);

CREATE INDEX newsletter_sync_outbox_pending_idx ON public.newsletter_sync_outbox USING btree (available_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE UNIQUE INDEX newsletter_sync_outbox_pkey ON public.newsletter_sync_outbox USING btree (id);

CREATE UNIQUE INDEX notification_pkey ON public.notification USING btree (id);

CREATE UNIQUE INDEX notification_read_per_user_key ON public.notification_read USING btree (notification_id, entity_type, entity_id, read_by_user_id);

CREATE UNIQUE INDEX notification_read_pkey ON public.notification_read USING btree (id);

CREATE UNIQUE INDEX notification_setting_pkey ON public.notification_setting USING btree (id);

CREATE UNIQUE INDEX notification_setting_user_id_key ON public.notification_setting USING btree (user_id);

CREATE INDEX notification_tutorial_run_id_idx ON public.notification USING btree (tutorial_run_id);

CREATE UNIQUE INDEX notification_user_state_per_user_key ON public.notification_user_state USING btree (notification_id, user_id);

CREATE UNIQUE INDEX notification_user_state_pkey ON public.notification_user_state USING btree (id);

CREATE UNIQUE INDEX participant_pkey ON public.participant USING btree (id);

CREATE UNIQUE INDEX payment_pkey ON public.payment USING btree (id);

CREATE INDEX payment_tutorial_run_id_idx ON public.payment USING btree (tutorial_run_id);

CREATE UNIQUE INDEX pql_filter_pkey ON public.pql_filter USING btree (id);

CREATE UNIQUE INDEX process_task_pkey ON public.process_task USING btree (id);

CREATE UNIQUE INDEX push_delivery_outbox_pkey ON public.push_delivery_outbox USING btree (id);

CREATE UNIQUE INDEX push_notification_outbox_notification_id_key ON public.push_notification_outbox USING btree (notification_id);

CREATE UNIQUE INDEX push_notification_outbox_pkey ON public.push_notification_outbox USING btree (id);

CREATE UNIQUE INDEX push_subscription_endpoint_key ON public.push_subscription USING btree (endpoint);

CREATE UNIQUE INDEX push_subscription_pkey ON public.push_subscription USING btree (id);

CREATE UNIQUE INDEX reaction_pkey ON public.reaction USING btree (id);

CREATE UNIQUE INDEX resend_webhook_event_pkey ON public.resend_webhook_event USING btree (svix_id);

CREATE UNIQUE INDEX role_holder_history_pkey ON public.role_holder_history USING btree (id);

CREATE UNIQUE INDEX role_pkey ON public.role USING btree (id);

CREATE UNIQUE INDEX search_document_acl_document_id_user_id_key ON public.search_document_acl USING btree (document_id, user_id);

CREATE UNIQUE INDEX search_document_acl_pkey ON public.search_document_acl USING btree (id);

CREATE UNIQUE INDEX search_document_pkey ON public.search_document USING btree (id);

CREATE UNIQUE INDEX search_document_topic_document_id_topic_key ON public.search_document_topic USING btree (document_id, topic);

CREATE UNIQUE INDEX search_document_topic_pkey ON public.search_document_topic USING btree (id);

CREATE INDEX search_document_tutorial_run_id_idx ON public.search_document USING btree (tutorial_run_id);

CREATE UNIQUE INDEX speaker_list_pkey ON public.speaker_list USING btree (id);

CREATE UNIQUE INDEX statement_hashtag_pkey ON public.statement_hashtag USING btree (id);

CREATE UNIQUE INDEX statement_hashtag_statement_id_hashtag_id_key ON public.statement_hashtag USING btree (statement_id, hashtag_id);

CREATE UNIQUE INDEX statement_pkey ON public.statement USING btree (id);

CREATE UNIQUE INDEX statement_support_vote_pkey ON public.statement_support_vote USING btree (id);

CREATE UNIQUE INDEX statement_survey_option_pkey ON public.statement_survey_option USING btree (id);

CREATE UNIQUE INDEX statement_survey_pkey ON public.statement_survey USING btree (id);

CREATE UNIQUE INDEX statement_survey_statement_id_key ON public.statement_survey USING btree (statement_id);

CREATE UNIQUE INDEX statement_survey_vote_option_id_user_id_key ON public.statement_survey_vote USING btree (option_id, user_id);

CREATE UNIQUE INDEX statement_survey_vote_pkey ON public.statement_survey_vote USING btree (id);

CREATE INDEX statement_tutorial_run_id_idx ON public.statement USING btree (tutorial_run_id);

CREATE UNIQUE INDEX stripe_customer_pkey ON public.stripe_customer USING btree (id);

CREATE UNIQUE INDEX stripe_customer_stripe_customer_id_key ON public.stripe_customer USING btree (stripe_customer_id);

CREATE UNIQUE INDEX stripe_customer_user_id_key ON public.stripe_customer USING btree (user_id);

CREATE UNIQUE INDEX stripe_payment_pkey ON public.stripe_payment USING btree (id);

CREATE UNIQUE INDEX stripe_payment_stripe_invoice_id_key ON public.stripe_payment USING btree (stripe_invoice_id);

CREATE UNIQUE INDEX stripe_subscription_pkey ON public.stripe_subscription USING btree (id);

CREATE UNIQUE INDEX stripe_subscription_stripe_subscription_id_key ON public.stripe_subscription USING btree (stripe_subscription_id);

CREATE UNIQUE INDEX subscriber_pkey ON public.subscriber USING btree (id);

CREATE UNIQUE INDEX support_confirmation_pkey ON public.support_confirmation USING btree (id);

CREATE UNIQUE INDEX thread_pkey ON public.thread USING btree (id);

CREATE UNIQUE INDEX thread_vote_pkey ON public.thread_vote USING btree (id);

CREATE UNIQUE INDEX timeline_event_pkey ON public.timeline_event USING btree (id);

CREATE UNIQUE INDEX todo_assignment_pkey ON public.todo_assignment USING btree (id);

CREATE UNIQUE INDEX todo_pkey ON public.todo USING btree (id);

CREATE INDEX todo_tutorial_run_id_idx ON public.todo USING btree (tutorial_run_id);

CREATE UNIQUE INDEX uq_event_exception_parent_date ON public.event_exception USING btree (parent_event_id, original_date);

CREATE UNIQUE INDEX user_hashtag_pkey ON public.user_hashtag USING btree (id);

CREATE UNIQUE INDEX user_hashtag_user_id_hashtag_id_key ON public.user_hashtag USING btree (user_id, hashtag_id);

CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id);

CREATE UNIQUE INDEX user_preference_pkey ON public.user_preference USING btree (id);

CREATE UNIQUE INDEX user_preference_user_id_key ON public.user_preference USING btree (user_id);

CREATE INDEX user_tutorial_run_id_idx ON public."user" USING btree (tutorial_run_id);

CREATE UNIQUE INDEX vote_choice_pkey ON public.vote_choice USING btree (id);

CREATE UNIQUE INDEX vote_offline_tally_pkey ON public.vote_offline_tally USING btree (id);

CREATE UNIQUE INDEX vote_offline_tally_vote_id_phase_choice_id_key ON public.vote_offline_tally USING btree (vote_id, phase, choice_id);

CREATE UNIQUE INDEX vote_pkey ON public.vote USING btree (id);

CREATE UNIQUE INDEX voter_pkey ON public.voter USING btree (id);

CREATE UNIQUE INDEX voter_vote_id_user_id_key ON public.voter USING btree (vote_id, user_id);

CREATE UNIQUE INDEX voting_password_pkey ON public.voting_password USING btree (id);

CREATE UNIQUE INDEX voting_password_user_id_key ON public.voting_password USING btree (user_id);

alter table "public"."accreditation" add constraint "accreditation_pkey" PRIMARY KEY using index "accreditation_pkey";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_pkey" PRIMARY KEY using index "accreditation_audit_pkey";

alter table "public"."action_right" add constraint "action_right_pkey" PRIMARY KEY using index "action_right_pkey";

alter table "public"."agenda_item" add constraint "agenda_item_pkey" PRIMARY KEY using index "agenda_item_pkey";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_pkey" PRIMARY KEY using index "agenda_item_change_request_pkey";

alter table "public"."ai_provider_credential" add constraint "ai_provider_credential_pkey" PRIMARY KEY using index "ai_provider_credential_pkey";

alter table "public"."ai_skill" add constraint "ai_skill_pkey" PRIMARY KEY using index "ai_skill_pkey";

alter table "public"."ai_tool" add constraint "ai_tool_pkey" PRIMARY KEY using index "ai_tool_pkey";

alter table "public"."amendment" add constraint "amendment_pkey" PRIMARY KEY using index "amendment_pkey";

alter table "public"."amendment_city_design" add constraint "amendment_city_design_pkey" PRIMARY KEY using index "amendment_city_design_pkey";

alter table "public"."amendment_collaborator" add constraint "amendment_collaborator_pkey" PRIMARY KEY using index "amendment_collaborator_pkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_pkey" PRIMARY KEY using index "amendment_group_decision_pkey";

alter table "public"."amendment_hashtag" add constraint "amendment_hashtag_pkey" PRIMARY KEY using index "amendment_hashtag_pkey";

alter table "public"."amendment_path" add constraint "amendment_path_pkey" PRIMARY KEY using index "amendment_path_pkey";

alter table "public"."amendment_path_segment" add constraint "amendment_path_segment_pkey" PRIMARY KEY using index "amendment_path_segment_pkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_pkey" PRIMARY KEY using index "amendment_process_branch_pkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_pkey" PRIMARY KEY using index "amendment_process_run_pkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_pkey" PRIMARY KEY using index "amendment_process_step_run_pkey";

alter table "public"."amendment_support_vote" add constraint "amendment_support_vote_pkey" PRIMARY KEY using index "amendment_support_vote_pkey";

alter table "public"."amendment_vote_entry" add constraint "amendment_vote_entry_pkey" PRIMARY KEY using index "amendment_vote_entry_pkey";

alter table "public"."app_tutorial_checkpoint_effect" add constraint "app_tutorial_checkpoint_effect_pkey" PRIMARY KEY using index "app_tutorial_checkpoint_effect_pkey";

alter table "public"."app_tutorial_entity" add constraint "app_tutorial_entity_pkey" PRIMARY KEY using index "app_tutorial_entity_pkey";

alter table "public"."app_tutorial_run" add constraint "app_tutorial_run_pkey" PRIMARY KEY using index "app_tutorial_run_pkey";

alter table "public"."appearance_theme" add constraint "appearance_theme_pkey" PRIMARY KEY using index "appearance_theme_pkey";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_pkey" PRIMARY KEY using index "appearance_theme_revision_pkey";

alter table "public"."blog" add constraint "blog_pkey" PRIMARY KEY using index "blog_pkey";

alter table "public"."blog_blogger" add constraint "blog_blogger_pkey" PRIMARY KEY using index "blog_blogger_pkey";

alter table "public"."blog_hashtag" add constraint "blog_hashtag_pkey" PRIMARY KEY using index "blog_hashtag_pkey";

alter table "public"."blog_support_vote" add constraint "blog_support_vote_pkey" PRIMARY KEY using index "blog_support_vote_pkey";

alter table "public"."calendar_subscription" add constraint "calendar_subscription_pkey" PRIMARY KEY using index "calendar_subscription_pkey";

alter table "public"."change_request" add constraint "change_request_pkey" PRIMARY KEY using index "change_request_pkey";

alter table "public"."change_request_vote" add constraint "change_request_vote_pkey" PRIMARY KEY using index "change_request_vote_pkey";

alter table "public"."comment" add constraint "comment_pkey" PRIMARY KEY using index "comment_pkey";

alter table "public"."comment_vote" add constraint "comment_vote_pkey" PRIMARY KEY using index "comment_vote_pkey";

alter table "public"."conversation" add constraint "conversation_pkey" PRIMARY KEY using index "conversation_pkey";

alter table "public"."conversation_participant" add constraint "conversation_participant_pkey" PRIMARY KEY using index "conversation_participant_pkey";

alter table "public"."currency_exchange_rate_cache" add constraint "currency_exchange_rate_cache_pkey" PRIMARY KEY using index "currency_exchange_rate_cache_pkey";

alter table "public"."dataset" add constraint "dataset_pkey" PRIMARY KEY using index "dataset_pkey";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_pkey" PRIMARY KEY using index "dataset_import_job_pkey";

alter table "public"."dataset_snapshot" add constraint "dataset_snapshot_pkey" PRIMARY KEY using index "dataset_snapshot_pkey";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_pkey" PRIMARY KEY using index "delegate_election_assignment_pkey";

alter table "public"."document" add constraint "document_pkey" PRIMARY KEY using index "document_pkey";

alter table "public"."document_collaborator" add constraint "document_collaborator_pkey" PRIMARY KEY using index "document_collaborator_pkey";

alter table "public"."document_cursor" add constraint "document_cursor_pkey" PRIMARY KEY using index "document_cursor_pkey";

alter table "public"."document_version" add constraint "document_version_pkey" PRIMARY KEY using index "document_version_pkey";

alter table "public"."election" add constraint "election_pkey" PRIMARY KEY using index "election_pkey";

alter table "public"."election_candidate" add constraint "election_candidate_pkey" PRIMARY KEY using index "election_candidate_pkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_pkey" PRIMARY KEY using index "election_offline_tally_pkey";

alter table "public"."elector" add constraint "elector_pkey" PRIMARY KEY using index "elector_pkey";

alter table "public"."event" add constraint "event_pkey" PRIMARY KEY using index "event_pkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_pkey" PRIMARY KEY using index "event_assembly_scope_pkey";

alter table "public"."event_delegate" add constraint "event_delegate_pkey" PRIMARY KEY using index "event_delegate_pkey";

alter table "public"."event_exception" add constraint "event_exception_pkey" PRIMARY KEY using index "event_exception_pkey";

alter table "public"."event_hashtag" add constraint "event_hashtag_pkey" PRIMARY KEY using index "event_hashtag_pkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_pkey" PRIMARY KEY using index "event_offline_participant_pkey";

alter table "public"."event_participant" add constraint "event_participant_pkey" PRIMARY KEY using index "event_participant_pkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_pkey" PRIMARY KEY using index "event_participant_role_pkey";

alter table "public"."file" add constraint "file_pkey" PRIMARY KEY using index "file_pkey";

alter table "public"."final_candidate_selection" add constraint "final_candidate_selection_pkey" PRIMARY KEY using index "final_candidate_selection_pkey";

alter table "public"."final_choice_decision" add constraint "final_choice_decision_pkey" PRIMARY KEY using index "final_choice_decision_pkey";

alter table "public"."final_elector_participation" add constraint "final_elector_participation_pkey" PRIMARY KEY using index "final_elector_participation_pkey";

alter table "public"."final_voter_participation" add constraint "final_voter_participation_pkey" PRIMARY KEY using index "final_voter_participation_pkey";

alter table "public"."follow" add constraint "follow_pkey" PRIMARY KEY using index "follow_pkey";

alter table "public"."group" add constraint "group_pkey" PRIMARY KEY using index "group_pkey";

alter table "public"."group_connection" add constraint "group_connection_pkey" PRIMARY KEY using index "group_connection_pkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_pkey" PRIMARY KEY using index "group_connection_request_pkey";

alter table "public"."group_delegate_allocation" add constraint "group_delegate_allocation_pkey" PRIMARY KEY using index "group_delegate_allocation_pkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_pkey" PRIMARY KEY using index "group_effective_right_pkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_pkey" PRIMARY KEY using index "group_guest_access_pkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_pkey" PRIMARY KEY using index "group_guest_role_pkey";

alter table "public"."group_hashtag" add constraint "group_hashtag_pkey" PRIMARY KEY using index "group_hashtag_pkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_pkey" PRIMARY KEY using index "group_hierarchy_path_pkey";

alter table "public"."group_membership" add constraint "group_membership_pkey" PRIMARY KEY using index "group_membership_pkey";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_pkey" PRIMARY KEY using index "group_membership_exclusivity_lock_pkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_pkey" PRIMARY KEY using index "group_membership_origin_pkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_pkey" PRIMARY KEY using index "group_membership_role_pkey";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_pkey" PRIMARY KEY using index "group_membership_rule_pkey";

alter table "public"."group_membership_rule_origin" add constraint "group_membership_rule_origin_pkey" PRIMARY KEY using index "group_membership_rule_origin_pkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_pkey" PRIMARY KEY using index "group_membership_rule_request_pkey";

alter table "public"."group_membership_rule_request_origin" add constraint "group_membership_rule_request_origin_pkey" PRIMARY KEY using index "group_membership_rule_request_origin_pkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_pkey" PRIMARY KEY using index "group_offline_member_pkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_pkey" PRIMARY KEY using index "group_offline_membership_pkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_pkey" PRIMARY KEY using index "group_offline_membership_role_pkey";

alter table "public"."group_right_grant" add constraint "group_right_grant_pkey" PRIMARY KEY using index "group_right_grant_pkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_pkey" PRIMARY KEY using index "group_right_grant_request_pkey";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_pkey" PRIMARY KEY using index "group_sibling_source_lock_pkey";

alter table "public"."group_workflow" add constraint "group_workflow_pkey" PRIMARY KEY using index "group_workflow_pkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_pkey" PRIMARY KEY using index "group_workflow_approval_pkey";

alter table "public"."group_workflow_step" add constraint "group_workflow_step_pkey" PRIMARY KEY using index "group_workflow_step_pkey";

alter table "public"."hashtag" add constraint "hashtag_pkey" PRIMARY KEY using index "hashtag_pkey";

alter table "public"."indicative_candidate_selection" add constraint "indicative_candidate_selection_pkey" PRIMARY KEY using index "indicative_candidate_selection_pkey";

alter table "public"."indicative_choice_decision" add constraint "indicative_choice_decision_pkey" PRIMARY KEY using index "indicative_choice_decision_pkey";

alter table "public"."indicative_elector_participation" add constraint "indicative_elector_participation_pkey" PRIMARY KEY using index "indicative_elector_participation_pkey";

alter table "public"."indicative_voter_participation" add constraint "indicative_voter_participation_pkey" PRIMARY KEY using index "indicative_voter_participation_pkey";

alter table "public"."link" add constraint "link_pkey" PRIMARY KEY using index "link_pkey";

alter table "public"."message" add constraint "message_pkey" PRIMARY KEY using index "message_pkey";

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_pkey" PRIMARY KEY using index "newsletter_subscription_pkey";

alter table "public"."newsletter_sync_outbox" add constraint "newsletter_sync_outbox_pkey" PRIMARY KEY using index "newsletter_sync_outbox_pkey";

alter table "public"."notification" add constraint "notification_pkey" PRIMARY KEY using index "notification_pkey";

alter table "public"."notification_read" add constraint "notification_read_pkey" PRIMARY KEY using index "notification_read_pkey";

alter table "public"."notification_setting" add constraint "notification_setting_pkey" PRIMARY KEY using index "notification_setting_pkey";

alter table "public"."notification_user_state" add constraint "notification_user_state_pkey" PRIMARY KEY using index "notification_user_state_pkey";

alter table "public"."participant" add constraint "participant_pkey" PRIMARY KEY using index "participant_pkey";

alter table "public"."payment" add constraint "payment_pkey" PRIMARY KEY using index "payment_pkey";

alter table "public"."pql_filter" add constraint "pql_filter_pkey" PRIMARY KEY using index "pql_filter_pkey";

alter table "public"."process_task" add constraint "process_task_pkey" PRIMARY KEY using index "process_task_pkey";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_pkey" PRIMARY KEY using index "push_delivery_outbox_pkey";

alter table "public"."push_notification_outbox" add constraint "push_notification_outbox_pkey" PRIMARY KEY using index "push_notification_outbox_pkey";

alter table "public"."push_subscription" add constraint "push_subscription_pkey" PRIMARY KEY using index "push_subscription_pkey";

alter table "public"."reaction" add constraint "reaction_pkey" PRIMARY KEY using index "reaction_pkey";

alter table "public"."resend_webhook_event" add constraint "resend_webhook_event_pkey" PRIMARY KEY using index "resend_webhook_event_pkey";

alter table "public"."role" add constraint "role_pkey" PRIMARY KEY using index "role_pkey";

alter table "public"."role_holder_history" add constraint "role_holder_history_pkey" PRIMARY KEY using index "role_holder_history_pkey";

alter table "public"."search_document" add constraint "search_document_pkey" PRIMARY KEY using index "search_document_pkey";

alter table "public"."search_document_acl" add constraint "search_document_acl_pkey" PRIMARY KEY using index "search_document_acl_pkey";

alter table "public"."search_document_topic" add constraint "search_document_topic_pkey" PRIMARY KEY using index "search_document_topic_pkey";

alter table "public"."speaker_list" add constraint "speaker_list_pkey" PRIMARY KEY using index "speaker_list_pkey";

alter table "public"."statement" add constraint "statement_pkey" PRIMARY KEY using index "statement_pkey";

alter table "public"."statement_hashtag" add constraint "statement_hashtag_pkey" PRIMARY KEY using index "statement_hashtag_pkey";

alter table "public"."statement_support_vote" add constraint "statement_support_vote_pkey" PRIMARY KEY using index "statement_support_vote_pkey";

alter table "public"."statement_survey" add constraint "statement_survey_pkey" PRIMARY KEY using index "statement_survey_pkey";

alter table "public"."statement_survey_option" add constraint "statement_survey_option_pkey" PRIMARY KEY using index "statement_survey_option_pkey";

alter table "public"."statement_survey_vote" add constraint "statement_survey_vote_pkey" PRIMARY KEY using index "statement_survey_vote_pkey";

alter table "public"."stripe_customer" add constraint "stripe_customer_pkey" PRIMARY KEY using index "stripe_customer_pkey";

alter table "public"."stripe_payment" add constraint "stripe_payment_pkey" PRIMARY KEY using index "stripe_payment_pkey";

alter table "public"."stripe_subscription" add constraint "stripe_subscription_pkey" PRIMARY KEY using index "stripe_subscription_pkey";

alter table "public"."subscriber" add constraint "subscriber_pkey" PRIMARY KEY using index "subscriber_pkey";

alter table "public"."support_confirmation" add constraint "support_confirmation_pkey" PRIMARY KEY using index "support_confirmation_pkey";

alter table "public"."thread" add constraint "thread_pkey" PRIMARY KEY using index "thread_pkey";

alter table "public"."thread_vote" add constraint "thread_vote_pkey" PRIMARY KEY using index "thread_vote_pkey";

alter table "public"."timeline_event" add constraint "timeline_event_pkey" PRIMARY KEY using index "timeline_event_pkey";

alter table "public"."todo" add constraint "todo_pkey" PRIMARY KEY using index "todo_pkey";

alter table "public"."todo_assignment" add constraint "todo_assignment_pkey" PRIMARY KEY using index "todo_assignment_pkey";

alter table "public"."user" add constraint "user_pkey" PRIMARY KEY using index "user_pkey";

alter table "public"."user_hashtag" add constraint "user_hashtag_pkey" PRIMARY KEY using index "user_hashtag_pkey";

alter table "public"."user_preference" add constraint "user_preference_pkey" PRIMARY KEY using index "user_preference_pkey";

alter table "public"."vote" add constraint "vote_pkey" PRIMARY KEY using index "vote_pkey";

alter table "public"."vote_choice" add constraint "vote_choice_pkey" PRIMARY KEY using index "vote_choice_pkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_pkey" PRIMARY KEY using index "vote_offline_tally_pkey";

alter table "public"."voter" add constraint "voter_pkey" PRIMARY KEY using index "voter_pkey";

alter table "public"."voting_password" add constraint "voting_password_pkey" PRIMARY KEY using index "voting_password_pkey";

alter table "public"."accreditation" add constraint "accreditation_agenda_item_id_fkey" FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation" validate constraint "accreditation_agenda_item_id_fkey";

alter table "public"."accreditation" add constraint "accreditation_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."accreditation" validate constraint "accreditation_decided_by_fkey";

alter table "public"."accreditation" add constraint "accreditation_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation" validate constraint "accreditation_event_id_fkey";

alter table "public"."accreditation" add constraint "accreditation_event_id_user_id_key" UNIQUE using index "accreditation_event_id_user_id_key";

alter table "public"."accreditation" add constraint "accreditation_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text]))) not valid;

alter table "public"."accreditation" validate constraint "accreditation_status_check";

alter table "public"."accreditation" add constraint "accreditation_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation" validate constraint "accreditation_user_id_fkey";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_accreditation_id_fkey" FOREIGN KEY (accreditation_id) REFERENCES public.accreditation(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation_audit" validate constraint "accreditation_audit_accreditation_id_fkey";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."accreditation_audit" validate constraint "accreditation_audit_actor_id_fkey";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation_audit" validate constraint "accreditation_audit_event_id_fkey";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_to_status_check" CHECK ((to_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text]))) not valid;

alter table "public"."accreditation_audit" validate constraint "accreditation_audit_to_status_check";

alter table "public"."accreditation_audit" add constraint "accreditation_audit_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."accreditation_audit" validate constraint "accreditation_audit_user_id_fkey";

alter table "public"."action_right" add constraint "action_right_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."action_right" validate constraint "action_right_role_id_fkey";

alter table "public"."agenda_item" add constraint "agenda_item_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."agenda_item" validate constraint "agenda_item_creator_id_fkey";

alter table "public"."agenda_item" add constraint "agenda_item_voting_phase_check" CHECK ((voting_phase = ANY (ARRAY['internal'::text, 'indicative'::text, 'final'::text, 'closed'::text]))) not valid;

alter table "public"."agenda_item" validate constraint "agenda_item_voting_phase_check";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_agenda_item_id_fkey" FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE not valid;

alter table "public"."agenda_item_change_request" validate constraint "agenda_item_change_request_agenda_item_id_fkey";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_change_request_id_fkey" FOREIGN KEY (change_request_id) REFERENCES public.change_request(id) ON DELETE CASCADE not valid;

alter table "public"."agenda_item_change_request" validate constraint "agenda_item_change_request_change_request_id_fkey";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_process_branch_id_fkey" FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."agenda_item_change_request" validate constraint "agenda_item_change_request_process_branch_id_fkey";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_step_kind_check" CHECK ((step_kind = ANY (ARRAY['change_request'::text, 'closing'::text, 'merge_variant'::text]))) not valid;

alter table "public"."agenda_item_change_request" validate constraint "agenda_item_change_request_step_kind_check";

alter table "public"."agenda_item_change_request" add constraint "agenda_item_change_request_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE SET NULL not valid;

alter table "public"."agenda_item_change_request" validate constraint "agenda_item_change_request_vote_id_fkey";

alter table "public"."ai_provider_credential" add constraint "ai_provider_credential_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_provider_credential" validate constraint "ai_provider_credential_user_id_fkey";

alter table "public"."ai_skill" add constraint "ai_skill_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_skill" validate constraint "ai_skill_user_id_fkey";

alter table "public"."ai_tool" add constraint "ai_tool_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_tool" validate constraint "ai_tool_user_id_fkey";

alter table "public"."amendment" add constraint "amendment_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment" validate constraint "amendment_created_by_id_fkey";

alter table "public"."amendment" add constraint "amendment_current_process_run_fk" FOREIGN KEY (current_process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment" validate constraint "amendment_current_process_run_fk";

alter table "public"."amendment" add constraint "amendment_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE SET NULL not valid;

alter table "public"."amendment" validate constraint "amendment_document_id_fkey";

alter table "public"."amendment" add constraint "amendment_origin_amendment_fk" FOREIGN KEY (origin_amendment_id) REFERENCES public.amendment(id) ON DELETE SET NULL not valid;

alter table "public"."amendment" validate constraint "amendment_origin_amendment_fk";

alter table "public"."amendment" add constraint "amendment_single_primary_media_check" CHECK (((image_url IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."amendment" validate constraint "amendment_single_primary_media_check";

alter table "public"."amendment" add constraint "amendment_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."amendment" validate constraint "amendment_tutorial_run_id_fkey";

alter table "public"."amendment_city_design" add constraint "amendment_city_design_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_city_design" validate constraint "amendment_city_design_amendment_id_fkey";

alter table "public"."amendment_city_design" add constraint "amendment_city_design_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_city_design" validate constraint "amendment_city_design_created_by_id_fkey";

alter table "public"."amendment_collaborator" add constraint "amendment_collaborator_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_collaborator" validate constraint "amendment_collaborator_amendment_id_fkey";

alter table "public"."amendment_collaborator" add constraint "amendment_collaborator_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_collaborator" validate constraint "amendment_collaborator_role_id_fkey";

alter table "public"."amendment_collaborator" add constraint "amendment_collaborator_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_collaborator" validate constraint "amendment_collaborator_user_id_fkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_group_decision" validate constraint "amendment_group_decision_amendment_id_fkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_group_decision" validate constraint "amendment_group_decision_group_id_fkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_process_branch_id_fkey" FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_group_decision" validate constraint "amendment_group_decision_process_branch_id_fkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_process_run_id_fkey" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_group_decision" validate constraint "amendment_group_decision_process_run_id_fkey";

alter table "public"."amendment_group_decision" add constraint "amendment_group_decision_process_step_run_id_fkey" FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_group_decision" validate constraint "amendment_group_decision_process_step_run_id_fkey";

alter table "public"."amendment_hashtag" add constraint "amendment_hashtag_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_hashtag" validate constraint "amendment_hashtag_amendment_id_fkey";

alter table "public"."amendment_hashtag" add constraint "amendment_hashtag_amendment_id_hashtag_id_key" UNIQUE using index "amendment_hashtag_amendment_id_hashtag_id_key";

alter table "public"."amendment_hashtag" add constraint "amendment_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_hashtag" validate constraint "amendment_hashtag_hashtag_id_fkey";

alter table "public"."amendment_path" add constraint "amendment_path_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_path" validate constraint "amendment_path_amendment_id_fkey";

alter table "public"."amendment_path" add constraint "amendment_path_process_run_fk" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_path" validate constraint "amendment_path_process_run_fk";

alter table "public"."amendment_path" add constraint "amendment_path_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_path" validate constraint "amendment_path_workflow_id_fkey";

alter table "public"."amendment_path_segment" add constraint "amendment_path_segment_path_id_fkey" FOREIGN KEY (path_id) REFERENCES public.amendment_path(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_path_segment" validate constraint "amendment_path_segment_path_id_fkey";

alter table "public"."amendment_path_segment" add constraint "amendment_path_segment_process_branch_fk" FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_path_segment" validate constraint "amendment_path_segment_process_branch_fk";

alter table "public"."amendment_path_segment" add constraint "amendment_path_segment_process_step_run_fk" FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_path_segment" validate constraint "amendment_path_segment_process_step_run_fk";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_document_id_fkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_document_version_id_fkey" FOREIGN KEY (document_version_id) REFERENCES public.document_version(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_document_version_id_fkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_editing_mode_check" CHECK ((editing_mode = ANY (ARRAY['edit'::text, 'view'::text, 'suggest_internal'::text, 'suggest_event'::text, 'vote_internal'::text, 'event_final_closing_vote'::text, 'passed'::text, 'rejected'::text]))) not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_editing_mode_check";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_merged_into_branch_id_fkey" FOREIGN KEY (merged_into_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_merged_into_branch_id_fkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_parent_branch_id_fkey" FOREIGN KEY (parent_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_parent_branch_id_fkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_process_run_id_fkey" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_process_run_id_fkey";

alter table "public"."amendment_process_branch" add constraint "amendment_process_branch_source_step_fk" FOREIGN KEY (source_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_branch" validate constraint "amendment_process_branch_source_step_fk";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_active_branch_fk" FOREIGN KEY (active_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_active_branch_fk";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_amendment_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_created_by_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_root_workflow_id_fkey" FOREIGN KEY (root_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_root_workflow_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_selected_source_group_id_fkey" FOREIGN KEY (selected_source_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_selected_source_group_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_selected_target_group_id_fkey" FOREIGN KEY (selected_target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_selected_target_group_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_selected_target_workflow_id_fkey" FOREIGN KEY (selected_target_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_selected_target_workflow_id_fkey";

alter table "public"."amendment_process_run" add constraint "amendment_process_run_terminal_step_fk" FOREIGN KEY (terminal_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_run" validate constraint "amendment_process_run_terminal_step_fk";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_agenda_item_fk" FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_agenda_item_fk";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_branch_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_event_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_process_run_id_fkey" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_process_run_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_source_group_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_support_confirmation_id_fkey" FOREIGN KEY (support_confirmation_id) REFERENCES public.support_confirmation(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_support_confirmation_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_target_group_id_fkey" FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_target_group_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_vote_fk" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_vote_fk";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_workflow_id_fkey";

alter table "public"."amendment_process_step_run" add constraint "amendment_process_step_run_workflow_step_id_fkey" FOREIGN KEY (workflow_step_id) REFERENCES public.group_workflow_step(id) ON DELETE SET NULL not valid;

alter table "public"."amendment_process_step_run" validate constraint "amendment_process_step_run_workflow_step_id_fkey";

alter table "public"."amendment_support_vote" add constraint "amendment_support_vote_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_support_vote" validate constraint "amendment_support_vote_amendment_id_fkey";

alter table "public"."amendment_support_vote" add constraint "amendment_support_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_support_vote" validate constraint "amendment_support_vote_user_id_fkey";

alter table "public"."amendment_vote_entry" add constraint "amendment_vote_entry_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_vote_entry" validate constraint "amendment_vote_entry_amendment_id_fkey";

alter table "public"."amendment_vote_entry" add constraint "amendment_vote_entry_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_vote_entry" validate constraint "amendment_vote_entry_user_id_fkey";

alter table "public"."app_tutorial_checkpoint_effect" add constraint "app_tutorial_checkpoint_effect_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."app_tutorial_checkpoint_effect" validate constraint "app_tutorial_checkpoint_effect_run_id_fkey";

alter table "public"."app_tutorial_entity" add constraint "app_tutorial_entity_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."app_tutorial_entity" validate constraint "app_tutorial_entity_run_id_fkey";

alter table "public"."app_tutorial_entity" add constraint "app_tutorial_entity_run_type_id_key" UNIQUE using index "app_tutorial_entity_run_type_id_key";

alter table "public"."app_tutorial_run" add constraint "app_tutorial_run_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text]))) not valid;

alter table "public"."app_tutorial_run" validate constraint "app_tutorial_run_status_check";

alter table "public"."app_tutorial_run" add constraint "app_tutorial_run_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."app_tutorial_run" validate constraint "app_tutorial_run_user_id_fkey";

alter table "public"."appearance_theme" add constraint "appearance_theme_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."appearance_theme" validate constraint "appearance_theme_created_by_id_fkey";

alter table "public"."appearance_theme" add constraint "appearance_theme_current_revision_fkey" FOREIGN KEY (current_revision_id) REFERENCES public.appearance_theme_revision(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED not valid;

alter table "public"."appearance_theme" validate constraint "appearance_theme_current_revision_fkey";

alter table "public"."appearance_theme" add constraint "appearance_theme_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."appearance_theme" validate constraint "appearance_theme_group_id_fkey";

alter table "public"."appearance_theme" add constraint "appearance_theme_group_slug_unique" UNIQUE using index "appearance_theme_group_slug_unique";

alter table "public"."appearance_theme" add constraint "appearance_theme_kind_check" CHECK ((kind = ANY (ARRAY['builtin'::text, 'group'::text]))) not valid;

alter table "public"."appearance_theme" validate constraint "appearance_theme_kind_check";

alter table "public"."appearance_theme" add constraint "appearance_theme_scope_check" CHECK ((((kind = 'builtin'::text) AND (group_id IS NULL)) OR ((kind = 'group'::text) AND (group_id IS NOT NULL)))) not valid;

alter table "public"."appearance_theme" validate constraint "appearance_theme_scope_check";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."appearance_theme_revision" validate constraint "appearance_theme_revision_created_by_id_fkey";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))) not valid;

alter table "public"."appearance_theme_revision" validate constraint "appearance_theme_revision_status_check";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_theme_id_fkey" FOREIGN KEY (theme_id) REFERENCES public.appearance_theme(id) ON DELETE CASCADE not valid;

alter table "public"."appearance_theme_revision" validate constraint "appearance_theme_revision_theme_id_fkey";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_theme_id_version_key" UNIQUE using index "appearance_theme_revision_theme_id_version_key";

alter table "public"."appearance_theme_revision" add constraint "appearance_theme_revision_version_check" CHECK ((version > 0)) not valid;

alter table "public"."appearance_theme_revision" validate constraint "appearance_theme_revision_version_check";

alter table "public"."blog" add constraint "blog_single_primary_media_check" CHECK (((image_url IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."blog" validate constraint "blog_single_primary_media_check";

alter table "public"."blog" add constraint "blog_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."blog" validate constraint "blog_tutorial_run_id_fkey";

alter table "public"."blog_blogger" add constraint "blog_blogger_blog_id_fkey" FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE not valid;

alter table "public"."blog_blogger" validate constraint "blog_blogger_blog_id_fkey";

alter table "public"."blog_blogger" add constraint "blog_blogger_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."blog_blogger" validate constraint "blog_blogger_role_id_fkey";

alter table "public"."blog_blogger" add constraint "blog_blogger_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."blog_blogger" validate constraint "blog_blogger_user_id_fkey";

alter table "public"."blog_hashtag" add constraint "blog_hashtag_blog_id_fkey" FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE not valid;

alter table "public"."blog_hashtag" validate constraint "blog_hashtag_blog_id_fkey";

alter table "public"."blog_hashtag" add constraint "blog_hashtag_blog_id_hashtag_id_key" UNIQUE using index "blog_hashtag_blog_id_hashtag_id_key";

alter table "public"."blog_hashtag" add constraint "blog_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."blog_hashtag" validate constraint "blog_hashtag_hashtag_id_fkey";

alter table "public"."blog_support_vote" add constraint "blog_support_vote_blog_id_fkey" FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE not valid;

alter table "public"."blog_support_vote" validate constraint "blog_support_vote_blog_id_fkey";

alter table "public"."blog_support_vote" add constraint "blog_support_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."blog_support_vote" validate constraint "blog_support_vote_user_id_fkey";

alter table "public"."calendar_subscription" add constraint "calendar_subscription_target_group_id_fkey" FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."calendar_subscription" validate constraint "calendar_subscription_target_group_id_fkey";

alter table "public"."calendar_subscription" add constraint "calendar_subscription_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."calendar_subscription" validate constraint "calendar_subscription_target_user_id_fkey";

alter table "public"."calendar_subscription" add constraint "calendar_subscription_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."calendar_subscription" validate constraint "calendar_subscription_user_id_fkey";

alter table "public"."calendar_subscription" add constraint "chk_calendar_sub_target" CHECK ((((target_type = 'group'::text) AND (target_group_id IS NOT NULL) AND (target_user_id IS NULL)) OR ((target_type = 'user'::text) AND (target_user_id IS NOT NULL) AND (target_group_id IS NULL)))) not valid;

alter table "public"."calendar_subscription" validate constraint "chk_calendar_sub_target";

alter table "public"."change_request" add constraint "change_request_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."change_request" validate constraint "change_request_amendment_id_fkey";

alter table "public"."change_request" add constraint "change_request_process_branch_id_fkey" FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."change_request" validate constraint "change_request_process_branch_id_fkey";

alter table "public"."change_request" add constraint "change_request_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."change_request" validate constraint "change_request_user_id_fkey";

alter table "public"."change_request_vote" add constraint "change_request_vote_change_request_id_fkey" FOREIGN KEY (change_request_id) REFERENCES public.change_request(id) ON DELETE CASCADE not valid;

alter table "public"."change_request_vote" validate constraint "change_request_vote_change_request_id_fkey";

alter table "public"."change_request_vote" add constraint "change_request_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."change_request_vote" validate constraint "change_request_vote_user_id_fkey";

alter table "public"."comment" add constraint "comment_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.comment(id) ON DELETE CASCADE not valid;

alter table "public"."comment" validate constraint "comment_parent_id_fkey";

alter table "public"."comment" add constraint "comment_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON DELETE CASCADE not valid;

alter table "public"."comment" validate constraint "comment_thread_id_fkey";

alter table "public"."comment" add constraint "comment_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."comment" validate constraint "comment_user_id_fkey";

alter table "public"."comment_vote" add constraint "comment_vote_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES public.comment(id) ON DELETE CASCADE not valid;

alter table "public"."comment_vote" validate constraint "comment_vote_comment_id_fkey";

alter table "public"."comment_vote" add constraint "comment_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."comment_vote" validate constraint "comment_vote_user_id_fkey";

alter table "public"."conversation" add constraint "conversation_assistant_for_user_id_fkey" FOREIGN KEY (assistant_for_user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."conversation" validate constraint "conversation_assistant_for_user_id_fkey";

alter table "public"."conversation" add constraint "conversation_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."conversation" validate constraint "conversation_event_id_fkey";

alter table "public"."conversation" add constraint "conversation_requested_by_id_fkey" FOREIGN KEY (requested_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."conversation" validate constraint "conversation_requested_by_id_fkey";

alter table "public"."conversation" add constraint "conversation_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."conversation" validate constraint "conversation_tutorial_run_id_fkey";

alter table "public"."conversation_participant" add constraint "conversation_participant_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_participant" validate constraint "conversation_participant_conversation_id_fkey";

alter table "public"."conversation_participant" add constraint "conversation_participant_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_participant" validate constraint "conversation_participant_user_id_fkey";

alter table "public"."currency_exchange_rate_cache" add constraint "currency_exchange_rate_cache_base_currency_check" CHECK ((base_currency ~ '^[A-Z]{3}$'::text)) not valid;

alter table "public"."currency_exchange_rate_cache" validate constraint "currency_exchange_rate_cache_base_currency_check";

alter table "public"."currency_exchange_rate_cache" add constraint "currency_exchange_rate_cache_quote_currency_check" CHECK ((quote_currency ~ '^[A-Z]{3}$'::text)) not valid;

alter table "public"."currency_exchange_rate_cache" validate constraint "currency_exchange_rate_cache_quote_currency_check";

alter table "public"."currency_exchange_rate_cache" add constraint "currency_exchange_rate_cache_rate_check" CHECK ((rate > (0)::numeric)) not valid;

alter table "public"."currency_exchange_rate_cache" validate constraint "currency_exchange_rate_cache_rate_check";

alter table "public"."dataset" add constraint "dataset_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."dataset" validate constraint "dataset_created_by_id_fkey";

alter table "public"."dataset" add constraint "dataset_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."dataset" validate constraint "dataset_group_id_fkey";

alter table "public"."dataset" add constraint "dataset_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."dataset" validate constraint "dataset_owner_user_id_fkey";

alter table "public"."dataset" add constraint "dataset_provider_check" CHECK ((provider = ANY (ARRAY['EUROSTAT'::text, 'GENESIS_DESTATIS'::text, 'GOVDATA'::text, 'UPLOAD'::text]))) not valid;

alter table "public"."dataset" validate constraint "dataset_provider_check";

alter table "public"."dataset" add constraint "dataset_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'error'::text]))) not valid;

alter table "public"."dataset" validate constraint "dataset_status_check";

alter table "public"."dataset" add constraint "dataset_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))) not valid;

alter table "public"."dataset" validate constraint "dataset_visibility_check";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_dataset_id_fkey" FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE not valid;

alter table "public"."dataset_import_job" validate constraint "dataset_import_job_dataset_id_fkey";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_provider_check" CHECK ((provider = ANY (ARRAY['EUROSTAT'::text, 'GENESIS_DESTATIS'::text, 'GOVDATA'::text, 'UPLOAD'::text]))) not valid;

alter table "public"."dataset_import_job" validate constraint "dataset_import_job_provider_check";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_requested_by_id_fkey" FOREIGN KEY (requested_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."dataset_import_job" validate constraint "dataset_import_job_requested_by_id_fkey";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_result_snapshot_id_fkey" FOREIGN KEY (result_snapshot_id) REFERENCES public.dataset_snapshot(id) ON DELETE SET NULL not valid;

alter table "public"."dataset_import_job" validate constraint "dataset_import_job_result_snapshot_id_fkey";

alter table "public"."dataset_import_job" add constraint "dataset_import_job_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'blocked'::text, 'error'::text]))) not valid;

alter table "public"."dataset_import_job" validate constraint "dataset_import_job_status_check";

alter table "public"."dataset_snapshot" add constraint "dataset_snapshot_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."dataset_snapshot" validate constraint "dataset_snapshot_created_by_id_fkey";

alter table "public"."dataset_snapshot" add constraint "dataset_snapshot_dataset_id_fkey" FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE not valid;

alter table "public"."dataset_snapshot" validate constraint "dataset_snapshot_dataset_id_fkey";

alter table "public"."dataset_snapshot" add constraint "dataset_snapshot_snapshot_key_key" UNIQUE using index "dataset_snapshot_snapshot_key_key";

alter table "public"."dataset_snapshot" add constraint "dataset_snapshot_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'blocked'::text, 'error'::text]))) not valid;

alter table "public"."dataset_snapshot" validate constraint "dataset_snapshot_status_check";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_allocation_id_fkey" FOREIGN KEY (allocation_id) REFERENCES public.group_delegate_allocation(id) ON DELETE SET NULL not valid;

alter table "public"."delegate_election_assignment" validate constraint "delegate_election_assignment_allocation_id_fkey";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_linked_event_id_fkey" FOREIGN KEY (linked_event_id) REFERENCES public.event(id) ON DELETE SET NULL not valid;

alter table "public"."delegate_election_assignment" validate constraint "delegate_election_assignment_linked_event_id_fkey";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."delegate_election_assignment" validate constraint "delegate_election_assignment_source_group_id_fkey";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'scheduled'::text, 'complete'::text, 'cancelled'::text]))) not valid;

alter table "public"."delegate_election_assignment" validate constraint "delegate_election_assignment_status_check";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_target_event_id_fkey" FOREIGN KEY (target_event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."delegate_election_assignment" validate constraint "delegate_election_assignment_target_event_id_fkey";

alter table "public"."delegate_election_assignment" add constraint "delegate_election_assignment_target_event_id_source_group_i_key" UNIQUE using index "delegate_election_assignment_target_event_id_source_group_i_key";

alter table "public"."document_collaborator" add constraint "document_collaborator_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE not valid;

alter table "public"."document_collaborator" validate constraint "document_collaborator_document_id_fkey";

alter table "public"."document_collaborator" add constraint "document_collaborator_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."document_collaborator" validate constraint "document_collaborator_user_id_fkey";

alter table "public"."document_cursor" add constraint "document_cursor_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE not valid;

alter table "public"."document_cursor" validate constraint "document_cursor_document_id_fkey";

alter table "public"."document_cursor" add constraint "document_cursor_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."document_cursor" validate constraint "document_cursor_user_id_fkey";

alter table "public"."document_version" add constraint "document_version_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."document_version" validate constraint "document_version_author_id_fkey";

alter table "public"."document_version" add constraint "document_version_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE not valid;

alter table "public"."document_version" validate constraint "document_version_document_id_fkey";

alter table "public"."election" add constraint "election_ballot_visibility_check" CHECK ((ballot_visibility = ANY (ARRAY['named'::text, 'secret'::text]))) not valid;

alter table "public"."election" validate constraint "election_ballot_visibility_check";

alter table "public"."election" add constraint "election_offline_electorate_size_check" CHECK ((offline_electorate_size >= 0)) not valid;

alter table "public"."election" validate constraint "election_offline_electorate_size_check";

alter table "public"."election" add constraint "election_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."election" validate constraint "election_role_id_fkey";

alter table "public"."election_candidate" add constraint "election_candidate_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."election_candidate" validate constraint "election_candidate_election_id_fkey";

alter table "public"."election_candidate" add constraint "election_candidate_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."election_candidate" validate constraint "election_candidate_user_id_fkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_candidate_id_fkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_count_check" CHECK ((count >= 0)) not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_count_check";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_election_id_fkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_election_id_phase_candidate_id_key" UNIQUE using index "election_offline_tally_election_id_phase_candidate_id_key";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_phase_check" CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))) not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_phase_check";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_updated_by_id_fkey";

alter table "public"."elector" add constraint "elector_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."elector" validate constraint "elector_election_id_fkey";

alter table "public"."elector" add constraint "elector_election_id_user_id_key" UNIQUE using index "elector_election_id_user_id_key";

alter table "public"."elector" add constraint "elector_participation_channel_check" CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))) not valid;

alter table "public"."elector" validate constraint "elector_participation_channel_check";

alter table "public"."elector" add constraint "elector_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."elector" validate constraint "elector_user_id_fkey";

alter table "public"."event" add constraint "event_attendance_mode_check" CHECK ((attendance_mode = ANY (ARRAY['online'::text, 'hybrid'::text, 'offline'::text]))) not valid;

alter table "public"."event" validate constraint "event_attendance_mode_check";

alter table "public"."event" add constraint "event_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."event" validate constraint "event_creator_id_fkey";

alter table "public"."event" add constraint "event_single_primary_media_check" CHECK (((image_url IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."event" validate constraint "event_single_primary_media_check";

alter table "public"."event" add constraint "event_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."event" validate constraint "event_tutorial_run_id_fkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_event_id_fkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_event_id_source_group_id_scope_kind_pa_key" UNIQUE using index "event_assembly_scope_event_id_source_group_id_scope_kind_pa_key";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_host_group_id_fkey" FOREIGN KEY (host_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_host_group_id_fkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_participant_mode_check" CHECK ((participant_mode = ANY (ARRAY['all_members'::text, 'delegates'::text, 'role_members'::text, 'none'::text]))) not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_participant_mode_check";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_required_role_id_fkey" FOREIGN KEY (required_role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_required_role_id_fkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_scope_kind_check" CHECK ((scope_kind = ANY (ARRAY['general_member_source'::text, 'delegate_source'::text, 'delegate_assignment_source'::text]))) not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_scope_kind_check";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_source_group_id_fkey";

alter table "public"."event_assembly_scope" add constraint "event_assembly_scope_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."event_assembly_scope" validate constraint "event_assembly_scope_status_check";

alter table "public"."event_delegate" add constraint "event_delegate_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_delegate" validate constraint "event_delegate_event_id_fkey";

alter table "public"."event_delegate" add constraint "event_delegate_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."event_delegate" validate constraint "event_delegate_user_id_fkey";

alter table "public"."event_exception" add constraint "event_exception_parent_event_id_fkey" FOREIGN KEY (parent_event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_exception" validate constraint "event_exception_parent_event_id_fkey";

alter table "public"."event_exception" add constraint "uq_event_exception_parent_date" UNIQUE using index "uq_event_exception_parent_date";

alter table "public"."event_hashtag" add constraint "event_hashtag_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_hashtag" validate constraint "event_hashtag_event_id_fkey";

alter table "public"."event_hashtag" add constraint "event_hashtag_event_id_hashtag_id_key" UNIQUE using index "event_hashtag_event_id_hashtag_id_key";

alter table "public"."event_hashtag" add constraint "event_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."event_hashtag" validate constraint "event_hashtag_hashtag_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_attendance_status_check" CHECK ((attendance_status = ANY (ARRAY['listed'::text, 'confirmed'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_attendance_status_check";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_connected_user_id_fkey" FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_connected_user_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_event_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_group_offline_member_id_fkey" FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE SET NULL not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_group_offline_member_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_participation_channel_check" CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_participation_channel_check";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_source_type_check" CHECK ((source_type = ANY (ARRAY['group_member'::text, 'event_extra'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_source_type_check";

alter table "public"."event_participant" add constraint "event_participant_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant" validate constraint "event_participant_event_id_fkey";

alter table "public"."event_participant" add constraint "event_participant_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant" validate constraint "event_participant_user_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_assigned_by_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_event_participant_id_fkey" FOREIGN KEY (event_participant_id) REFERENCES public.event_participant(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_event_participant_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_event_participant_id_role_id_key" UNIQUE using index "event_participant_role_event_participant_id_role_id_key";

alter table "public"."event_participant_role" add constraint "event_participant_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_role_id_fkey";

alter table "public"."final_candidate_selection" add constraint "final_candidate_selection_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE not valid;

alter table "public"."final_candidate_selection" validate constraint "final_candidate_selection_candidate_id_fkey";

alter table "public"."final_candidate_selection" add constraint "final_candidate_selection_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."final_candidate_selection" validate constraint "final_candidate_selection_election_id_fkey";

alter table "public"."final_candidate_selection" add constraint "final_candidate_selection_elector_participation_id_fkey" FOREIGN KEY (elector_participation_id) REFERENCES public.final_elector_participation(id) ON DELETE CASCADE not valid;

alter table "public"."final_candidate_selection" validate constraint "final_candidate_selection_elector_participation_id_fkey";

alter table "public"."final_choice_decision" add constraint "final_choice_decision_choice_id_fkey" FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE not valid;

alter table "public"."final_choice_decision" validate constraint "final_choice_decision_choice_id_fkey";

alter table "public"."final_choice_decision" add constraint "final_choice_decision_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."final_choice_decision" validate constraint "final_choice_decision_vote_id_fkey";

alter table "public"."final_choice_decision" add constraint "final_choice_decision_voter_participation_id_fkey" FOREIGN KEY (voter_participation_id) REFERENCES public.final_voter_participation(id) ON DELETE CASCADE not valid;

alter table "public"."final_choice_decision" validate constraint "final_choice_decision_voter_participation_id_fkey";

alter table "public"."final_elector_participation" add constraint "final_elector_participation_election_id_elector_id_key" UNIQUE using index "final_elector_participation_election_id_elector_id_key";

alter table "public"."final_elector_participation" add constraint "final_elector_participation_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."final_elector_participation" validate constraint "final_elector_participation_election_id_fkey";

alter table "public"."final_elector_participation" add constraint "final_elector_participation_elector_id_fkey" FOREIGN KEY (elector_id) REFERENCES public.elector(id) ON DELETE CASCADE not valid;

alter table "public"."final_elector_participation" validate constraint "final_elector_participation_elector_id_fkey";

alter table "public"."final_voter_participation" add constraint "final_voter_participation_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."final_voter_participation" validate constraint "final_voter_participation_vote_id_fkey";

alter table "public"."final_voter_participation" add constraint "final_voter_participation_vote_id_voter_id_key" UNIQUE using index "final_voter_participation_vote_id_voter_id_key";

alter table "public"."final_voter_participation" add constraint "final_voter_participation_voter_id_fkey" FOREIGN KEY (voter_id) REFERENCES public.voter(id) ON DELETE CASCADE not valid;

alter table "public"."final_voter_participation" validate constraint "final_voter_participation_voter_id_fkey";

alter table "public"."follow" add constraint "follow_followee_id_fkey" FOREIGN KEY (followee_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."follow" validate constraint "follow_followee_id_fkey";

alter table "public"."follow" add constraint "follow_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."follow" validate constraint "follow_follower_id_fkey";

alter table "public"."group" add constraint "group_connected_group_id_fkey" FOREIGN KEY (connected_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group" validate constraint "group_connected_group_id_fkey";

alter table "public"."group" add constraint "group_group_type_check" CHECK ((group_type = ANY (ARRAY['base'::text, 'hierarchical'::text, 'sibling'::text, 'parliament'::text, 'committee'::text, 'institution'::text]))) not valid;

alter table "public"."group" validate constraint "group_group_type_check";

alter table "public"."group" add constraint "group_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group" validate constraint "group_owner_id_fkey";

alter table "public"."group" add constraint "group_primary_sibling_membership_mode_check" CHECK (((primary_sibling_membership_mode IS NULL) OR (primary_sibling_membership_mode = ANY (ARRAY['none'::text, 'all_members'::text, 'role_members'::text, 'selected_source_groups'::text])))) not valid;

alter table "public"."group" validate constraint "group_primary_sibling_membership_mode_check";

alter table "public"."group" add constraint "group_sibling_membership_mode_check" CHECK (((sibling_membership_mode IS NULL) OR (sibling_membership_mode = ANY (ARRAY['open'::text, 'elected'::text, 'parliament'::text])))) not valid;

alter table "public"."group" validate constraint "group_sibling_membership_mode_check";

alter table "public"."group" add constraint "group_single_primary_media_check" CHECK (((image_url IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."group" validate constraint "group_single_primary_media_check";

alter table "public"."group" add constraint "group_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."group" validate constraint "group_tutorial_run_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_canonical_pair_check" CHECK ((group_a_id < group_b_id)) not valid;

alter table "public"."group_connection" validate constraint "group_connection_canonical_pair_check";

alter table "public"."group_connection" add constraint "group_connection_child_group_id_fkey" FOREIGN KEY (child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_child_group_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_connection_kind_check" CHECK (((connection_kind IS NULL) OR (connection_kind = ANY (ARRAY['hierarchy'::text, 'sibling'::text, 'parliament'::text, 'committee'::text, 'institution'::text])))) not valid;

alter table "public"."group_connection" validate constraint "group_connection_connection_kind_check";

alter table "public"."group_connection" add constraint "group_connection_connection_type_check" CHECK ((connection_type = ANY (ARRAY['hierarchy'::text, 'peer'::text]))) not valid;

alter table "public"."group_connection" validate constraint "group_connection_connection_type_check";

alter table "public"."group_connection" add constraint "group_connection_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_connection" validate constraint "group_connection_created_by_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_from_group_id_fkey" FOREIGN KEY (from_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_from_group_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_group_a_id_fkey" FOREIGN KEY (group_a_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_group_a_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_group_a_id_group_b_id_key" UNIQUE using index "group_connection_group_a_id_group_b_id_key";

alter table "public"."group_connection" add constraint "group_connection_group_b_id_fkey" FOREIGN KEY (group_b_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_group_b_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_parent_group_id_fkey" FOREIGN KEY (parent_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_parent_group_id_fkey";

alter table "public"."group_connection" add constraint "group_connection_structure_check" CHECK ((((connection_type = 'peer'::text) AND (parent_group_id IS NULL) AND (child_group_id IS NULL)) OR ((connection_type = 'hierarchy'::text) AND (parent_group_id IS NOT NULL) AND (child_group_id IS NOT NULL) AND (parent_group_id <> child_group_id) AND (((parent_group_id = group_a_id) AND (child_group_id = group_b_id)) OR ((parent_group_id = group_b_id) AND (child_group_id = group_a_id)))))) not valid;

alter table "public"."group_connection" validate constraint "group_connection_structure_check";

alter table "public"."group_connection" add constraint "group_connection_to_group_id_fkey" FOREIGN KEY (to_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection" validate constraint "group_connection_to_group_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_active_connection_id_fkey" FOREIGN KEY (active_connection_id) REFERENCES public.group_connection(id) ON DELETE SET NULL not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_active_connection_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_canonical_pair_check" CHECK ((group_a_id < group_b_id)) not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_canonical_pair_check";

alter table "public"."group_connection_request" add constraint "group_connection_request_desired_child_group_id_fkey" FOREIGN KEY (desired_child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_desired_child_group_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_desired_connection_type_check" CHECK ((desired_connection_type = ANY (ARRAY['hierarchy'::text, 'peer'::text]))) not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_desired_connection_type_check";

alter table "public"."group_connection_request" add constraint "group_connection_request_desired_parent_group_id_fkey" FOREIGN KEY (desired_parent_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_desired_parent_group_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_group_a_id_fkey" FOREIGN KEY (group_a_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_group_a_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_group_a_id_group_b_id_key" UNIQUE using index "group_connection_request_group_a_id_group_b_id_key";

alter table "public"."group_connection_request" add constraint "group_connection_request_group_b_id_fkey" FOREIGN KEY (group_b_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_group_b_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_initiator_group_id_fkey" FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_initiator_group_id_fkey";

alter table "public"."group_connection_request" add constraint "group_connection_request_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'partially_approved'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_status_check";

alter table "public"."group_connection_request" add constraint "group_connection_request_structure_check" CHECK ((((desired_connection_type = 'peer'::text) AND (desired_parent_group_id IS NULL) AND (desired_child_group_id IS NULL)) OR ((desired_connection_type = 'hierarchy'::text) AND (desired_parent_group_id IS NOT NULL) AND (desired_child_group_id IS NOT NULL) AND (desired_parent_group_id <> desired_child_group_id) AND (((desired_parent_group_id = group_a_id) AND (desired_child_group_id = group_b_id)) OR ((desired_parent_group_id = group_b_id) AND (desired_child_group_id = group_a_id)))))) not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_structure_check";

alter table "public"."group_connection_request" add constraint "group_connection_request_structure_status_check" CHECK ((structure_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."group_connection_request" validate constraint "group_connection_request_structure_status_check";

alter table "public"."group_delegate_allocation" add constraint "group_delegate_allocation_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."group_delegate_allocation" validate constraint "group_delegate_allocation_event_id_fkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_endpoints_check" CHECK ((holder_group_id <> scope_group_id)) not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_endpoints_check";

alter table "public"."group_effective_right" add constraint "group_effective_right_holder_group_id_fkey" FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_holder_group_id_fkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_holder_group_id_scope_group_id_right__key" UNIQUE using index "group_effective_right_holder_group_id_scope_group_id_right__key";

alter table "public"."group_effective_right" add constraint "group_effective_right_right_key_check" CHECK ((right_key = ANY (ARRAY['informationRight'::text, 'amendmentRight'::text, 'rightToSpeak'::text, 'activeVotingRight'::text, 'passiveVotingRight'::text]))) not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_right_key_check";

alter table "public"."group_effective_right" add constraint "group_effective_right_scope_group_id_fkey" FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_scope_group_id_fkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_source_connection_id_fkey" FOREIGN KEY (source_connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_source_connection_id_fkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_source_grant_id_fkey" FOREIGN KEY (source_grant_id) REFERENCES public.group_right_grant(id) ON DELETE CASCADE not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_source_grant_id_fkey";

alter table "public"."group_effective_right" add constraint "group_effective_right_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."group_effective_right" validate constraint "group_effective_right_status_check";

alter table "public"."group_guest_access" add constraint "group_guest_access_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_group_id_fkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_group_id_user_id_key" UNIQUE using index "group_guest_access_group_id_user_id_key";

alter table "public"."group_guest_access" add constraint "group_guest_access_invited_by_id_fkey" FOREIGN KEY (invited_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_invited_by_id_fkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_status_check" CHECK ((status = ANY (ARRAY['requested'::text, 'invited'::text, 'active'::text, 'revoked'::text]))) not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_status_check";

alter table "public"."group_guest_access" add constraint "group_guest_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_user_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_assigned_by_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_group_guest_access_id_fkey" FOREIGN KEY (group_guest_access_id) REFERENCES public.group_guest_access(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_group_guest_access_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_group_guest_access_id_role_id_key" UNIQUE using index "group_guest_role_group_guest_access_id_role_id_key";

alter table "public"."group_guest_role" add constraint "group_guest_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_role_id_fkey";

alter table "public"."group_hashtag" add constraint "group_hashtag_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_hashtag" validate constraint "group_hashtag_group_id_fkey";

alter table "public"."group_hashtag" add constraint "group_hashtag_group_id_hashtag_id_key" UNIQUE using index "group_hashtag_group_id_hashtag_id_key";

alter table "public"."group_hashtag" add constraint "group_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."group_hashtag" validate constraint "group_hashtag_hashtag_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_ancestor_group_id_descendant_group_id__key" UNIQUE using index "group_hierarchy_path_ancestor_group_id_descendant_group_id__key";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_ancestor_group_id_fkey" FOREIGN KEY (ancestor_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_ancestor_group_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_base_group_id_fkey" FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_base_group_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_connection_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_descendant_group_id_fkey" FOREIGN KEY (descendant_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_descendant_group_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_direct_child_group_id_fkey" FOREIGN KEY (direct_child_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_direct_child_group_id_fkey";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_distinct_check" CHECK ((ancestor_group_id <> descendant_group_id)) not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_distinct_check";

alter table "public"."group_hierarchy_path" add constraint "group_hierarchy_path_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."group_hierarchy_path" validate constraint "group_hierarchy_path_status_check";

alter table "public"."group_membership" add constraint "group_membership_base_group_id_fkey" FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership" validate constraint "group_membership_base_group_id_fkey";

alter table "public"."group_membership" add constraint "group_membership_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership" validate constraint "group_membership_group_id_fkey";

alter table "public"."group_membership" add constraint "group_membership_origin_kind_check" CHECK ((origin_kind = ANY (ARRAY['direct'::text, 'hierarchy'::text, 'sibling_all_members'::text, 'sibling_role_members'::text, 'sibling_selected_source_groups'::text, 'manual_projection'::text]))) not valid;

alter table "public"."group_membership" validate constraint "group_membership_origin_kind_check";

alter table "public"."group_membership" add constraint "group_membership_part_group_id_fkey" FOREIGN KEY (part_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership" validate constraint "group_membership_part_group_id_fkey";

alter table "public"."group_membership" add constraint "group_membership_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership" validate constraint "group_membership_source_group_id_fkey";

alter table "public"."group_membership" add constraint "group_membership_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership" validate constraint "group_membership_user_id_fkey";

alter table "public"."group_membership" add constraint "group_membership_user_id_group_id_key" UNIQUE using index "group_membership_user_id_group_id_key";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_group_membership_id_fkey" FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_exclusivity_lock" validate constraint "group_membership_exclusivity_lock_group_membership_id_fkey";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_hierarchy_group_id_fkey" FOREIGN KEY (hierarchy_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_exclusivity_lock" validate constraint "group_membership_exclusivity_lock_hierarchy_group_id_fkey";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_exclusivity_lock" validate constraint "group_membership_exclusivity_lock_source_group_id_fkey";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."group_membership_exclusivity_lock" validate constraint "group_membership_exclusivity_lock_status_check";

alter table "public"."group_membership_exclusivity_lock" add constraint "group_membership_exclusivity_lock_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_exclusivity_lock" validate constraint "group_membership_exclusivity_lock_user_id_fkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_base_group_id_fkey" FOREIGN KEY (base_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_base_group_id_fkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_group_membership_id_fkey" FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_group_membership_id_fkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_group_membership_id_origin_kind_sou_key" UNIQUE using index "group_membership_origin_group_membership_id_origin_kind_sou_key";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_origin_kind_check" CHECK ((origin_kind = ANY (ARRAY['direct'::text, 'hierarchy'::text, 'sibling_all_members'::text, 'sibling_role_members'::text, 'sibling_selected_source_groups'::text, 'manual_projection'::text]))) not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_origin_kind_check";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_part_group_id_fkey" FOREIGN KEY (part_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_part_group_id_fkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_source_group_id_fkey";

alter table "public"."group_membership_origin" add constraint "group_membership_origin_source_membership_id_fkey" FOREIGN KEY (source_membership_id) REFERENCES public.group_membership(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_origin" validate constraint "group_membership_origin_source_membership_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_assigned_by_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_group_membership_id_fkey" FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_group_membership_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_group_membership_id_role_id_key" UNIQUE using index "group_membership_role_group_membership_id_role_id_key";

alter table "public"."group_membership_role" add constraint "group_membership_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_role_id_fkey";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_connection_id_fkey";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_connection_id_key" UNIQUE using index "group_membership_rule_connection_id_key";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_endpoints_check" CHECK ((member_source_group_id <> member_target_group_id)) not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_endpoints_check";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_member_source_group_id_fkey" FOREIGN KEY (member_source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_member_source_group_id_fkey";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_member_target_group_id_fkey" FOREIGN KEY (member_target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_member_target_group_id_fkey";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_mode_check" CHECK ((membership_mode = ANY (ARRAY['all_members'::text, 'role_members'::text, 'selected_source_groups'::text]))) not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_mode_check";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_mode_fields_check" CHECK ((((membership_mode = ANY (ARRAY['all_members'::text, 'selected_source_groups'::text])) AND (required_source_role_id IS NULL)) OR ((membership_mode = 'role_members'::text) AND (required_source_role_id IS NOT NULL)))) not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_mode_fields_check";

alter table "public"."group_membership_rule" add constraint "group_membership_rule_required_source_role_id_fkey" FOREIGN KEY (required_source_role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_rule" validate constraint "group_membership_rule_required_source_role_id_fkey";

alter table "public"."group_membership_rule_origin" add constraint "group_membership_rule_origin_eligible_origin_group_id_fkey" FOREIGN KEY (eligible_origin_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_origin" validate constraint "group_membership_rule_origin_eligible_origin_group_id_fkey";

alter table "public"."group_membership_rule_origin" add constraint "group_membership_rule_origin_membership_rule_id_eligible_or_key" UNIQUE using index "group_membership_rule_origin_membership_rule_id_eligible_or_key";

alter table "public"."group_membership_rule_origin" add constraint "group_membership_rule_origin_membership_rule_id_fkey" FOREIGN KEY (membership_rule_id) REFERENCES public.group_membership_rule(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_origin" validate constraint "group_membership_rule_origin_membership_rule_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_connection_request_id_fkey" FOREIGN KEY (connection_request_id) REFERENCES public.group_connection_request(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_connection_request_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_connection_request_id_key" UNIQUE using index "group_membership_rule_request_connection_request_id_key";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_existing_membership_rule_id_fkey" FOREIGN KEY (existing_membership_rule_id) REFERENCES public.group_membership_rule(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_existing_membership_rule_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_member_source_group_id_fkey" FOREIGN KEY (member_source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_member_source_group_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_member_target_group_id_fkey" FOREIGN KEY (member_target_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_member_target_group_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_operation_check" CHECK ((operation = ANY (ARRAY['upsert'::text, 'remove'::text]))) not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_operation_check";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_required_source_role_id_fkey" FOREIGN KEY (required_source_role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_required_source_role_id_fkey";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_shape_check" CHECK ((((operation = 'remove'::text) AND (member_source_group_id IS NULL) AND (member_target_group_id IS NULL) AND (membership_mode IS NULL) AND (required_source_role_id IS NULL)) OR ((operation = 'upsert'::text) AND (member_source_group_id IS NOT NULL) AND (member_target_group_id IS NOT NULL) AND (member_source_group_id <> member_target_group_id) AND (membership_mode = ANY (ARRAY['all_members'::text, 'role_members'::text, 'selected_source_groups'::text])) AND (((membership_mode = ANY (ARRAY['all_members'::text, 'selected_source_groups'::text])) AND (required_source_role_id IS NULL)) OR ((membership_mode = 'role_members'::text) AND (required_source_role_id IS NOT NULL)))))) not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_shape_check";

alter table "public"."group_membership_rule_request" add constraint "group_membership_rule_request_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."group_membership_rule_request" validate constraint "group_membership_rule_request_status_check";

alter table "public"."group_membership_rule_request_origin" add constraint "group_membership_rule_request_membership_rule_request_id_el_key" UNIQUE using index "group_membership_rule_request_membership_rule_request_id_el_key";

alter table "public"."group_membership_rule_request_origin" add constraint "group_membership_rule_request_o_membership_rule_request_id_fkey" FOREIGN KEY (membership_rule_request_id) REFERENCES public.group_membership_rule_request(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_request_origin" validate constraint "group_membership_rule_request_o_membership_rule_request_id_fkey";

alter table "public"."group_membership_rule_request_origin" add constraint "group_membership_rule_request_ori_eligible_origin_group_id_fkey" FOREIGN KEY (eligible_origin_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_rule_request_origin" validate constraint "group_membership_rule_request_ori_eligible_origin_group_id_fkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_connected_user_id_fkey" FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_connected_user_id_fkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_created_by_id_fkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_group_id_fkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_group_id_fkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_offline_member_id_fkey" FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_group_offline_member_id_fkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_offline_member_id_group_id_key" UNIQUE using index "group_offline_membership_group_offline_member_id_group_id_key";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_source_group_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_assigned_by_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_group_offline_membership_id_fkey" FOREIGN KEY (group_offline_membership_id) REFERENCES public.group_offline_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_group_offline_membership_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_group_offline_membership_id_r_key" UNIQUE using index "group_offline_membership_role_group_offline_membership_id_r_key";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_role_id_fkey";

alter table "public"."group_right_grant" add constraint "group_right_grant_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.group_connection(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant" validate constraint "group_right_grant_connection_id_fkey";

alter table "public"."group_right_grant" add constraint "group_right_grant_connection_id_right_key_holder_group_id_s_key" UNIQUE using index "group_right_grant_connection_id_right_key_holder_group_id_s_key";

alter table "public"."group_right_grant" add constraint "group_right_grant_endpoints_check" CHECK ((holder_group_id <> scope_group_id)) not valid;

alter table "public"."group_right_grant" validate constraint "group_right_grant_endpoints_check";

alter table "public"."group_right_grant" add constraint "group_right_grant_holder_group_id_fkey" FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant" validate constraint "group_right_grant_holder_group_id_fkey";

alter table "public"."group_right_grant" add constraint "group_right_grant_initiator_group_id_fkey" FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group_right_grant" validate constraint "group_right_grant_initiator_group_id_fkey";

alter table "public"."group_right_grant" add constraint "group_right_grant_scope_group_id_fkey" FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant" validate constraint "group_right_grant_scope_group_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_connection_request_id_fkey" FOREIGN KEY (connection_request_id) REFERENCES public.group_connection_request(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_connection_request_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_connection_request_id_right_key_h_key" UNIQUE using index "group_right_grant_request_connection_request_id_right_key_h_key";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_endpoints_check" CHECK ((holder_group_id <> scope_group_id)) not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_endpoints_check";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_existing_grant_id_fkey" FOREIGN KEY (existing_grant_id) REFERENCES public.group_right_grant(id) ON DELETE SET NULL not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_existing_grant_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_holder_group_id_fkey" FOREIGN KEY (holder_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_holder_group_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_initiator_group_id_fkey" FOREIGN KEY (initiator_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_initiator_group_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_operation_check" CHECK ((operation = ANY (ARRAY['upsert'::text, 'remove'::text]))) not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_operation_check";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_scope_group_id_fkey" FOREIGN KEY (scope_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_scope_group_id_fkey";

alter table "public"."group_right_grant_request" add constraint "group_right_grant_request_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."group_right_grant_request" validate constraint "group_right_grant_request_status_check";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_group_membership_id_fkey" FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source_lock" validate constraint "group_sibling_source_lock_group_membership_id_fkey";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_sibling_group_id_fkey" FOREIGN KEY (sibling_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source_lock" validate constraint "group_sibling_source_lock_sibling_group_id_fkey";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source_lock" validate constraint "group_sibling_source_lock_source_group_id_fkey";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."group_sibling_source_lock" validate constraint "group_sibling_source_lock_status_check";

alter table "public"."group_sibling_source_lock" add constraint "group_sibling_source_lock_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source_lock" validate constraint "group_sibling_source_lock_user_id_fkey";

alter table "public"."group_workflow" add constraint "group_workflow_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow" validate constraint "group_workflow_created_by_id_fkey";

alter table "public"."group_workflow" add constraint "group_workflow_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow" validate constraint "group_workflow_group_id_fkey";

alter table "public"."group_workflow" add constraint "group_workflow_start_group_id_fkey" FOREIGN KEY (start_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow" validate constraint "group_workflow_start_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_requested_by_group_id_fkey" FOREIGN KEY (requested_by_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_requested_by_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_workflow_id_fkey";

alter table "public"."group_workflow_step" add constraint "group_workflow_step_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_step" validate constraint "group_workflow_step_group_id_fkey";

alter table "public"."group_workflow_step" add constraint "group_workflow_step_target_workflow_id_fkey" FOREIGN KEY (target_workflow_id) REFERENCES public.group_workflow(id) ON DELETE SET NULL not valid;

alter table "public"."group_workflow_step" validate constraint "group_workflow_step_target_workflow_id_fkey";

alter table "public"."group_workflow_step" add constraint "group_workflow_step_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_step" validate constraint "group_workflow_step_workflow_id_fkey";

alter table "public"."indicative_candidate_selection" add constraint "indicative_candidate_selection_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_candidate_selection" validate constraint "indicative_candidate_selection_candidate_id_fkey";

alter table "public"."indicative_candidate_selection" add constraint "indicative_candidate_selection_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_candidate_selection" validate constraint "indicative_candidate_selection_election_id_fkey";

alter table "public"."indicative_candidate_selection" add constraint "indicative_candidate_selection_elector_participation_id_fkey" FOREIGN KEY (elector_participation_id) REFERENCES public.indicative_elector_participation(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_candidate_selection" validate constraint "indicative_candidate_selection_elector_participation_id_fkey";

alter table "public"."indicative_choice_decision" add constraint "indicative_choice_decision_choice_id_fkey" FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_choice_decision" validate constraint "indicative_choice_decision_choice_id_fkey";

alter table "public"."indicative_choice_decision" add constraint "indicative_choice_decision_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_choice_decision" validate constraint "indicative_choice_decision_vote_id_fkey";

alter table "public"."indicative_choice_decision" add constraint "indicative_choice_decision_voter_participation_id_fkey" FOREIGN KEY (voter_participation_id) REFERENCES public.indicative_voter_participation(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_choice_decision" validate constraint "indicative_choice_decision_voter_participation_id_fkey";

alter table "public"."indicative_elector_participation" add constraint "indicative_elector_participation_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_elector_participation" validate constraint "indicative_elector_participation_election_id_fkey";

alter table "public"."indicative_elector_participation" add constraint "indicative_elector_participation_election_id_user_id_key" UNIQUE using index "indicative_elector_participation_election_id_user_id_key";

alter table "public"."indicative_elector_participation" add constraint "indicative_elector_participation_elector_id_fkey" FOREIGN KEY (elector_id) REFERENCES public.elector(id) ON DELETE SET NULL not valid;

alter table "public"."indicative_elector_participation" validate constraint "indicative_elector_participation_elector_id_fkey";

alter table "public"."indicative_elector_participation" add constraint "indicative_elector_participation_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_elector_participation" validate constraint "indicative_elector_participation_user_id_fkey";

alter table "public"."indicative_voter_participation" add constraint "indicative_voter_participation_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_voter_participation" validate constraint "indicative_voter_participation_user_id_fkey";

alter table "public"."indicative_voter_participation" add constraint "indicative_voter_participation_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."indicative_voter_participation" validate constraint "indicative_voter_participation_vote_id_fkey";

alter table "public"."indicative_voter_participation" add constraint "indicative_voter_participation_vote_id_user_id_key" UNIQUE using index "indicative_voter_participation_vote_id_user_id_key";

alter table "public"."indicative_voter_participation" add constraint "indicative_voter_participation_voter_id_fkey" FOREIGN KEY (voter_id) REFERENCES public.voter(id) ON DELETE SET NULL not valid;

alter table "public"."indicative_voter_participation" validate constraint "indicative_voter_participation_voter_id_fkey";

alter table "public"."link" add constraint "link_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."link" validate constraint "link_event_id_fkey";

alter table "public"."message" add constraint "message_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE not valid;

alter table "public"."message" validate constraint "message_conversation_id_fkey";

alter table "public"."message" add constraint "message_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."message" validate constraint "message_sender_id_fkey";

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."newsletter_subscription" validate constraint "newsletter_subscription_language_check";

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_resend_contact_id_key" UNIQUE using index "newsletter_subscription_resend_contact_id_key";

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_sync_status_check" CHECK ((sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'unsubscribed'::text, 'error'::text, 'deleted'::text]))) not valid;

alter table "public"."newsletter_subscription" validate constraint "newsletter_subscription_sync_status_check";

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."newsletter_subscription" validate constraint "newsletter_subscription_user_id_fkey";

alter table "public"."newsletter_sync_outbox" add constraint "newsletter_sync_outbox_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."newsletter_sync_outbox" validate constraint "newsletter_sync_outbox_language_check";

alter table "public"."newsletter_sync_outbox" add constraint "newsletter_sync_outbox_operation_check" CHECK ((operation = ANY (ARRAY['upsert'::text, 'replace_email'::text, 'delete'::text]))) not valid;

alter table "public"."newsletter_sync_outbox" validate constraint "newsletter_sync_outbox_operation_check";

alter table "public"."newsletter_sync_outbox" add constraint "newsletter_sync_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."newsletter_sync_outbox" validate constraint "newsletter_sync_outbox_status_check";

alter table "public"."notification" add constraint "notification_deleted_by_user_id_fkey" FOREIGN KEY (deleted_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."notification" validate constraint "notification_deleted_by_user_id_fkey";

alter table "public"."notification" add constraint "notification_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."notification" validate constraint "notification_recipient_id_fkey";

alter table "public"."notification" add constraint "notification_recipient_target_consistency" CHECK (((recipient_entity_type IS NULL) OR ((recipient_entity_type = 'group'::text) AND (recipient_group_id = recipient_entity_id)) OR ((recipient_entity_type = 'event'::text) AND (recipient_event_id = recipient_entity_id)) OR ((recipient_entity_type = 'amendment'::text) AND (recipient_amendment_id = recipient_entity_id)) OR ((recipient_entity_type = 'blog'::text) AND (recipient_blog_id = recipient_entity_id)))) not valid;

alter table "public"."notification" validate constraint "notification_recipient_target_consistency";

alter table "public"."notification" add constraint "notification_recipient_target_shape" CHECK ((((recipient_id IS NOT NULL) AND (recipient_entity_type IS NULL) AND (recipient_entity_id IS NULL) AND (recipient_group_id IS NULL) AND (recipient_event_id IS NULL) AND (recipient_amendment_id IS NULL) AND (recipient_blog_id IS NULL)) OR ((recipient_id IS NULL) AND (recipient_entity_type = ANY (ARRAY['group'::text, 'event'::text, 'amendment'::text, 'blog'::text])) AND (recipient_entity_id IS NOT NULL) AND (num_nonnulls(recipient_group_id, recipient_event_id, recipient_amendment_id, recipient_blog_id) = 1)))) not valid;

alter table "public"."notification" validate constraint "notification_recipient_target_shape";

alter table "public"."notification" add constraint "notification_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."notification" validate constraint "notification_sender_id_fkey";

alter table "public"."notification" add constraint "notification_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."notification" validate constraint "notification_tutorial_run_id_fkey";

alter table "public"."notification_read" add constraint "notification_read_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE not valid;

alter table "public"."notification_read" validate constraint "notification_read_notification_id_fkey";

alter table "public"."notification_read" add constraint "notification_read_per_user_key" UNIQUE using index "notification_read_per_user_key";

alter table "public"."notification_read" add constraint "notification_read_read_by_user_id_fkey" FOREIGN KEY (read_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."notification_read" validate constraint "notification_read_read_by_user_id_fkey";

alter table "public"."notification_setting" add constraint "notification_setting_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."notification_setting" validate constraint "notification_setting_user_id_fkey";

alter table "public"."notification_setting" add constraint "notification_setting_user_id_key" UNIQUE using index "notification_setting_user_id_key";

alter table "public"."notification_user_state" add constraint "notification_user_state_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE not valid;

alter table "public"."notification_user_state" validate constraint "notification_user_state_notification_id_fkey";

alter table "public"."notification_user_state" add constraint "notification_user_state_order" CHECK (((purged_at IS NULL) OR (dismissed_at IS NOT NULL))) not valid;

alter table "public"."notification_user_state" validate constraint "notification_user_state_order";

alter table "public"."notification_user_state" add constraint "notification_user_state_per_user_key" UNIQUE using index "notification_user_state_per_user_key";

alter table "public"."notification_user_state" add constraint "notification_user_state_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."notification_user_state" validate constraint "notification_user_state_user_id_fkey";

alter table "public"."participant" add constraint "participant_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."participant" validate constraint "participant_event_id_fkey";

alter table "public"."participant" add constraint "participant_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."participant" validate constraint "participant_user_id_fkey";

alter table "public"."payment" add constraint "payment_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)) not valid;

alter table "public"."payment" validate constraint "payment_currency_check";

alter table "public"."payment" add constraint "payment_payer_user_id_fkey" FOREIGN KEY (payer_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."payment" validate constraint "payment_payer_user_id_fkey";

alter table "public"."payment" add constraint "payment_receiver_user_id_fkey" FOREIGN KEY (receiver_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."payment" validate constraint "payment_receiver_user_id_fkey";

alter table "public"."payment" add constraint "payment_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."payment" validate constraint "payment_tutorial_run_id_fkey";

alter table "public"."pql_filter" add constraint "pql_filter_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."pql_filter" validate constraint "pql_filter_group_id_fkey";

alter table "public"."pql_filter" add constraint "pql_filter_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."pql_filter" validate constraint "pql_filter_user_id_fkey";

alter table "public"."process_task" add constraint "process_task_agenda_item_fk" FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE SET NULL not valid;

alter table "public"."process_task" validate constraint "process_task_agenda_item_fk";

alter table "public"."process_task" add constraint "process_task_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE CASCADE not valid;

alter table "public"."process_task" validate constraint "process_task_branch_id_fkey";

alter table "public"."process_task" add constraint "process_task_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE SET NULL not valid;

alter table "public"."process_task" validate constraint "process_task_event_id_fkey";

alter table "public"."process_task" add constraint "process_task_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."process_task" validate constraint "process_task_group_id_fkey";

alter table "public"."process_task" add constraint "process_task_process_run_id_fkey" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE CASCADE not valid;

alter table "public"."process_task" validate constraint "process_task_process_run_id_fkey";

alter table "public"."process_task" add constraint "process_task_step_run_id_fkey" FOREIGN KEY (step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE CASCADE not valid;

alter table "public"."process_task" validate constraint "process_task_step_run_id_fkey";

alter table "public"."process_task" add constraint "process_task_support_confirmation_id_fkey" FOREIGN KEY (support_confirmation_id) REFERENCES public.support_confirmation(id) ON DELETE SET NULL not valid;

alter table "public"."process_task" validate constraint "process_task_support_confirmation_id_fkey";

alter table "public"."process_task" add constraint "process_task_target_group_id_fkey" FOREIGN KEY (target_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."process_task" validate constraint "process_task_target_group_id_fkey";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_kind_check" CHECK ((kind = ANY (ARRAY['notification'::text, 'test'::text]))) not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_kind_check";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_notification_id_fkey";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_notification_job_id_fkey" FOREIGN KEY (notification_job_id) REFERENCES public.push_notification_outbox(id) ON DELETE CASCADE not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_notification_job_id_fkey";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_push_subscription_id_fkey" FOREIGN KEY (push_subscription_id) REFERENCES public.push_subscription(id) ON DELETE SET NULL not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_push_subscription_id_fkey";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'skipped'::text, 'failed'::text]))) not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_status_check";

alter table "public"."push_delivery_outbox" add constraint "push_delivery_outbox_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."push_delivery_outbox" validate constraint "push_delivery_outbox_user_id_fkey";

alter table "public"."push_notification_outbox" add constraint "push_notification_outbox_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE not valid;

alter table "public"."push_notification_outbox" validate constraint "push_notification_outbox_notification_id_fkey";

alter table "public"."push_notification_outbox" add constraint "push_notification_outbox_notification_id_key" UNIQUE using index "push_notification_outbox_notification_id_key";

alter table "public"."push_notification_outbox" add constraint "push_notification_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."push_notification_outbox" validate constraint "push_notification_outbox_status_check";

alter table "public"."push_subscription" add constraint "push_subscription_endpoint_key" UNIQUE using index "push_subscription_endpoint_key";

alter table "public"."push_subscription" add constraint "push_subscription_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscription" validate constraint "push_subscription_user_id_fkey";

alter table "public"."reaction" add constraint "reaction_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."reaction" validate constraint "reaction_user_id_fkey";

alter table "public"."role" add constraint "role_assignee_kind_check" CHECK ((assignee_kind = ANY (ARRAY['member'::text, 'guest'::text]))) not valid;

alter table "public"."role" validate constraint "role_assignee_kind_check";

alter table "public"."role" add constraint "role_assignment_mode_check" CHECK ((assignment_mode = ANY (ARRAY['assigned'::text, 'elected'::text]))) not valid;

alter table "public"."role" validate constraint "role_assignment_mode_check";

alter table "public"."role" add constraint "role_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."role" validate constraint "role_group_id_fkey";

alter table "public"."role" add constraint "role_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))) not valid;

alter table "public"."role" validate constraint "role_visibility_check";

alter table "public"."role_holder_history" add constraint "role_holder_history_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."role_holder_history" validate constraint "role_holder_history_role_id_fkey";

alter table "public"."role_holder_history" add constraint "role_holder_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."role_holder_history" validate constraint "role_holder_history_user_id_fkey";

alter table "public"."search_document" add constraint "search_document_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."search_document" validate constraint "search_document_group_id_fkey";

alter table "public"."search_document" add constraint "search_document_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."search_document" validate constraint "search_document_owner_user_id_fkey";

alter table "public"."search_document" add constraint "search_document_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."search_document" validate constraint "search_document_tutorial_run_id_fkey";

alter table "public"."search_document_acl" add constraint "search_document_acl_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.search_document(id) ON DELETE CASCADE not valid;

alter table "public"."search_document_acl" validate constraint "search_document_acl_document_id_fkey";

alter table "public"."search_document_acl" add constraint "search_document_acl_document_id_user_id_key" UNIQUE using index "search_document_acl_document_id_user_id_key";

alter table "public"."search_document_acl" add constraint "search_document_acl_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."search_document_acl" validate constraint "search_document_acl_user_id_fkey";

alter table "public"."search_document_topic" add constraint "search_document_topic_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.search_document(id) ON DELETE CASCADE not valid;

alter table "public"."search_document_topic" validate constraint "search_document_topic_document_id_fkey";

alter table "public"."search_document_topic" add constraint "search_document_topic_document_id_topic_key" UNIQUE using index "search_document_topic_document_id_topic_key";

alter table "public"."speaker_list" add constraint "speaker_list_agenda_item_id_fkey" FOREIGN KEY (agenda_item_id) REFERENCES public.agenda_item(id) ON DELETE CASCADE not valid;

alter table "public"."speaker_list" validate constraint "speaker_list_agenda_item_id_fkey";

alter table "public"."speaker_list" add constraint "speaker_list_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."speaker_list" validate constraint "speaker_list_user_id_fkey";

alter table "public"."statement" add constraint "statement_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."statement" validate constraint "statement_group_id_fkey";

alter table "public"."statement" add constraint "statement_has_content_check" CHECK (((NULLIF(btrim(COALESCE(title, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(text, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(image_url, ''::text)), ''::text) IS NOT NULL) OR (NULLIF(btrim(COALESCE(video_url, ''::text)), ''::text) IS NOT NULL))) not valid;

alter table "public"."statement" validate constraint "statement_has_content_check";

alter table "public"."statement" add constraint "statement_media_type_check" CHECK ((media_type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text]))) not valid;

alter table "public"."statement" validate constraint "statement_media_type_check";

alter table "public"."statement" add constraint "statement_single_primary_media_check" CHECK (((image_url IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."statement" validate constraint "statement_single_primary_media_check";

alter table "public"."statement" add constraint "statement_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."statement" validate constraint "statement_tutorial_run_id_fkey";

alter table "public"."statement" add constraint "statement_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."statement" validate constraint "statement_user_id_fkey";

alter table "public"."statement_hashtag" add constraint "statement_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."statement_hashtag" validate constraint "statement_hashtag_hashtag_id_fkey";

alter table "public"."statement_hashtag" add constraint "statement_hashtag_statement_id_fkey" FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE not valid;

alter table "public"."statement_hashtag" validate constraint "statement_hashtag_statement_id_fkey";

alter table "public"."statement_hashtag" add constraint "statement_hashtag_statement_id_hashtag_id_key" UNIQUE using index "statement_hashtag_statement_id_hashtag_id_key";

alter table "public"."statement_support_vote" add constraint "statement_support_vote_statement_id_fkey" FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE not valid;

alter table "public"."statement_support_vote" validate constraint "statement_support_vote_statement_id_fkey";

alter table "public"."statement_support_vote" add constraint "statement_support_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."statement_support_vote" validate constraint "statement_support_vote_user_id_fkey";

alter table "public"."statement_survey" add constraint "statement_survey_statement_id_fkey" FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE not valid;

alter table "public"."statement_survey" validate constraint "statement_survey_statement_id_fkey";

alter table "public"."statement_survey" add constraint "statement_survey_statement_id_key" UNIQUE using index "statement_survey_statement_id_key";

alter table "public"."statement_survey_option" add constraint "statement_survey_option_survey_id_fkey" FOREIGN KEY (survey_id) REFERENCES public.statement_survey(id) ON DELETE CASCADE not valid;

alter table "public"."statement_survey_option" validate constraint "statement_survey_option_survey_id_fkey";

alter table "public"."statement_survey_vote" add constraint "statement_survey_vote_option_id_fkey" FOREIGN KEY (option_id) REFERENCES public.statement_survey_option(id) ON DELETE CASCADE not valid;

alter table "public"."statement_survey_vote" validate constraint "statement_survey_vote_option_id_fkey";

alter table "public"."statement_survey_vote" add constraint "statement_survey_vote_option_id_user_id_key" UNIQUE using index "statement_survey_vote_option_id_user_id_key";

alter table "public"."statement_survey_vote" add constraint "statement_survey_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."statement_survey_vote" validate constraint "statement_survey_vote_user_id_fkey";

alter table "public"."stripe_customer" add constraint "stripe_customer_stripe_customer_id_key" UNIQUE using index "stripe_customer_stripe_customer_id_key";

alter table "public"."stripe_customer" add constraint "stripe_customer_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."stripe_customer" validate constraint "stripe_customer_user_id_fkey";

alter table "public"."stripe_customer" add constraint "stripe_customer_user_id_key" UNIQUE using index "stripe_customer_user_id_key";

alter table "public"."stripe_payment" add constraint "stripe_payment_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.stripe_customer(id) ON DELETE CASCADE not valid;

alter table "public"."stripe_payment" validate constraint "stripe_payment_customer_id_fkey";

alter table "public"."stripe_payment" add constraint "stripe_payment_stripe_invoice_id_key" UNIQUE using index "stripe_payment_stripe_invoice_id_key";

alter table "public"."stripe_subscription" add constraint "stripe_subscription_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.stripe_customer(id) ON DELETE CASCADE not valid;

alter table "public"."stripe_subscription" validate constraint "stripe_subscription_customer_id_fkey";

alter table "public"."stripe_subscription" add constraint "stripe_subscription_stripe_subscription_id_key" UNIQUE using index "stripe_subscription_stripe_subscription_id_key";

alter table "public"."subscriber" add constraint "subscriber_subscriber_id_fkey" FOREIGN KEY (subscriber_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."subscriber" validate constraint "subscriber_subscriber_id_fkey";

alter table "public"."support_confirmation" add constraint "support_confirmation_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."support_confirmation" validate constraint "support_confirmation_amendment_id_fkey";

alter table "public"."support_confirmation" add constraint "support_confirmation_confirmed_by_id_fkey" FOREIGN KEY (confirmed_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."support_confirmation" validate constraint "support_confirmation_confirmed_by_id_fkey";

alter table "public"."support_confirmation" add constraint "support_confirmation_process_run_fk" FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run(id) ON DELETE SET NULL not valid;

alter table "public"."support_confirmation" validate constraint "support_confirmation_process_run_fk";

alter table "public"."support_confirmation" add constraint "support_confirmation_process_step_run_fk" FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run(id) ON DELETE SET NULL not valid;

alter table "public"."support_confirmation" validate constraint "support_confirmation_process_step_run_fk";

alter table "public"."support_confirmation" add constraint "support_confirmation_process_task_fk" FOREIGN KEY (process_task_id) REFERENCES public.process_task(id) ON DELETE SET NULL not valid;

alter table "public"."support_confirmation" validate constraint "support_confirmation_process_task_fk";

alter table "public"."thread" add constraint "thread_blog_id_fkey" FOREIGN KEY (blog_id) REFERENCES public.blog(id) ON DELETE CASCADE not valid;

alter table "public"."thread" validate constraint "thread_blog_id_fkey";

alter table "public"."thread" add constraint "thread_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE not valid;

alter table "public"."thread" validate constraint "thread_document_id_fkey";

alter table "public"."thread" add constraint "thread_statement_id_fkey" FOREIGN KEY (statement_id) REFERENCES public.statement(id) ON DELETE CASCADE not valid;

alter table "public"."thread" validate constraint "thread_statement_id_fkey";

alter table "public"."thread" add constraint "thread_todo_id_fkey" FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE not valid;

alter table "public"."thread" validate constraint "thread_todo_id_fkey";

alter table "public"."thread" add constraint "thread_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."thread" validate constraint "thread_user_id_fkey";

alter table "public"."thread_vote" add constraint "thread_vote_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON DELETE CASCADE not valid;

alter table "public"."thread_vote" validate constraint "thread_vote_thread_id_fkey";

alter table "public"."thread_vote" add constraint "thread_vote_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."thread_vote" validate constraint "thread_vote_user_id_fkey";

alter table "public"."todo" add constraint "todo_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."todo" validate constraint "todo_creator_id_fkey";

alter table "public"."todo" add constraint "todo_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."todo" validate constraint "todo_tutorial_run_id_fkey";

alter table "public"."todo_assignment" add constraint "todo_assignment_todo_id_fkey" FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE not valid;

alter table "public"."todo_assignment" validate constraint "todo_assignment_todo_id_fkey";

alter table "public"."todo_assignment" add constraint "todo_assignment_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."todo_assignment" validate constraint "todo_assignment_user_id_fkey";

alter table "public"."user" add constraint "user_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'diverse'::text]))) not valid;

alter table "public"."user" validate constraint "user_gender_check";

alter table "public"."user" add constraint "user_single_primary_media_check" CHECK (((avatar IS NULL) OR (video_url IS NULL))) not valid;

alter table "public"."user" validate constraint "user_single_primary_media_check";

alter table "public"."user" add constraint "user_tutorial_run_id_fkey" FOREIGN KEY (tutorial_run_id) REFERENCES public.app_tutorial_run(id) ON DELETE CASCADE not valid;

alter table "public"."user" validate constraint "user_tutorial_run_id_fkey";

alter table "public"."user_hashtag" add constraint "user_hashtag_hashtag_id_fkey" FOREIGN KEY (hashtag_id) REFERENCES public.hashtag(id) ON DELETE CASCADE not valid;

alter table "public"."user_hashtag" validate constraint "user_hashtag_hashtag_id_fkey";

alter table "public"."user_hashtag" add constraint "user_hashtag_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."user_hashtag" validate constraint "user_hashtag_user_id_fkey";

alter table "public"."user_hashtag" add constraint "user_hashtag_user_id_hashtag_id_key" UNIQUE using index "user_hashtag_user_id_hashtag_id_key";

alter table "public"."user_preference" add constraint "user_preference_appearance_theme_id_fkey" FOREIGN KEY (appearance_theme_id) REFERENCES public.appearance_theme(id) ON DELETE SET NULL not valid;

alter table "public"."user_preference" validate constraint "user_preference_appearance_theme_id_fkey";

alter table "public"."user_preference" add constraint "user_preference_display_currency_check" CHECK ((display_currency ~ '^[A-Z]{3}$'::text)) not valid;

alter table "public"."user_preference" validate constraint "user_preference_display_currency_check";

alter table "public"."user_preference" add constraint "user_preference_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."user_preference" validate constraint "user_preference_language_check";

alter table "public"."user_preference" add constraint "user_preference_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."user_preference" validate constraint "user_preference_user_id_fkey";

alter table "public"."user_preference" add constraint "user_preference_user_id_key" UNIQUE using index "user_preference_user_id_key";

alter table "public"."vote" add constraint "vote_ballot_visibility_check" CHECK ((ballot_visibility = ANY (ARRAY['named'::text, 'secret'::text]))) not valid;

alter table "public"."vote" validate constraint "vote_ballot_visibility_check";

alter table "public"."vote" add constraint "vote_closed_by_id_fkey" FOREIGN KEY (closed_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."vote" validate constraint "vote_closed_by_id_fkey";

alter table "public"."vote" add constraint "vote_offline_electorate_size_check" CHECK ((offline_electorate_size >= 0)) not valid;

alter table "public"."vote" validate constraint "vote_offline_electorate_size_check";

alter table "public"."vote" add constraint "vote_purpose_check" CHECK ((purpose = ANY (ARRAY['change_request'::text, 'closing'::text, 'merge_variant'::text]))) not valid;

alter table "public"."vote" validate constraint "vote_purpose_check";

alter table "public"."vote" add constraint "vote_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'internal'::text, 'indicative'::text, 'final'::text, 'closed'::text]))) not valid;

alter table "public"."vote" validate constraint "vote_status_check";

alter table "public"."vote_choice" add constraint "vote_choice_process_branch_id_fkey" FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch(id) ON DELETE SET NULL not valid;

alter table "public"."vote_choice" validate constraint "vote_choice_process_branch_id_fkey";

alter table "public"."vote_choice" add constraint "vote_choice_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."vote_choice" validate constraint "vote_choice_vote_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_choice_id_fkey" FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_choice_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_count_check" CHECK ((count >= 0)) not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_count_check";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_phase_check" CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))) not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_phase_check";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_updated_by_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_vote_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_vote_id_phase_choice_id_key" UNIQUE using index "vote_offline_tally_vote_id_phase_choice_id_key";

alter table "public"."voter" add constraint "voter_participation_channel_check" CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))) not valid;

alter table "public"."voter" validate constraint "voter_participation_channel_check";

alter table "public"."voter" add constraint "voter_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."voter" validate constraint "voter_user_id_fkey";

alter table "public"."voter" add constraint "voter_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."voter" validate constraint "voter_vote_id_fkey";

alter table "public"."voter" add constraint "voter_vote_id_user_id_key" UNIQUE using index "voter_vote_id_user_id_key";

alter table "public"."voting_password" add constraint "voting_password_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."voting_password" validate constraint "voting_password_user_id_fkey";

alter table "public"."voting_password" add constraint "voting_password_user_id_key" UNIQUE using index "voting_password_user_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.amendment_supporting_group_count(target_amendment_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(*)::INTEGER
  FROM public.amendment_group_decision decision
  LEFT JOIN LATERAL (
    SELECT confirmation.status
    FROM public.support_confirmation confirmation
    WHERE confirmation.amendment_id = decision.amendment_id
      AND confirmation.group_id = decision.group_id
    ORDER BY confirmation.created_at DESC, confirmation.id DESC
    LIMIT 1
  ) latest_confirmation ON true
  WHERE decision.amendment_id = target_amendment_id
    AND decision.status IN ('supported', 'accepted')
    AND coalesce(latest_confirmation.status, '') NOT IN ('declined', 'withdrawn');
$function$
;

CREATE OR REPLACE FUNCTION public.claim_newsletter_sync_jobs(job_limit integer DEFAULT 100)
 RETURNS SETOF public.newsletter_sync_outbox
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH candidates AS (
    SELECT id
    FROM public.newsletter_sync_outbox
    WHERE (
      status IN ('pending', 'failed') AND available_at <= now()
    ) OR (
      status = 'processing' AND locked_at < now() - INTERVAL '10 minutes'
    )
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(job_limit, 1), 100)
  )
  UPDATE public.newsletter_sync_outbox AS job
    SET status = 'processing',
        attempt_count = job.attempt_count + 1,
        locked_at = now(),
        updated_at = now()
    FROM candidates
    WHERE job.id = candidates.id
    RETURNING job.*;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_push_delivery_jobs(job_limit integer DEFAULT 100, notification_filter uuid DEFAULT NULL::uuid, delivery_filter bigint DEFAULT NULL::bigint)
 RETURNS SETOF public.push_delivery_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.push_delivery_outbox
  SET status = 'pending',
      locked_at = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - INTERVAL '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.push_delivery_outbox job
    WHERE job.status = 'pending'
      AND job.available_at <= now()
      AND (notification_filter IS NULL OR job.notification_id = notification_filter)
      AND (delivery_filter IS NULL OR job.id = delivery_filter)
    ORDER BY job.available_at, job.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(job_limit, 1), 100)
  )
  UPDATE public.push_delivery_outbox job
  SET status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_push_notification_jobs(job_limit integer DEFAULT 100, notification_filter uuid DEFAULT NULL::uuid)
 RETURNS SETOF public.push_notification_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.push_notification_outbox
  SET status = 'pending',
      locked_at = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - INTERVAL '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.push_notification_outbox job
    WHERE job.status = 'pending'
      AND job.available_at <= now()
      AND (notification_filter IS NULL OR job.notification_id = notification_filter)
    ORDER BY job.available_at, job.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(job_limit, 1), 100)
  )
  UPDATE public.push_notification_outbox job
  SET status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_app_tutorial_runs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.amendment_process_run process_run
  USING public.amendment amendment, public.app_tutorial_run tutorial_run
  WHERE process_run.amendment_id = amendment.id
    AND amendment.tutorial_run_id = tutorial_run.id
    AND tutorial_run.expires_at <= now();

  DELETE FROM public.app_tutorial_run
  WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_has_password()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (
      SELECT NULLIF(u.encrypted_password, '') IS NOT NULL
      FROM auth.users AS u
      WHERE u.id = auth.uid()
    ),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_direct_push_delivery(target_user_id uuid, target_dedupe_key text, target_payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.push_delivery_outbox (
    notification_id,
    user_id,
    push_subscription_id,
    kind,
    dedupe_key,
    payload
  )
  SELECT
    NULL,
    target_user_id,
    subscription.id,
    'notification',
    target_dedupe_key,
    target_payload
  FROM public.push_subscription subscription
  WHERE subscription.user_id = target_user_id
    AND subscription.auth IS NOT NULL
    AND subscription.p256dh IS NOT NULL
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_newsletter_subscription(target_user_id uuid, target_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
  target_language TEXT;
BEGIN
  SELECT CASE WHEN preference.language IN ('de', 'en') THEN preference.language ELSE 'en' END
    INTO target_language
    FROM public.user_preference AS preference
    WHERE preference.user_id = target_user_id;

  target_language := COALESCE(target_language, 'en');

  INSERT INTO public.newsletter_subscription (user_id, email, language)
  VALUES (target_user_id, target_email, target_language)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        language = excluded.language,
        updated_at = now()
  RETURNING * INTO current_subscription;

  INSERT INTO public.newsletter_sync_outbox (
    user_id,
    operation,
    email,
    resend_contact_id,
    language,
    subscribed
  ) VALUES (
    target_user_id,
    'upsert',
    target_email,
    current_subscription.resend_contact_id,
    current_subscription.language,
    current_subscription.subscribed
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.push_notification_outbox (notification_id)
  VALUES (NEW.id)
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_aria_kai_user()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  assistant_user_id CONSTANT UUID :=
    'a12a0000-0000-4000-a000-000000000001'::UUID;
BEGIN
  INSERT INTO public."user" (
    id,
    email,
    handle,
    first_name,
    last_name,
    bio,
    visibility
  )
  VALUES (
    assistant_user_id,
    'aria-kai-assistants@polity.com',
    'aria-kai',
    'Assistent Aria',
    '& Kai',
    'Assistent Aria & Kai helps you navigate Polity.',
    'public'
  )
  ON CONFLICT (id) DO UPDATE
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      bio = EXCLUDED.bio;

  INSERT INTO public.notification_setting (user_id)
  VALUES (assistant_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preference (user_id)
  VALUES (assistant_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN assistant_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_assistant_conversation(target_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  assistant_user_id UUID;
  assistant_conversation_id UUID;
  welcome_message CONSTANT TEXT := 'Hey! Assistent Aria & Kai is here to help you navigate Polity. How can I help?';
BEGIN
  assistant_user_id := public.ensure_aria_kai_user();

  SELECT id
  INTO assistant_conversation_id
  FROM public.conversation
  WHERE assistant_for_user_id = target_user_id
  LIMIT 1;

  IF assistant_conversation_id IS NULL THEN
    INSERT INTO public.conversation (
      type,
      name,
      status,
      last_message_at,
      assistant_for_user_id,
      requested_by_id
    )
    VALUES (
      'direct',
      'Assistent Aria & Kai',
      'accepted',
      now(),
      target_user_id,
      assistant_user_id
    )
    RETURNING id INTO assistant_conversation_id;
  ELSE
    UPDATE public.conversation
    SET name = 'Assistent Aria & Kai'
    WHERE id = assistant_conversation_id;
  END IF;

  INSERT INTO public.conversation_participant (
    conversation_id,
    user_id,
    joined_at,
    last_read_at,
    left_at
  )
  VALUES (
    assistant_conversation_id,
    target_user_id,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.conversation_participant (
    conversation_id,
    user_id,
    joined_at,
    last_read_at,
    left_at
  )
  VALUES (
    assistant_conversation_id,
    assistant_user_id,
    now(),
    now(),
    NULL
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.message
    WHERE conversation_id = assistant_conversation_id
      AND sender_id = assistant_user_id
  ) THEN
    INSERT INTO public.message (
      conversation_id,
      sender_id,
      content,
      is_read,
      created_at,
      updated_at,
      deleted_at
    )
    VALUES (
      assistant_conversation_id,
      assistant_user_id,
      welcome_message,
      false,
      now(),
      now(),
      NULL
    );
  END IF;

  UPDATE public.conversation
  SET last_message_at = COALESCE(
    (
      SELECT MAX(created_at)
      FROM public.message
      WHERE conversation_id = assistant_conversation_id
    ),
    last_message_at,
    now()
  )
  WHERE id = assistant_conversation_id;

  RETURN assistant_conversation_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_todo_discussion_thread()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.thread (
    id,
    todo_id,
    user_id,
    content,
    status,
    upvotes,
    downvotes,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.creator_id,
    NULL,
    'open',
    0,
    0,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (todo_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expand_push_notification_job(target_job_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.push_delivery_outbox (
    notification_job_id,
    notification_id,
    user_id,
    push_subscription_id,
    dedupe_key,
    payload
  )
  SELECT
    job.id,
    notification.id,
    recipient.user_id,
    subscription.id,
    md5(concat_ws(
      '|',
      notification.type,
      notification.sender_id,
      notification.action_url,
      notification.related_user_id,
      notification.related_group_id,
      notification.related_event_id,
      notification.related_amendment_id,
      notification.related_blog_id,
      notification.title,
      notification.message,
      date_trunc('minute', notification.created_at)
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'title', COALESCE(notification.title, 'Polity'),
      'message', COALESCE(notification.message, ''),
      'body', COALESCE(notification.message, ''),
      'actionUrl', notification.action_url,
      'notificationId', notification.id,
      'type', notification.type,
      'icon', '/android-chrome-192x192.png',
      'badge', '/favicon-32x32.png',
      'tag', notification.id,
      'requireInteraction', false,
      'foregroundBehavior', 'toast'
    ))
  FROM public.push_notification_outbox job
  JOIN public.notification notification
    ON notification.id = job.notification_id
  CROSS JOIN LATERAL public.resolve_notification_recipients(notification.id) recipient
  JOIN public.push_subscription subscription
    ON subscription.user_id = recipient.user_id
   AND subscription.auth IS NOT NULL
   AND subscription.p256dh IS NOT NULL
  WHERE job.id = target_job_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.push_notification_outbox
  SET status = 'completed',
      completed_at = now(),
      locked_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = target_job_id;

  RETURN inserted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_newsletter_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
      PERFORM public.enqueue_newsletter_subscription(NEW.id, NEW.email);
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.email_confirmed_at IS NULL
    AND NEW.email_confirmed_at IS NOT NULL
    AND NEW.email IS NOT NULL THEN
    PERFORM public.enqueue_newsletter_subscription(NEW.id, NEW.email);
    RETURN NEW;
  END IF;

  IF NEW.email_confirmed_at IS NOT NULL
    AND NEW.email IS NOT NULL
    AND NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT * INTO current_subscription
      FROM public.newsletter_subscription
      WHERE user_id = NEW.id;

    IF FOUND THEN
      UPDATE public.newsletter_subscription
        SET email = NEW.email,
            resend_contact_id = NULL,
            sync_status = 'pending',
            last_error = NULL,
            updated_at = now()
        WHERE user_id = NEW.id;

      INSERT INTO public.newsletter_sync_outbox (
        user_id,
        operation,
        email,
        previous_email,
        resend_contact_id,
        language,
        subscribed
      ) VALUES (
        NEW.id,
        'replace_email',
        NEW.email,
        OLD.email,
        current_subscription.resend_contact_id,
        current_subscription.language,
        current_subscription.subscribed
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_newsletter_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  SELECT * INTO current_subscription
    FROM public.newsletter_subscription
    WHERE user_id = OLD.id;

  IF FOUND THEN
    INSERT INTO public.newsletter_sync_outbox (
      user_id,
      operation,
      email,
      resend_contact_id,
      language,
      subscribed
    ) VALUES (
      OLD.id,
      'delete',
      current_subscription.email,
      current_subscription.resend_contact_id,
      current_subscription.language,
      current_subscription.subscribed
    );
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public."user" (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.notification_setting (user_id)
  VALUES (NEW.id);

  INSERT INTO public.user_preference (user_id, language)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data->>'language' IN ('de', 'en')
        THEN NEW.raw_user_meta_data->>'language'
      ELSE 'en'
    END
  );

  PERFORM public.ensure_assistant_conversation(NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_newsletter_language_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_language TEXT;
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  IF NEW.language IS NOT DISTINCT FROM OLD.language THEN
    RETURN NEW;
  END IF;

  normalized_language := CASE WHEN NEW.language IN ('de', 'en') THEN NEW.language ELSE 'en' END;

  UPDATE public.newsletter_subscription
    SET language = normalized_language,
        sync_status = 'pending',
        last_error = NULL,
        updated_at = now()
    WHERE user_id = NEW.user_id
    RETURNING * INTO current_subscription;

  IF FOUND THEN
    INSERT INTO public.newsletter_sync_outbox (
      user_id,
      operation,
      email,
      resend_contact_id,
      language,
      subscribed
    ) VALUES (
      current_subscription.user_id,
      'upsert',
      current_subscription.email,
      current_subscription.resend_contact_id,
      current_subscription.language,
      current_subscription.subscribed
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.populate_search_document_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  direct_latitude DOUBLE PRECISION;
  direct_longitude DOUBLE PRECISION;
  direct_label TEXT;
  direct_source TEXT;
  direct_kind TEXT;
  direct_place_id TEXT;
  direct_boundary_source TEXT;
  direct_geometry JSONB;
  direct_bounds JSONB;
  group_latitude DOUBLE PRECISION;
  group_longitude DOUBLE PRECISION;
  group_label TEXT;
  group_kind TEXT;
  group_place_id TEXT;
  group_boundary_source TEXT;
  group_geometry JSONB;
  group_bounds JSONB;
  owner_latitude DOUBLE PRECISION;
  owner_longitude DOUBLE PRECISION;
  owner_label TEXT;
  owner_kind TEXT;
  owner_place_id TEXT;
  owner_boundary_source TEXT;
  owner_geometry JSONB;
  owner_bounds JSONB;
  resolved_group_id UUID;
  resolved_owner_user_id UUID;
BEGIN
  resolved_group_id := NEW.group_id;
  resolved_owner_user_id := NEW.owner_user_id;

  IF NEW.entity_type = 'user' THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number),
      u.location_kind,
      u.location_place_id,
      u.location_boundary_source,
      u.location_geometry,
      u.location_bounds
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds
    FROM public."user" AS u
    WHERE u.id = NEW.entity_id;

    direct_source := 'user';
    resolved_owner_user_id := coalesce(resolved_owner_user_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'group' THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number),
      g.location_kind,
      g.location_place_id,
      g.location_boundary_source,
      g.location_geometry,
      g.location_bounds,
      g.owner_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_owner_user_id
    FROM public."group" AS g
    WHERE g.id = NEW.entity_id;

    direct_source := 'group';
    resolved_group_id := coalesce(resolved_group_id, NEW.entity_id);
  ELSIF NEW.entity_type = 'event' THEN
    SELECT
      e.latitude,
      e.longitude,
      public.search_document_format_location(e.location_name, e.country, e.region, e.post_code, e.city, e.street, e.house_number),
      e.location_kind,
      e.location_place_id,
      e.location_boundary_source,
      e.location_geometry,
      e.location_bounds,
      e.group_id,
      e.creator_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_group_id, resolved_owner_user_id
    FROM public.event AS e
    WHERE e.id = NEW.entity_id;

    direct_source := 'event';
  ELSIF NEW.entity_type = 'amendment' THEN
    SELECT
      a.latitude,
      a.longitude,
      public.search_document_format_location(NULL, a.country, a.region, a.post_code, a.city, a.street, a.house_number),
      a.location_kind,
      a.location_place_id,
      a.location_boundary_source,
      a.location_geometry,
      a.location_bounds,
      a.group_id,
      a.created_by_id
    INTO direct_latitude, direct_longitude, direct_label, direct_kind, direct_place_id, direct_boundary_source, direct_geometry, direct_bounds, resolved_group_id, resolved_owner_user_id
    FROM public.amendment AS a
    WHERE a.id = NEW.entity_id;

    direct_source := 'amendment';
  ELSIF NEW.entity_type = 'blog' AND resolved_owner_user_id IS NULL THEN
    SELECT bb.user_id
    INTO resolved_owner_user_id
    FROM public.blog_blogger AS bb
    WHERE bb.blog_id = NEW.entity_id
    ORDER BY bb.created_at ASC
    LIMIT 1;
  END IF;

  NEW.group_id := resolved_group_id;
  NEW.owner_user_id := resolved_owner_user_id;

  IF direct_latitude IS NOT NULL AND direct_longitude IS NOT NULL THEN
    NEW.location_latitude := direct_latitude;
    NEW.location_longitude := direct_longitude;
    NEW.location_label := direct_label;
    NEW.location_source := coalesce(direct_source, 'own');
    NEW.location_kind := direct_kind;
    NEW.location_place_id := direct_place_id;
    NEW.location_boundary_source := direct_boundary_source;
    NEW.location_geometry := direct_geometry;
    NEW.location_bounds := direct_bounds;
    RETURN NEW;
  END IF;

  IF NEW.location_latitude IS NOT NULL AND NEW.location_longitude IS NOT NULL THEN
    NEW.location_source := coalesce(NEW.location_source, direct_source, 'document');
    RETURN NEW;
  END IF;

  IF resolved_group_id IS NOT NULL THEN
    SELECT
      g.latitude,
      g.longitude,
      public.search_document_format_location(NULL, g.country, g.region, g.post_code, g.city, g.street, g.house_number),
      g.location_kind,
      g.location_place_id,
      g.location_boundary_source,
      g.location_geometry,
      g.location_bounds
    INTO group_latitude, group_longitude, group_label, group_kind, group_place_id, group_boundary_source, group_geometry, group_bounds
    FROM public."group" AS g
    WHERE g.id = resolved_group_id;

    IF group_latitude IS NOT NULL AND group_longitude IS NOT NULL THEN
      NEW.location_latitude := group_latitude;
      NEW.location_longitude := group_longitude;
      NEW.location_label := group_label;
      NEW.location_source := 'group';
      NEW.location_kind := group_kind;
      NEW.location_place_id := group_place_id;
      NEW.location_boundary_source := group_boundary_source;
      NEW.location_geometry := group_geometry;
      NEW.location_bounds := group_bounds;
      RETURN NEW;
    END IF;
  END IF;

  IF resolved_owner_user_id IS NOT NULL THEN
    SELECT
      u.latitude,
      u.longitude,
      public.search_document_format_location(NULL, u.country, u.region, u.post_code, u.city, u.street, u.house_number),
      u.location_kind,
      u.location_place_id,
      u.location_boundary_source,
      u.location_geometry,
      u.location_bounds
    INTO owner_latitude, owner_longitude, owner_label, owner_kind, owner_place_id, owner_boundary_source, owner_geometry, owner_bounds
    FROM public."user" AS u
    WHERE u.id = resolved_owner_user_id;

    IF owner_latitude IS NOT NULL AND owner_longitude IS NOT NULL THEN
      NEW.location_latitude := owner_latitude;
      NEW.location_longitude := owner_longitude;
      NEW.location_label := owner_label;
      NEW.location_source := 'owner';
      NEW.location_kind := owner_kind;
      NEW.location_place_id := owner_place_id;
      NEW.location_boundary_source := owner_boundary_source;
      NEW.location_geometry := owner_geometry;
      NEW.location_bounds := owner_bounds;
      RETURN NEW;
    END IF;
  END IF;

  NEW.location_latitude := NULL;
  NEW.location_longitude := NULL;
  NEW.location_label := NULL;
  NEW.location_source := NULL;
  NEW.location_kind := NULL;
  NEW.location_place_id := NULL;
  NEW.location_boundary_source := NULL;
  NEW.location_geometry := NULL;
  NEW.location_bounds := NULL;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_expired_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  removed_count INTEGER;
BEGIN
  DELETE FROM public.notification
  WHERE deleted_at < now() - INTERVAL '30 days'
     OR (
       recipient_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.notification_user_state state
         WHERE state.notification_id = notification.id
           AND state.user_id = notification.recipient_id
           AND state.purged_at < now() - INTERVAL '30 days'
       )
     );
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document(target_amendment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  amendment_row public.amendment%ROWTYPE;
  supporting_group_count INTEGER;
  net_user_votes INTEGER;
BEGIN
  SELECT *
  INTO amendment_row
  FROM public.amendment
  WHERE id = target_amendment_id;

  IF NOT FOUND THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('amendment', target_amendment_id);
    RETURN;
  END IF;

  supporting_group_count := public.amendment_supporting_group_count(amendment_row.id);
  net_user_votes := coalesce(amendment_row.upvotes, 0) - coalesce(amendment_row.downvotes, 0);

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('amendment', amendment_row.id),
    'amendment',
    amendment_row.id,
    coalesce(nullif(amendment_row.title, ''), nullif(amendment_row.code, ''), 'Amendment'),
    amendment_row.code,
    coalesce(amendment_row.reason, amendment_row.preamble),
    concat_ws(
      ' ',
      amendment_row.code,
      amendment_row.title,
      amendment_row.reason,
      amendment_row.preamble,
      amendment_row.category,
      amendment_row.country,
      amendment_row.region,
      amendment_row.post_code,
      amendment_row.city,
      amendment_row.street,
      amendment_row.house_number
    ),
    coalesce(amendment_row.visibility, 'public'),
    amendment_row.created_by_id,
    amendment_row.group_id,
    amendment_row.image_url,
    jsonb_build_object(
      'type', 'amendment',
      'code', amendment_row.code,
      'location', public.search_document_format_location(
        NULL,
        amendment_row.country,
        amendment_row.region,
        amendment_row.post_code,
        amendment_row.city,
        amendment_row.street,
        amendment_row.house_number
      ),
      'status', (
        SELECT branch.editing_mode
        FROM public.amendment_process_branch branch
        WHERE branch.process_run_id = amendment_row.current_process_run_id
        ORDER BY branch.created_at ASC, branch.id ASC
        LIMIT 1
      ),
      'branch_statuses', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'branch_id', branch.id,
            'label', coalesce(branch.title, 'Branch'),
            'editing_mode', branch.editing_mode,
            'process_status', branch.status,
            'resolution', branch.resolution
          )
          ORDER BY branch.created_at ASC, branch.id ASC
        )
        FROM public.amendment_process_branch branch
        WHERE branch.process_run_id = amendment_row.current_process_run_id
      ), '[]'::jsonb),
      'entity_id', amendment_row.id,
      'metadata', jsonb_build_object('event_id', amendment_row.event_id),
      'stats', jsonb_build_object(
        'upvotes', amendment_row.upvotes,
        'downvotes', amendment_row.downvotes,
        'supporting_groups', supporting_group_count,
        'comments', amendment_row.comment_count,
        'subscribers', amendment_row.subscriber_count,
        'collaborators', amendment_row.collaborator_count
      )
    ),
    amendment_row.created_at,
    amendment_row.updated_at,
    net_user_votes + supporting_group_count + coalesce(amendment_row.comment_count, 0),
    net_user_votes + supporting_group_count
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score,
    location_latitude = EXCLUDED.location_latitude,
    location_longitude = EXCLUDED.location_longitude,
    location_label = EXCLUDED.location_label,
    location_source = EXCLUDED.location_source,
    location_kind = EXCLUDED.location_kind,
    location_place_id = EXCLUDED.location_place_id,
    location_boundary_source = EXCLUDED.location_boundary_source,
    location_geometry = EXCLUDED.location_geometry,
    location_bounds = EXCLUDED.location_bounds;

  PERFORM public.sync_amendment_search_document_topics(amendment_row.id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document_from_support()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_amendment_id UUID;
BEGIN
  target_amendment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.amendment_id ELSE NEW.amendment_id END;

  IF TG_OP = 'UPDATE' AND OLD.amendment_id IS DISTINCT FROM NEW.amendment_id THEN
    PERFORM public.refresh_amendment_search_document(OLD.amendment_id);
  END IF;

  IF target_amendment_id IS NOT NULL THEN
    PERFORM public.refresh_amendment_search_document(target_amendment_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_amendment_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_amendment_search_document_topics(OLD.amendment_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_amendment_search_document_topics(NEW.amendment_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_blog_search_document_from_blogger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_blog_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_blog_id := OLD.blog_id;
  ELSE
    target_blog_id := NEW.blog_id;
  END IF;

  UPDATE public.search_document
  SET updated_at = updated_at
  WHERE id = public.search_document_id('blog', target_blog_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_blog_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_blog_search_document_topics(OLD.blog_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_blog_search_document_topics(NEW.blog_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups(target_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  latest RECORD;
BEGIN
  SELECT id, created_at, content
  INTO latest
  FROM public.message
  WHERE conversation_id = target_conversation_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  UPDATE public.conversation
  SET
    last_message_id = latest.id,
    last_message_at = latest.created_at,
    last_message_preview = left(coalesce(latest.content, ''), 240)
  WHERE id = target_conversation_id;

  UPDATE public.conversation_participant AS cp
  SET unread_count = coalesce((
    SELECT count(*)::integer
    FROM public.message AS m
    WHERE m.conversation_id = cp.conversation_id
      AND m.deleted_at IS NULL
      AND m.sender_id <> cp.user_id
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  ), 0)
  WHERE cp.conversation_id = target_conversation_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups_from_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_conversation_rollups(OLD.conversation_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_conversation_rollups(NEW.conversation_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_conversation_rollups_from_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_conversation_rollups(OLD.conversation_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_conversation_rollups(NEW.conversation_id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_event_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_event_search_document_topics(OLD.event_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_event_search_document_topics(NEW.event_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_group_search_document_acls(target_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_group_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_group_search_document_topics(OLD.group_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_group_search_document_topics(NEW.group_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_search_document_acl_relation_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_group_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.search_document
  SET
    location_latitude = NULL,
    location_longitude = NULL,
    location_label = NULL,
    location_source = NULL,
    location_kind = NULL,
    location_place_id = NULL,
    location_boundary_source = NULL,
    location_geometry = NULL,
    location_bounds = NULL,
    updated_at = updated_at
  WHERE group_id = NEW.id
    OR id = public.search_document_id('group', NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_search_documents_from_user_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.search_document
  SET
    location_latitude = NULL,
    location_longitude = NULL,
    location_label = NULL,
    location_source = NULL,
    location_kind = NULL,
    location_place_id = NULL,
    location_boundary_source = NULL,
    location_geometry = NULL,
    location_bounds = NULL,
    updated_at = updated_at
  WHERE owner_user_id = NEW.id
    OR id = public.search_document_id('user', NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_statement_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_statement_search_document_topics(OLD.statement_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_statement_search_document_topics(NEW.statement_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_user_search_document_topics_from_hashtag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_user_search_document_topics(OLD.user_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_user_search_document_topics(NEW.user_id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_notification_recipients(target_notification_id uuid)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT *
    FROM public.notification
    WHERE id = target_notification_id
      AND deleted_at IS NULL
  ),
  candidates AS (
    SELECT recipient_id AS user_id
    FROM target
    WHERE recipient_id IS NOT NULL

    UNION

    SELECT recipient_group.owner_id
    FROM target
    JOIN public."group" recipient_group
      ON recipient_group.id = target.recipient_group_id
    WHERE recipient_group.owner_id IS NOT NULL

    UNION

    SELECT membership.user_id
    FROM target
    JOIN public.group_membership membership
      ON membership.group_id = target.recipient_group_id
     AND membership.status IN ('active', 'member', 'admin')
    JOIN public.group_membership_role membership_role
      ON membership_role.group_membership_id = membership.id
    JOIN public.action_right action_right
      ON action_right.role_id = membership_role.role_id
     AND action_right.resource = 'groupNotifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT guest_access.user_id
    FROM target
    JOIN public.group_guest_access guest_access
      ON guest_access.group_id = target.recipient_group_id
     AND guest_access.status = 'active'
    JOIN public.group_guest_role guest_role
      ON guest_role.group_guest_access_id = guest_access.id
    JOIN public.action_right action_right
      ON action_right.role_id = guest_role.role_id
     AND action_right.resource = 'groupNotifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT participant.user_id
    FROM target
    JOIN public.event_participant participant
      ON participant.event_id = target.recipient_event_id
     AND participant.status IN ('active', 'confirmed', 'member', 'admin')
    JOIN public.event_participant_role participant_role
      ON participant_role.event_participant_id = participant.id
    JOIN public.action_right action_right
      ON action_right.role_id = participant_role.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT amendment.created_by_id
    FROM target
    JOIN public.amendment amendment
      ON amendment.id = target.recipient_amendment_id
    WHERE amendment.created_by_id IS NOT NULL

    UNION

    SELECT collaborator.user_id
    FROM target
    JOIN public.amendment_collaborator collaborator
      ON collaborator.amendment_id = target.recipient_amendment_id
     AND collaborator.status IN ('active', 'collaborator', 'member', 'admin')
    JOIN public.action_right action_right
      ON action_right.role_id = collaborator.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')

    UNION

    SELECT blogger.user_id
    FROM target
    JOIN public.blog_blogger blogger
      ON blogger.blog_id = target.recipient_blog_id
    JOIN public.action_right action_right
      ON action_right.role_id = blogger.role_id
     AND action_right.resource = 'notifications'
     AND action_right.action IN ('viewNotifications', 'manageNotifications')
  )
  SELECT DISTINCT candidates.user_id
  FROM candidates
  CROSS JOIN target
  WHERE candidates.user_id IS NOT NULL
    AND candidates.user_id IS DISTINCT FROM target.sender_id;
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_epoch_ms(value timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE floor(extract(epoch FROM value) * 1000)::bigint
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_format_location(p_location_name text, p_country text, p_region text, p_post_code text, p_city text, p_street text, p_house_number text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT nullif(
    concat_ws(
      ', ',
      nullif(trim(coalesce(p_location_name, '')), ''),
      nullif(trim(concat_ws(' ', nullif(p_street, ''), nullif(p_house_number, ''))), ''),
      nullif(trim(concat_ws(' ', nullif(p_post_code, ''), nullif(p_city, ''))), ''),
      nullif(trim(coalesce(p_region, '')), ''),
      nullif(trim(coalesce(p_country, '')), '')
    ),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_group_acl_users(target_group_id uuid)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_id(entity_type text, entity_id uuid)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT entity_type || ':' || entity_id::text;
$function$
;

CREATE OR REPLACE FUNCTION public.search_document_json_text(value jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(regexp_replace(value::text, '[\[\]\{\}"_,:]+', ' ', 'g'), '');
$function$
;

CREATE OR REPLACE FUNCTION public.sync_amendment_search_document_topics(target_amendment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  WITH topic_values AS (
    SELECT value AS topic
    FROM public.amendment AS a,
      jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(a.tags) = 'array' THEN a.tags ELSE '[]'::jsonb END
      ) AS tag_value(value)
    WHERE a.id = target_amendment_id
    UNION
    SELECT h.tag
    FROM public.amendment_hashtag AS ah
    JOIN public.hashtag AS h ON h.id = ah.hashtag_id
    WHERE ah.amendment_id = target_amendment_id
  )
  SELECT coalesce(jsonb_agg(topic ORDER BY topic), '[]'::jsonb)
  INTO topics
  FROM topic_values;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('amendment', target_amendment_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_blog_search_document_topics(target_blog_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.blog_hashtag AS bh
  JOIN public.hashtag AS h ON h.id = bh.hashtag_id
  WHERE bh.blog_id = target_blog_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('blog', target_blog_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_dataset_search_document_topics(target_dataset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT CASE
    WHEN jsonb_typeof(d.topics) = 'array' THEN d.topics
    ELSE '[]'::jsonb
  END
  INTO topics
  FROM public.dataset AS d
  WHERE d.id = target_dataset_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('dataset', target_dataset_id),
    coalesce(topics, '[]'::jsonb)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_event_search_document_topics(target_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.event_hashtag AS eh
  JOIN public.hashtag AS h ON h.id = eh.hashtag_id
  WHERE eh.event_id = target_event_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('event', target_event_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_group_search_document_topics(target_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.group_hashtag AS gh
  JOIN public.hashtag AS h ON h.id = gh.hashtag_id
  WHERE gh.group_id = target_group_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('group', target_group_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl(target_entity_type text, target_entity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_entity_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_search_document_acl_with_derivatives(target_entity_type text, target_entity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_search_document_topics(p_document_id text, p_topics jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_topics JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.search_document WHERE id = p_document_id
  ) THEN
    RETURN;
  END IF;

  normalized_topics := CASE
    WHEN jsonb_typeof(p_topics) = 'array' THEN p_topics
    ELSE '[]'::jsonb
  END;

  DELETE FROM public.search_document_topic
  WHERE document_id = p_document_id;

  INSERT INTO public.search_document_topic (document_id, topic)
  SELECT DISTINCT p_document_id, lower(trim(value))
  FROM jsonb_array_elements_text(normalized_topics) AS topic_value(value)
  WHERE nullif(trim(value), '') IS NOT NULL
  ON CONFLICT (document_id, topic) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_statement_search_document_topics(target_statement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.statement_hashtag AS sh
  JOIN public.hashtag AS h ON h.id = sh.hashtag_id
  WHERE sh.statement_id = target_statement_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('statement', target_statement_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_timeline_search_document_privacy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_search_document_topics(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  topics JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(h.tag ORDER BY h.tag), '[]'::jsonb)
  INTO topics
  FROM public.user_hashtag AS uh
  JOIN public.hashtag AS h ON h.id = uh.hashtag_id
  WHERE uh.user_id = target_user_id;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('user', target_user_id),
    topics
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tag_app_tutorial_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.search_document
  SET tutorial_run_id = NEW.tutorial_run_id
  WHERE entity_type = TG_ARGV[0]
    AND entity_id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_dataset_from_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_dataset_id UUID;
BEGIN
  target_dataset_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.dataset_id ELSE NEW.dataset_id END;

  UPDATE public.dataset
  SET
    columns = CASE
      WHEN TG_OP = 'DELETE' THEN columns
      ELSE NEW.columns
    END,
    column_profiles = CASE
      WHEN TG_OP = 'DELETE' THEN column_profiles
      ELSE NEW.column_profiles
    END,
    updated_at = now()
  WHERE id = target_dataset_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_amendment_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('amendment', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_amendment_search_document(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_blog_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('blog', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    summary,
    search_text,
    visibility,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('blog', NEW.id),
    'blog',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Blog'),
    coalesce(NEW.description, left(public.search_document_json_text(NEW.content), 320)),
    concat_ws(' ', NEW.title, NEW.description, public.search_document_json_text(NEW.content)),
    coalesce(NEW.visibility, 'public'),
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'blog',
      'stats', jsonb_build_object(
        'likes', NEW.like_count,
        'comments', NEW.comment_count,
        'supporters', NEW.supporter_count,
        'subscribers', NEW.subscriber_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.like_count, 0) + coalesce(NEW.comment_count, 0) + coalesce(NEW.supporter_count, 0) + coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0),
    coalesce(NEW.like_count, 0) + coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_blog_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_dataset_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  latest_snapshot RECORD;
  provider_label TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('dataset', OLD.id);
    RETURN OLD;
  END IF;

  SELECT
    ds.id,
    ds.status,
    ds.snapshot_taken_at,
    ds.byte_size,
    ds.row_count,
    ds.column_count
  INTO latest_snapshot
  FROM public.dataset_snapshot AS ds
  WHERE ds.dataset_id = NEW.id
  ORDER BY ds.snapshot_taken_at DESC
  LIMIT 1;

  provider_label := CASE NEW.provider
    WHEN 'EUROSTAT' THEN 'Eurostat'
    WHEN 'GENESIS_DESTATIS' THEN 'Genesis/Destatis'
    WHEN 'GOVDATA' THEN 'GovData'
    WHEN 'UPLOAD' THEN 'Upload'
    ELSE NEW.provider
  END;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('dataset', NEW.id),
    'dataset',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Dataset'),
    concat_ws(' · ', provider_label, nullif(NEW.publisher, ''), nullif(NEW.provider_dataset_id, '')),
    left(coalesce(NEW.description, NEW.structure_summary, ''), 420),
    concat_ws(
      ' ',
      NEW.title,
      NEW.description,
      NEW.structure_summary,
      NEW.provider,
      provider_label,
      NEW.provider_dataset_id,
      NEW.provider_resource_id,
      NEW.publisher,
      NEW.license,
      public.search_document_json_text(NEW.columns),
      public.search_document_json_text(NEW.column_profiles),
      public.search_document_json_text(NEW.dimensions),
      public.search_document_json_text(NEW.time_coverage),
      public.search_document_json_text(NEW.spatial_coverage),
      public.search_document_json_text(NEW.topics),
      public.search_document_json_text(NEW.metadata)
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.owner_user_id,
    NEW.group_id,
    jsonb_build_object(
      'type', 'dataset',
      'provider', NEW.provider,
      'provider_label', provider_label,
      'provider_dataset_id', NEW.provider_dataset_id,
      'provider_resource_id', NEW.provider_resource_id,
      'publisher', NEW.publisher,
      'license', NEW.license,
      'structure_summary', NEW.structure_summary,
      'column_profiles', coalesce(NEW.column_profiles, '[]'::jsonb),
      'snapshot_id', latest_snapshot.id,
      'snapshot_status', latest_snapshot.status,
      'snapshot_taken_at', public.search_document_epoch_ms(latest_snapshot.snapshot_taken_at),
      'byte_size', latest_snapshot.byte_size,
      'row_count', latest_snapshot.row_count,
      'column_count', latest_snapshot.column_count,
      'metadata', coalesce(NEW.metadata, '{}'::jsonb)
    ),
    NEW.created_at,
    NEW.updated_at,
    CASE WHEN latest_snapshot.status = 'ready' THEN 2 ELSE 1 END,
    CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_dataset_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_election_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  related_group_id UUID;
  related_event_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('election', OLD.id);
    RETURN OLD;
  END IF;

  SELECT group_id
  INTO related_group_id
  FROM public.role
  WHERE id = NEW.role_id;

  SELECT event_id
  INTO related_event_id
  FROM public.agenda_item
  WHERE id = NEW.agenda_item_id;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    group_id,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('election', NEW.id),
    'election',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Election'),
    NEW.status,
    NEW.description,
    concat_ws(' ', NEW.title, NEW.description, NEW.status, NEW.majority_type, NEW.election_mode),
    coalesce(NEW.visibility, 'public'),
    related_group_id,
    jsonb_build_object(
      'type', 'election',
      'status', NEW.status,
      'agenda_event_id', related_event_id,
      'agenda_item_id', NEW.agenda_item_id,
      'metadata', jsonb_build_object(
        'role_id', NEW.role_id,
        'event_id', related_event_id,
        'agenda_event_id', related_event_id,
        'agenda_item_id', NEW.agenda_item_id,
        'election_mode', NEW.election_mode
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.seat_count, 0) + coalesce(NEW.max_votes, 0),
    CASE WHEN NEW.status IN ('open', 'active') THEN 1 ELSE 0 END
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    group_id = EXCLUDED.group_id,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_event_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('event', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('event', NEW.id),
    'event',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Event'),
    concat_ws(', ', nullif(NEW.location_name, ''), nullif(NEW.city, ''), nullif(NEW.country, '')),
    left(public.search_document_json_text(NEW.description), 320),
    concat_ws(
      ' ',
      NEW.title,
      public.search_document_json_text(NEW.description),
      NEW.event_type,
      NEW.location_name,
      NEW.city,
      NEW.region,
      NEW.country
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.creator_id,
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'event',
      'event_type', NEW.event_type,
      'location', concat_ws(', ', nullif(NEW.location_name, ''), nullif(NEW.city, ''), nullif(NEW.country, '')),
      'starts_at', public.search_document_epoch_ms(NEW.start_date),
      'ends_at', public.search_document_epoch_ms(NEW.end_date),
      'status', NEW.status,
      'stats', jsonb_build_object(
        'participants', NEW.participant_count,
        'subscribers', NEW.subscriber_count,
        'amendments', NEW.amendment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.participant_count, 0) + coalesce(NEW.subscriber_count, 0) + coalesce(NEW.amendment_count, 0) + coalesce(NEW.election_count, 0),
    coalesce(NEW.participant_count, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_event_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_group_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('group', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('group', NEW.id),
    'group',
    NEW.id,
    coalesce(nullif(NEW.name, ''), 'Group'),
    concat_ws(', ', nullif(NEW.city, ''), nullif(NEW.region, ''), nullif(NEW.country, '')),
    left(public.search_document_json_text(NEW.description), 320),
    concat_ws(
      ' ',
      NEW.name,
      public.search_document_json_text(NEW.description),
      NEW.city,
      NEW.region,
      NEW.country
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.owner_id,
    NEW.id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'group',
      'group_type', NEW.group_type,
      'connected_group_id', NEW.connected_group_id,
      'primary_sibling_membership_mode', NEW.primary_sibling_membership_mode,
      'location', concat_ws(', ', nullif(NEW.city, ''), nullif(NEW.region, ''), nullif(NEW.country, '')),
      'stats', jsonb_build_object(
        'members', NEW.member_count,
        'subscribers', NEW.subscriber_count,
        'events', NEW.event_count,
        'amendments', NEW.amendment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.member_count, 0) + coalesce(NEW.subscriber_count, 0) + coalesce(NEW.event_count, 0) + coalesce(NEW.amendment_count, 0),
    coalesce(NEW.subscriber_count, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_group_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_statement_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('statement', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('statement', NEW.id),
    'statement',
    NEW.id,
    coalesce(nullif(left(NEW.text, 100), ''), 'Statement'),
    NEW.text,
    coalesce(NEW.text, ''),
    coalesce(NEW.visibility, 'public'),
    NEW.user_id,
    NEW.group_id,
    NEW.image_url,
    jsonb_build_object(
      'type', 'statement',
      'stats', jsonb_build_object(
        'upvotes', NEW.upvotes,
        'comments', NEW.comment_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0) + coalesce(NEW.comment_count, 0),
    coalesce(NEW.upvotes, 0) - coalesce(NEW.downvotes, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_statement_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_timeline_event_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  projected_type TEXT;
  projected_entity_id UUID;
  score INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('timeline_event', OLD.id);
    RETURN OLD;
  END IF;

  projected_type := coalesce(NEW.content_type, NEW.entity_type, 'timeline_event');
  projected_entity_id := coalesce(NEW.entity_id, NEW.id);
  score := CASE
    WHEN NEW.stats ? 'score' AND (NEW.stats ->> 'score') ~ '^-?[0-9]+$'
      THEN (NEW.stats ->> 'score')::integer
    ELSE 0
  END;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('timeline_event', NEW.id),
    projected_type,
    projected_entity_id,
    coalesce(nullif(NEW.title, ''), 'Timeline item'),
    NEW.description,
    concat_ws(
      ' ',
      NEW.title,
      NEW.description,
      NEW.event_type,
      NEW.entity_type,
      NEW.content_type,
      public.search_document_json_text(NEW.metadata),
      public.search_document_json_text(NEW.tags)
    ),
    'public',
    coalesce(NEW.user_id, NEW.actor_id),
    NEW.group_id,
    coalesce(NEW.image_url, NEW.video_thumbnail_url),
    jsonb_build_object(
      'type', projected_type,
      'status', coalesce(NEW.vote_status, NEW.election_status),
      'ends_at', public.search_document_epoch_ms(NEW.ends_at),
      'entity_type', NEW.entity_type,
      'entity_id', projected_entity_id,
      'metadata', coalesce(NEW.metadata, '{}'::jsonb),
      'stats', coalesce(NEW.stats, '{}'::jsonb)
    ),
    NEW.created_at,
    NEW.created_at,
    score,
    score
  )
  ON CONFLICT (id) DO UPDATE SET
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('timeline_event', NEW.id),
    NEW.tags
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_todo_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('todo', OLD.id);
    RETURN OLD;
  END IF;

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    group_id,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('todo', NEW.id),
    'todo',
    NEW.id,
    coalesce(nullif(NEW.title, ''), 'Todo'),
    NEW.status,
    NEW.description,
    concat_ws(' ', NEW.title, NEW.description, NEW.status, NEW.priority),
    coalesce(NEW.visibility, 'public'),
    NEW.creator_id,
    NEW.group_id,
    jsonb_build_object(
      'type', 'todo',
      'priority', NEW.priority,
      'status', NEW.status,
      'due_at', public.search_document_epoch_ms(NEW.due_date),
      'archived_at', public.search_document_epoch_ms(NEW.archived_at),
      'metadata', jsonb_build_object('event_id', NEW.event_id, 'amendment_id', NEW.amendment_id)
    ),
    NEW.created_at,
    NEW.updated_at,
    CASE
      WHEN NEW.status = 'completed' THEN 0
      WHEN NEW.priority = 'high' THEN 3
      WHEN NEW.priority = 'medium' THEN 2
      ELSE 1
    END,
    CASE
      WHEN NEW.due_date IS NOT NULL AND NEW.completed_at IS NULL THEN 1
      ELSE 0
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    group_id = EXCLUDED.group_id,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_search_document_topics(
    public.search_document_id('todo', NEW.id),
    NEW.tags
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_user_search_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  display_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('user', OLD.id);
    RETURN OLD;
  END IF;

  display_name := coalesce(
    nullif(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
    nullif(NEW.handle, ''),
    NEW.email,
    'User'
  );

  INSERT INTO public.search_document (
    id,
    entity_type,
    entity_id,
    title,
    subtitle,
    summary,
    search_text,
    visibility,
    owner_user_id,
    image_url,
    card_payload,
    created_at,
    updated_at,
    engagement_score,
    trending_score
  )
  VALUES (
    public.search_document_id('user', NEW.id),
    'user',
    NEW.id,
    display_name,
    CASE WHEN nullif(NEW.handle, '') IS NULL THEN NEW.city ELSE '@' || NEW.handle END,
    NEW.bio,
    concat_ws(
      ' ',
      display_name,
      NEW.handle,
      NEW.email,
      NEW.bio,
      NEW.city,
      NEW.region,
      NEW.country,
      public.search_document_json_text(NEW.about)
    ),
    coalesce(NEW.visibility, 'public'),
    NEW.id,
    NEW.avatar,
    jsonb_build_object(
      'type', 'user',
      'handle', NEW.handle,
      'stats', jsonb_build_object(
        'subscribers', NEW.subscriber_count,
        'amendments', NEW.amendment_count,
        'groups', NEW.group_count
      )
    ),
    NEW.created_at,
    NEW.updated_at,
    coalesce(NEW.subscriber_count, 0) + coalesce(NEW.amendment_count, 0) + coalesce(NEW.group_count, 0),
    coalesce(NEW.subscriber_count, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    search_text = EXCLUDED.search_text,
    visibility = EXCLUDED.visibility,
    owner_user_id = EXCLUDED.owner_user_id,
    image_url = EXCLUDED.image_url,
    card_payload = EXCLUDED.card_payload,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    engagement_score = EXCLUDED.engagement_score,
    trending_score = EXCLUDED.trending_score;

  PERFORM public.sync_user_search_document_topics(NEW.id);
  RETURN NEW;
END;
$function$
;

grant references on table "public"."accreditation" to "anon";

grant trigger on table "public"."accreditation" to "anon";

grant truncate on table "public"."accreditation" to "anon";

grant references on table "public"."accreditation" to "authenticated";

grant trigger on table "public"."accreditation" to "authenticated";

grant truncate on table "public"."accreditation" to "authenticated";

grant delete on table "public"."accreditation" to "service_role";

grant insert on table "public"."accreditation" to "service_role";

grant references on table "public"."accreditation" to "service_role";

grant select on table "public"."accreditation" to "service_role";

grant trigger on table "public"."accreditation" to "service_role";

grant truncate on table "public"."accreditation" to "service_role";

grant update on table "public"."accreditation" to "service_role";

grant references on table "public"."accreditation_audit" to "anon";

grant trigger on table "public"."accreditation_audit" to "anon";

grant truncate on table "public"."accreditation_audit" to "anon";

grant references on table "public"."accreditation_audit" to "authenticated";

grant trigger on table "public"."accreditation_audit" to "authenticated";

grant truncate on table "public"."accreditation_audit" to "authenticated";

grant delete on table "public"."accreditation_audit" to "service_role";

grant insert on table "public"."accreditation_audit" to "service_role";

grant references on table "public"."accreditation_audit" to "service_role";

grant select on table "public"."accreditation_audit" to "service_role";

grant trigger on table "public"."accreditation_audit" to "service_role";

grant truncate on table "public"."accreditation_audit" to "service_role";

grant update on table "public"."accreditation_audit" to "service_role";

grant references on table "public"."action_right" to "anon";

grant trigger on table "public"."action_right" to "anon";

grant truncate on table "public"."action_right" to "anon";

grant references on table "public"."action_right" to "authenticated";

grant trigger on table "public"."action_right" to "authenticated";

grant truncate on table "public"."action_right" to "authenticated";

grant delete on table "public"."action_right" to "service_role";

grant insert on table "public"."action_right" to "service_role";

grant references on table "public"."action_right" to "service_role";

grant select on table "public"."action_right" to "service_role";

grant trigger on table "public"."action_right" to "service_role";

grant truncate on table "public"."action_right" to "service_role";

grant update on table "public"."action_right" to "service_role";

grant references on table "public"."agenda_item" to "anon";

grant trigger on table "public"."agenda_item" to "anon";

grant truncate on table "public"."agenda_item" to "anon";

grant references on table "public"."agenda_item" to "authenticated";

grant trigger on table "public"."agenda_item" to "authenticated";

grant truncate on table "public"."agenda_item" to "authenticated";

grant delete on table "public"."agenda_item" to "service_role";

grant insert on table "public"."agenda_item" to "service_role";

grant references on table "public"."agenda_item" to "service_role";

grant select on table "public"."agenda_item" to "service_role";

grant trigger on table "public"."agenda_item" to "service_role";

grant truncate on table "public"."agenda_item" to "service_role";

grant update on table "public"."agenda_item" to "service_role";

grant references on table "public"."agenda_item_change_request" to "anon";

grant trigger on table "public"."agenda_item_change_request" to "anon";

grant truncate on table "public"."agenda_item_change_request" to "anon";

grant references on table "public"."agenda_item_change_request" to "authenticated";

grant trigger on table "public"."agenda_item_change_request" to "authenticated";

grant truncate on table "public"."agenda_item_change_request" to "authenticated";

grant delete on table "public"."agenda_item_change_request" to "service_role";

grant insert on table "public"."agenda_item_change_request" to "service_role";

grant references on table "public"."agenda_item_change_request" to "service_role";

grant select on table "public"."agenda_item_change_request" to "service_role";

grant trigger on table "public"."agenda_item_change_request" to "service_role";

grant truncate on table "public"."agenda_item_change_request" to "service_role";

grant update on table "public"."agenda_item_change_request" to "service_role";

grant references on table "public"."ai_provider_credential" to "anon";

grant trigger on table "public"."ai_provider_credential" to "anon";

grant truncate on table "public"."ai_provider_credential" to "anon";

grant references on table "public"."ai_provider_credential" to "authenticated";

grant trigger on table "public"."ai_provider_credential" to "authenticated";

grant truncate on table "public"."ai_provider_credential" to "authenticated";

grant delete on table "public"."ai_provider_credential" to "service_role";

grant insert on table "public"."ai_provider_credential" to "service_role";

grant references on table "public"."ai_provider_credential" to "service_role";

grant select on table "public"."ai_provider_credential" to "service_role";

grant trigger on table "public"."ai_provider_credential" to "service_role";

grant truncate on table "public"."ai_provider_credential" to "service_role";

grant update on table "public"."ai_provider_credential" to "service_role";

grant references on table "public"."ai_skill" to "anon";

grant trigger on table "public"."ai_skill" to "anon";

grant truncate on table "public"."ai_skill" to "anon";

grant references on table "public"."ai_skill" to "authenticated";

grant trigger on table "public"."ai_skill" to "authenticated";

grant truncate on table "public"."ai_skill" to "authenticated";

grant delete on table "public"."ai_skill" to "service_role";

grant insert on table "public"."ai_skill" to "service_role";

grant references on table "public"."ai_skill" to "service_role";

grant select on table "public"."ai_skill" to "service_role";

grant trigger on table "public"."ai_skill" to "service_role";

grant truncate on table "public"."ai_skill" to "service_role";

grant update on table "public"."ai_skill" to "service_role";

grant references on table "public"."ai_tool" to "anon";

grant trigger on table "public"."ai_tool" to "anon";

grant truncate on table "public"."ai_tool" to "anon";

grant references on table "public"."ai_tool" to "authenticated";

grant trigger on table "public"."ai_tool" to "authenticated";

grant truncate on table "public"."ai_tool" to "authenticated";

grant delete on table "public"."ai_tool" to "service_role";

grant insert on table "public"."ai_tool" to "service_role";

grant references on table "public"."ai_tool" to "service_role";

grant select on table "public"."ai_tool" to "service_role";

grant trigger on table "public"."ai_tool" to "service_role";

grant truncate on table "public"."ai_tool" to "service_role";

grant update on table "public"."ai_tool" to "service_role";

grant references on table "public"."amendment" to "anon";

grant trigger on table "public"."amendment" to "anon";

grant truncate on table "public"."amendment" to "anon";

grant references on table "public"."amendment" to "authenticated";

grant trigger on table "public"."amendment" to "authenticated";

grant truncate on table "public"."amendment" to "authenticated";

grant delete on table "public"."amendment" to "service_role";

grant insert on table "public"."amendment" to "service_role";

grant references on table "public"."amendment" to "service_role";

grant select on table "public"."amendment" to "service_role";

grant trigger on table "public"."amendment" to "service_role";

grant truncate on table "public"."amendment" to "service_role";

grant update on table "public"."amendment" to "service_role";

grant references on table "public"."amendment_city_design" to "anon";

grant trigger on table "public"."amendment_city_design" to "anon";

grant truncate on table "public"."amendment_city_design" to "anon";

grant references on table "public"."amendment_city_design" to "authenticated";

grant trigger on table "public"."amendment_city_design" to "authenticated";

grant truncate on table "public"."amendment_city_design" to "authenticated";

grant delete on table "public"."amendment_city_design" to "service_role";

grant insert on table "public"."amendment_city_design" to "service_role";

grant references on table "public"."amendment_city_design" to "service_role";

grant select on table "public"."amendment_city_design" to "service_role";

grant trigger on table "public"."amendment_city_design" to "service_role";

grant truncate on table "public"."amendment_city_design" to "service_role";

grant update on table "public"."amendment_city_design" to "service_role";

grant references on table "public"."amendment_collaborator" to "anon";

grant trigger on table "public"."amendment_collaborator" to "anon";

grant truncate on table "public"."amendment_collaborator" to "anon";

grant references on table "public"."amendment_collaborator" to "authenticated";

grant trigger on table "public"."amendment_collaborator" to "authenticated";

grant truncate on table "public"."amendment_collaborator" to "authenticated";

grant delete on table "public"."amendment_collaborator" to "service_role";

grant insert on table "public"."amendment_collaborator" to "service_role";

grant references on table "public"."amendment_collaborator" to "service_role";

grant select on table "public"."amendment_collaborator" to "service_role";

grant trigger on table "public"."amendment_collaborator" to "service_role";

grant truncate on table "public"."amendment_collaborator" to "service_role";

grant update on table "public"."amendment_collaborator" to "service_role";

grant references on table "public"."amendment_group_decision" to "anon";

grant trigger on table "public"."amendment_group_decision" to "anon";

grant truncate on table "public"."amendment_group_decision" to "anon";

grant references on table "public"."amendment_group_decision" to "authenticated";

grant trigger on table "public"."amendment_group_decision" to "authenticated";

grant truncate on table "public"."amendment_group_decision" to "authenticated";

grant delete on table "public"."amendment_group_decision" to "service_role";

grant insert on table "public"."amendment_group_decision" to "service_role";

grant references on table "public"."amendment_group_decision" to "service_role";

grant select on table "public"."amendment_group_decision" to "service_role";

grant trigger on table "public"."amendment_group_decision" to "service_role";

grant truncate on table "public"."amendment_group_decision" to "service_role";

grant update on table "public"."amendment_group_decision" to "service_role";

grant references on table "public"."amendment_hashtag" to "anon";

grant trigger on table "public"."amendment_hashtag" to "anon";

grant truncate on table "public"."amendment_hashtag" to "anon";

grant references on table "public"."amendment_hashtag" to "authenticated";

grant trigger on table "public"."amendment_hashtag" to "authenticated";

grant truncate on table "public"."amendment_hashtag" to "authenticated";

grant delete on table "public"."amendment_hashtag" to "service_role";

grant insert on table "public"."amendment_hashtag" to "service_role";

grant references on table "public"."amendment_hashtag" to "service_role";

grant select on table "public"."amendment_hashtag" to "service_role";

grant trigger on table "public"."amendment_hashtag" to "service_role";

grant truncate on table "public"."amendment_hashtag" to "service_role";

grant update on table "public"."amendment_hashtag" to "service_role";

grant references on table "public"."amendment_path" to "anon";

grant trigger on table "public"."amendment_path" to "anon";

grant truncate on table "public"."amendment_path" to "anon";

grant references on table "public"."amendment_path" to "authenticated";

grant trigger on table "public"."amendment_path" to "authenticated";

grant truncate on table "public"."amendment_path" to "authenticated";

grant delete on table "public"."amendment_path" to "service_role";

grant insert on table "public"."amendment_path" to "service_role";

grant references on table "public"."amendment_path" to "service_role";

grant select on table "public"."amendment_path" to "service_role";

grant trigger on table "public"."amendment_path" to "service_role";

grant truncate on table "public"."amendment_path" to "service_role";

grant update on table "public"."amendment_path" to "service_role";

grant references on table "public"."amendment_path_segment" to "anon";

grant trigger on table "public"."amendment_path_segment" to "anon";

grant truncate on table "public"."amendment_path_segment" to "anon";

grant references on table "public"."amendment_path_segment" to "authenticated";

grant trigger on table "public"."amendment_path_segment" to "authenticated";

grant truncate on table "public"."amendment_path_segment" to "authenticated";

grant delete on table "public"."amendment_path_segment" to "service_role";

grant insert on table "public"."amendment_path_segment" to "service_role";

grant references on table "public"."amendment_path_segment" to "service_role";

grant select on table "public"."amendment_path_segment" to "service_role";

grant trigger on table "public"."amendment_path_segment" to "service_role";

grant truncate on table "public"."amendment_path_segment" to "service_role";

grant update on table "public"."amendment_path_segment" to "service_role";

grant references on table "public"."amendment_process_branch" to "anon";

grant trigger on table "public"."amendment_process_branch" to "anon";

grant truncate on table "public"."amendment_process_branch" to "anon";

grant references on table "public"."amendment_process_branch" to "authenticated";

grant trigger on table "public"."amendment_process_branch" to "authenticated";

grant truncate on table "public"."amendment_process_branch" to "authenticated";

grant delete on table "public"."amendment_process_branch" to "service_role";

grant insert on table "public"."amendment_process_branch" to "service_role";

grant references on table "public"."amendment_process_branch" to "service_role";

grant select on table "public"."amendment_process_branch" to "service_role";

grant trigger on table "public"."amendment_process_branch" to "service_role";

grant truncate on table "public"."amendment_process_branch" to "service_role";

grant update on table "public"."amendment_process_branch" to "service_role";

grant references on table "public"."amendment_process_run" to "anon";

grant trigger on table "public"."amendment_process_run" to "anon";

grant truncate on table "public"."amendment_process_run" to "anon";

grant references on table "public"."amendment_process_run" to "authenticated";

grant trigger on table "public"."amendment_process_run" to "authenticated";

grant truncate on table "public"."amendment_process_run" to "authenticated";

grant delete on table "public"."amendment_process_run" to "service_role";

grant insert on table "public"."amendment_process_run" to "service_role";

grant references on table "public"."amendment_process_run" to "service_role";

grant select on table "public"."amendment_process_run" to "service_role";

grant trigger on table "public"."amendment_process_run" to "service_role";

grant truncate on table "public"."amendment_process_run" to "service_role";

grant update on table "public"."amendment_process_run" to "service_role";

grant references on table "public"."amendment_process_step_run" to "anon";

grant trigger on table "public"."amendment_process_step_run" to "anon";

grant truncate on table "public"."amendment_process_step_run" to "anon";

grant references on table "public"."amendment_process_step_run" to "authenticated";

grant trigger on table "public"."amendment_process_step_run" to "authenticated";

grant truncate on table "public"."amendment_process_step_run" to "authenticated";

grant delete on table "public"."amendment_process_step_run" to "service_role";

grant insert on table "public"."amendment_process_step_run" to "service_role";

grant references on table "public"."amendment_process_step_run" to "service_role";

grant select on table "public"."amendment_process_step_run" to "service_role";

grant trigger on table "public"."amendment_process_step_run" to "service_role";

grant truncate on table "public"."amendment_process_step_run" to "service_role";

grant update on table "public"."amendment_process_step_run" to "service_role";

grant references on table "public"."amendment_support_vote" to "anon";

grant trigger on table "public"."amendment_support_vote" to "anon";

grant truncate on table "public"."amendment_support_vote" to "anon";

grant references on table "public"."amendment_support_vote" to "authenticated";

grant trigger on table "public"."amendment_support_vote" to "authenticated";

grant truncate on table "public"."amendment_support_vote" to "authenticated";

grant delete on table "public"."amendment_support_vote" to "service_role";

grant insert on table "public"."amendment_support_vote" to "service_role";

grant references on table "public"."amendment_support_vote" to "service_role";

grant select on table "public"."amendment_support_vote" to "service_role";

grant trigger on table "public"."amendment_support_vote" to "service_role";

grant truncate on table "public"."amendment_support_vote" to "service_role";

grant update on table "public"."amendment_support_vote" to "service_role";

grant references on table "public"."amendment_vote_entry" to "anon";

grant trigger on table "public"."amendment_vote_entry" to "anon";

grant truncate on table "public"."amendment_vote_entry" to "anon";

grant references on table "public"."amendment_vote_entry" to "authenticated";

grant trigger on table "public"."amendment_vote_entry" to "authenticated";

grant truncate on table "public"."amendment_vote_entry" to "authenticated";

grant delete on table "public"."amendment_vote_entry" to "service_role";

grant insert on table "public"."amendment_vote_entry" to "service_role";

grant references on table "public"."amendment_vote_entry" to "service_role";

grant select on table "public"."amendment_vote_entry" to "service_role";

grant trigger on table "public"."amendment_vote_entry" to "service_role";

grant truncate on table "public"."amendment_vote_entry" to "service_role";

grant update on table "public"."amendment_vote_entry" to "service_role";

grant references on table "public"."app_tutorial_checkpoint_effect" to "anon";

grant trigger on table "public"."app_tutorial_checkpoint_effect" to "anon";

grant truncate on table "public"."app_tutorial_checkpoint_effect" to "anon";

grant references on table "public"."app_tutorial_checkpoint_effect" to "authenticated";

grant trigger on table "public"."app_tutorial_checkpoint_effect" to "authenticated";

grant truncate on table "public"."app_tutorial_checkpoint_effect" to "authenticated";

grant delete on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant insert on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant references on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant select on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant trigger on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant truncate on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant update on table "public"."app_tutorial_checkpoint_effect" to "service_role";

grant references on table "public"."app_tutorial_entity" to "anon";

grant trigger on table "public"."app_tutorial_entity" to "anon";

grant truncate on table "public"."app_tutorial_entity" to "anon";

grant references on table "public"."app_tutorial_entity" to "authenticated";

grant trigger on table "public"."app_tutorial_entity" to "authenticated";

grant truncate on table "public"."app_tutorial_entity" to "authenticated";

grant delete on table "public"."app_tutorial_entity" to "service_role";

grant insert on table "public"."app_tutorial_entity" to "service_role";

grant references on table "public"."app_tutorial_entity" to "service_role";

grant select on table "public"."app_tutorial_entity" to "service_role";

grant trigger on table "public"."app_tutorial_entity" to "service_role";

grant truncate on table "public"."app_tutorial_entity" to "service_role";

grant update on table "public"."app_tutorial_entity" to "service_role";

grant references on table "public"."app_tutorial_run" to "anon";

grant trigger on table "public"."app_tutorial_run" to "anon";

grant truncate on table "public"."app_tutorial_run" to "anon";

grant references on table "public"."app_tutorial_run" to "authenticated";

grant trigger on table "public"."app_tutorial_run" to "authenticated";

grant truncate on table "public"."app_tutorial_run" to "authenticated";

grant delete on table "public"."app_tutorial_run" to "service_role";

grant insert on table "public"."app_tutorial_run" to "service_role";

grant references on table "public"."app_tutorial_run" to "service_role";

grant select on table "public"."app_tutorial_run" to "service_role";

grant trigger on table "public"."app_tutorial_run" to "service_role";

grant truncate on table "public"."app_tutorial_run" to "service_role";

grant update on table "public"."app_tutorial_run" to "service_role";

grant references on table "public"."appearance_theme" to "anon";

grant trigger on table "public"."appearance_theme" to "anon";

grant truncate on table "public"."appearance_theme" to "anon";

grant references on table "public"."appearance_theme" to "authenticated";

grant trigger on table "public"."appearance_theme" to "authenticated";

grant truncate on table "public"."appearance_theme" to "authenticated";

grant delete on table "public"."appearance_theme" to "service_role";

grant insert on table "public"."appearance_theme" to "service_role";

grant references on table "public"."appearance_theme" to "service_role";

grant select on table "public"."appearance_theme" to "service_role";

grant trigger on table "public"."appearance_theme" to "service_role";

grant truncate on table "public"."appearance_theme" to "service_role";

grant update on table "public"."appearance_theme" to "service_role";

grant references on table "public"."appearance_theme_revision" to "anon";

grant trigger on table "public"."appearance_theme_revision" to "anon";

grant truncate on table "public"."appearance_theme_revision" to "anon";

grant references on table "public"."appearance_theme_revision" to "authenticated";

grant trigger on table "public"."appearance_theme_revision" to "authenticated";

grant truncate on table "public"."appearance_theme_revision" to "authenticated";

grant delete on table "public"."appearance_theme_revision" to "service_role";

grant insert on table "public"."appearance_theme_revision" to "service_role";

grant references on table "public"."appearance_theme_revision" to "service_role";

grant select on table "public"."appearance_theme_revision" to "service_role";

grant trigger on table "public"."appearance_theme_revision" to "service_role";

grant truncate on table "public"."appearance_theme_revision" to "service_role";

grant update on table "public"."appearance_theme_revision" to "service_role";

grant references on table "public"."blog" to "anon";

grant trigger on table "public"."blog" to "anon";

grant truncate on table "public"."blog" to "anon";

grant references on table "public"."blog" to "authenticated";

grant trigger on table "public"."blog" to "authenticated";

grant truncate on table "public"."blog" to "authenticated";

grant delete on table "public"."blog" to "service_role";

grant insert on table "public"."blog" to "service_role";

grant references on table "public"."blog" to "service_role";

grant select on table "public"."blog" to "service_role";

grant trigger on table "public"."blog" to "service_role";

grant truncate on table "public"."blog" to "service_role";

grant update on table "public"."blog" to "service_role";

grant references on table "public"."blog_blogger" to "anon";

grant trigger on table "public"."blog_blogger" to "anon";

grant truncate on table "public"."blog_blogger" to "anon";

grant references on table "public"."blog_blogger" to "authenticated";

grant trigger on table "public"."blog_blogger" to "authenticated";

grant truncate on table "public"."blog_blogger" to "authenticated";

grant delete on table "public"."blog_blogger" to "service_role";

grant insert on table "public"."blog_blogger" to "service_role";

grant references on table "public"."blog_blogger" to "service_role";

grant select on table "public"."blog_blogger" to "service_role";

grant trigger on table "public"."blog_blogger" to "service_role";

grant truncate on table "public"."blog_blogger" to "service_role";

grant update on table "public"."blog_blogger" to "service_role";

grant references on table "public"."blog_hashtag" to "anon";

grant trigger on table "public"."blog_hashtag" to "anon";

grant truncate on table "public"."blog_hashtag" to "anon";

grant references on table "public"."blog_hashtag" to "authenticated";

grant trigger on table "public"."blog_hashtag" to "authenticated";

grant truncate on table "public"."blog_hashtag" to "authenticated";

grant delete on table "public"."blog_hashtag" to "service_role";

grant insert on table "public"."blog_hashtag" to "service_role";

grant references on table "public"."blog_hashtag" to "service_role";

grant select on table "public"."blog_hashtag" to "service_role";

grant trigger on table "public"."blog_hashtag" to "service_role";

grant truncate on table "public"."blog_hashtag" to "service_role";

grant update on table "public"."blog_hashtag" to "service_role";

grant references on table "public"."blog_support_vote" to "anon";

grant trigger on table "public"."blog_support_vote" to "anon";

grant truncate on table "public"."blog_support_vote" to "anon";

grant references on table "public"."blog_support_vote" to "authenticated";

grant trigger on table "public"."blog_support_vote" to "authenticated";

grant truncate on table "public"."blog_support_vote" to "authenticated";

grant delete on table "public"."blog_support_vote" to "service_role";

grant insert on table "public"."blog_support_vote" to "service_role";

grant references on table "public"."blog_support_vote" to "service_role";

grant select on table "public"."blog_support_vote" to "service_role";

grant trigger on table "public"."blog_support_vote" to "service_role";

grant truncate on table "public"."blog_support_vote" to "service_role";

grant update on table "public"."blog_support_vote" to "service_role";

grant references on table "public"."calendar_subscription" to "anon";

grant trigger on table "public"."calendar_subscription" to "anon";

grant truncate on table "public"."calendar_subscription" to "anon";

grant references on table "public"."calendar_subscription" to "authenticated";

grant trigger on table "public"."calendar_subscription" to "authenticated";

grant truncate on table "public"."calendar_subscription" to "authenticated";

grant delete on table "public"."calendar_subscription" to "service_role";

grant insert on table "public"."calendar_subscription" to "service_role";

grant references on table "public"."calendar_subscription" to "service_role";

grant select on table "public"."calendar_subscription" to "service_role";

grant trigger on table "public"."calendar_subscription" to "service_role";

grant truncate on table "public"."calendar_subscription" to "service_role";

grant update on table "public"."calendar_subscription" to "service_role";

grant references on table "public"."change_request" to "anon";

grant trigger on table "public"."change_request" to "anon";

grant truncate on table "public"."change_request" to "anon";

grant references on table "public"."change_request" to "authenticated";

grant trigger on table "public"."change_request" to "authenticated";

grant truncate on table "public"."change_request" to "authenticated";

grant delete on table "public"."change_request" to "service_role";

grant insert on table "public"."change_request" to "service_role";

grant references on table "public"."change_request" to "service_role";

grant select on table "public"."change_request" to "service_role";

grant trigger on table "public"."change_request" to "service_role";

grant truncate on table "public"."change_request" to "service_role";

grant update on table "public"."change_request" to "service_role";

grant references on table "public"."change_request_vote" to "anon";

grant trigger on table "public"."change_request_vote" to "anon";

grant truncate on table "public"."change_request_vote" to "anon";

grant references on table "public"."change_request_vote" to "authenticated";

grant trigger on table "public"."change_request_vote" to "authenticated";

grant truncate on table "public"."change_request_vote" to "authenticated";

grant delete on table "public"."change_request_vote" to "service_role";

grant insert on table "public"."change_request_vote" to "service_role";

grant references on table "public"."change_request_vote" to "service_role";

grant select on table "public"."change_request_vote" to "service_role";

grant trigger on table "public"."change_request_vote" to "service_role";

grant truncate on table "public"."change_request_vote" to "service_role";

grant update on table "public"."change_request_vote" to "service_role";

grant references on table "public"."comment" to "anon";

grant trigger on table "public"."comment" to "anon";

grant truncate on table "public"."comment" to "anon";

grant references on table "public"."comment" to "authenticated";

grant trigger on table "public"."comment" to "authenticated";

grant truncate on table "public"."comment" to "authenticated";

grant delete on table "public"."comment" to "service_role";

grant insert on table "public"."comment" to "service_role";

grant references on table "public"."comment" to "service_role";

grant select on table "public"."comment" to "service_role";

grant trigger on table "public"."comment" to "service_role";

grant truncate on table "public"."comment" to "service_role";

grant update on table "public"."comment" to "service_role";

grant references on table "public"."comment_vote" to "anon";

grant trigger on table "public"."comment_vote" to "anon";

grant truncate on table "public"."comment_vote" to "anon";

grant references on table "public"."comment_vote" to "authenticated";

grant trigger on table "public"."comment_vote" to "authenticated";

grant truncate on table "public"."comment_vote" to "authenticated";

grant delete on table "public"."comment_vote" to "service_role";

grant insert on table "public"."comment_vote" to "service_role";

grant references on table "public"."comment_vote" to "service_role";

grant select on table "public"."comment_vote" to "service_role";

grant trigger on table "public"."comment_vote" to "service_role";

grant truncate on table "public"."comment_vote" to "service_role";

grant update on table "public"."comment_vote" to "service_role";

grant references on table "public"."conversation" to "anon";

grant trigger on table "public"."conversation" to "anon";

grant truncate on table "public"."conversation" to "anon";

grant references on table "public"."conversation" to "authenticated";

grant trigger on table "public"."conversation" to "authenticated";

grant truncate on table "public"."conversation" to "authenticated";

grant delete on table "public"."conversation" to "service_role";

grant insert on table "public"."conversation" to "service_role";

grant references on table "public"."conversation" to "service_role";

grant select on table "public"."conversation" to "service_role";

grant trigger on table "public"."conversation" to "service_role";

grant truncate on table "public"."conversation" to "service_role";

grant update on table "public"."conversation" to "service_role";

grant references on table "public"."conversation_participant" to "anon";

grant trigger on table "public"."conversation_participant" to "anon";

grant truncate on table "public"."conversation_participant" to "anon";

grant references on table "public"."conversation_participant" to "authenticated";

grant trigger on table "public"."conversation_participant" to "authenticated";

grant truncate on table "public"."conversation_participant" to "authenticated";

grant delete on table "public"."conversation_participant" to "service_role";

grant insert on table "public"."conversation_participant" to "service_role";

grant references on table "public"."conversation_participant" to "service_role";

grant select on table "public"."conversation_participant" to "service_role";

grant trigger on table "public"."conversation_participant" to "service_role";

grant truncate on table "public"."conversation_participant" to "service_role";

grant update on table "public"."conversation_participant" to "service_role";

grant references on table "public"."currency_exchange_rate_cache" to "anon";

grant trigger on table "public"."currency_exchange_rate_cache" to "anon";

grant truncate on table "public"."currency_exchange_rate_cache" to "anon";

grant references on table "public"."currency_exchange_rate_cache" to "authenticated";

grant trigger on table "public"."currency_exchange_rate_cache" to "authenticated";

grant truncate on table "public"."currency_exchange_rate_cache" to "authenticated";

grant delete on table "public"."currency_exchange_rate_cache" to "service_role";

grant insert on table "public"."currency_exchange_rate_cache" to "service_role";

grant references on table "public"."currency_exchange_rate_cache" to "service_role";

grant select on table "public"."currency_exchange_rate_cache" to "service_role";

grant trigger on table "public"."currency_exchange_rate_cache" to "service_role";

grant truncate on table "public"."currency_exchange_rate_cache" to "service_role";

grant update on table "public"."currency_exchange_rate_cache" to "service_role";

grant references on table "public"."dataset" to "anon";

grant trigger on table "public"."dataset" to "anon";

grant truncate on table "public"."dataset" to "anon";

grant references on table "public"."dataset" to "authenticated";

grant trigger on table "public"."dataset" to "authenticated";

grant truncate on table "public"."dataset" to "authenticated";

grant delete on table "public"."dataset" to "service_role";

grant insert on table "public"."dataset" to "service_role";

grant references on table "public"."dataset" to "service_role";

grant select on table "public"."dataset" to "service_role";

grant trigger on table "public"."dataset" to "service_role";

grant truncate on table "public"."dataset" to "service_role";

grant update on table "public"."dataset" to "service_role";

grant references on table "public"."dataset_import_job" to "anon";

grant trigger on table "public"."dataset_import_job" to "anon";

grant truncate on table "public"."dataset_import_job" to "anon";

grant references on table "public"."dataset_import_job" to "authenticated";

grant trigger on table "public"."dataset_import_job" to "authenticated";

grant truncate on table "public"."dataset_import_job" to "authenticated";

grant delete on table "public"."dataset_import_job" to "service_role";

grant insert on table "public"."dataset_import_job" to "service_role";

grant references on table "public"."dataset_import_job" to "service_role";

grant select on table "public"."dataset_import_job" to "service_role";

grant trigger on table "public"."dataset_import_job" to "service_role";

grant truncate on table "public"."dataset_import_job" to "service_role";

grant update on table "public"."dataset_import_job" to "service_role";

grant references on table "public"."dataset_snapshot" to "anon";

grant trigger on table "public"."dataset_snapshot" to "anon";

grant truncate on table "public"."dataset_snapshot" to "anon";

grant references on table "public"."dataset_snapshot" to "authenticated";

grant trigger on table "public"."dataset_snapshot" to "authenticated";

grant truncate on table "public"."dataset_snapshot" to "authenticated";

grant delete on table "public"."dataset_snapshot" to "service_role";

grant insert on table "public"."dataset_snapshot" to "service_role";

grant references on table "public"."dataset_snapshot" to "service_role";

grant select on table "public"."dataset_snapshot" to "service_role";

grant trigger on table "public"."dataset_snapshot" to "service_role";

grant truncate on table "public"."dataset_snapshot" to "service_role";

grant update on table "public"."dataset_snapshot" to "service_role";

grant references on table "public"."delegate_election_assignment" to "anon";

grant trigger on table "public"."delegate_election_assignment" to "anon";

grant truncate on table "public"."delegate_election_assignment" to "anon";

grant references on table "public"."delegate_election_assignment" to "authenticated";

grant trigger on table "public"."delegate_election_assignment" to "authenticated";

grant truncate on table "public"."delegate_election_assignment" to "authenticated";

grant delete on table "public"."delegate_election_assignment" to "service_role";

grant insert on table "public"."delegate_election_assignment" to "service_role";

grant references on table "public"."delegate_election_assignment" to "service_role";

grant select on table "public"."delegate_election_assignment" to "service_role";

grant trigger on table "public"."delegate_election_assignment" to "service_role";

grant truncate on table "public"."delegate_election_assignment" to "service_role";

grant update on table "public"."delegate_election_assignment" to "service_role";

grant references on table "public"."document" to "anon";

grant trigger on table "public"."document" to "anon";

grant truncate on table "public"."document" to "anon";

grant references on table "public"."document" to "authenticated";

grant trigger on table "public"."document" to "authenticated";

grant truncate on table "public"."document" to "authenticated";

grant delete on table "public"."document" to "service_role";

grant insert on table "public"."document" to "service_role";

grant references on table "public"."document" to "service_role";

grant select on table "public"."document" to "service_role";

grant trigger on table "public"."document" to "service_role";

grant truncate on table "public"."document" to "service_role";

grant update on table "public"."document" to "service_role";

grant references on table "public"."document_collaborator" to "anon";

grant trigger on table "public"."document_collaborator" to "anon";

grant truncate on table "public"."document_collaborator" to "anon";

grant references on table "public"."document_collaborator" to "authenticated";

grant trigger on table "public"."document_collaborator" to "authenticated";

grant truncate on table "public"."document_collaborator" to "authenticated";

grant delete on table "public"."document_collaborator" to "service_role";

grant insert on table "public"."document_collaborator" to "service_role";

grant references on table "public"."document_collaborator" to "service_role";

grant select on table "public"."document_collaborator" to "service_role";

grant trigger on table "public"."document_collaborator" to "service_role";

grant truncate on table "public"."document_collaborator" to "service_role";

grant update on table "public"."document_collaborator" to "service_role";

grant references on table "public"."document_cursor" to "anon";

grant trigger on table "public"."document_cursor" to "anon";

grant truncate on table "public"."document_cursor" to "anon";

grant references on table "public"."document_cursor" to "authenticated";

grant trigger on table "public"."document_cursor" to "authenticated";

grant truncate on table "public"."document_cursor" to "authenticated";

grant delete on table "public"."document_cursor" to "service_role";

grant insert on table "public"."document_cursor" to "service_role";

grant references on table "public"."document_cursor" to "service_role";

grant select on table "public"."document_cursor" to "service_role";

grant trigger on table "public"."document_cursor" to "service_role";

grant truncate on table "public"."document_cursor" to "service_role";

grant update on table "public"."document_cursor" to "service_role";

grant references on table "public"."document_version" to "anon";

grant trigger on table "public"."document_version" to "anon";

grant truncate on table "public"."document_version" to "anon";

grant references on table "public"."document_version" to "authenticated";

grant trigger on table "public"."document_version" to "authenticated";

grant truncate on table "public"."document_version" to "authenticated";

grant delete on table "public"."document_version" to "service_role";

grant insert on table "public"."document_version" to "service_role";

grant references on table "public"."document_version" to "service_role";

grant select on table "public"."document_version" to "service_role";

grant trigger on table "public"."document_version" to "service_role";

grant truncate on table "public"."document_version" to "service_role";

grant update on table "public"."document_version" to "service_role";

grant references on table "public"."election" to "anon";

grant trigger on table "public"."election" to "anon";

grant truncate on table "public"."election" to "anon";

grant references on table "public"."election" to "authenticated";

grant trigger on table "public"."election" to "authenticated";

grant truncate on table "public"."election" to "authenticated";

grant delete on table "public"."election" to "service_role";

grant insert on table "public"."election" to "service_role";

grant references on table "public"."election" to "service_role";

grant select on table "public"."election" to "service_role";

grant trigger on table "public"."election" to "service_role";

grant truncate on table "public"."election" to "service_role";

grant update on table "public"."election" to "service_role";

grant references on table "public"."election_candidate" to "anon";

grant trigger on table "public"."election_candidate" to "anon";

grant truncate on table "public"."election_candidate" to "anon";

grant references on table "public"."election_candidate" to "authenticated";

grant trigger on table "public"."election_candidate" to "authenticated";

grant truncate on table "public"."election_candidate" to "authenticated";

grant delete on table "public"."election_candidate" to "service_role";

grant insert on table "public"."election_candidate" to "service_role";

grant references on table "public"."election_candidate" to "service_role";

grant select on table "public"."election_candidate" to "service_role";

grant trigger on table "public"."election_candidate" to "service_role";

grant truncate on table "public"."election_candidate" to "service_role";

grant update on table "public"."election_candidate" to "service_role";

grant references on table "public"."election_offline_tally" to "anon";

grant trigger on table "public"."election_offline_tally" to "anon";

grant truncate on table "public"."election_offline_tally" to "anon";

grant references on table "public"."election_offline_tally" to "authenticated";

grant trigger on table "public"."election_offline_tally" to "authenticated";

grant truncate on table "public"."election_offline_tally" to "authenticated";

grant delete on table "public"."election_offline_tally" to "service_role";

grant insert on table "public"."election_offline_tally" to "service_role";

grant references on table "public"."election_offline_tally" to "service_role";

grant select on table "public"."election_offline_tally" to "service_role";

grant trigger on table "public"."election_offline_tally" to "service_role";

grant truncate on table "public"."election_offline_tally" to "service_role";

grant update on table "public"."election_offline_tally" to "service_role";

grant references on table "public"."elector" to "anon";

grant trigger on table "public"."elector" to "anon";

grant truncate on table "public"."elector" to "anon";

grant references on table "public"."elector" to "authenticated";

grant trigger on table "public"."elector" to "authenticated";

grant truncate on table "public"."elector" to "authenticated";

grant delete on table "public"."elector" to "service_role";

grant insert on table "public"."elector" to "service_role";

grant references on table "public"."elector" to "service_role";

grant select on table "public"."elector" to "service_role";

grant trigger on table "public"."elector" to "service_role";

grant truncate on table "public"."elector" to "service_role";

grant update on table "public"."elector" to "service_role";

grant references on table "public"."event" to "anon";

grant trigger on table "public"."event" to "anon";

grant truncate on table "public"."event" to "anon";

grant references on table "public"."event" to "authenticated";

grant trigger on table "public"."event" to "authenticated";

grant truncate on table "public"."event" to "authenticated";

grant delete on table "public"."event" to "service_role";

grant insert on table "public"."event" to "service_role";

grant references on table "public"."event" to "service_role";

grant select on table "public"."event" to "service_role";

grant trigger on table "public"."event" to "service_role";

grant truncate on table "public"."event" to "service_role";

grant update on table "public"."event" to "service_role";

grant references on table "public"."event_assembly_scope" to "anon";

grant trigger on table "public"."event_assembly_scope" to "anon";

grant truncate on table "public"."event_assembly_scope" to "anon";

grant references on table "public"."event_assembly_scope" to "authenticated";

grant trigger on table "public"."event_assembly_scope" to "authenticated";

grant truncate on table "public"."event_assembly_scope" to "authenticated";

grant delete on table "public"."event_assembly_scope" to "service_role";

grant insert on table "public"."event_assembly_scope" to "service_role";

grant references on table "public"."event_assembly_scope" to "service_role";

grant select on table "public"."event_assembly_scope" to "service_role";

grant trigger on table "public"."event_assembly_scope" to "service_role";

grant truncate on table "public"."event_assembly_scope" to "service_role";

grant update on table "public"."event_assembly_scope" to "service_role";

grant references on table "public"."event_delegate" to "anon";

grant trigger on table "public"."event_delegate" to "anon";

grant truncate on table "public"."event_delegate" to "anon";

grant references on table "public"."event_delegate" to "authenticated";

grant trigger on table "public"."event_delegate" to "authenticated";

grant truncate on table "public"."event_delegate" to "authenticated";

grant delete on table "public"."event_delegate" to "service_role";

grant insert on table "public"."event_delegate" to "service_role";

grant references on table "public"."event_delegate" to "service_role";

grant select on table "public"."event_delegate" to "service_role";

grant trigger on table "public"."event_delegate" to "service_role";

grant truncate on table "public"."event_delegate" to "service_role";

grant update on table "public"."event_delegate" to "service_role";

grant references on table "public"."event_exception" to "anon";

grant trigger on table "public"."event_exception" to "anon";

grant truncate on table "public"."event_exception" to "anon";

grant references on table "public"."event_exception" to "authenticated";

grant trigger on table "public"."event_exception" to "authenticated";

grant truncate on table "public"."event_exception" to "authenticated";

grant delete on table "public"."event_exception" to "service_role";

grant insert on table "public"."event_exception" to "service_role";

grant references on table "public"."event_exception" to "service_role";

grant select on table "public"."event_exception" to "service_role";

grant trigger on table "public"."event_exception" to "service_role";

grant truncate on table "public"."event_exception" to "service_role";

grant update on table "public"."event_exception" to "service_role";

grant references on table "public"."event_hashtag" to "anon";

grant trigger on table "public"."event_hashtag" to "anon";

grant truncate on table "public"."event_hashtag" to "anon";

grant references on table "public"."event_hashtag" to "authenticated";

grant trigger on table "public"."event_hashtag" to "authenticated";

grant truncate on table "public"."event_hashtag" to "authenticated";

grant delete on table "public"."event_hashtag" to "service_role";

grant insert on table "public"."event_hashtag" to "service_role";

grant references on table "public"."event_hashtag" to "service_role";

grant select on table "public"."event_hashtag" to "service_role";

grant trigger on table "public"."event_hashtag" to "service_role";

grant truncate on table "public"."event_hashtag" to "service_role";

grant update on table "public"."event_hashtag" to "service_role";

grant references on table "public"."event_offline_participant" to "anon";

grant trigger on table "public"."event_offline_participant" to "anon";

grant truncate on table "public"."event_offline_participant" to "anon";

grant references on table "public"."event_offline_participant" to "authenticated";

grant trigger on table "public"."event_offline_participant" to "authenticated";

grant truncate on table "public"."event_offline_participant" to "authenticated";

grant delete on table "public"."event_offline_participant" to "service_role";

grant insert on table "public"."event_offline_participant" to "service_role";

grant references on table "public"."event_offline_participant" to "service_role";

grant select on table "public"."event_offline_participant" to "service_role";

grant trigger on table "public"."event_offline_participant" to "service_role";

grant truncate on table "public"."event_offline_participant" to "service_role";

grant update on table "public"."event_offline_participant" to "service_role";

grant references on table "public"."event_participant" to "anon";

grant trigger on table "public"."event_participant" to "anon";

grant truncate on table "public"."event_participant" to "anon";

grant references on table "public"."event_participant" to "authenticated";

grant trigger on table "public"."event_participant" to "authenticated";

grant truncate on table "public"."event_participant" to "authenticated";

grant delete on table "public"."event_participant" to "service_role";

grant insert on table "public"."event_participant" to "service_role";

grant references on table "public"."event_participant" to "service_role";

grant select on table "public"."event_participant" to "service_role";

grant trigger on table "public"."event_participant" to "service_role";

grant truncate on table "public"."event_participant" to "service_role";

grant update on table "public"."event_participant" to "service_role";

grant references on table "public"."event_participant_role" to "anon";

grant trigger on table "public"."event_participant_role" to "anon";

grant truncate on table "public"."event_participant_role" to "anon";

grant references on table "public"."event_participant_role" to "authenticated";

grant trigger on table "public"."event_participant_role" to "authenticated";

grant truncate on table "public"."event_participant_role" to "authenticated";

grant delete on table "public"."event_participant_role" to "service_role";

grant insert on table "public"."event_participant_role" to "service_role";

grant references on table "public"."event_participant_role" to "service_role";

grant select on table "public"."event_participant_role" to "service_role";

grant trigger on table "public"."event_participant_role" to "service_role";

grant truncate on table "public"."event_participant_role" to "service_role";

grant update on table "public"."event_participant_role" to "service_role";

grant references on table "public"."file" to "anon";

grant trigger on table "public"."file" to "anon";

grant truncate on table "public"."file" to "anon";

grant references on table "public"."file" to "authenticated";

grant trigger on table "public"."file" to "authenticated";

grant truncate on table "public"."file" to "authenticated";

grant delete on table "public"."file" to "service_role";

grant insert on table "public"."file" to "service_role";

grant references on table "public"."file" to "service_role";

grant select on table "public"."file" to "service_role";

grant trigger on table "public"."file" to "service_role";

grant truncate on table "public"."file" to "service_role";

grant update on table "public"."file" to "service_role";

grant references on table "public"."final_candidate_selection" to "anon";

grant trigger on table "public"."final_candidate_selection" to "anon";

grant truncate on table "public"."final_candidate_selection" to "anon";

grant references on table "public"."final_candidate_selection" to "authenticated";

grant trigger on table "public"."final_candidate_selection" to "authenticated";

grant truncate on table "public"."final_candidate_selection" to "authenticated";

grant delete on table "public"."final_candidate_selection" to "service_role";

grant insert on table "public"."final_candidate_selection" to "service_role";

grant references on table "public"."final_candidate_selection" to "service_role";

grant select on table "public"."final_candidate_selection" to "service_role";

grant trigger on table "public"."final_candidate_selection" to "service_role";

grant truncate on table "public"."final_candidate_selection" to "service_role";

grant update on table "public"."final_candidate_selection" to "service_role";

grant references on table "public"."final_choice_decision" to "anon";

grant trigger on table "public"."final_choice_decision" to "anon";

grant truncate on table "public"."final_choice_decision" to "anon";

grant references on table "public"."final_choice_decision" to "authenticated";

grant trigger on table "public"."final_choice_decision" to "authenticated";

grant truncate on table "public"."final_choice_decision" to "authenticated";

grant delete on table "public"."final_choice_decision" to "service_role";

grant insert on table "public"."final_choice_decision" to "service_role";

grant references on table "public"."final_choice_decision" to "service_role";

grant select on table "public"."final_choice_decision" to "service_role";

grant trigger on table "public"."final_choice_decision" to "service_role";

grant truncate on table "public"."final_choice_decision" to "service_role";

grant update on table "public"."final_choice_decision" to "service_role";

grant references on table "public"."final_elector_participation" to "anon";

grant trigger on table "public"."final_elector_participation" to "anon";

grant truncate on table "public"."final_elector_participation" to "anon";

grant references on table "public"."final_elector_participation" to "authenticated";

grant trigger on table "public"."final_elector_participation" to "authenticated";

grant truncate on table "public"."final_elector_participation" to "authenticated";

grant delete on table "public"."final_elector_participation" to "service_role";

grant insert on table "public"."final_elector_participation" to "service_role";

grant references on table "public"."final_elector_participation" to "service_role";

grant select on table "public"."final_elector_participation" to "service_role";

grant trigger on table "public"."final_elector_participation" to "service_role";

grant truncate on table "public"."final_elector_participation" to "service_role";

grant update on table "public"."final_elector_participation" to "service_role";

grant references on table "public"."final_voter_participation" to "anon";

grant trigger on table "public"."final_voter_participation" to "anon";

grant truncate on table "public"."final_voter_participation" to "anon";

grant references on table "public"."final_voter_participation" to "authenticated";

grant trigger on table "public"."final_voter_participation" to "authenticated";

grant truncate on table "public"."final_voter_participation" to "authenticated";

grant delete on table "public"."final_voter_participation" to "service_role";

grant insert on table "public"."final_voter_participation" to "service_role";

grant references on table "public"."final_voter_participation" to "service_role";

grant select on table "public"."final_voter_participation" to "service_role";

grant trigger on table "public"."final_voter_participation" to "service_role";

grant truncate on table "public"."final_voter_participation" to "service_role";

grant update on table "public"."final_voter_participation" to "service_role";

grant references on table "public"."follow" to "anon";

grant trigger on table "public"."follow" to "anon";

grant truncate on table "public"."follow" to "anon";

grant references on table "public"."follow" to "authenticated";

grant trigger on table "public"."follow" to "authenticated";

grant truncate on table "public"."follow" to "authenticated";

grant delete on table "public"."follow" to "service_role";

grant insert on table "public"."follow" to "service_role";

grant references on table "public"."follow" to "service_role";

grant select on table "public"."follow" to "service_role";

grant trigger on table "public"."follow" to "service_role";

grant truncate on table "public"."follow" to "service_role";

grant update on table "public"."follow" to "service_role";

grant references on table "public"."group" to "anon";

grant trigger on table "public"."group" to "anon";

grant truncate on table "public"."group" to "anon";

grant references on table "public"."group" to "authenticated";

grant trigger on table "public"."group" to "authenticated";

grant truncate on table "public"."group" to "authenticated";

grant delete on table "public"."group" to "service_role";

grant insert on table "public"."group" to "service_role";

grant references on table "public"."group" to "service_role";

grant select on table "public"."group" to "service_role";

grant trigger on table "public"."group" to "service_role";

grant truncate on table "public"."group" to "service_role";

grant update on table "public"."group" to "service_role";

grant references on table "public"."group_connection" to "anon";

grant trigger on table "public"."group_connection" to "anon";

grant truncate on table "public"."group_connection" to "anon";

grant references on table "public"."group_connection" to "authenticated";

grant trigger on table "public"."group_connection" to "authenticated";

grant truncate on table "public"."group_connection" to "authenticated";

grant delete on table "public"."group_connection" to "service_role";

grant insert on table "public"."group_connection" to "service_role";

grant references on table "public"."group_connection" to "service_role";

grant select on table "public"."group_connection" to "service_role";

grant trigger on table "public"."group_connection" to "service_role";

grant truncate on table "public"."group_connection" to "service_role";

grant update on table "public"."group_connection" to "service_role";

grant references on table "public"."group_connection_request" to "anon";

grant trigger on table "public"."group_connection_request" to "anon";

grant truncate on table "public"."group_connection_request" to "anon";

grant references on table "public"."group_connection_request" to "authenticated";

grant trigger on table "public"."group_connection_request" to "authenticated";

grant truncate on table "public"."group_connection_request" to "authenticated";

grant delete on table "public"."group_connection_request" to "service_role";

grant insert on table "public"."group_connection_request" to "service_role";

grant references on table "public"."group_connection_request" to "service_role";

grant select on table "public"."group_connection_request" to "service_role";

grant trigger on table "public"."group_connection_request" to "service_role";

grant truncate on table "public"."group_connection_request" to "service_role";

grant update on table "public"."group_connection_request" to "service_role";

grant references on table "public"."group_delegate_allocation" to "anon";

grant trigger on table "public"."group_delegate_allocation" to "anon";

grant truncate on table "public"."group_delegate_allocation" to "anon";

grant references on table "public"."group_delegate_allocation" to "authenticated";

grant trigger on table "public"."group_delegate_allocation" to "authenticated";

grant truncate on table "public"."group_delegate_allocation" to "authenticated";

grant delete on table "public"."group_delegate_allocation" to "service_role";

grant insert on table "public"."group_delegate_allocation" to "service_role";

grant references on table "public"."group_delegate_allocation" to "service_role";

grant select on table "public"."group_delegate_allocation" to "service_role";

grant trigger on table "public"."group_delegate_allocation" to "service_role";

grant truncate on table "public"."group_delegate_allocation" to "service_role";

grant update on table "public"."group_delegate_allocation" to "service_role";

grant references on table "public"."group_effective_right" to "anon";

grant trigger on table "public"."group_effective_right" to "anon";

grant truncate on table "public"."group_effective_right" to "anon";

grant references on table "public"."group_effective_right" to "authenticated";

grant trigger on table "public"."group_effective_right" to "authenticated";

grant truncate on table "public"."group_effective_right" to "authenticated";

grant delete on table "public"."group_effective_right" to "service_role";

grant insert on table "public"."group_effective_right" to "service_role";

grant references on table "public"."group_effective_right" to "service_role";

grant select on table "public"."group_effective_right" to "service_role";

grant trigger on table "public"."group_effective_right" to "service_role";

grant truncate on table "public"."group_effective_right" to "service_role";

grant update on table "public"."group_effective_right" to "service_role";

grant references on table "public"."group_guest_access" to "anon";

grant trigger on table "public"."group_guest_access" to "anon";

grant truncate on table "public"."group_guest_access" to "anon";

grant references on table "public"."group_guest_access" to "authenticated";

grant trigger on table "public"."group_guest_access" to "authenticated";

grant truncate on table "public"."group_guest_access" to "authenticated";

grant delete on table "public"."group_guest_access" to "service_role";

grant insert on table "public"."group_guest_access" to "service_role";

grant references on table "public"."group_guest_access" to "service_role";

grant select on table "public"."group_guest_access" to "service_role";

grant trigger on table "public"."group_guest_access" to "service_role";

grant truncate on table "public"."group_guest_access" to "service_role";

grant update on table "public"."group_guest_access" to "service_role";

grant references on table "public"."group_guest_role" to "anon";

grant trigger on table "public"."group_guest_role" to "anon";

grant truncate on table "public"."group_guest_role" to "anon";

grant references on table "public"."group_guest_role" to "authenticated";

grant trigger on table "public"."group_guest_role" to "authenticated";

grant truncate on table "public"."group_guest_role" to "authenticated";

grant delete on table "public"."group_guest_role" to "service_role";

grant insert on table "public"."group_guest_role" to "service_role";

grant references on table "public"."group_guest_role" to "service_role";

grant select on table "public"."group_guest_role" to "service_role";

grant trigger on table "public"."group_guest_role" to "service_role";

grant truncate on table "public"."group_guest_role" to "service_role";

grant update on table "public"."group_guest_role" to "service_role";

grant references on table "public"."group_hashtag" to "anon";

grant trigger on table "public"."group_hashtag" to "anon";

grant truncate on table "public"."group_hashtag" to "anon";

grant references on table "public"."group_hashtag" to "authenticated";

grant trigger on table "public"."group_hashtag" to "authenticated";

grant truncate on table "public"."group_hashtag" to "authenticated";

grant delete on table "public"."group_hashtag" to "service_role";

grant insert on table "public"."group_hashtag" to "service_role";

grant references on table "public"."group_hashtag" to "service_role";

grant select on table "public"."group_hashtag" to "service_role";

grant trigger on table "public"."group_hashtag" to "service_role";

grant truncate on table "public"."group_hashtag" to "service_role";

grant update on table "public"."group_hashtag" to "service_role";

grant references on table "public"."group_hierarchy_path" to "anon";

grant trigger on table "public"."group_hierarchy_path" to "anon";

grant truncate on table "public"."group_hierarchy_path" to "anon";

grant references on table "public"."group_hierarchy_path" to "authenticated";

grant trigger on table "public"."group_hierarchy_path" to "authenticated";

grant truncate on table "public"."group_hierarchy_path" to "authenticated";

grant delete on table "public"."group_hierarchy_path" to "service_role";

grant insert on table "public"."group_hierarchy_path" to "service_role";

grant references on table "public"."group_hierarchy_path" to "service_role";

grant select on table "public"."group_hierarchy_path" to "service_role";

grant trigger on table "public"."group_hierarchy_path" to "service_role";

grant truncate on table "public"."group_hierarchy_path" to "service_role";

grant update on table "public"."group_hierarchy_path" to "service_role";

grant references on table "public"."group_membership" to "anon";

grant trigger on table "public"."group_membership" to "anon";

grant truncate on table "public"."group_membership" to "anon";

grant references on table "public"."group_membership" to "authenticated";

grant trigger on table "public"."group_membership" to "authenticated";

grant truncate on table "public"."group_membership" to "authenticated";

grant delete on table "public"."group_membership" to "service_role";

grant insert on table "public"."group_membership" to "service_role";

grant references on table "public"."group_membership" to "service_role";

grant select on table "public"."group_membership" to "service_role";

grant trigger on table "public"."group_membership" to "service_role";

grant truncate on table "public"."group_membership" to "service_role";

grant update on table "public"."group_membership" to "service_role";

grant references on table "public"."group_membership_exclusivity_lock" to "anon";

grant trigger on table "public"."group_membership_exclusivity_lock" to "anon";

grant truncate on table "public"."group_membership_exclusivity_lock" to "anon";

grant references on table "public"."group_membership_exclusivity_lock" to "authenticated";

grant trigger on table "public"."group_membership_exclusivity_lock" to "authenticated";

grant truncate on table "public"."group_membership_exclusivity_lock" to "authenticated";

grant delete on table "public"."group_membership_exclusivity_lock" to "service_role";

grant insert on table "public"."group_membership_exclusivity_lock" to "service_role";

grant references on table "public"."group_membership_exclusivity_lock" to "service_role";

grant select on table "public"."group_membership_exclusivity_lock" to "service_role";

grant trigger on table "public"."group_membership_exclusivity_lock" to "service_role";

grant truncate on table "public"."group_membership_exclusivity_lock" to "service_role";

grant update on table "public"."group_membership_exclusivity_lock" to "service_role";

grant references on table "public"."group_membership_origin" to "anon";

grant trigger on table "public"."group_membership_origin" to "anon";

grant truncate on table "public"."group_membership_origin" to "anon";

grant references on table "public"."group_membership_origin" to "authenticated";

grant trigger on table "public"."group_membership_origin" to "authenticated";

grant truncate on table "public"."group_membership_origin" to "authenticated";

grant delete on table "public"."group_membership_origin" to "service_role";

grant insert on table "public"."group_membership_origin" to "service_role";

grant references on table "public"."group_membership_origin" to "service_role";

grant select on table "public"."group_membership_origin" to "service_role";

grant trigger on table "public"."group_membership_origin" to "service_role";

grant truncate on table "public"."group_membership_origin" to "service_role";

grant update on table "public"."group_membership_origin" to "service_role";

grant references on table "public"."group_membership_role" to "anon";

grant trigger on table "public"."group_membership_role" to "anon";

grant truncate on table "public"."group_membership_role" to "anon";

grant references on table "public"."group_membership_role" to "authenticated";

grant trigger on table "public"."group_membership_role" to "authenticated";

grant truncate on table "public"."group_membership_role" to "authenticated";

grant delete on table "public"."group_membership_role" to "service_role";

grant insert on table "public"."group_membership_role" to "service_role";

grant references on table "public"."group_membership_role" to "service_role";

grant select on table "public"."group_membership_role" to "service_role";

grant trigger on table "public"."group_membership_role" to "service_role";

grant truncate on table "public"."group_membership_role" to "service_role";

grant update on table "public"."group_membership_role" to "service_role";

grant references on table "public"."group_membership_rule" to "anon";

grant trigger on table "public"."group_membership_rule" to "anon";

grant truncate on table "public"."group_membership_rule" to "anon";

grant references on table "public"."group_membership_rule" to "authenticated";

grant trigger on table "public"."group_membership_rule" to "authenticated";

grant truncate on table "public"."group_membership_rule" to "authenticated";

grant delete on table "public"."group_membership_rule" to "service_role";

grant insert on table "public"."group_membership_rule" to "service_role";

grant references on table "public"."group_membership_rule" to "service_role";

grant select on table "public"."group_membership_rule" to "service_role";

grant trigger on table "public"."group_membership_rule" to "service_role";

grant truncate on table "public"."group_membership_rule" to "service_role";

grant update on table "public"."group_membership_rule" to "service_role";

grant references on table "public"."group_membership_rule_origin" to "anon";

grant trigger on table "public"."group_membership_rule_origin" to "anon";

grant truncate on table "public"."group_membership_rule_origin" to "anon";

grant references on table "public"."group_membership_rule_origin" to "authenticated";

grant trigger on table "public"."group_membership_rule_origin" to "authenticated";

grant truncate on table "public"."group_membership_rule_origin" to "authenticated";

grant delete on table "public"."group_membership_rule_origin" to "service_role";

grant insert on table "public"."group_membership_rule_origin" to "service_role";

grant references on table "public"."group_membership_rule_origin" to "service_role";

grant select on table "public"."group_membership_rule_origin" to "service_role";

grant trigger on table "public"."group_membership_rule_origin" to "service_role";

grant truncate on table "public"."group_membership_rule_origin" to "service_role";

grant update on table "public"."group_membership_rule_origin" to "service_role";

grant references on table "public"."group_membership_rule_request" to "anon";

grant trigger on table "public"."group_membership_rule_request" to "anon";

grant truncate on table "public"."group_membership_rule_request" to "anon";

grant references on table "public"."group_membership_rule_request" to "authenticated";

grant trigger on table "public"."group_membership_rule_request" to "authenticated";

grant truncate on table "public"."group_membership_rule_request" to "authenticated";

grant delete on table "public"."group_membership_rule_request" to "service_role";

grant insert on table "public"."group_membership_rule_request" to "service_role";

grant references on table "public"."group_membership_rule_request" to "service_role";

grant select on table "public"."group_membership_rule_request" to "service_role";

grant trigger on table "public"."group_membership_rule_request" to "service_role";

grant truncate on table "public"."group_membership_rule_request" to "service_role";

grant update on table "public"."group_membership_rule_request" to "service_role";

grant references on table "public"."group_membership_rule_request_origin" to "anon";

grant trigger on table "public"."group_membership_rule_request_origin" to "anon";

grant truncate on table "public"."group_membership_rule_request_origin" to "anon";

grant references on table "public"."group_membership_rule_request_origin" to "authenticated";

grant trigger on table "public"."group_membership_rule_request_origin" to "authenticated";

grant truncate on table "public"."group_membership_rule_request_origin" to "authenticated";

grant delete on table "public"."group_membership_rule_request_origin" to "service_role";

grant insert on table "public"."group_membership_rule_request_origin" to "service_role";

grant references on table "public"."group_membership_rule_request_origin" to "service_role";

grant select on table "public"."group_membership_rule_request_origin" to "service_role";

grant trigger on table "public"."group_membership_rule_request_origin" to "service_role";

grant truncate on table "public"."group_membership_rule_request_origin" to "service_role";

grant update on table "public"."group_membership_rule_request_origin" to "service_role";

grant references on table "public"."group_offline_member" to "anon";

grant trigger on table "public"."group_offline_member" to "anon";

grant truncate on table "public"."group_offline_member" to "anon";

grant references on table "public"."group_offline_member" to "authenticated";

grant trigger on table "public"."group_offline_member" to "authenticated";

grant truncate on table "public"."group_offline_member" to "authenticated";

grant delete on table "public"."group_offline_member" to "service_role";

grant insert on table "public"."group_offline_member" to "service_role";

grant references on table "public"."group_offline_member" to "service_role";

grant select on table "public"."group_offline_member" to "service_role";

grant trigger on table "public"."group_offline_member" to "service_role";

grant truncate on table "public"."group_offline_member" to "service_role";

grant update on table "public"."group_offline_member" to "service_role";

grant references on table "public"."group_offline_membership" to "anon";

grant trigger on table "public"."group_offline_membership" to "anon";

grant truncate on table "public"."group_offline_membership" to "anon";

grant references on table "public"."group_offline_membership" to "authenticated";

grant trigger on table "public"."group_offline_membership" to "authenticated";

grant truncate on table "public"."group_offline_membership" to "authenticated";

grant delete on table "public"."group_offline_membership" to "service_role";

grant insert on table "public"."group_offline_membership" to "service_role";

grant references on table "public"."group_offline_membership" to "service_role";

grant select on table "public"."group_offline_membership" to "service_role";

grant trigger on table "public"."group_offline_membership" to "service_role";

grant truncate on table "public"."group_offline_membership" to "service_role";

grant update on table "public"."group_offline_membership" to "service_role";

grant references on table "public"."group_offline_membership_role" to "anon";

grant trigger on table "public"."group_offline_membership_role" to "anon";

grant truncate on table "public"."group_offline_membership_role" to "anon";

grant references on table "public"."group_offline_membership_role" to "authenticated";

grant trigger on table "public"."group_offline_membership_role" to "authenticated";

grant truncate on table "public"."group_offline_membership_role" to "authenticated";

grant delete on table "public"."group_offline_membership_role" to "service_role";

grant insert on table "public"."group_offline_membership_role" to "service_role";

grant references on table "public"."group_offline_membership_role" to "service_role";

grant select on table "public"."group_offline_membership_role" to "service_role";

grant trigger on table "public"."group_offline_membership_role" to "service_role";

grant truncate on table "public"."group_offline_membership_role" to "service_role";

grant update on table "public"."group_offline_membership_role" to "service_role";

grant references on table "public"."group_right_grant" to "anon";

grant trigger on table "public"."group_right_grant" to "anon";

grant truncate on table "public"."group_right_grant" to "anon";

grant references on table "public"."group_right_grant" to "authenticated";

grant trigger on table "public"."group_right_grant" to "authenticated";

grant truncate on table "public"."group_right_grant" to "authenticated";

grant delete on table "public"."group_right_grant" to "service_role";

grant insert on table "public"."group_right_grant" to "service_role";

grant references on table "public"."group_right_grant" to "service_role";

grant select on table "public"."group_right_grant" to "service_role";

grant trigger on table "public"."group_right_grant" to "service_role";

grant truncate on table "public"."group_right_grant" to "service_role";

grant update on table "public"."group_right_grant" to "service_role";

grant references on table "public"."group_right_grant_request" to "anon";

grant trigger on table "public"."group_right_grant_request" to "anon";

grant truncate on table "public"."group_right_grant_request" to "anon";

grant references on table "public"."group_right_grant_request" to "authenticated";

grant trigger on table "public"."group_right_grant_request" to "authenticated";

grant truncate on table "public"."group_right_grant_request" to "authenticated";

grant delete on table "public"."group_right_grant_request" to "service_role";

grant insert on table "public"."group_right_grant_request" to "service_role";

grant references on table "public"."group_right_grant_request" to "service_role";

grant select on table "public"."group_right_grant_request" to "service_role";

grant trigger on table "public"."group_right_grant_request" to "service_role";

grant truncate on table "public"."group_right_grant_request" to "service_role";

grant update on table "public"."group_right_grant_request" to "service_role";

grant references on table "public"."group_sibling_source_lock" to "anon";

grant trigger on table "public"."group_sibling_source_lock" to "anon";

grant truncate on table "public"."group_sibling_source_lock" to "anon";

grant references on table "public"."group_sibling_source_lock" to "authenticated";

grant trigger on table "public"."group_sibling_source_lock" to "authenticated";

grant truncate on table "public"."group_sibling_source_lock" to "authenticated";

grant delete on table "public"."group_sibling_source_lock" to "service_role";

grant insert on table "public"."group_sibling_source_lock" to "service_role";

grant references on table "public"."group_sibling_source_lock" to "service_role";

grant select on table "public"."group_sibling_source_lock" to "service_role";

grant trigger on table "public"."group_sibling_source_lock" to "service_role";

grant truncate on table "public"."group_sibling_source_lock" to "service_role";

grant update on table "public"."group_sibling_source_lock" to "service_role";

grant references on table "public"."group_workflow" to "anon";

grant trigger on table "public"."group_workflow" to "anon";

grant truncate on table "public"."group_workflow" to "anon";

grant references on table "public"."group_workflow" to "authenticated";

grant trigger on table "public"."group_workflow" to "authenticated";

grant truncate on table "public"."group_workflow" to "authenticated";

grant delete on table "public"."group_workflow" to "service_role";

grant insert on table "public"."group_workflow" to "service_role";

grant references on table "public"."group_workflow" to "service_role";

grant select on table "public"."group_workflow" to "service_role";

grant trigger on table "public"."group_workflow" to "service_role";

grant truncate on table "public"."group_workflow" to "service_role";

grant update on table "public"."group_workflow" to "service_role";

grant references on table "public"."group_workflow_approval" to "anon";

grant trigger on table "public"."group_workflow_approval" to "anon";

grant truncate on table "public"."group_workflow_approval" to "anon";

grant references on table "public"."group_workflow_approval" to "authenticated";

grant trigger on table "public"."group_workflow_approval" to "authenticated";

grant truncate on table "public"."group_workflow_approval" to "authenticated";

grant delete on table "public"."group_workflow_approval" to "service_role";

grant insert on table "public"."group_workflow_approval" to "service_role";

grant references on table "public"."group_workflow_approval" to "service_role";

grant select on table "public"."group_workflow_approval" to "service_role";

grant trigger on table "public"."group_workflow_approval" to "service_role";

grant truncate on table "public"."group_workflow_approval" to "service_role";

grant update on table "public"."group_workflow_approval" to "service_role";

grant references on table "public"."group_workflow_step" to "anon";

grant trigger on table "public"."group_workflow_step" to "anon";

grant truncate on table "public"."group_workflow_step" to "anon";

grant references on table "public"."group_workflow_step" to "authenticated";

grant trigger on table "public"."group_workflow_step" to "authenticated";

grant truncate on table "public"."group_workflow_step" to "authenticated";

grant delete on table "public"."group_workflow_step" to "service_role";

grant insert on table "public"."group_workflow_step" to "service_role";

grant references on table "public"."group_workflow_step" to "service_role";

grant select on table "public"."group_workflow_step" to "service_role";

grant trigger on table "public"."group_workflow_step" to "service_role";

grant truncate on table "public"."group_workflow_step" to "service_role";

grant update on table "public"."group_workflow_step" to "service_role";

grant references on table "public"."hashtag" to "anon";

grant trigger on table "public"."hashtag" to "anon";

grant truncate on table "public"."hashtag" to "anon";

grant references on table "public"."hashtag" to "authenticated";

grant trigger on table "public"."hashtag" to "authenticated";

grant truncate on table "public"."hashtag" to "authenticated";

grant delete on table "public"."hashtag" to "service_role";

grant insert on table "public"."hashtag" to "service_role";

grant references on table "public"."hashtag" to "service_role";

grant select on table "public"."hashtag" to "service_role";

grant trigger on table "public"."hashtag" to "service_role";

grant truncate on table "public"."hashtag" to "service_role";

grant update on table "public"."hashtag" to "service_role";

grant references on table "public"."indicative_candidate_selection" to "anon";

grant trigger on table "public"."indicative_candidate_selection" to "anon";

grant truncate on table "public"."indicative_candidate_selection" to "anon";

grant references on table "public"."indicative_candidate_selection" to "authenticated";

grant trigger on table "public"."indicative_candidate_selection" to "authenticated";

grant truncate on table "public"."indicative_candidate_selection" to "authenticated";

grant delete on table "public"."indicative_candidate_selection" to "service_role";

grant insert on table "public"."indicative_candidate_selection" to "service_role";

grant references on table "public"."indicative_candidate_selection" to "service_role";

grant select on table "public"."indicative_candidate_selection" to "service_role";

grant trigger on table "public"."indicative_candidate_selection" to "service_role";

grant truncate on table "public"."indicative_candidate_selection" to "service_role";

grant update on table "public"."indicative_candidate_selection" to "service_role";

grant references on table "public"."indicative_choice_decision" to "anon";

grant trigger on table "public"."indicative_choice_decision" to "anon";

grant truncate on table "public"."indicative_choice_decision" to "anon";

grant references on table "public"."indicative_choice_decision" to "authenticated";

grant trigger on table "public"."indicative_choice_decision" to "authenticated";

grant truncate on table "public"."indicative_choice_decision" to "authenticated";

grant delete on table "public"."indicative_choice_decision" to "service_role";

grant insert on table "public"."indicative_choice_decision" to "service_role";

grant references on table "public"."indicative_choice_decision" to "service_role";

grant select on table "public"."indicative_choice_decision" to "service_role";

grant trigger on table "public"."indicative_choice_decision" to "service_role";

grant truncate on table "public"."indicative_choice_decision" to "service_role";

grant update on table "public"."indicative_choice_decision" to "service_role";

grant references on table "public"."indicative_elector_participation" to "anon";

grant trigger on table "public"."indicative_elector_participation" to "anon";

grant truncate on table "public"."indicative_elector_participation" to "anon";

grant references on table "public"."indicative_elector_participation" to "authenticated";

grant trigger on table "public"."indicative_elector_participation" to "authenticated";

grant truncate on table "public"."indicative_elector_participation" to "authenticated";

grant delete on table "public"."indicative_elector_participation" to "service_role";

grant insert on table "public"."indicative_elector_participation" to "service_role";

grant references on table "public"."indicative_elector_participation" to "service_role";

grant select on table "public"."indicative_elector_participation" to "service_role";

grant trigger on table "public"."indicative_elector_participation" to "service_role";

grant truncate on table "public"."indicative_elector_participation" to "service_role";

grant update on table "public"."indicative_elector_participation" to "service_role";

grant references on table "public"."indicative_voter_participation" to "anon";

grant trigger on table "public"."indicative_voter_participation" to "anon";

grant truncate on table "public"."indicative_voter_participation" to "anon";

grant references on table "public"."indicative_voter_participation" to "authenticated";

grant trigger on table "public"."indicative_voter_participation" to "authenticated";

grant truncate on table "public"."indicative_voter_participation" to "authenticated";

grant delete on table "public"."indicative_voter_participation" to "service_role";

grant insert on table "public"."indicative_voter_participation" to "service_role";

grant references on table "public"."indicative_voter_participation" to "service_role";

grant select on table "public"."indicative_voter_participation" to "service_role";

grant trigger on table "public"."indicative_voter_participation" to "service_role";

grant truncate on table "public"."indicative_voter_participation" to "service_role";

grant update on table "public"."indicative_voter_participation" to "service_role";

grant references on table "public"."link" to "anon";

grant trigger on table "public"."link" to "anon";

grant truncate on table "public"."link" to "anon";

grant references on table "public"."link" to "authenticated";

grant trigger on table "public"."link" to "authenticated";

grant truncate on table "public"."link" to "authenticated";

grant delete on table "public"."link" to "service_role";

grant insert on table "public"."link" to "service_role";

grant references on table "public"."link" to "service_role";

grant select on table "public"."link" to "service_role";

grant trigger on table "public"."link" to "service_role";

grant truncate on table "public"."link" to "service_role";

grant update on table "public"."link" to "service_role";

grant references on table "public"."message" to "anon";

grant trigger on table "public"."message" to "anon";

grant truncate on table "public"."message" to "anon";

grant references on table "public"."message" to "authenticated";

grant trigger on table "public"."message" to "authenticated";

grant truncate on table "public"."message" to "authenticated";

grant delete on table "public"."message" to "service_role";

grant insert on table "public"."message" to "service_role";

grant references on table "public"."message" to "service_role";

grant select on table "public"."message" to "service_role";

grant trigger on table "public"."message" to "service_role";

grant truncate on table "public"."message" to "service_role";

grant update on table "public"."message" to "service_role";

grant delete on table "public"."newsletter_subscription" to "service_role";

grant insert on table "public"."newsletter_subscription" to "service_role";

grant references on table "public"."newsletter_subscription" to "service_role";

grant select on table "public"."newsletter_subscription" to "service_role";

grant trigger on table "public"."newsletter_subscription" to "service_role";

grant truncate on table "public"."newsletter_subscription" to "service_role";

grant update on table "public"."newsletter_subscription" to "service_role";

grant delete on table "public"."newsletter_sync_outbox" to "service_role";

grant insert on table "public"."newsletter_sync_outbox" to "service_role";

grant references on table "public"."newsletter_sync_outbox" to "service_role";

grant select on table "public"."newsletter_sync_outbox" to "service_role";

grant trigger on table "public"."newsletter_sync_outbox" to "service_role";

grant truncate on table "public"."newsletter_sync_outbox" to "service_role";

grant update on table "public"."newsletter_sync_outbox" to "service_role";

grant references on table "public"."notification" to "anon";

grant trigger on table "public"."notification" to "anon";

grant truncate on table "public"."notification" to "anon";

grant references on table "public"."notification" to "authenticated";

grant trigger on table "public"."notification" to "authenticated";

grant truncate on table "public"."notification" to "authenticated";

grant delete on table "public"."notification" to "service_role";

grant insert on table "public"."notification" to "service_role";

grant references on table "public"."notification" to "service_role";

grant select on table "public"."notification" to "service_role";

grant trigger on table "public"."notification" to "service_role";

grant truncate on table "public"."notification" to "service_role";

grant update on table "public"."notification" to "service_role";

grant references on table "public"."notification_read" to "anon";

grant trigger on table "public"."notification_read" to "anon";

grant truncate on table "public"."notification_read" to "anon";

grant references on table "public"."notification_read" to "authenticated";

grant trigger on table "public"."notification_read" to "authenticated";

grant truncate on table "public"."notification_read" to "authenticated";

grant delete on table "public"."notification_read" to "service_role";

grant insert on table "public"."notification_read" to "service_role";

grant references on table "public"."notification_read" to "service_role";

grant select on table "public"."notification_read" to "service_role";

grant trigger on table "public"."notification_read" to "service_role";

grant truncate on table "public"."notification_read" to "service_role";

grant update on table "public"."notification_read" to "service_role";

grant references on table "public"."notification_setting" to "anon";

grant trigger on table "public"."notification_setting" to "anon";

grant truncate on table "public"."notification_setting" to "anon";

grant references on table "public"."notification_setting" to "authenticated";

grant trigger on table "public"."notification_setting" to "authenticated";

grant truncate on table "public"."notification_setting" to "authenticated";

grant delete on table "public"."notification_setting" to "service_role";

grant insert on table "public"."notification_setting" to "service_role";

grant references on table "public"."notification_setting" to "service_role";

grant select on table "public"."notification_setting" to "service_role";

grant trigger on table "public"."notification_setting" to "service_role";

grant truncate on table "public"."notification_setting" to "service_role";

grant update on table "public"."notification_setting" to "service_role";

grant references on table "public"."notification_user_state" to "anon";

grant trigger on table "public"."notification_user_state" to "anon";

grant truncate on table "public"."notification_user_state" to "anon";

grant references on table "public"."notification_user_state" to "authenticated";

grant trigger on table "public"."notification_user_state" to "authenticated";

grant truncate on table "public"."notification_user_state" to "authenticated";

grant delete on table "public"."notification_user_state" to "service_role";

grant insert on table "public"."notification_user_state" to "service_role";

grant references on table "public"."notification_user_state" to "service_role";

grant select on table "public"."notification_user_state" to "service_role";

grant trigger on table "public"."notification_user_state" to "service_role";

grant truncate on table "public"."notification_user_state" to "service_role";

grant update on table "public"."notification_user_state" to "service_role";

grant references on table "public"."participant" to "anon";

grant trigger on table "public"."participant" to "anon";

grant truncate on table "public"."participant" to "anon";

grant references on table "public"."participant" to "authenticated";

grant trigger on table "public"."participant" to "authenticated";

grant truncate on table "public"."participant" to "authenticated";

grant delete on table "public"."participant" to "service_role";

grant insert on table "public"."participant" to "service_role";

grant references on table "public"."participant" to "service_role";

grant select on table "public"."participant" to "service_role";

grant trigger on table "public"."participant" to "service_role";

grant truncate on table "public"."participant" to "service_role";

grant update on table "public"."participant" to "service_role";

grant references on table "public"."payment" to "anon";

grant trigger on table "public"."payment" to "anon";

grant truncate on table "public"."payment" to "anon";

grant references on table "public"."payment" to "authenticated";

grant trigger on table "public"."payment" to "authenticated";

grant truncate on table "public"."payment" to "authenticated";

grant delete on table "public"."payment" to "service_role";

grant insert on table "public"."payment" to "service_role";

grant references on table "public"."payment" to "service_role";

grant select on table "public"."payment" to "service_role";

grant trigger on table "public"."payment" to "service_role";

grant truncate on table "public"."payment" to "service_role";

grant update on table "public"."payment" to "service_role";

grant references on table "public"."pql_filter" to "anon";

grant trigger on table "public"."pql_filter" to "anon";

grant truncate on table "public"."pql_filter" to "anon";

grant references on table "public"."pql_filter" to "authenticated";

grant trigger on table "public"."pql_filter" to "authenticated";

grant truncate on table "public"."pql_filter" to "authenticated";

grant delete on table "public"."pql_filter" to "service_role";

grant insert on table "public"."pql_filter" to "service_role";

grant references on table "public"."pql_filter" to "service_role";

grant select on table "public"."pql_filter" to "service_role";

grant trigger on table "public"."pql_filter" to "service_role";

grant truncate on table "public"."pql_filter" to "service_role";

grant update on table "public"."pql_filter" to "service_role";

grant references on table "public"."process_task" to "anon";

grant trigger on table "public"."process_task" to "anon";

grant truncate on table "public"."process_task" to "anon";

grant references on table "public"."process_task" to "authenticated";

grant trigger on table "public"."process_task" to "authenticated";

grant truncate on table "public"."process_task" to "authenticated";

grant delete on table "public"."process_task" to "service_role";

grant insert on table "public"."process_task" to "service_role";

grant references on table "public"."process_task" to "service_role";

grant select on table "public"."process_task" to "service_role";

grant trigger on table "public"."process_task" to "service_role";

grant truncate on table "public"."process_task" to "service_role";

grant update on table "public"."process_task" to "service_role";

grant references on table "public"."push_delivery_outbox" to "anon";

grant trigger on table "public"."push_delivery_outbox" to "anon";

grant truncate on table "public"."push_delivery_outbox" to "anon";

grant references on table "public"."push_delivery_outbox" to "authenticated";

grant trigger on table "public"."push_delivery_outbox" to "authenticated";

grant truncate on table "public"."push_delivery_outbox" to "authenticated";

grant delete on table "public"."push_delivery_outbox" to "service_role";

grant insert on table "public"."push_delivery_outbox" to "service_role";

grant references on table "public"."push_delivery_outbox" to "service_role";

grant select on table "public"."push_delivery_outbox" to "service_role";

grant trigger on table "public"."push_delivery_outbox" to "service_role";

grant truncate on table "public"."push_delivery_outbox" to "service_role";

grant update on table "public"."push_delivery_outbox" to "service_role";

grant references on table "public"."push_notification_outbox" to "anon";

grant trigger on table "public"."push_notification_outbox" to "anon";

grant truncate on table "public"."push_notification_outbox" to "anon";

grant references on table "public"."push_notification_outbox" to "authenticated";

grant trigger on table "public"."push_notification_outbox" to "authenticated";

grant truncate on table "public"."push_notification_outbox" to "authenticated";

grant delete on table "public"."push_notification_outbox" to "service_role";

grant insert on table "public"."push_notification_outbox" to "service_role";

grant references on table "public"."push_notification_outbox" to "service_role";

grant select on table "public"."push_notification_outbox" to "service_role";

grant trigger on table "public"."push_notification_outbox" to "service_role";

grant truncate on table "public"."push_notification_outbox" to "service_role";

grant update on table "public"."push_notification_outbox" to "service_role";

grant references on table "public"."push_subscription" to "anon";

grant trigger on table "public"."push_subscription" to "anon";

grant truncate on table "public"."push_subscription" to "anon";

grant references on table "public"."push_subscription" to "authenticated";

grant trigger on table "public"."push_subscription" to "authenticated";

grant truncate on table "public"."push_subscription" to "authenticated";

grant delete on table "public"."push_subscription" to "service_role";

grant insert on table "public"."push_subscription" to "service_role";

grant references on table "public"."push_subscription" to "service_role";

grant select on table "public"."push_subscription" to "service_role";

grant trigger on table "public"."push_subscription" to "service_role";

grant truncate on table "public"."push_subscription" to "service_role";

grant update on table "public"."push_subscription" to "service_role";

grant references on table "public"."reaction" to "anon";

grant trigger on table "public"."reaction" to "anon";

grant truncate on table "public"."reaction" to "anon";

grant references on table "public"."reaction" to "authenticated";

grant trigger on table "public"."reaction" to "authenticated";

grant truncate on table "public"."reaction" to "authenticated";

grant delete on table "public"."reaction" to "service_role";

grant insert on table "public"."reaction" to "service_role";

grant references on table "public"."reaction" to "service_role";

grant select on table "public"."reaction" to "service_role";

grant trigger on table "public"."reaction" to "service_role";

grant truncate on table "public"."reaction" to "service_role";

grant update on table "public"."reaction" to "service_role";

grant delete on table "public"."resend_webhook_event" to "service_role";

grant insert on table "public"."resend_webhook_event" to "service_role";

grant references on table "public"."resend_webhook_event" to "service_role";

grant select on table "public"."resend_webhook_event" to "service_role";

grant trigger on table "public"."resend_webhook_event" to "service_role";

grant truncate on table "public"."resend_webhook_event" to "service_role";

grant update on table "public"."resend_webhook_event" to "service_role";

grant references on table "public"."role" to "anon";

grant trigger on table "public"."role" to "anon";

grant truncate on table "public"."role" to "anon";

grant references on table "public"."role" to "authenticated";

grant trigger on table "public"."role" to "authenticated";

grant truncate on table "public"."role" to "authenticated";

grant delete on table "public"."role" to "service_role";

grant insert on table "public"."role" to "service_role";

grant references on table "public"."role" to "service_role";

grant select on table "public"."role" to "service_role";

grant trigger on table "public"."role" to "service_role";

grant truncate on table "public"."role" to "service_role";

grant update on table "public"."role" to "service_role";

grant references on table "public"."role_holder_history" to "anon";

grant trigger on table "public"."role_holder_history" to "anon";

grant truncate on table "public"."role_holder_history" to "anon";

grant references on table "public"."role_holder_history" to "authenticated";

grant trigger on table "public"."role_holder_history" to "authenticated";

grant truncate on table "public"."role_holder_history" to "authenticated";

grant delete on table "public"."role_holder_history" to "service_role";

grant insert on table "public"."role_holder_history" to "service_role";

grant references on table "public"."role_holder_history" to "service_role";

grant select on table "public"."role_holder_history" to "service_role";

grant trigger on table "public"."role_holder_history" to "service_role";

grant truncate on table "public"."role_holder_history" to "service_role";

grant update on table "public"."role_holder_history" to "service_role";

grant references on table "public"."search_document" to "anon";

grant trigger on table "public"."search_document" to "anon";

grant truncate on table "public"."search_document" to "anon";

grant references on table "public"."search_document" to "authenticated";

grant trigger on table "public"."search_document" to "authenticated";

grant truncate on table "public"."search_document" to "authenticated";

grant delete on table "public"."search_document" to "service_role";

grant insert on table "public"."search_document" to "service_role";

grant references on table "public"."search_document" to "service_role";

grant select on table "public"."search_document" to "service_role";

grant trigger on table "public"."search_document" to "service_role";

grant truncate on table "public"."search_document" to "service_role";

grant update on table "public"."search_document" to "service_role";

grant references on table "public"."search_document_acl" to "anon";

grant trigger on table "public"."search_document_acl" to "anon";

grant truncate on table "public"."search_document_acl" to "anon";

grant references on table "public"."search_document_acl" to "authenticated";

grant trigger on table "public"."search_document_acl" to "authenticated";

grant truncate on table "public"."search_document_acl" to "authenticated";

grant delete on table "public"."search_document_acl" to "service_role";

grant insert on table "public"."search_document_acl" to "service_role";

grant references on table "public"."search_document_acl" to "service_role";

grant select on table "public"."search_document_acl" to "service_role";

grant trigger on table "public"."search_document_acl" to "service_role";

grant truncate on table "public"."search_document_acl" to "service_role";

grant update on table "public"."search_document_acl" to "service_role";

grant references on table "public"."search_document_topic" to "anon";

grant trigger on table "public"."search_document_topic" to "anon";

grant truncate on table "public"."search_document_topic" to "anon";

grant references on table "public"."search_document_topic" to "authenticated";

grant trigger on table "public"."search_document_topic" to "authenticated";

grant truncate on table "public"."search_document_topic" to "authenticated";

grant delete on table "public"."search_document_topic" to "service_role";

grant insert on table "public"."search_document_topic" to "service_role";

grant references on table "public"."search_document_topic" to "service_role";

grant select on table "public"."search_document_topic" to "service_role";

grant trigger on table "public"."search_document_topic" to "service_role";

grant truncate on table "public"."search_document_topic" to "service_role";

grant update on table "public"."search_document_topic" to "service_role";

grant references on table "public"."speaker_list" to "anon";

grant trigger on table "public"."speaker_list" to "anon";

grant truncate on table "public"."speaker_list" to "anon";

grant references on table "public"."speaker_list" to "authenticated";

grant trigger on table "public"."speaker_list" to "authenticated";

grant truncate on table "public"."speaker_list" to "authenticated";

grant delete on table "public"."speaker_list" to "service_role";

grant insert on table "public"."speaker_list" to "service_role";

grant references on table "public"."speaker_list" to "service_role";

grant select on table "public"."speaker_list" to "service_role";

grant trigger on table "public"."speaker_list" to "service_role";

grant truncate on table "public"."speaker_list" to "service_role";

grant update on table "public"."speaker_list" to "service_role";

grant references on table "public"."statement" to "anon";

grant trigger on table "public"."statement" to "anon";

grant truncate on table "public"."statement" to "anon";

grant references on table "public"."statement" to "authenticated";

grant trigger on table "public"."statement" to "authenticated";

grant truncate on table "public"."statement" to "authenticated";

grant delete on table "public"."statement" to "service_role";

grant insert on table "public"."statement" to "service_role";

grant references on table "public"."statement" to "service_role";

grant select on table "public"."statement" to "service_role";

grant trigger on table "public"."statement" to "service_role";

grant truncate on table "public"."statement" to "service_role";

grant update on table "public"."statement" to "service_role";

grant references on table "public"."statement_hashtag" to "anon";

grant trigger on table "public"."statement_hashtag" to "anon";

grant truncate on table "public"."statement_hashtag" to "anon";

grant references on table "public"."statement_hashtag" to "authenticated";

grant trigger on table "public"."statement_hashtag" to "authenticated";

grant truncate on table "public"."statement_hashtag" to "authenticated";

grant delete on table "public"."statement_hashtag" to "service_role";

grant insert on table "public"."statement_hashtag" to "service_role";

grant references on table "public"."statement_hashtag" to "service_role";

grant select on table "public"."statement_hashtag" to "service_role";

grant trigger on table "public"."statement_hashtag" to "service_role";

grant truncate on table "public"."statement_hashtag" to "service_role";

grant update on table "public"."statement_hashtag" to "service_role";

grant references on table "public"."statement_support_vote" to "anon";

grant trigger on table "public"."statement_support_vote" to "anon";

grant truncate on table "public"."statement_support_vote" to "anon";

grant references on table "public"."statement_support_vote" to "authenticated";

grant trigger on table "public"."statement_support_vote" to "authenticated";

grant truncate on table "public"."statement_support_vote" to "authenticated";

grant delete on table "public"."statement_support_vote" to "service_role";

grant insert on table "public"."statement_support_vote" to "service_role";

grant references on table "public"."statement_support_vote" to "service_role";

grant select on table "public"."statement_support_vote" to "service_role";

grant trigger on table "public"."statement_support_vote" to "service_role";

grant truncate on table "public"."statement_support_vote" to "service_role";

grant update on table "public"."statement_support_vote" to "service_role";

grant references on table "public"."statement_survey" to "anon";

grant trigger on table "public"."statement_survey" to "anon";

grant truncate on table "public"."statement_survey" to "anon";

grant references on table "public"."statement_survey" to "authenticated";

grant trigger on table "public"."statement_survey" to "authenticated";

grant truncate on table "public"."statement_survey" to "authenticated";

grant delete on table "public"."statement_survey" to "service_role";

grant insert on table "public"."statement_survey" to "service_role";

grant references on table "public"."statement_survey" to "service_role";

grant select on table "public"."statement_survey" to "service_role";

grant trigger on table "public"."statement_survey" to "service_role";

grant truncate on table "public"."statement_survey" to "service_role";

grant update on table "public"."statement_survey" to "service_role";

grant references on table "public"."statement_survey_option" to "anon";

grant trigger on table "public"."statement_survey_option" to "anon";

grant truncate on table "public"."statement_survey_option" to "anon";

grant references on table "public"."statement_survey_option" to "authenticated";

grant trigger on table "public"."statement_survey_option" to "authenticated";

grant truncate on table "public"."statement_survey_option" to "authenticated";

grant delete on table "public"."statement_survey_option" to "service_role";

grant insert on table "public"."statement_survey_option" to "service_role";

grant references on table "public"."statement_survey_option" to "service_role";

grant select on table "public"."statement_survey_option" to "service_role";

grant trigger on table "public"."statement_survey_option" to "service_role";

grant truncate on table "public"."statement_survey_option" to "service_role";

grant update on table "public"."statement_survey_option" to "service_role";

grant references on table "public"."statement_survey_vote" to "anon";

grant trigger on table "public"."statement_survey_vote" to "anon";

grant truncate on table "public"."statement_survey_vote" to "anon";

grant references on table "public"."statement_survey_vote" to "authenticated";

grant trigger on table "public"."statement_survey_vote" to "authenticated";

grant truncate on table "public"."statement_survey_vote" to "authenticated";

grant delete on table "public"."statement_survey_vote" to "service_role";

grant insert on table "public"."statement_survey_vote" to "service_role";

grant references on table "public"."statement_survey_vote" to "service_role";

grant select on table "public"."statement_survey_vote" to "service_role";

grant trigger on table "public"."statement_survey_vote" to "service_role";

grant truncate on table "public"."statement_survey_vote" to "service_role";

grant update on table "public"."statement_survey_vote" to "service_role";

grant references on table "public"."stripe_customer" to "anon";

grant trigger on table "public"."stripe_customer" to "anon";

grant truncate on table "public"."stripe_customer" to "anon";

grant references on table "public"."stripe_customer" to "authenticated";

grant trigger on table "public"."stripe_customer" to "authenticated";

grant truncate on table "public"."stripe_customer" to "authenticated";

grant delete on table "public"."stripe_customer" to "service_role";

grant insert on table "public"."stripe_customer" to "service_role";

grant references on table "public"."stripe_customer" to "service_role";

grant select on table "public"."stripe_customer" to "service_role";

grant trigger on table "public"."stripe_customer" to "service_role";

grant truncate on table "public"."stripe_customer" to "service_role";

grant update on table "public"."stripe_customer" to "service_role";

grant references on table "public"."stripe_payment" to "anon";

grant trigger on table "public"."stripe_payment" to "anon";

grant truncate on table "public"."stripe_payment" to "anon";

grant references on table "public"."stripe_payment" to "authenticated";

grant trigger on table "public"."stripe_payment" to "authenticated";

grant truncate on table "public"."stripe_payment" to "authenticated";

grant delete on table "public"."stripe_payment" to "service_role";

grant insert on table "public"."stripe_payment" to "service_role";

grant references on table "public"."stripe_payment" to "service_role";

grant select on table "public"."stripe_payment" to "service_role";

grant trigger on table "public"."stripe_payment" to "service_role";

grant truncate on table "public"."stripe_payment" to "service_role";

grant update on table "public"."stripe_payment" to "service_role";

grant references on table "public"."stripe_subscription" to "anon";

grant trigger on table "public"."stripe_subscription" to "anon";

grant truncate on table "public"."stripe_subscription" to "anon";

grant references on table "public"."stripe_subscription" to "authenticated";

grant trigger on table "public"."stripe_subscription" to "authenticated";

grant truncate on table "public"."stripe_subscription" to "authenticated";

grant delete on table "public"."stripe_subscription" to "service_role";

grant insert on table "public"."stripe_subscription" to "service_role";

grant references on table "public"."stripe_subscription" to "service_role";

grant select on table "public"."stripe_subscription" to "service_role";

grant trigger on table "public"."stripe_subscription" to "service_role";

grant truncate on table "public"."stripe_subscription" to "service_role";

grant update on table "public"."stripe_subscription" to "service_role";

grant references on table "public"."subscriber" to "anon";

grant trigger on table "public"."subscriber" to "anon";

grant truncate on table "public"."subscriber" to "anon";

grant references on table "public"."subscriber" to "authenticated";

grant trigger on table "public"."subscriber" to "authenticated";

grant truncate on table "public"."subscriber" to "authenticated";

grant delete on table "public"."subscriber" to "service_role";

grant insert on table "public"."subscriber" to "service_role";

grant references on table "public"."subscriber" to "service_role";

grant select on table "public"."subscriber" to "service_role";

grant trigger on table "public"."subscriber" to "service_role";

grant truncate on table "public"."subscriber" to "service_role";

grant update on table "public"."subscriber" to "service_role";

grant references on table "public"."support_confirmation" to "anon";

grant trigger on table "public"."support_confirmation" to "anon";

grant truncate on table "public"."support_confirmation" to "anon";

grant references on table "public"."support_confirmation" to "authenticated";

grant trigger on table "public"."support_confirmation" to "authenticated";

grant truncate on table "public"."support_confirmation" to "authenticated";

grant delete on table "public"."support_confirmation" to "service_role";

grant insert on table "public"."support_confirmation" to "service_role";

grant references on table "public"."support_confirmation" to "service_role";

grant select on table "public"."support_confirmation" to "service_role";

grant trigger on table "public"."support_confirmation" to "service_role";

grant truncate on table "public"."support_confirmation" to "service_role";

grant update on table "public"."support_confirmation" to "service_role";

grant references on table "public"."thread" to "anon";

grant trigger on table "public"."thread" to "anon";

grant truncate on table "public"."thread" to "anon";

grant references on table "public"."thread" to "authenticated";

grant trigger on table "public"."thread" to "authenticated";

grant truncate on table "public"."thread" to "authenticated";

grant delete on table "public"."thread" to "service_role";

grant insert on table "public"."thread" to "service_role";

grant references on table "public"."thread" to "service_role";

grant select on table "public"."thread" to "service_role";

grant trigger on table "public"."thread" to "service_role";

grant truncate on table "public"."thread" to "service_role";

grant update on table "public"."thread" to "service_role";

grant references on table "public"."thread_vote" to "anon";

grant trigger on table "public"."thread_vote" to "anon";

grant truncate on table "public"."thread_vote" to "anon";

grant references on table "public"."thread_vote" to "authenticated";

grant trigger on table "public"."thread_vote" to "authenticated";

grant truncate on table "public"."thread_vote" to "authenticated";

grant delete on table "public"."thread_vote" to "service_role";

grant insert on table "public"."thread_vote" to "service_role";

grant references on table "public"."thread_vote" to "service_role";

grant select on table "public"."thread_vote" to "service_role";

grant trigger on table "public"."thread_vote" to "service_role";

grant truncate on table "public"."thread_vote" to "service_role";

grant update on table "public"."thread_vote" to "service_role";

grant references on table "public"."timeline_event" to "anon";

grant trigger on table "public"."timeline_event" to "anon";

grant truncate on table "public"."timeline_event" to "anon";

grant references on table "public"."timeline_event" to "authenticated";

grant trigger on table "public"."timeline_event" to "authenticated";

grant truncate on table "public"."timeline_event" to "authenticated";

grant delete on table "public"."timeline_event" to "service_role";

grant insert on table "public"."timeline_event" to "service_role";

grant references on table "public"."timeline_event" to "service_role";

grant select on table "public"."timeline_event" to "service_role";

grant trigger on table "public"."timeline_event" to "service_role";

grant truncate on table "public"."timeline_event" to "service_role";

grant update on table "public"."timeline_event" to "service_role";

grant references on table "public"."todo" to "anon";

grant trigger on table "public"."todo" to "anon";

grant truncate on table "public"."todo" to "anon";

grant references on table "public"."todo" to "authenticated";

grant trigger on table "public"."todo" to "authenticated";

grant truncate on table "public"."todo" to "authenticated";

grant delete on table "public"."todo" to "service_role";

grant insert on table "public"."todo" to "service_role";

grant references on table "public"."todo" to "service_role";

grant select on table "public"."todo" to "service_role";

grant trigger on table "public"."todo" to "service_role";

grant truncate on table "public"."todo" to "service_role";

grant update on table "public"."todo" to "service_role";

grant references on table "public"."todo_assignment" to "anon";

grant trigger on table "public"."todo_assignment" to "anon";

grant truncate on table "public"."todo_assignment" to "anon";

grant references on table "public"."todo_assignment" to "authenticated";

grant trigger on table "public"."todo_assignment" to "authenticated";

grant truncate on table "public"."todo_assignment" to "authenticated";

grant delete on table "public"."todo_assignment" to "service_role";

grant insert on table "public"."todo_assignment" to "service_role";

grant references on table "public"."todo_assignment" to "service_role";

grant select on table "public"."todo_assignment" to "service_role";

grant trigger on table "public"."todo_assignment" to "service_role";

grant truncate on table "public"."todo_assignment" to "service_role";

grant update on table "public"."todo_assignment" to "service_role";

grant references on table "public"."user" to "anon";

grant trigger on table "public"."user" to "anon";

grant truncate on table "public"."user" to "anon";

grant references on table "public"."user" to "authenticated";

grant trigger on table "public"."user" to "authenticated";

grant truncate on table "public"."user" to "authenticated";

grant delete on table "public"."user" to "service_role";

grant insert on table "public"."user" to "service_role";

grant references on table "public"."user" to "service_role";

grant select on table "public"."user" to "service_role";

grant trigger on table "public"."user" to "service_role";

grant truncate on table "public"."user" to "service_role";

grant update on table "public"."user" to "service_role";

grant references on table "public"."user_hashtag" to "anon";

grant trigger on table "public"."user_hashtag" to "anon";

grant truncate on table "public"."user_hashtag" to "anon";

grant references on table "public"."user_hashtag" to "authenticated";

grant trigger on table "public"."user_hashtag" to "authenticated";

grant truncate on table "public"."user_hashtag" to "authenticated";

grant delete on table "public"."user_hashtag" to "service_role";

grant insert on table "public"."user_hashtag" to "service_role";

grant references on table "public"."user_hashtag" to "service_role";

grant select on table "public"."user_hashtag" to "service_role";

grant trigger on table "public"."user_hashtag" to "service_role";

grant truncate on table "public"."user_hashtag" to "service_role";

grant update on table "public"."user_hashtag" to "service_role";

grant references on table "public"."user_preference" to "anon";

grant trigger on table "public"."user_preference" to "anon";

grant truncate on table "public"."user_preference" to "anon";

grant references on table "public"."user_preference" to "authenticated";

grant trigger on table "public"."user_preference" to "authenticated";

grant truncate on table "public"."user_preference" to "authenticated";

grant delete on table "public"."user_preference" to "service_role";

grant insert on table "public"."user_preference" to "service_role";

grant references on table "public"."user_preference" to "service_role";

grant select on table "public"."user_preference" to "service_role";

grant trigger on table "public"."user_preference" to "service_role";

grant truncate on table "public"."user_preference" to "service_role";

grant update on table "public"."user_preference" to "service_role";

grant references on table "public"."vote" to "anon";

grant trigger on table "public"."vote" to "anon";

grant truncate on table "public"."vote" to "anon";

grant references on table "public"."vote" to "authenticated";

grant trigger on table "public"."vote" to "authenticated";

grant truncate on table "public"."vote" to "authenticated";

grant delete on table "public"."vote" to "service_role";

grant insert on table "public"."vote" to "service_role";

grant references on table "public"."vote" to "service_role";

grant select on table "public"."vote" to "service_role";

grant trigger on table "public"."vote" to "service_role";

grant truncate on table "public"."vote" to "service_role";

grant update on table "public"."vote" to "service_role";

grant references on table "public"."vote_choice" to "anon";

grant trigger on table "public"."vote_choice" to "anon";

grant truncate on table "public"."vote_choice" to "anon";

grant references on table "public"."vote_choice" to "authenticated";

grant trigger on table "public"."vote_choice" to "authenticated";

grant truncate on table "public"."vote_choice" to "authenticated";

grant delete on table "public"."vote_choice" to "service_role";

grant insert on table "public"."vote_choice" to "service_role";

grant references on table "public"."vote_choice" to "service_role";

grant select on table "public"."vote_choice" to "service_role";

grant trigger on table "public"."vote_choice" to "service_role";

grant truncate on table "public"."vote_choice" to "service_role";

grant update on table "public"."vote_choice" to "service_role";

grant references on table "public"."vote_offline_tally" to "anon";

grant trigger on table "public"."vote_offline_tally" to "anon";

grant truncate on table "public"."vote_offline_tally" to "anon";

grant references on table "public"."vote_offline_tally" to "authenticated";

grant trigger on table "public"."vote_offline_tally" to "authenticated";

grant truncate on table "public"."vote_offline_tally" to "authenticated";

grant delete on table "public"."vote_offline_tally" to "service_role";

grant insert on table "public"."vote_offline_tally" to "service_role";

grant references on table "public"."vote_offline_tally" to "service_role";

grant select on table "public"."vote_offline_tally" to "service_role";

grant trigger on table "public"."vote_offline_tally" to "service_role";

grant truncate on table "public"."vote_offline_tally" to "service_role";

grant update on table "public"."vote_offline_tally" to "service_role";

grant references on table "public"."voter" to "anon";

grant trigger on table "public"."voter" to "anon";

grant truncate on table "public"."voter" to "anon";

grant references on table "public"."voter" to "authenticated";

grant trigger on table "public"."voter" to "authenticated";

grant truncate on table "public"."voter" to "authenticated";

grant delete on table "public"."voter" to "service_role";

grant insert on table "public"."voter" to "service_role";

grant references on table "public"."voter" to "service_role";

grant select on table "public"."voter" to "service_role";

grant trigger on table "public"."voter" to "service_role";

grant truncate on table "public"."voter" to "service_role";

grant update on table "public"."voter" to "service_role";

grant references on table "public"."voting_password" to "anon";

grant trigger on table "public"."voting_password" to "anon";

grant truncate on table "public"."voting_password" to "anon";

grant references on table "public"."voting_password" to "authenticated";

grant trigger on table "public"."voting_password" to "authenticated";

grant truncate on table "public"."voting_password" to "authenticated";

grant delete on table "public"."voting_password" to "service_role";

grant insert on table "public"."voting_password" to "service_role";

grant references on table "public"."voting_password" to "service_role";

grant select on table "public"."voting_password" to "service_role";

grant trigger on table "public"."voting_password" to "service_role";

grant truncate on table "public"."voting_password" to "service_role";

grant update on table "public"."voting_password" to "service_role";


  create policy "service_role_all"
  on "public"."accreditation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."accreditation_audit"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."action_right"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."agenda_item"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."agenda_item_change_request"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."ai_provider_credential"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."ai_skill"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."ai_tool"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_city_design"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_collaborator"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_group_decision"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_path"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_path_segment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_process_branch"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_process_run"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_process_step_run"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_support_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."amendment_vote_entry"
  as permissive
  for all
  to service_role
using (true);



  create policy "app_tutorial_effect_service_role_all"
  on "public"."app_tutorial_checkpoint_effect"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "app_tutorial_entity_owner_select"
  on "public"."app_tutorial_entity"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.app_tutorial_run run
  WHERE ((run.id = app_tutorial_entity.run_id) AND (run.user_id = auth.uid())))));



  create policy "app_tutorial_entity_service_role_all"
  on "public"."app_tutorial_entity"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "app_tutorial_run_owner_select"
  on "public"."app_tutorial_run"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "app_tutorial_service_role_all"
  on "public"."app_tutorial_run"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "service_role_all"
  on "public"."appearance_theme"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."appearance_theme_revision"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."blog"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."blog_blogger"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."blog_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."blog_support_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."calendar_subscription"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."change_request"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."change_request_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."comment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."comment_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."conversation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."conversation_participant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."currency_exchange_rate_cache"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "service_role_all"
  on "public"."dataset"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."dataset_import_job"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."dataset_snapshot"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."delegate_election_assignment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."document"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."document_collaborator"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."document_cursor"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."document_version"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."election"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."election_candidate"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."election_offline_tally"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."elector"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_assembly_scope"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_delegate"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_exception"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_offline_participant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_participant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_participant_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."file"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."final_candidate_selection"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."final_choice_decision"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."final_elector_participation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."final_voter_participation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."follow"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_connection"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_connection_request"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_delegate_allocation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_effective_right"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_guest_access"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_guest_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_hierarchy_path"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_exclusivity_lock"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_origin"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_rule"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_rule_origin"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_rule_request"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_rule_request_origin"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_offline_member"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_offline_membership"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_offline_membership_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_right_grant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_right_grant_request"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_sibling_source_lock"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_workflow"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_workflow_approval"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_workflow_step"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."indicative_candidate_selection"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."indicative_choice_decision"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."indicative_elector_participation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."indicative_voter_participation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."link"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."message"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."notification"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."notification_read"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."notification_setting"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."notification_user_state"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."participant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."payment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."pql_filter"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."process_task"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."push_delivery_outbox"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."push_notification_outbox"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."push_subscription"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."reaction"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."role_holder_history"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."search_document"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."search_document_acl"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."search_document_topic"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."speaker_list"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement_support_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement_survey"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement_survey_option"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."statement_survey_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."stripe_customer"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."stripe_payment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."stripe_subscription"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."subscriber"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."support_confirmation"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."thread"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."thread_vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."timeline_event"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."todo"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."todo_assignment"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."user"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."user_hashtag"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."user_preference"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."vote"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."vote_choice"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."vote_offline_tally"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."voter"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."voting_password"
  as permissive
  for all
  to service_role
using (true);


CREATE TRIGGER trg_search_document_amendment AFTER INSERT OR DELETE OR UPDATE ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.upsert_amendment_search_document();

CREATE TRIGGER trg_zz_search_document_acl_amendment AFTER INSERT OR UPDATE ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_amendment_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.amendment FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('amendment');

CREATE TRIGGER trg_zz_search_document_acl_amendment_collaborator AFTER INSERT OR DELETE OR UPDATE ON public.amendment_collaborator FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_amendment_group_decision AFTER INSERT OR DELETE OR UPDATE ON public.amendment_group_decision FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_amendment_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.amendment_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_blog AFTER INSERT OR DELETE OR UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.upsert_blog_search_document();

CREATE TRIGGER trg_zz_search_document_acl_blog AFTER INSERT OR UPDATE ON public.blog FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_blog_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.blog FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('blog');

CREATE TRIGGER trg_search_document_blog_blogger_location_refresh AFTER INSERT OR DELETE OR UPDATE ON public.blog_blogger FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_from_blogger();

CREATE TRIGGER trg_zz_search_document_acl_blog_blogger AFTER INSERT OR DELETE OR UPDATE ON public.blog_blogger FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_blog_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.blog_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_blog_search_document_topics_from_hashtag();

CREATE TRIGGER trg_participant_refresh_conversation_rollups AFTER INSERT OR DELETE OR UPDATE OF last_read_at, left_at, user_id ON public.conversation_participant FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_participant();

CREATE TRIGGER trg_search_document_dataset AFTER INSERT OR DELETE OR UPDATE ON public.dataset FOR EACH ROW EXECUTE FUNCTION public.upsert_dataset_search_document();

CREATE TRIGGER trg_zz_search_document_acl_dataset AFTER INSERT OR UPDATE ON public.dataset FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_dataset_snapshot_touch_dataset AFTER INSERT OR DELETE OR UPDATE ON public.dataset_snapshot FOR EACH ROW EXECUTE FUNCTION public.touch_dataset_from_snapshot();

CREATE TRIGGER trg_search_document_election AFTER INSERT OR DELETE OR UPDATE ON public.election FOR EACH ROW EXECUTE FUNCTION public.upsert_election_search_document();

CREATE TRIGGER trg_zz_search_document_acl_election AFTER INSERT OR UPDATE ON public.election FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER trg_zz_search_document_acl_elector AFTER INSERT OR DELETE OR UPDATE ON public.elector FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_event AFTER INSERT OR DELETE OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.upsert_event_search_document();

CREATE TRIGGER trg_zz_search_document_acl_event AFTER INSERT OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_event_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.event FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('event');

CREATE TRIGGER trg_search_document_event_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.event_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_event_search_document_topics_from_hashtag();

CREATE TRIGGER trg_zz_search_document_acl_event_participant AFTER INSERT OR DELETE OR UPDATE ON public.event_participant FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_group AFTER INSERT OR DELETE OR UPDATE ON public."group" FOR EACH ROW EXECUTE FUNCTION public.upsert_group_search_document();

CREATE TRIGGER trg_search_document_group_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds ON public."group" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_group_location();

CREATE TRIGGER trg_zz_search_document_acl_group AFTER INSERT OR UPDATE ON public."group" FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_group_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public."group" FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('group');

CREATE TRIGGER trg_zz_search_document_acl_group_guest_access AFTER INSERT OR DELETE OR UPDATE ON public.group_guest_access FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_group_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.group_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_group_search_document_topics_from_hashtag();

CREATE TRIGGER trg_zz_search_document_acl_group_membership AFTER INSERT OR DELETE OR UPDATE ON public.group_membership FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_message_refresh_conversation_rollups AFTER INSERT OR DELETE OR UPDATE ON public.message FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_rollups_from_message();

CREATE TRIGGER notification_enqueue_push AFTER INSERT ON public.notification FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_notification();

CREATE TRIGGER trg_search_document_populate_location BEFORE INSERT OR UPDATE ON public.search_document FOR EACH ROW EXECUTE FUNCTION public.populate_search_document_location();

CREATE TRIGGER trg_search_document_statement AFTER INSERT OR DELETE OR UPDATE ON public.statement FOR EACH ROW EXECUTE FUNCTION public.upsert_statement_search_document();

CREATE TRIGGER trg_zz_search_document_acl_statement AFTER INSERT OR UPDATE ON public.statement FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_statement_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.statement FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('statement');

CREATE TRIGGER trg_search_document_statement_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.statement_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_statement_search_document_topics_from_hashtag();

CREATE TRIGGER trg_search_document_support_confirmation AFTER INSERT OR DELETE OR UPDATE ON public.support_confirmation FOR EACH ROW EXECUTE FUNCTION public.refresh_amendment_search_document_from_support();

CREATE TRIGGER trg_search_document_timeline_event AFTER INSERT OR DELETE OR UPDATE ON public.timeline_event FOR EACH ROW EXECUTE FUNCTION public.upsert_timeline_event_search_document();

CREATE TRIGGER trg_zz_search_document_acl_timeline_event AFTER INSERT OR UPDATE ON public.timeline_event FOR EACH ROW EXECUTE FUNCTION public.sync_timeline_search_document_privacy();

CREATE TRIGGER todo_ensure_discussion_thread AFTER INSERT ON public.todo FOR EACH ROW EXECUTE FUNCTION public.ensure_todo_discussion_thread();

CREATE TRIGGER trg_search_document_todo AFTER INSERT OR DELETE OR UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.upsert_todo_search_document();

CREATE TRIGGER trg_zz_search_document_acl_todo AFTER INSERT OR UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_todo_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public.todo FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('todo');

CREATE TRIGGER trg_zz_search_document_acl_todo_assignment AFTER INSERT OR DELETE OR UPDATE ON public.todo_assignment FOR EACH ROW EXECUTE FUNCTION public.refresh_search_document_acl_relation_trigger();

CREATE TRIGGER trg_search_document_user AFTER INSERT OR DELETE OR UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.upsert_user_search_document();

CREATE TRIGGER trg_search_document_user_location_refresh AFTER UPDATE OF country, region, post_code, city, street, house_number, latitude, longitude, location_kind, location_place_id, location_boundary_source, location_geometry, location_bounds ON public."user" FOR EACH ROW EXECUTE FUNCTION public.refresh_search_documents_from_user_location();

CREATE TRIGGER trg_zz_search_document_acl_user AFTER INSERT OR UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

CREATE TRIGGER zz_tag_user_tutorial_search_document AFTER INSERT OR UPDATE OF tutorial_run_id ON public."user" FOR EACH ROW EXECUTE FUNCTION public.tag_app_tutorial_search_document('user');

CREATE TRIGGER trg_search_document_user_hashtag AFTER INSERT OR DELETE OR UPDATE ON public.user_hashtag FOR EACH ROW EXECUTE FUNCTION public.refresh_user_search_document_topics_from_hashtag();

CREATE TRIGGER on_user_preference_newsletter_language_changed AFTER UPDATE OF language ON public.user_preference FOR EACH ROW EXECUTE FUNCTION public.handle_newsletter_language_change();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_newsletter_changed AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_newsletter_change();

CREATE TRIGGER on_auth_user_newsletter_deleted BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_newsletter_delete();


  create policy "avatars_auth_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_auth_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_auth_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "dataset_snapshots_no_direct_read"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (false);



  create policy "dataset_snapshots_no_direct_write"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (false);



  create policy "service_role_all_storage"
  on "storage"."objects"
  as permissive
  for all
  to service_role
using (true);



  create policy "uploads_auth_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'uploads'::text));



  create policy "uploads_auth_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'uploads'::text));



  create policy "uploads_auth_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'uploads'::text));



  create policy "uploads_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'uploads'::text));


revoke all on table "public"."newsletter_subscription" from "anon", "authenticated";

revoke all on table "public"."newsletter_sync_outbox" from "anon", "authenticated";

revoke all on table "public"."resend_webhook_event" from "anon", "authenticated";

-- =============================================================================
-- Durable pg_cron scheduling
-- =============================================================================
-- Cron rows are operational DML and are not emitted by declarative schema
-- diffs. Keep these idempotent blocks in sync with
-- supabase/schemas/34_scheduled_jobs.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-expired-app-tutorial-runs'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-app-tutorial-runs',
      '17 3 * * *',
      'SELECT public.cleanup_expired_app_tutorial_runs();'
    );
  END IF;
END
$$;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'push_delivery_secret'
  ) THEN
    RETURN;
  END IF;

  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'push-delivery-sync';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'push-delivery-sync',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://www.polity.live/api/push/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'push_delivery_secret'
          )
        ),
        body := '{"source":"scheduler"}'::jsonb
      );
    $cron$
  );
END
$$;


