-- Canonicalize amendment editing modes and enforce strict process-branch values.

DO $$
DECLARE
  target_column record;
BEGIN
  FOR target_column IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'editing_mode'
  LOOP
    EXECUTE format(
      $sql$
        UPDATE %I.%I
        SET editing_mode = CASE editing_mode
          WHEN 'collaborative' THEN 'edit'
          WHEN 'collaborative_editing' THEN 'edit'
          WHEN 'internal_suggesting' THEN 'suggest_internal'
          WHEN 'internal_suggestion' THEN 'suggest_internal'
          WHEN 'internal_suggestions' THEN 'suggest_internal'
          WHEN 'internal_voting' THEN 'vote_internal'
          WHEN 'viewing' THEN 'view'
          WHEN 'event_suggesting' THEN 'suggest_event'
          WHEN 'event_suggestion' THEN 'suggest_event'
          WHEN 'event_suggestions' THEN 'suggest_event'
          WHEN 'Drafting' THEN 'edit'
          WHEN 'Under Review' THEN 'suggest_internal'
          WHEN 'Passed' THEN 'passed'
          WHEN 'Rejected' THEN 'rejected'
          ELSE editing_mode
        END
        WHERE editing_mode IN (
          'collaborative',
          'collaborative_editing',
          'internal_suggesting',
          'internal_suggestion',
          'internal_suggestions',
          'internal_voting',
          'viewing',
          'event_suggesting',
          'event_suggestion',
          'event_suggestions',
          'Drafting',
          'Under Review',
          'Passed',
          'Rejected'
        )
      $sql$,
      target_column.table_schema,
      target_column.table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.amendment_process_branch
  DROP CONSTRAINT IF EXISTS amendment_process_branch_editing_mode_check;

DO $$
DECLARE
  invalid_values text;
BEGIN
  SELECT string_agg(
    DISTINCT COALESCE(editing_mode, '<null>'),
    ', ' ORDER BY COALESCE(editing_mode, '<null>')
  )
  INTO invalid_values
  FROM public.amendment_process_branch
  WHERE editing_mode IS NULL
     OR editing_mode NOT IN (
       'edit',
       'view',
       'suggest_internal',
       'suggest_event',
       'vote_internal',
       'event_final_closing_vote',
       'passed',
       'rejected'
     );

  IF invalid_values IS NOT NULL THEN
    RAISE EXCEPTION
      'Invalid amendment_process_branch.editing_mode values present: %. Expected one of edit, view, suggest_internal, suggest_event, vote_internal, event_final_closing_vote, passed, rejected.',
      invalid_values;
  END IF;
END $$;

ALTER TABLE public.amendment_process_branch
  ADD CONSTRAINT amendment_process_branch_editing_mode_check
  CHECK (editing_mode IN (
    'edit',
    'view',
    'suggest_internal',
    'suggest_event',
    'vote_internal',
    'event_final_closing_vote',
    'passed',
    'rejected'
  ));
