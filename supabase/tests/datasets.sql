-- @covers schema 30_datasets.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(13);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

INSERT INTO public."user" (id, handle)
VALUES ('71000000-0000-0000-0000-000000000001', 'dataset-user');
INSERT INTO public."group" (id, name, owner_id)
VALUES ('72000000-0000-0000-0000-000000000001', 'Dataset group', '71000000-0000-0000-0000-000000000001');

INSERT INTO public.dataset (
  id, provider, provider_dataset_id, provider_resource_id, title,
  owner_user_id, group_id, created_by_id, columns, column_profiles
)
VALUES (
  '73000000-0000-0000-0000-000000000001',
  'EUROSTAT',
  'demo',
  'resource',
  'Dataset contract',
  '71000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '[]',
  '[]'
);

UPDATE public.dataset
SET updated_at = now() - INTERVAL '1 day'
WHERE id = '73000000-0000-0000-0000-000000000001';

INSERT INTO public.dataset_snapshot (
  id, dataset_id, snapshot_key, storage_path, content_hash,
  columns, column_profiles, status, created_by_id
)
VALUES (
  '74000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'dataset-contract-v1',
  'contract/v1.csv',
  'hash-v1',
  '[{"name":"value"}]',
  '[{"name":"value","type":"number"}]',
  'ready',
  '71000000-0000-0000-0000-000000000001'
);

SELECT results_eq(
  $sql$
    SELECT columns, column_profiles
    FROM public.dataset
    WHERE id = '73000000-0000-0000-0000-000000000001'
  $sql$,
  $sql$
    VALUES (
      '[{"name":"value"}]'::JSONB,
      '[{"name":"value","type":"number"}]'::JSONB
    )
  $sql$,
  'snapshot insertion copies its schema into the dataset'
);

UPDATE public.dataset_snapshot
SET
  columns = '[{"name":"updated"}]',
  column_profiles = '[{"name":"updated","type":"text"}]'
WHERE id = '74000000-0000-0000-0000-000000000001';

SELECT results_eq(
  $sql$
    SELECT columns, column_profiles
    FROM public.dataset
    WHERE id = '73000000-0000-0000-0000-000000000001'
  $sql$,
  $sql$
    VALUES (
      '[{"name":"updated"}]'::JSONB,
      '[{"name":"updated","type":"text"}]'::JSONB
    )
  $sql$,
  'snapshot updates refresh the dataset schema'
);

INSERT INTO public.dataset_import_job (
  id, dataset_id, provider, status, requested_by_id, result_snapshot_id
)
VALUES (
  '75000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'EUROSTAT',
  'ready',
  '71000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001'
);

DELETE FROM public.dataset_snapshot
WHERE id = '74000000-0000-0000-0000-000000000001';

SELECT ok(
  (SELECT result_snapshot_id IS NULL FROM public.dataset_import_job WHERE id = '75000000-0000-0000-0000-000000000001')
  AND (SELECT columns = '[{"name":"updated"}]'::JSONB FROM public.dataset WHERE id = '73000000-0000-0000-0000-000000000001')
  AND (SELECT updated_at > now() - INTERVAL '1 minute' FROM public.dataset WHERE id = '73000000-0000-0000-0000-000000000001'),
  'snapshot deletion preserves copied schema, touches the dataset, and nulls job results'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset SET provider = 'INVALID' WHERE id = '73000000-0000-0000-0000-000000000001'$sql$), '23514', 'dataset provider is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset SET visibility = 'invalid' WHERE id = '73000000-0000-0000-0000-000000000001'$sql$), '23514', 'dataset visibility is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset SET status = 'invalid' WHERE id = '73000000-0000-0000-0000-000000000001'$sql$), '23514', 'dataset status is constrained');

INSERT INTO public.dataset_snapshot (
  id, dataset_id, snapshot_key, storage_path, content_hash
)
VALUES (
  '74000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000001',
  'dataset-contract-v2',
  'contract/v2.csv',
  'hash-v2'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset_snapshot SET status = 'invalid' WHERE id = '74000000-0000-0000-0000-000000000002'$sql$), '23514', 'snapshot status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset_import_job SET provider = 'INVALID' WHERE id = '75000000-0000-0000-0000-000000000001'$sql$), '23514', 'import provider is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.dataset_import_job SET status = 'invalid' WHERE id = '75000000-0000-0000-0000-000000000001'$sql$), '23514', 'import status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.dataset (id, provider, provider_dataset_id, provider_resource_id, title, group_id) VALUES ('73000000-0000-0000-0000-000000000002', 'EUROSTAT', 'demo', 'resource', 'Duplicate identity', '72000000-0000-0000-0000-000000000001')$sql$), '23505', 'provider dataset identities are unique per scope');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.dataset_snapshot (id, dataset_id, snapshot_key, storage_path, content_hash) VALUES ('74000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000001', 'dataset-contract-v2', 'contract/v3.csv', 'hash-v3')$sql$), '23505', 'snapshot keys are globally unique');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.search_document
    WHERE entity_type = 'dataset'
      AND entity_id = '73000000-0000-0000-0000-000000000001'
  ),
  'dataset changes maintain the search projection'
);

DELETE FROM public.dataset
WHERE id = '73000000-0000-0000-0000-000000000001';

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.dataset_snapshot WHERE dataset_id = '73000000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.dataset_import_job WHERE id = '75000000-0000-0000-0000-000000000001')
  AND NOT EXISTS (
    SELECT 1 FROM public.search_document
    WHERE entity_type = 'dataset'
      AND entity_id = '73000000-0000-0000-0000-000000000001'
  ),
  'dataset deletion removes snapshots, jobs, and search projection'
);

SELECT * FROM finish();

ROLLBACK;
