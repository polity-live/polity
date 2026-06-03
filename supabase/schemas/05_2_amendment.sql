-- =============================================================================
-- 04_amendment.sql — Amendments, collaborators, paths, support confirmations
-- Vote tables moved to 20_vote.sql
-- Change request tables moved to 14_change_request.sql
-- =============================================================================

-- Amendment table
CREATE TABLE IF NOT EXISTS public.amendment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  title TEXT,
  reason TEXT,
  category TEXT,
  preamble TEXT,
  created_by_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID,
  event_id UUID,
  clone_source_id UUID,
  document_id UUID REFERENCES public.document (id) ON DELETE SET NULL,
  supporters INTEGER NOT NULL DEFAULT 0,
  supporters_required INTEGER,
  supporters_percentage NUMERIC,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  tags JSONB,
  visibility TEXT NOT NULL DEFAULT 'public',
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  clone_count INTEGER NOT NULL DEFAULT 0,
  change_request_count INTEGER NOT NULL DEFAULT 0,
  editing_mode TEXT,
  discussions JSONB,
  comment_count INTEGER NOT NULL DEFAULT 0,
  collaborator_count INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  x TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  current_process_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_created_by ON public.amendment (created_by_id);
CREATE INDEX idx_amendment_group ON public.amendment (group_id);
CREATE INDEX idx_amendment_event ON public.amendment (event_id);
CREATE INDEX idx_amendment_editing_mode ON public.amendment (editing_mode);

ALTER TABLE public.amendment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment FOR ALL TO service_role USING (true);

