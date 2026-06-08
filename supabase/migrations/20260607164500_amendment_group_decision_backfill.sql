BEGIN;

CREATE TABLE IF NOT EXISTS public.amendment_group_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  process_run_id UUID REFERENCES public.amendment_process_run (id) ON DELETE SET NULL,
  process_branch_id UUID REFERENCES public.amendment_process_branch (id) ON DELETE SET NULL,
  process_step_run_id UUID REFERENCES public.amendment_process_step_run (id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_amendment_group_decision_unique
  ON public.amendment_group_decision (amendment_id, group_id);
CREATE INDEX IF NOT EXISTS idx_amendment_group_decision_group
  ON public.amendment_group_decision (group_id);
CREATE INDEX IF NOT EXISTS idx_amendment_group_decision_process_run
  ON public.amendment_group_decision (process_run_id);
CREATE INDEX IF NOT EXISTS idx_amendment_group_decision_status
  ON public.amendment_group_decision (status);

ALTER TABLE public.amendment_group_decision ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amendment_group_decision'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all"
      ON public.amendment_group_decision
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

WITH latest_process_run AS (
  SELECT DISTINCT ON (amendment_id)
    amendment_id,
    id AS process_run_id
  FROM public.amendment_process_run
  ORDER BY amendment_id, created_at DESC, id DESC
)
UPDATE public.amendment AS amendment
SET current_process_run_id = latest_process_run.process_run_id
FROM latest_process_run
WHERE amendment.id = latest_process_run.amendment_id
  AND amendment.current_process_run_id IS NULL;

CREATE TEMP TABLE tmp_amendment_runtime_backfill ON COMMIT DROP AS
WITH latest_path AS (
  SELECT DISTINCT ON (path.amendment_id)
    path.id,
    path.amendment_id,
    path.workflow_id,
    path.created_at
  FROM public.amendment_path AS path
  ORDER BY path.amendment_id, path.created_at DESC, path.id DESC
),
first_segment AS (
  SELECT DISTINCT ON (segment.path_id)
    segment.path_id,
    segment.group_id
  FROM public.amendment_path_segment AS segment
  ORDER BY segment.path_id, segment.order_index ASC NULLS LAST, segment.created_at ASC, segment.id ASC
),
last_segment AS (
  SELECT DISTINCT ON (segment.path_id)
    segment.path_id,
    segment.group_id,
    segment.event_id
  FROM public.amendment_path_segment AS segment
  ORDER BY segment.path_id, segment.order_index DESC NULLS LAST, segment.created_at DESC, segment.id DESC
)
SELECT
  amendment.id AS amendment_id,
  gen_random_uuid() AS process_run_id,
  gen_random_uuid() AS branch_id,
  latest_path.id AS path_id,
  amendment.created_by_id,
  first_segment.group_id AS selected_source_group_id,
  COALESCE(amendment.group_id, last_segment.group_id) AS selected_target_group_id,
  latest_path.workflow_id AS workflow_id,
  CASE
    WHEN amendment.editing_mode = 'rejected' THEN 'rejected'
    WHEN amendment.editing_mode = 'passed' THEN 'completed'
    WHEN latest_path.id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.amendment_path_segment AS path_segment
        WHERE path_segment.path_id = latest_path.id
          AND path_segment.event_id IS NULL
      ) THEN 'pending_event'
    WHEN latest_path.id IS NULL AND amendment.event_id IS NULL THEN 'pending_event'
    ELSE 'scheduled'
  END AS process_status,
  CASE
    WHEN amendment.editing_mode = 'rejected' THEN 'rejected'
    WHEN amendment.editing_mode = 'passed' THEN 'accepted'
    ELSE NULL
  END AS branch_resolution,
  amendment.created_at,
  amendment.updated_at
FROM public.amendment AS amendment
LEFT JOIN latest_path
  ON latest_path.amendment_id = amendment.id
LEFT JOIN first_segment
  ON first_segment.path_id = latest_path.id
LEFT JOIN last_segment
  ON last_segment.path_id = latest_path.id
WHERE amendment.current_process_run_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.amendment_process_run AS process_run
    WHERE process_run.amendment_id = amendment.id
  )
  AND (
    amendment.group_id IS NOT NULL
    OR amendment.event_id IS NOT NULL
    OR latest_path.id IS NOT NULL
  );

