import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { activeCollaboration } from './governance';
import { rows, sqlTransaction } from './transaction';
import { checksum, loadStored } from './store';

export async function submissionContext(
  tx: Transaction<Schema>,
  documentId: string | null,
  branchId: string | null,
  changeRequestId: string,
  discussionId?: string | null
) {
  if (!(await activeCollaboration(tx))) return null;
  const sql = sqlTransaction(tx);
  const [proof] = await rows<{
    submitted_content: unknown;
    checksum: string;
    projection: unknown;
    entity_id: string;
    branch_id: string | null;
  }>(
    sql,
    `select p.submitted_content,p.checksum,r.projection,d.entity_id,d.branch_id from collaboration_proposal p
    join collaboration_document d on d.id=p.document_id join collaboration_revision r on r.id=p.submitted_revision_id where p.change_request_id=$1`,
    [changeRequestId]
  );
  if (proof) {
    if (
      proof.entity_id !== documentId ||
      proof.branch_id !== branchId ||
      checksum(proof.submitted_content) !== proof.checksum
    )
      throw new CollaborationError('submitted_content_changed');
    return {
      content: proof.projection,
      discussions: [{ id: discussionId, changeRequestEntityId: changeRequestId }],
      mode: null,
    };
  }
  const [context] = await rows<{ draft: string | null }>(
    sql,
    "select current_setting('polity.collaboration_draft',true) as draft"
  );
  if (!context?.draft) throw new CollaborationError('proposal_requires_workspace');
  const draft = await loadStored(sql, context.draft);
  if (
    draft.kind !== 'document' ||
    draft.entity_id !== documentId ||
    draft.branch_id !== branchId ||
    draft.frozen
  )
    throw new CollaborationError('proposal_document_mismatch');
  return {
    content: draft.projection,
    discussions: [{ id: discussionId, changeRequestEntityId: changeRequestId }],
    mode: null,
  };
}
