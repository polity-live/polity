-- =============================================================================
-- 14_change_request.sql — Change requests for amendments
-- Depends on: 01_user (user), 04_amendment (amendment)
-- =============================================================================

-- Change request table
CREATE TABLE IF NOT EXISTS public.change_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  process_branch_id UUID REFERENCES public.amendment_process_branch (id) ON DELETE SET NULL,
  suggestion_id TEXT,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  status TEXT,
  reason TEXT,
  source_type TEXT,
  source_id UUID,
  source_title TEXT,
  change_type TEXT,
  original_text TEXT,
  new_text TEXT,
  original_properties JSONB,
  new_properties JSONB,
  changed_character_count INTEGER NOT NULL DEFAULT 0,
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  voting_status TEXT NOT NULL DEFAULT 'open',
  voting_deadline TIMESTAMPTZ,
  voting_majority_type TEXT,
  quorum_required INTEGER,
  branch_sequence_number INTEGER,
  created_in_mode TEXT,
  resolved_in_mode TEXT,
  resolution_method TEXT,
  visibility_scope TEXT NOT NULL DEFAULT 'public',
  obsolete_reason TEXT,
  obsolete_at TIMESTAMPTZ,
  obsolete_by_vote_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_request_amendment ON public.change_request (amendment_id);
CREATE INDEX idx_change_request_process_branch ON public.change_request (process_branch_id);
CREATE INDEX idx_change_request_suggestion_id
  ON public.change_request (suggestion_id)
  WHERE suggestion_id IS NOT NULL;
CREATE INDEX idx_change_request_user ON public.change_request (user_id);
CREATE INDEX idx_change_request_changed_character_count ON public.change_request (changed_character_count);
CREATE UNIQUE INDEX idx_change_request_branch_sequence
  ON public.change_request (amendment_id, process_branch_id, branch_sequence_number)
  WHERE branch_sequence_number IS NOT NULL AND process_branch_id IS NOT NULL;
CREATE UNIQUE INDEX idx_change_request_main_sequence
  ON public.change_request (amendment_id, branch_sequence_number)
  WHERE branch_sequence_number IS NOT NULL AND process_branch_id IS NULL;

ALTER TABLE public.change_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.change_request FOR ALL TO service_role USING (true);
