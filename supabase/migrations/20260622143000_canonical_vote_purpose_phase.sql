-- Enforce strict vote purpose/phase values and agenda vote step kinds.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_item_change_request'
      AND column_name = 'is_final_vote'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agenda_item_change_request'
        AND column_name = 'is_closing_vote'
    ) THEN
      EXECUTE 'UPDATE public.agenda_item_change_request SET is_closing_vote = true WHERE is_final_vote = true';
      EXECUTE 'ALTER TABLE public.agenda_item_change_request DROP COLUMN is_final_vote';
    ELSE
      EXECUTE 'ALTER TABLE public.agenda_item_change_request RENAME COLUMN is_final_vote TO is_closing_vote';
    END IF;
  END IF;
END $$;

ALTER TABLE public.vote
  DROP CONSTRAINT IF EXISTS vote_status_check;

ALTER TABLE public.vote
  DROP CONSTRAINT IF EXISTS vote_purpose_check;

ALTER TABLE public.agenda_item
  DROP CONSTRAINT IF EXISTS agenda_item_voting_phase_check;

ALTER TABLE public.agenda_item_change_request
  DROP CONSTRAINT IF EXISTS agenda_item_change_request_step_kind_check;

UPDATE public.vote
SET status = 'indicative'
WHERE status IN ('indicative_open', 'indication');

UPDATE public.vote
SET status = 'internal'
WHERE status IN ('internal_voting', 'vote_internal');

UPDATE public.vote
SET status = 'final'
WHERE status IN ('final_open', 'final_vote');

UPDATE public.agenda_item_change_request
SET step_kind = 'closing'
WHERE step_kind = 'closing_vote';

UPDATE public.agenda_item
SET voting_phase = 'indicative'
WHERE voting_phase IN ('indicative_open', 'indication');

UPDATE public.agenda_item
SET voting_phase = 'internal'
WHERE voting_phase IN ('internal_voting', 'vote_internal');

UPDATE public.agenda_item
SET voting_phase = 'final'
WHERE voting_phase IN ('final_open', 'final_vote');

ALTER TABLE public.vote
  ALTER COLUMN status SET DEFAULT 'indicative';

ALTER TABLE public.vote
  ALTER COLUMN purpose DROP DEFAULT;

DO $$
DECLARE
  invalid_values text;
BEGIN
  SELECT string_agg(
    DISTINCT COALESCE(purpose, '<null>'),
    ', ' ORDER BY COALESCE(purpose, '<null>')
  )
  INTO invalid_values
  FROM public.vote
  WHERE purpose IS NULL
     OR purpose NOT IN ('change_request', 'closing', 'merge_variant');

  IF invalid_values IS NOT NULL THEN
    RAISE EXCEPTION
      'Invalid vote.purpose values present: %. Expected one of change_request, closing, merge_variant. Clean these rows before running this migration.',
      invalid_values;
  END IF;
END $$;

DO $$
DECLARE
  invalid_values text;
BEGIN
  SELECT string_agg(
    DISTINCT COALESCE(step_kind, '<null>'),
    ', ' ORDER BY COALESCE(step_kind, '<null>')
  )
  INTO invalid_values
  FROM public.agenda_item_change_request
  WHERE step_kind IS NULL
     OR step_kind NOT IN ('change_request', 'closing', 'merge_variant');

  IF invalid_values IS NOT NULL THEN
    RAISE EXCEPTION
      'Invalid agenda_item_change_request.step_kind values present: %. Expected one of change_request, closing, merge_variant. Clean these rows before running this migration.',
      invalid_values;
  END IF;
END $$;

ALTER TABLE public.vote
  ADD CONSTRAINT vote_status_check
  CHECK (status IN ('internal', 'indicative', 'final', 'closed'));

ALTER TABLE public.vote
  ADD CONSTRAINT vote_purpose_check
  CHECK (purpose IN ('change_request', 'closing', 'merge_variant'));

ALTER TABLE public.agenda_item
  ADD CONSTRAINT agenda_item_voting_phase_check
  CHECK (voting_phase IS NULL OR voting_phase IN ('internal', 'indicative', 'final', 'closed'));

ALTER TABLE public.agenda_item_change_request
  ADD CONSTRAINT agenda_item_change_request_step_kind_check
  CHECK (step_kind IN ('change_request', 'closing', 'merge_variant'));
