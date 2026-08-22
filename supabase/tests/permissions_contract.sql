-- @covers security all
-- @covers schema 31_service_role_grants.sql
-- @covers schema 35_security.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

CREATE TEMP TABLE app_functions ON COMMIT DROP AS
SELECT
  procedure.oid,
  procedure.oid::regprocedure::TEXT AS signature,
  procedure.proowner,
  procedure.proacl
FROM pg_proc procedure
JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend dependency
    WHERE dependency.classid = 'pg_proc'::regclass
      AND dependency.objid = procedure.oid
      AND dependency.deptype = 'e'
  );

CREATE TEMP TABLE app_sequences ON COMMIT DROP AS
SELECT sequence_definition.oid
FROM pg_class sequence_definition
JOIN pg_namespace namespace ON namespace.oid = sequence_definition.relnamespace
WHERE namespace.nspname = 'public'
  AND sequence_definition.relkind = 'S';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM app_functions
    WHERE EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(proacl, acldefault('f', proowner))) acl_entry
      WHERE acl_entry.grantee = 0
        AND acl_entry.privilege_type = 'EXECUTE'
    )
  ),
  0,
  'PUBLIC cannot execute application functions'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM app_functions
    WHERE has_function_privilege('anon', oid, 'EXECUTE')
  ),
  0,
  'anonymous clients cannot execute application functions'
);

SELECT set_eq(
  $sql$
    SELECT signature
    FROM app_functions
    WHERE has_function_privilege('authenticated', oid, 'EXECUTE')
  $sql$,
  $sql$
    VALUES ('current_user_has_password()'::TEXT)
  $sql$,
  'authenticated clients can execute only the password-inspection RPC'
);

SELECT set_eq(
  $sql$
    SELECT signature
    FROM app_functions
    WHERE has_function_privilege('service_role', oid, 'EXECUTE')
  $sql$,
  $sql$
    VALUES
      ('claim_newsletter_sync_jobs(integer)'::TEXT),
      ('claim_push_delivery_jobs(integer,uuid,bigint)'::TEXT),
      ('claim_push_notification_jobs(integer,uuid)'::TEXT),
      ('cleanup_expired_app_tutorial_runs()'::TEXT),
      ('enqueue_direct_push_delivery(uuid,text,jsonb)'::TEXT),
      ('expand_push_notification_job(bigint)'::TEXT),
      ('purge_expired_notifications()'::TEXT),
      ('resolve_notification_recipients(uuid)'::TEXT)
  $sql$,
  'the service role can execute exactly the server RPC allowlist'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM information_schema.role_table_grants table_grant
    WHERE table_grant.table_schema = 'public'
      AND table_grant.grantee IN ('PUBLIC', 'anon', 'authenticated')
  ),
  0,
  'untrusted roles have no privileges on application tables'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM information_schema.role_table_grants table_grant
    WHERE table_grant.table_schema = 'public'
      AND table_grant.grantee = 'service_role'
      AND table_grant.privilege_type IN (
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      )
  ),
  1015,
  'the service role has all seven privileges on all 145 tables'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM app_sequences sequence_definition
    WHERE has_sequence_privilege('service_role', sequence_definition.oid, 'USAGE')
      AND has_sequence_privilege('service_role', sequence_definition.oid, 'SELECT')
      AND has_sequence_privilege('service_role', sequence_definition.oid, 'UPDATE')
  ),
  3,
  'the service role can use every application sequence'
);

SELECT ok(
  NOT has_schema_privilege('anon', 'public', 'CREATE')
  AND NOT has_schema_privilege('authenticated', 'public', 'CREATE')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_namespace namespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
    ) acl_entry
    WHERE namespace.nspname = 'public'
      AND acl_entry.grantee = 0
      AND acl_entry.privilege_type = 'CREATE'
  ),
  'untrusted roles cannot create objects in the trusted public schema'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_default_acl default_acl
    CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry
    JOIN pg_roles owner_role ON owner_role.oid = default_acl.defaclrole
    JOIN pg_roles grantee_role ON grantee_role.oid = acl_entry.grantee
    JOIN pg_namespace namespace ON namespace.oid = default_acl.defaclnamespace
    WHERE namespace.nspname = 'public'
      AND default_acl.defaclobjtype IN ('r', 'S')
      AND owner_role.rolname = 'postgres'
      AND grantee_role.rolname IN ('anon', 'authenticated')
  ),
  0,
  'future tables and sequences grant nothing to untrusted roles'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_default_acl default_acl
    CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry
    JOIN pg_roles owner_role ON owner_role.oid = default_acl.defaclrole
    LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl_entry.grantee
    JOIN pg_namespace namespace ON namespace.oid = default_acl.defaclnamespace
    WHERE namespace.nspname = 'public'
      AND default_acl.defaclobjtype = 'f'
      AND owner_role.rolname = 'postgres'
      AND acl_entry.privilege_type = 'EXECUTE'
      AND (
        acl_entry.grantee = 0
        OR grantee_role.rolname IN ('anon', 'authenticated')
      )
  ),
  0,
  'future functions are not executable by untrusted roles by default'
);

SELECT * FROM finish();

ROLLBACK;
