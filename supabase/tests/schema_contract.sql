-- @covers catalog all
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

SELECT set_eq(
  $sql$
    SELECT extension_name
    FROM (
      VALUES
        ('pg_cron'::TEXT),
        ('pg_net'::TEXT),
        ('pg_trgm'::TEXT)
    ) expected(extension_name)
  $sql$,
  $sql$
    SELECT extension.extname::TEXT
    FROM pg_extension extension
    WHERE extension.extname IN ('pg_cron', 'pg_net', 'pg_trgm')
  $sql$,
  'all application extensions are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
  ),
  141,
  'the application owns 141 public tables'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_attribute column_definition
    JOIN pg_class relation ON relation.oid = column_definition.attrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND column_definition.attnum > 0
      AND NOT column_definition.attisdropped
  ),
  1546,
  'all 1546 application columns are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_definition
        WHERE constraint_definition.conrelid = relation.oid
          AND constraint_definition.contype = 'p'
      )
  ),
  0,
  'every application table has a primary key'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND NOT relation.relrowsecurity
  ),
  0,
  'row level security is enabled on every application table'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_constraint constraint_definition
    JOIN pg_namespace namespace
      ON namespace.oid = constraint_definition.connamespace
    WHERE namespace.nspname = 'public'
      AND constraint_definition.contype = 'c'
  ),
  98,
  'all 98 business CHECK constraints are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_constraint constraint_definition
    JOIN pg_namespace namespace
      ON namespace.oid = constraint_definition.connamespace
    WHERE namespace.nspname = 'public'
      AND constraint_definition.contype = 'f'
  ),
  358,
  'all 358 foreign keys are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_constraint constraint_definition
    JOIN pg_namespace namespace
      ON namespace.oid = constraint_definition.connamespace
    WHERE namespace.nspname = 'public'
      AND constraint_definition.contype = 'u'
  ),
  56,
  'all 56 UNIQUE constraints are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_index index_definition
    JOIN pg_class index_relation ON index_relation.oid = index_definition.indexrelid
    JOIN pg_namespace namespace ON namespace.oid = index_relation.relnamespace
    LEFT JOIN pg_constraint constraint_definition
      ON constraint_definition.conindid = index_definition.indexrelid
    WHERE namespace.nspname = 'public'
      AND index_definition.indisunique
      AND constraint_definition.oid IS NULL
  ),
  28,
  'all 28 standalone and partial uniqueness rules are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_indexes index_definition
    WHERE index_definition.schemaname = 'public'
  ),
  639,
  'all 639 application indexes are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  ),
  67,
  'all 67 application functions are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  ),
  63,
  'all 63 privileged functions are SECURITY DEFINER'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    JOIN pg_roles owner_role ON owner_role.oid = procedure.proowner
    WHERE namespace.nspname = 'public'
      AND owner_role.rolname <> 'postgres'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  ),
  0,
  'postgres owns every application function'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(procedure.proconfig, ARRAY[]::TEXT[])) setting
        WHERE setting LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  ),
  0,
  'every SECURITY DEFINER function fixes its search path'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_trigger trigger_definition
    JOIN pg_class relation ON relation.oid = trigger_definition.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname IN ('public', 'auth')
      AND NOT trigger_definition.tgisinternal
  ),
  57,
  'all 57 application triggers are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_trigger trigger_definition
    JOIN pg_class relation ON relation.oid = trigger_definition.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname IN ('public', 'auth')
      AND NOT trigger_definition.tgisinternal
      AND trigger_definition.tgenabled <> 'O'
  ),
  0,
  'every application trigger is enabled'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_policies policy_definition
    WHERE policy_definition.schemaname IN ('public', 'storage')
  ),
  151,
  'all 151 RLS policies are installed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_constraint constraint_definition
    JOIN pg_namespace namespace
      ON namespace.oid = constraint_definition.connamespace
    WHERE namespace.nspname = 'public'
      AND NOT constraint_definition.convalidated
  ),
  0,
  'every application constraint is validated'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_index index_definition
    JOIN pg_class index_relation ON index_relation.oid = index_definition.indexrelid
    JOIN pg_namespace namespace ON namespace.oid = index_relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND (
        NOT index_definition.indisvalid
        OR NOT index_definition.indisready
      )
  ),
  0,
  'every application index is valid and ready'
);

SELECT * FROM finish();

ROLLBACK;