INSERT INTO public.amendment_process_run (
  id,
  amendment_id,
  root_workflow_id,
  selected_source_group_id,
  selected_target_group_id,
  selected_target_workflow_id,
  active_branch_id,
  terminal_step_run_id,
  status,
  evaluation_mode,
  evaluation_date,
  evaluation_offset_months,
  evaluation_offset_years,
  implementation_status,
  created_by_id,
  created_at,
  updated_at
)
SELECT
  process_run_id,
  amendment_id,
  workflow_id,
  selected_source_group_id,
  selected_target_group_id,
  workflow_id,
  branch_id,
  NULL,
  process_status,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  created_by_id,
  created_at,
  updated_at
FROM tmp_amendment_runtime_backfill;

INSERT INTO public.amendment_process_branch (
  id,
  process_run_id,
  parent_branch_id,
  merged_into_branch_id,
  source_step_run_id,
  document_version_id,
  title,
  status,
  resolution,
  created_at,
  updated_at
)
SELECT
  branch_id,
  process_run_id,
  NULL,
  NULL,
  NULL,
  NULL,
  amendment.title,
  process_status,
  branch_resolution,
  tmp.created_at,
  tmp.updated_at
FROM tmp_amendment_runtime_backfill AS tmp
JOIN public.amendment AS amendment
  ON amendment.id = tmp.amendment_id;

CREATE TEMP TABLE tmp_amendment_step_backfill ON COMMIT DROP AS
WITH ordered_path_segments AS (
  SELECT
    tmp.process_run_id,
    tmp.branch_id,
    tmp.workflow_id,
    tmp.path_id,
    segment.id AS path_segment_id,
    segment.group_id AS target_group_id,
    segment.event_id,
    segment.status AS legacy_status,
    COALESCE(segment.order_index, 0) AS order_index,
    LAG(segment.group_id) OVER (
      PARTITION BY segment.path_id
      ORDER BY segment.order_index ASC NULLS LAST, segment.created_at ASC, segment.id ASC
    ) AS source_group_id
  FROM tmp_amendment_runtime_backfill AS tmp
  JOIN public.amendment_path_segment AS segment
    ON segment.path_id = tmp.path_id
),
path_backfill_rows AS (
  SELECT
    gen_random_uuid() AS step_run_id,
    process_run_id,
    branch_id,
    workflow_id,
    path_id,
    path_segment_id,
    source_group_id,
    target_group_id,
    event_id,
    order_index,
    CASE
      WHEN legacy_status IN ('approved', 'rejected', 'merged', 'withdrawn', 'completed')
        THEN legacy_status
      WHEN event_id IS NULL THEN 'pending_event'
      ELSE 'scheduled'
    END AS step_status,
    legacy_status AS decision_status
  FROM ordered_path_segments
),
direct_target_rows AS (
  SELECT
    gen_random_uuid() AS step_run_id,
    tmp.process_run_id,
    tmp.branch_id,
    tmp.workflow_id,
    tmp.path_id,
    NULL::uuid AS path_segment_id,
    tmp.selected_source_group_id AS source_group_id,
    tmp.selected_target_group_id AS target_group_id,
    amendment.event_id,
    0 AS order_index,
    CASE
      WHEN amendment.editing_mode = 'rejected' THEN 'rejected'
      WHEN amendment.editing_mode = 'passed' THEN 'completed'
      WHEN amendment.event_id IS NULL THEN 'pending_event'
      ELSE 'scheduled'
    END AS step_status,
    CASE
      WHEN amendment.editing_mode = 'rejected' THEN 'rejected'
      WHEN amendment.editing_mode = 'passed' THEN 'approved'
      WHEN amendment.event_id IS NULL THEN 'previous_decision_outstanding'
      ELSE 'forward_confirmed'
    END AS decision_status
  FROM tmp_amendment_runtime_backfill AS tmp
  JOIN public.amendment AS amendment
    ON amendment.id = tmp.amendment_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.amendment_path_segment AS segment
    WHERE segment.path_id = tmp.path_id
  )
    AND tmp.selected_target_group_id IS NOT NULL
)
SELECT * FROM path_backfill_rows
UNION ALL
SELECT * FROM direct_target_rows;

INSERT INTO public.amendment_process_step_run (
  id,
  process_run_id,
  branch_id,
  workflow_id,
  workflow_step_id,
  step_kind,
  selection_mode,
  merge_strategy,
  status,
  source_group_id,
  target_group_id,
  event_id,
  agenda_item_id,
  vote_id,
  support_confirmation_id,
  decision_status,
  order_index,
  starts_at,
  ends_at,
  created_at,
  updated_at
)
SELECT
  step_backfill.step_run_id,
  step_backfill.process_run_id,
  step_backfill.branch_id,
  step_backfill.workflow_id,
  NULL,
  'group_vote',
  CASE
    WHEN step_backfill.workflow_id IS NOT NULL THEN 'explicit_workflow'
    ELSE 'default_target_workflow'
  END,
  NULL,
  step_backfill.step_status,
  step_backfill.source_group_id,
  step_backfill.target_group_id,
  step_backfill.event_id,
  NULL,
  NULL,
  NULL,
  step_backfill.decision_status,
  step_backfill.order_index,
  event.start_date,
  CASE
    WHEN step_backfill.step_status IN ('approved', 'rejected', 'merged', 'withdrawn', 'completed')
      THEN COALESCE(event.start_date, now())
    ELSE NULL
  END,
  amendment.created_at,
  amendment.updated_at