-- Amendment collaborator table
CREATE TABLE IF NOT EXISTS public.amendment_collaborator (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  status TEXT,
  visibility TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_collaborator_amendment ON public.amendment_collaborator (amendment_id);
CREATE INDEX idx_amendment_collaborator_user ON public.amendment_collaborator (user_id);

ALTER TABLE public.amendment_collaborator ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_collaborator FOR ALL TO service_role USING (true);

-- Amendment path table
CREATE TABLE IF NOT EXISTS public.amendment_path (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  process_run_id UUID,
  title TEXT,
  workflow_id UUID REFERENCES public.group_workflow (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_path_amendment ON public.amendment_path (amendment_id);

ALTER TABLE public.amendment_path ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_path FOR ALL TO service_role USING (true);

-- Amendment path segment table
CREATE TABLE IF NOT EXISTS public.amendment_path_segment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES public.amendment_path (id) ON DELETE CASCADE,
  process_branch_id UUID,
  process_step_run_id UUID,
  group_id UUID,
  event_id UUID,
  order_index INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_path_segment_path ON public.amendment_path_segment (path_id);

ALTER TABLE public.amendment_path_segment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_path_segment FOR ALL TO service_role USING (true);

-- Support confirmation table
CREATE TABLE IF NOT EXISTS public.support_confirmation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  process_run_id UUID,
  process_step_run_id UUID,
  process_task_id UUID,
  group_id UUID,
  event_id UUID,
  confirmed_by_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  status TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_confirmation_amendment ON public.support_confirmation (amendment_id);
CREATE INDEX idx_support_confirmation_user ON public.support_confirmation (confirmed_by_id);

ALTER TABLE public.support_confirmation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.support_confirmation FOR ALL TO service_role USING (true);

-- Workflow runtime process execution
CREATE TABLE IF NOT EXISTS public.amendment_process_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  root_workflow_id UUID REFERENCES public.group_workflow (id) ON DELETE SET NULL,
  selected_source_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  selected_target_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  selected_target_workflow_id UUID REFERENCES public.group_workflow (id) ON DELETE SET NULL,
  active_branch_id UUID,
  terminal_step_run_id UUID,
  status TEXT NOT NULL DEFAULT 'pending_event',
  evaluation_mode TEXT,
  evaluation_date TIMESTAMPTZ,
  evaluation_offset_months INTEGER,
  evaluation_offset_years INTEGER,
  implementation_status TEXT,
  created_by_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_process_run_amendment ON public.amendment_process_run (amendment_id);
CREATE INDEX idx_amendment_process_run_status ON public.amendment_process_run (status);

ALTER TABLE public.amendment_process_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_process_run FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.amendment_process_branch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_run_id UUID NOT NULL REFERENCES public.amendment_process_run (id) ON DELETE CASCADE,
  parent_branch_id UUID REFERENCES public.amendment_process_branch (id) ON DELETE SET NULL,
  merged_into_branch_id UUID REFERENCES public.amendment_process_branch (id) ON DELETE SET NULL,
  source_step_run_id UUID,
  document_version_id UUID REFERENCES public.document_version (id) ON DELETE SET NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending_event',
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_process_branch_run ON public.amendment_process_branch (process_run_id);
CREATE INDEX idx_amendment_process_branch_parent ON public.amendment_process_branch (parent_branch_id);
CREATE INDEX idx_amendment_process_branch_status ON public.amendment_process_branch (status);

ALTER TABLE public.amendment_process_branch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_process_branch FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.amendment_process_step_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_run_id UUID NOT NULL REFERENCES public.amendment_process_run (id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.amendment_process_branch (id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.group_workflow (id) ON DELETE SET NULL,
  workflow_step_id UUID REFERENCES public.group_workflow_step (id) ON DELETE SET NULL,
  step_kind TEXT NOT NULL DEFAULT 'group_vote',
  selection_mode TEXT,
  merge_strategy TEXT,
  status TEXT NOT NULL DEFAULT 'pending_event',
  source_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.event (id) ON DELETE SET NULL,
  agenda_item_id UUID,
  vote_id UUID,
  support_confirmation_id UUID REFERENCES public.support_confirmation (id) ON DELETE SET NULL,
  decision_status TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_process_step_run_process
  ON public.amendment_process_step_run (process_run_id);
CREATE INDEX idx_amendment_process_step_run_branch
  ON public.amendment_process_step_run (branch_id);
CREATE INDEX idx_amendment_process_step_run_status
  ON public.amendment_process_step_run (status);
CREATE INDEX idx_amendment_process_step_run_event
  ON public.amendment_process_step_run (event_id);

ALTER TABLE public.amendment_process_step_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_process_step_run FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.process_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_run_id UUID NOT NULL REFERENCES public.amendment_process_run (id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.amendment_process_branch (id) ON DELETE CASCADE,
  step_run_id UUID REFERENCES public.amendment_process_step_run (id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT,
  description TEXT,
  group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.event (id) ON DELETE SET NULL,
  agenda_item_id UUID,
  support_confirmation_id UUID REFERENCES public.support_confirmation (id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_process_task_process_run ON public.process_task (process_run_id);
CREATE INDEX idx_process_task_group ON public.process_task (group_id);
CREATE INDEX idx_process_task_status ON public.process_task (status);
CREATE INDEX idx_process_task_type ON public.process_task (task_type);
CREATE INDEX idx_process_task_due_at ON public.process_task (due_at);

ALTER TABLE public.process_task ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.process_task FOR ALL TO service_role USING (true);

ALTER TABLE public.amendment
  ADD CONSTRAINT amendment_current_process_run_fk
  FOREIGN KEY (current_process_run_id) REFERENCES public.amendment_process_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_path
  ADD CONSTRAINT amendment_path_process_run_fk
  FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_path_segment
  ADD CONSTRAINT amendment_path_segment_process_branch_fk
  FOREIGN KEY (process_branch_id) REFERENCES public.amendment_process_branch (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_path_segment
  ADD CONSTRAINT amendment_path_segment_process_step_run_fk
  FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.support_confirmation
  ADD CONSTRAINT support_confirmation_process_run_fk
  FOREIGN KEY (process_run_id) REFERENCES public.amendment_process_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.support_confirmation
  ADD CONSTRAINT support_confirmation_process_step_run_fk
  FOREIGN KEY (process_step_run_id) REFERENCES public.amendment_process_step_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.support_confirmation
  ADD CONSTRAINT support_confirmation_process_task_fk
  FOREIGN KEY (process_task_id) REFERENCES public.process_task (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_process_run
  ADD CONSTRAINT amendment_process_run_active_branch_fk
  FOREIGN KEY (active_branch_id) REFERENCES public.amendment_process_branch (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_process_run
  ADD CONSTRAINT amendment_process_run_terminal_step_fk
  FOREIGN KEY (terminal_step_run_id) REFERENCES public.amendment_process_step_run (id)
  ON DELETE SET NULL;

ALTER TABLE public.amendment_process_branch
  ADD CONSTRAINT amendment_process_branch_source_step_fk
  FOREIGN KEY (source_step_run_id) REFERENCES public.amendment_process_step_run (id)
  ON DELETE SET NULL;

-- Amendment support vote table
CREATE TABLE IF NOT EXISTS public.amendment_support_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  vote INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_support_vote_amendment ON public.amendment_support_vote (amendment_id);
CREATE INDEX idx_amendment_support_vote_user ON public.amendment_support_vote (user_id);

ALTER TABLE public.amendment_support_vote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_support_vote FOR ALL TO service_role USING (true);

-- Amendment vote entry table (inline upvote/downvote)
CREATE TABLE IF NOT EXISTS public.amendment_vote_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  vote INTEGER,
  is_indication BOOLEAN NOT NULL DEFAULT false,
  indicated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendment_vote_entry_amendment ON public.amendment_vote_entry (amendment_id);
CREATE INDEX idx_amendment_vote_entry_user ON public.amendment_vote_entry (user_id);

ALTER TABLE public.amendment_vote_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_vote_entry FOR ALL TO service_role USING (true);
