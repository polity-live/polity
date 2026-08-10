import { toMutableJSONValue } from '../shared/helpers';
import type { Value } from 'platejs';

import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { mutators } from '../mutators';
import { zql } from '../schema';

type EventSuggestionCleanupTx = Parameters<typeof mutators.amendments.update.fn>[0]['tx'];

interface EventSuggestionCleanupCtx {
  readonly userID: string;
}

export interface EventSuggestionDiscussionEntry {
  id: string;
  changeRequestEntityId?: string | null;
  confirmationStatus?: 'pending' | 'confirmed' | null;
  [key: string]: unknown;
}

export function isPendingUnconfirmedEventSuggestion(discussion: EventSuggestionDiscussionEntry) {
  return discussion.confirmationStatus === 'pending';
}

export function discardPendingEventSuggestionsFromState({
  content,
  discussions,
}: {
  content: Value | null | undefined;
  discussions: readonly EventSuggestionDiscussionEntry[];
}) {
  const pendingDiscussions = discussions.filter(isPendingUnconfirmedEventSuggestion);
  if (pendingDiscussions.length === 0) {
    return {
      changed: false,
      removedCount: 0,
      removedChangeRequestIds: [],
      content: content ?? null,
      discussions: [...discussions],
    };
  }

  const pendingIds = new Set(pendingDiscussions.map(discussion => discussion.id));
  const removedChangeRequestIds = pendingDiscussions
    .map(discussion => discussion.changeRequestEntityId)
    .filter((id): id is string => Boolean(id));
  let updatedContent = content ?? null;

  if (updatedContent) {
    for (const discussion of pendingDiscussions) {
      updatedContent = applySuggestionToContent(updatedContent, discussion.id, 'reject');
    }
  }

  return {
    changed: true,
    removedCount: pendingDiscussions.length,
    removedChangeRequestIds,
    content: updatedContent,
    discussions: discussions.filter(discussion => !pendingIds.has(discussion.id)),
  };
}

export async function discardPendingEventSuggestions({
  tx,
  ctx,
  amendmentId,
  processBranchId,
  now = Date.now(),
}: {
  tx: EventSuggestionCleanupTx;
  ctx: EventSuggestionCleanupCtx;
  amendmentId: string | null | undefined;
  processBranchId?: string | null;
  now?: number;
}) {
  if (!amendmentId) {
    return { removedCount: 0 };
  }

  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  const branch = processBranchId
    ? await tx.run(zql.amendment_process_branch.where('id', processBranchId).one())
    : null;
  const discussionSource = branch ?? amendment;
  const discussions: EventSuggestionDiscussionEntry[] = Array.isArray(discussionSource?.discussions)
    ? (discussionSource.discussions as EventSuggestionDiscussionEntry[])
    : [];
  if (!amendment || discussions.length === 0) {
    return { removedCount: 0 };
  }

  const documentId = branch?.document_id ?? amendment.document_id;
  const document = documentId ? await tx.run(zql.document.where('id', documentId).one()) : null;
  const cleanup = discardPendingEventSuggestionsFromState({
    content: document?.content as Value | null | undefined,
    discussions,
  });

  if (!cleanup.changed) {
    return { removedCount: 0 };
  }

  for (const changeRequestId of cleanup.removedChangeRequestIds) {
    await tx.mutate.change_request.delete({ id: changeRequestId });
  }

  if (document?.id && document.content && cleanup.content) {
    const latestVersion = await tx.run(
      zql.document_version
        .where('document_id', document.id)
        .orderBy('version_number', 'desc')
        .limit(1)
        .one()
    );
    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    await tx.mutate.document_version.insert({
      id: crypto.randomUUID(),
      document_id: document.id,
      amendment_id: amendment.id,
      blog_id: null,
      content: toMutableJSONValue(document.content),
      version_number: nextVersionNumber,
      change_summary: 'Discarded unsubmitted event suggestions before final vote',
      author_id: ctx.userID,
      created_at: now,
    });

    await tx.mutate.document.update({
      id: document.id,
      content: toMutableJSONValue(cleanup.content),
      updated_at: now,
    });
  }

  if (branch?.id) {
    await tx.mutate.amendment_process_branch.update({
      id: branch.id,
      discussions: toMutableJSONValue(cleanup.discussions),
      updated_at: now,
    });
  } else {
    await tx.mutate.amendment.update({
      id: amendment.id,
      discussions: toMutableJSONValue(cleanup.discussions),
      updated_at: now,
    });
  }

  return { removedCount: cleanup.removedCount };
}
