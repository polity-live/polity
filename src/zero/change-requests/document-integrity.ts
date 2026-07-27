import type { Value } from 'platejs';
import type { Transaction } from '@rocicorp/zero';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import { zql, type Schema } from '../schema';

export function isCityDesignChangeRequestSource(sourceType: string | null | undefined) {
  const normalized = sourceType?.trim().toLowerCase() ?? '';
  return normalized.startsWith('city_design_');
}

export function assertDocumentSuggestionIntegrity({
  changeRequestId,
  discussionId,
  discussions,
  content,
}: {
  changeRequestId: string;
  discussionId: string | null | undefined;
  discussions: unknown;
  content: unknown;
}) {
  const discussionList = Array.isArray(discussions) ? discussions : [];
  const discussion = discussionId
    ? discussionList.find(
        entry =>
          !!entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          (entry as { id?: unknown }).id === discussionId
      )
    : null;

  if (!discussionId || !discussion) {
    throw new Error(
      `Cannot create document change request ${changeRequestId}: linked discussion is not present in the document scope.`
    );
  }

  if (!Array.isArray(content)) {
    throw new Error(
      `Cannot create document change request ${changeRequestId}: document content not found.`
    );
  }

  const snapshot = createChangeRequestDiffSnapshot(discussionId, content as Value);
  if (!snapshot.change_type) {
    throw new Error(
      `Cannot create document change request ${changeRequestId}: linked suggestion is not present in the document. Save the suggestion before continuing.`
    );
  }

  return snapshot;
}

export async function assertPersistedDocumentChangeRequestIntegrity({
  tx,
  amendmentId,
  processBranchId,
  changeRequestId,
  discussionId,
}: {
  tx: Transaction<Schema>;
  amendmentId: string;
  processBranchId?: string | null;
  changeRequestId: string;
  discussionId?: string | null;
}) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }

  const branch = processBranchId
    ? await tx.run(zql.amendment_process_branch.where('id', processBranchId).one())
    : null;
  if (processBranchId && !branch) {
    throw new Error('Amendment process branch not found');
  }

  if (branch) {
    const processRun = await tx.run(
      zql.amendment_process_run.where('id', branch.process_run_id).one()
    );
    if (!processRun || processRun.amendment_id !== amendmentId) {
      throw new Error('Change request process branch does not belong to the amendment');
    }
  }

  const documentId = branch?.document_id ?? amendment.document_id;
  const document = documentId ? await tx.run(zql.document.where('id', documentId).one()) : null;

  return assertDocumentSuggestionIntegrity({
    changeRequestId,
    discussionId,
    discussions: branch?.discussions ?? amendment.discussions,
    content: document?.content,
  });
}
