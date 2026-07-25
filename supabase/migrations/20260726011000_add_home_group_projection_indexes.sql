-- Additive Zero projection indexes. This migration must run outside a
-- transaction because CREATE INDEX CONCURRENTLY is used.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_agenda_item_event_order_id
ON public.agenda_item (event_id, order_index, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_event_participant_event_user_id
ON public.event_participant (event_id, user_id, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_election_candidate_election_order_id
ON public.election_candidate (election_id, order_index, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_vote_choice_vote_order_id
ON public.vote_choice (vote_id, order_index, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_role_group_scope_order_id
ON public.role (group_id, scope, sort_order, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_role_holder_history_role_end_id
ON public.role_holder_history (role_id, end_date, id);
