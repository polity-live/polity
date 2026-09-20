import { type SqlTransaction, rows } from './transaction';
import { createStored } from './store';

/** Initialize Studio within its creation transaction. Other editors keep their legacy content. */
export async function initializeTransactionDocuments(sql: SqlTransaction) {
  const [control] = await rows<{ active: boolean; needed: boolean }>(
    sql,
    "select phase='active' as active,current_setting('polity.collaboration_needs_initialization',true)='on' as needed from collaboration_control where singleton"
  );
  if (!control?.active || !control.needed) return;
  const studios = await rows<{ project_id: string; document: unknown }>(
    sql,
    "select s.project_id,s.document from studio_state s where not exists(select 1 from collaboration_document c where c.kind='studio' and c.entity_id=s.project_id and c.workspace_id is null)"
  );
  for (const s of studios)
    await createStored(
      sql,
      { kind: 'studio', entityId: s.project_id, branchId: null, workspaceId: null },
      s.document,
      null
    );
}
