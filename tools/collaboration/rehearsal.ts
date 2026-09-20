import { dbProvider } from '../../src/zero/db-provider';
import {
  migrateDocuments,
  governanceManifest,
  activateMigration,
} from '../../src/server/collaboration/migration';
import { stableJson } from '../../src/features/collaboration/logic/codec';
const database = new URL(process.env.ZERO_UPSTREAM_DB || '');
if (process.env.COLLABORATION_REHEARSAL_LIFECYCLE === '1') {
  const { rehearseLifecycle } = await import('../e2e/collaboration/lifecycle');
  console.log(JSON.stringify(await rehearseLifecycle(), null, 2));
  process.exit(0);
}
if (!['localhost', '127.0.0.1', '::1'].includes(database.hostname))
  throw new Error('Rehearsals require an isolated local database copy');
const rollback = new Error('Rehearsal rollback');
const started = Date.now();
const migrationId = crypto.randomUUID();
const commit = process.env.COLLABORATION_REHEARSAL_COMMIT === '1';
if (commit && !/^\/polity_collaboration_acceptance_[0-9]+$/.test(database.pathname))
  throw new Error('Committed rehearsals require a dedicated acceptance database');
let report: unknown;
try {
  await dbProvider.transaction(async tx => {
    const sql = tx.dbTransaction;
    const before = await governanceManifest(sql);
    await sql.query("select set_config('polity.collaboration_migration','on',true)", []);
    await sql.query(
      "update collaboration_control set phase='maintenance',migration_id=$1 where singleton",
      [migrationId]
    );
    report = await migrateDocuments(sql, migrationId);
    await sql.query('update collaboration_control set manifest=$1::jsonb where singleton', [
      report,
    ]);
    await activateMigration(sql, migrationId, 60_000);
    if (stableJson(before) !== stableJson(await governanceManifest(sql)))
      throw new Error('Governance changed');
    if (!commit) throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}
console.log(
  JSON.stringify(
    {
      report,
      durationMs: Date.now() - started,
      activatedInsideTransaction: true,
      rolledBack: !commit,
      transactionRollbackOnly: !commit,
      database: database.pathname,
    },
    null,
    2
  )
);
process.exit(0);
