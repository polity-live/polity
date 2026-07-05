import { table, string, number, json } from '@rocicorp/zero';

export const amendment = table('amendment')
  .columns({
    id: string(),
    code: string().optional(),
    title: string().optional(),
    reason: string().optional(),
    category: string().optional(),
    preamble: string().optional(),
    created_by_id: string(),
    group_id: string().optional(),
    event_id: string().optional(),
    clone_source_id: string().optional(),
    origin_amendment_id: string().optional(),
    document_id: string().optional(),
    country: string().optional(),
    region: string().optional(),
    post_code: string().optional(),
    city: string().optional(),
    street: string().optional(),
    house_number: string().optional(),
    latitude: number().optional(),
    longitude: number().optional(),
    upvotes: number(),
    downvotes: number(),
    tags: json<string[]>().optional(),
    visibility: string(),
    subscriber_count: number(),
    clone_count: number(),
    change_request_count: number(),
    internal_cr_voting_close_trigger: string().optional(),
    internal_cr_voting_duration_minutes: number().optional(),
    internal_cr_resolution_visibility: string().optional(),
    discussions: json().optional(),
    comment_count: number(),
    collaborator_count: number(),
    image_url: string().optional(),
    x: string().optional(),
    youtube: string().optional(),
    linkedin: string().optional(),
    website: string().optional(),
    current_process_run_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const amendmentCollaborator = table('amendment_collaborator')
  .columns({
    id: string(),
    amendment_id: string(),
    user_id: string(),
    role_id: string().optional(),
    status: string().optional(),
    visibility: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const amendmentStreetDesign = table('amendment_street_design')
  .columns({
    id: string(),
    amendment_id: string(),
    created_by_id: string(),
    title: string().optional(),
    bbox: json().optional(),
    center_lat: number().optional(),
    center_lon: number().optional(),
    osm_snapshot: json().optional(),
    design_state: json().optional(),
    currency: string(),
    estimated_total_cost_minor: number(),
    cost_catalog_version: string().optional(),
    cost_summary: json().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const amendmentPath = table('amendment_path')
  .columns({
    id: string(),
    amendment_id: string(),
    process_run_id: string().optional(),
    title: string().optional(),
    workflow_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const amendmentPathSegment = table('amendment_path_segment')
  .columns({
    id: string(),
    path_id: string(),
    process_branch_id: string().optional(),
    process_step_run_id: string().optional(),
    group_id: string().optional(),
    event_id: string().optional(),
    order_index: number().optional(),
    status: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const supportConfirmation = table('support_confirmation')
  .columns({
    id: string(),
    amendment_id: string(),
    process_run_id: string().optional(),
    process_step_run_id: string().optional(),
    process_task_id: string().optional(),
    group_id: string().optional(),
    event_id: string().optional(),
    confirmed_by_id: string(),
    status: string().optional(),
    confirmed_at: number().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const amendmentGroupDecision = table('amendment_group_decision')
  .columns({
    id: string(),
    amendment_id: string(),
    group_id: string(),
    process_run_id: string().optional(),
    process_branch_id: string().optional(),
    process_step_run_id: string().optional(),
    status: string(),
    decided_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const amendmentProcessRun = table('amendment_process_run')
  .columns({
    id: string(),
    amendment_id: string(),
    root_workflow_id: string().optional(),
    selected_source_group_id: string().optional(),
    selected_target_group_id: string().optional(),
    selected_target_workflow_id: string().optional(),
    active_branch_id: string().optional(),
    terminal_step_run_id: string().optional(),
    status: string(),
    evaluation_mode: string().optional(),
    evaluation_date: number().optional(),
    evaluation_offset_months: number().optional(),
    evaluation_offset_years: number().optional(),
    implementation_status: string().optional(),
    created_by_id: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const amendmentProcessBranch = table('amendment_process_branch')
  .columns({
    id: string(),
    process_run_id: string(),
    parent_branch_id: string().optional(),
    merged_into_branch_id: string().optional(),
    source_step_run_id: string().optional(),
    document_version_id: string().optional(),
    document_id: string().optional(),
    discussions: json().optional(),
    title: string().optional(),
    status: string(),
    editing_mode: string(),
    resolution: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const amendmentProcessStepRun = table('amendment_process_step_run')
  .columns({
    id: string(),
    process_run_id: string(),
    branch_id: string(),
    workflow_id: string().optional(),
    workflow_step_id: string().optional(),
    step_kind: string(),
    selection_mode: string().optional(),
    merge_strategy: string().optional(),
    status: string(),
    source_group_id: string().optional(),
    target_group_id: string().optional(),
    event_id: string().optional(),
    agenda_item_id: string().optional(),
    vote_id: string().optional(),
    support_confirmation_id: string().optional(),
    decision_status: string().optional(),
    order_index: number(),
    starts_at: number().optional(),
    ends_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const processTask = table('process_task')
  .columns({
    id: string(),
    process_run_id: string(),
    branch_id: string().optional(),
    step_run_id: string().optional(),
    task_type: string(),
    status: string(),
    title: string().optional(),
    description: string().optional(),
    group_id: string().optional(),
    target_group_id: string().optional(),
    event_id: string().optional(),
    agenda_item_id: string().optional(),
    support_confirmation_id: string().optional(),
    due_at: number().optional(),
    resolved_at: number().optional(),
    metadata: json().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