FROM tmp_amendment_step_backfill AS step_backfill
JOIN tmp_amendment_runtime_backfill AS amendment
  ON amendment.process_run_id = step_backfill.process_run_id
LEFT JOIN public.event AS event
  ON event.id = step_backfill.event_id;

UPDATE public.amendment_path AS path
SET process_run_id = runtime.process_run_id
FROM tmp_amendment_runtime_backfill AS runtime
WHERE path.id = runtime.path_id
  AND path.process_run_id IS NULL;

UPDATE public.amendment_path_segment AS path_segment
SET
  process_branch_id = step_backfill.branch_id,
  process_step_run_id = step_backfill.step_run_id
FROM tmp_amendment_step_backfill AS step_backfill
WHERE path_segment.id = step_backfill.path_segment_id
  AND (
    path_segment.process_branch_id IS NULL
    OR path_segment.process_step_run_id IS NULL
  );

WITH terminal_steps AS (
  SELECT DISTINCT ON (process_run_id)
    process_run_id,
    step_run_id
  FROM tmp_amendment_step_backfill
  ORDER BY process_run_id, order_index DESC, step_run_id DESC
)
UPDATE public.amendment_process_run AS process_run
SET terminal_step_run_id = terminal_steps.step_run_id
FROM terminal_steps
WHERE process_run.id = terminal_steps.process_run_id
  AND process_run.terminal_step_run_id IS NULL
  AND process_run.status IN ('completed', 'rejected');

UPDATE public.amendment AS amendment
SET current_process_run_id = runtime.process_run_id
FROM tmp_amendment_runtime_backfill AS runtime
WHERE amendment.id = runtime.amendment_id
  AND amendment.current_process_run_id IS NULL;

INSERT INTO public.amendment_group_decision (
  id,
  amendment_id,
  group_id,
  process_run_id,
  process_branch_id,
  process_step_run_id,
  status,
  decided_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  decision_source.amendment_id,
  decision_source.group_id,
  decision_source.process_run_id,
  decision_source.process_branch_id,
  decision_source.process_step_run_id,
  decision_source.status,
  decision_source.decided_at,
  decision_source.created_at,
  decision_source.updated_at
FROM (
  SELECT DISTINCT ON (process_run.amendment_id, step_run.target_group_id)
    process_run.amendment_id,
    step_run.target_group_id AS group_id,
    process_run.id AS process_run_id,
    branch.id AS process_branch_id,
    step_run.id AS process_step_run_id,
    CASE
      WHEN branch.resolution = 'rejected' OR step_run.status = 'rejected' THEN 'rejected'
      WHEN (
        branch.resolution = 'accepted'
        OR process_run.status = 'completed'
      ) AND step_run.id = (
        SELECT last_step.id
        FROM public.amendment_process_step_run AS last_step
        WHERE last_step.branch_id = step_run.branch_id
        ORDER BY last_step.order_index DESC, last_step.created_at DESC, last_step.id DESC
        LIMIT 1
      ) THEN 'accepted'
      WHEN step_run.status = 'withdrawn' THEN 'withdrawn'
      ELSE 'supported'
    END AS status,
    COALESCE(step_run.ends_at, step_run.starts_at, process_run.updated_at, process_run.created_at) AS decided_at,
    process_run.created_at,
    COALESCE(step_run.ends_at, process_run.updated_at, process_run.created_at) AS updated_at
  FROM public.amendment_process_step_run AS step_run
  JOIN public.amendment_process_run AS process_run
    ON process_run.id = step_run.process_run_id
  JOIN public.amendment_process_branch AS branch
    ON branch.id = step_run.branch_id
  WHERE step_run.target_group_id IS NOT NULL
  ORDER BY
    process_run.amendment_id,
    step_run.target_group_id,
    step_run.order_index DESC,
    step_run.created_at DESC,
    step_run.id DESC
) AS decision_source
WHERE NOT EXISTS (
  SELECT 1
  FROM public.amendment_group_decision AS existing
  WHERE existing.amendment_id = decision_source.amendment_id
    AND existing.group_id = decision_source.group_id
);

COMMIT;
