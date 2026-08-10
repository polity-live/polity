import type { Transaction } from '@rocicorp/zero';
import { normalizeEditingMode } from './editing-mode-policy';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { toMutableJSONValue } from '../shared/helpers';

type ZeroTransaction = Transaction<Schema>;

async function loadCanonicalAmendmentDocument(tx: ZeroTransaction, amendmentId: string) {
  const amendmentResult = await tx.run(zql.amendment.where('id', amendmentId).one());
  const amendment = Array.isArray(amendmentResult) ? null : amendmentResult;
  if (!amendment?.document_id) {
    return null;
  }

  const document = await tx.run(zql.document.where('id', amendment.document_id).one());
  if (!document?.content) {
    return null;
  }

  return { amendment, document };
}

async function findProcessRunBaseSnapshot(tx: ZeroTransaction, processRunId: string) {
  const branches = await tx.run(
    zql.amendment_process_branch.where('process_run_id', processRunId).orderBy('created_at', 'asc')
  );

  for (const branch of branches) {
    if (!branch.document_version_id) {
      continue;
    }

    const version = await tx.run(
      zql.document_version.where('id', branch.document_version_id).one()
    );
    if (version?.content) {
      return {
        versionId: version.id,
        content: version.content,
      };
    }
  }

  return null;
}

export async function createBranchDocumentArtifacts(
  tx: ZeroTransaction,
  args: {
    amendmentId: string;
    processRunId?: string | null;
    authorId: string;
    changeSummary: string;
  }
) {
  const existingBase = args.processRunId
    ? await findProcessRunBaseSnapshot(tx, args.processRunId)
    : null;
  let documentVersionId = existingBase?.versionId ?? null;
  let branchContent = existingBase ? toMutableJSONValue(existingBase.content) : null;
  let editingMode: string | null = null;

  if (!branchContent) {
    const canonical = await loadCanonicalAmendmentDocument(tx, args.amendmentId);
    if (!canonical) {
      return { documentVersionId: null, documentId: null, editingMode: null };
    }

    const { document } = canonical;
    branchContent = toMutableJSONValue(document.content);
    editingMode = document.editing_mode ?? null;

    const latestVersion = await tx.run(
      zql.document_version
        .where('document_id', document.id)
        .orderBy('version_number', 'desc')
        .limit(1)
        .one()
    );
    documentVersionId = crypto.randomUUID();

    await tx.mutate.document_version.insert({
      id: documentVersionId,
      document_id: document.id,
      amendment_id: args.amendmentId,
      blog_id: null,
      content: branchContent,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      change_summary: args.changeSummary,
      author_id: args.authorId,
      created_at: Date.now(),
    });
  }

  const branchDocumentId = crypto.randomUUID();
  const now = Date.now();
  await tx.mutate.document.insert({
    id: branchDocumentId,
    amendment_id: args.amendmentId,
    content: branchContent,
    editing_mode: normalizeEditingMode(editingMode),
    created_at: now,
    updated_at: now,
  });

  return { documentVersionId, documentId: branchDocumentId, editingMode };
}
