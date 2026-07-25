-- This migration must be applied outside a transaction. Apply each statement
-- through `supabase migration up --linked`; do not pipeline it through db push.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_event_participant_user_created_id
ON public.event_participant (user_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_election_created_id
ON public.election (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_vote_created_id
ON public.vote (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_user_hashtag_user_created_id
ON public.user_hashtag (user_id, created_at DESC, id DESC);
