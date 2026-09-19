import { assertStoredIntegrity, persistProjection, type StoredDocument } from './store';
import { rows, type SqlTransaction } from './transaction';
import { checkWindow } from './migration';

/** The compatibility release retains PostgreSQL revisions and branch state and
 * uses authorized HTTP synchronization. It never restores an old database dump. */
export async function enterCompatibility(sql: SqlTransaction, reserveMs: number) {
  const [control] = await rows<{ phase: string; activated_at: number | null }>(
    sql,
    'select phase,activated_at from collaboration_control where singleton for update'
  );
  if (control.phase !== 'maintenance' || !control.activated_at)
    throw new Error('Compatibility rollback requires maintenance after activation');
  await checkWindow(sql, reserveMs);
  const documents = await rows<StoredDocument>(
    sql,
    'select * from collaboration_document where not deleted'
  );
  for (const doc of documents) {
    assertStoredIntegrity(doc);
    await persistProjection(sql, doc);
  }
  await sql.query(
    'update collaboration_document set generation=gen_random_uuid(),updated_at=$1 where not deleted',
    [Date.now()]
  );
  await sql.query(
    'insert into collaboration_outbox(document_id,generation,revision,created_at) select id,generation,revision,updated_at from collaboration_document where not deleted',
    []
  );
  await sql.query(
    "update collaboration_control set phase='active',compatibility=true,updated_at=$1 where singleton",
    [Date.now()]
  );
  await sql.query(
    "update collaboration_migration_attempt set status='compatibility',updated_at=$1 where id=(select migration_id from collaboration_control where singleton)",
    [Date.now()]
  );
  return { phase: 'active', transport: 'http', documents: documents.length };
}
