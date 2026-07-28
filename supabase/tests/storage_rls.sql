-- @covers schema 23_storage.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

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

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('uploads', 'uploads', true),
  ('dataset-snapshots', 'dataset-snapshots', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.objects (id, bucket_id, name, metadata)
VALUES
  (
    'f9200000-0000-4000-a000-000000000001',
    'avatars',
    'f9100000-0000-4000-a000-000000000001/existing.png',
    '{"version":"original"}'::JSONB
  ),
  (
    'f9200000-0000-4000-a000-000000000002',
    'avatars',
    'f9100000-0000-4000-a000-000000000002/foreign.png',
    '{"version":"foreign"}'::JSONB
  ),
  (
    'f9200000-0000-4000-a000-000000000003',
    'uploads',
    'shared/existing.pdf',
    '{"version":"upload"}'::JSONB
  ),
  (
    'f9200000-0000-4000-a000-000000000004',
    'dataset-snapshots',
    'private/existing.csv',
    '{"version":"dataset"}'::JSONB
  );

SET LOCAL ROLE anon;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM storage.objects
    WHERE id IN (
      'f9200000-0000-4000-a000-000000000001',
      'f9200000-0000-4000-a000-000000000002',
      'f9200000-0000-4000-a000-000000000003',
      'f9200000-0000-4000-a000-000000000004'
    )
  ),
  3,
  'anonymous users can read public buckets but not dataset snapshots'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'f9100000-0000-4000-a000-000000000001',
  true
);
SELECT set_config('storage.allow_delete_query', 'true', true);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM storage.objects
    WHERE id IN (
      'f9200000-0000-4000-a000-000000000001',
      'f9200000-0000-4000-a000-000000000002',
      'f9200000-0000-4000-a000-000000000003',
      'f9200000-0000-4000-a000-000000000004'
    )
  ),
  3,
  'authenticated users cannot read dataset snapshots directly'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES (
        'f9200000-0000-4000-a000-000000000005',
        'avatars',
        'f9100000-0000-4000-a000-000000000001/new.png'
      )
    $sql$
  ),
  NULL,
  'authenticated users can upload into their own avatar folder'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES (
        'f9200000-0000-4000-a000-000000000006',
        'avatars',
        'f9100000-0000-4000-a000-000000000002/blocked.png'
      )
    $sql$
  ),
  '42501',
  'authenticated users cannot upload into another avatar folder'
);

UPDATE storage.objects
SET metadata = '{"version":"updated"}'::JSONB
WHERE id = 'f9200000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT metadata->>'version'
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000001'
  ),
  'updated',
  'authenticated users can update their own avatar'
);

UPDATE storage.objects
SET metadata = '{"version":"blocked"}'::JSONB
WHERE id = 'f9200000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT metadata->>'version'
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000002'
  ),
  'foreign',
  'authenticated users cannot update another user avatar'
);

DELETE FROM storage.objects
WHERE id = 'f9200000-0000-4000-a000-000000000005';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000005'
  ),
  0,
  'authenticated users can delete their own avatar'
);

DELETE FROM storage.objects
WHERE id = 'f9200000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000002'
  ),
  1,
  'authenticated users cannot delete another user avatar'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES (
        'f9200000-0000-4000-a000-000000000007',
        'uploads',
        'shared/new.pdf'
      )
    $sql$
  ),
  NULL,
  'authenticated users can create uploads'
);

UPDATE storage.objects
SET metadata = '{"version":"updated-upload"}'::JSONB
WHERE id = 'f9200000-0000-4000-a000-000000000007';

SELECT is(
  (
    SELECT metadata->>'version'
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000007'
  ),
  'updated-upload',
  'authenticated users can update uploads'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES (
        'f9200000-0000-4000-a000-000000000008',
        'dataset-snapshots',
        'private/blocked.csv'
      )
    $sql$
  ),
  '42501',
  'authenticated users cannot create dataset snapshots directly'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM storage.objects
    WHERE id = 'f9200000-0000-4000-a000-000000000004'
  ),
  1,
  'the service role can read private dataset snapshots'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
