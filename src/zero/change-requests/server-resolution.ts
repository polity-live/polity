import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ChangeRequestVisibilityScope } from './visibility';

export type ChangeRequestResolutionTx = Parameters<
  typeof mutators.amendments.updateChangeRequest.fn
>[0]['tx'];
export type VoteResult = 'passed' | 'rejected' | 'tie';
export type ChangeRequestResolutionMethod = 'direct_internal' | 'internal_vote' | 'event_vote';

interface ChangeRequestResolutionCtx {
  readonly userID: string;
}

export interface DiscussionEntry {
  id: string;
  changeRequestEntityId?: string;
  crId?: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}

export function getChangeRequestResolutionStatus(voteResult: VoteResult) {
  return voteResult === 'passed' ? 'accepted' : 'rejected';
}

export function findChangeRequestDiscussion(
  discussions: readonly DiscussionEntry[],
  changeRequest: { id: string; title?: string | null }
) {
  return discussions.find(
    discussion =>
      discussion.changeRequestEntityId === changeRequest.id ||
      (changeRequest.title &&
        (discussion.crId === changeRequest.title || discussion.title === changeRequest.title))
  );
}

function linkResolvedDiscussion(
  discussion: DiscussionEntry,
  changeRequestId: string,
  status: string
): DiscussionEntry {
  return {
    ...discussion,
    changeRequestEntityId: discussion.changeRequestEntityId ?? changeRequestId,
    status,
  };
}

export function applyChangeRequestVoteResultToContent(
  content: Parameters<typeof applySuggestionToContent>[0],
  suggestionId: string,
  voteResult: VoteResult
) {
  const action = voteResult === 'passed' ? 'accept' : 'reject';
  return applySuggestionToContent(content, suggestionId, action);
}

async function loadResolutionTarget(
  tx: ChangeRequestResolutionTx,
  cr: {
    amendment_id: string;
    process_branch_id?: string | null;
  }
) {
  const amendmentRow = cr.amendment_id
    ? await tx.run(zql.amendment.where('id', cr.amendment_id).one())
    : null;

  if (!cr.process_branch_id) {
    return {
      amendmentRow,
      branch: null,
      documentId: amendmentRow?.document_id ?? null,
      discussions: Array.isArray(amendmentRow?.discussions)
        ? (amendmentRow.discussions as DiscussionEntry[])
        : [],
    };
  }

  const branch = await tx.run(zql.amendment_process_branch.where('id', cr.process_branch_id).one());
  if (!branch) {
    throw new Error('Process branch not found');
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  const amendmentOriginId =
    amendmentRow?.origin_amendment_id ?? amendmentRow?.clone_source_id ?? amendmentRow?.id;
  if (!processRun || processRun.amendment_id !== amendmentOriginId) {
    throw new Error('Process branch does not belong to this amendment.');
  }

  return {
    amendmentRow,
    branch,
    documentId: branch.document_id ?? null,
    discussions: Array.isArray(branch.discussions) ? (branch.discussions as DiscussionEntry[]) : [],
  };
}

export async function resolveChangeRequestByVoteResult({
  tx,
  ctx,
  changeRequestId,
  voteResult,
  now = Date.now(),
  resolutionMethod = 'event_vote',
  resolvedInMode = resolutionMethod === 'internal_vote'
    ? 'vote_internal'
    : 'event_final_closing_vote',
  visibilityScope = 'public',
}: {
  tx: ChangeRequestResolutionTx;
  ctx: ChangeRequestResolutionCtx;
  changeRequestId: string;
  voteResult: VoteResult;
  now?: number;
  resolutionMethod?: ChangeRequestResolutionMethod;
  resolvedInMode?: string | null;
  visibilityScope?: ChangeRequestVisibilityScope;
}) {
  const cr = await tx.run(zql.change_request.where('id', changeRequestId).one());
  if (!cr) {
    return null;
  }

  const crStatus = getChangeRequestResolutionStatus(voteResult);
  const target = await loadResolutionTarget(tx, cr);
  const discussions = target.discussions;
  const matchingDiscussion = findChangeRequestDiscussion(discussions, cr);
  const suggestionId = matchingDiscussion?.id;
  let resolutionSnapshot = {};

  if (target.documentId && suggestionId) {
    const doc = await tx.run(zql.document.where('id', target.documentId).one());

    if (doc?.content) {
      const snapshot = createChangeRequestDiffSnapshot(
        suggestionId,
        doc.content as Parameters<typeof applySuggestionToContent>[0]
      );
      if (snapshot.change_type) {
        resolutionSnapshot = snapshot;
      }

      const crLabel =
        matchingDiscussion?.crId ??
        cr.title ??
        translateText('generated.inline.0190_change_request_9c839351');
      const versionSummary =
        voteResult === 'passed' ? `${crLabel} accepted by vote` : `${crLabel} rejected by vote`;

      const latestVersion = await tx.run(
        zql.document_version
          .where('document_id', doc.id)
          .orderBy('version_number', 'desc')
          .limit(1)
          .one()
      );
      const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

      await tx.mutate.document_version.insert({
        id: crypto.randomUUID(),
        document_id: doc.id,
        amendment_id: cr.amendment_id,
        blog_id: null,
        content: doc.content as ReadonlyJSONValue,
        version_number: nextVersionNumber,
        change_summary: versionSummary,
        author_id: ctx.userID,
        created_at: now,
      });

      const updatedContent = applyChangeRequestVoteResultToContent(
        doc.content as Parameters<typeof applySuggestionToContent>[0],
        suggestionId,
        voteResult
      );

      await tx.mutate.document.update({
        id: doc.id,
        content: updatedContent as unknown as ReadonlyJSONValue,
        updated_at: now,
      });
    }
  }

  if (matchingDiscussion && discussions.length > 0) {
    const updatedDiscussions = discussions.map(discussion =>
      discussion.id === matchingDiscussion.id
        ? linkResolvedDiscussion(discussion, cr.id, crStatus)
        : discussion
    );
    if (target.branch) {
      await tx.mutate.amendment_process_branch.update({
        id: target.branch.id,
        discussions: updatedDiscussions as unknown as ReadonlyJSONValue,
        updated_at: now,
      });
    } else {
      await tx.mutate.amendment.update({
        id: cr.amendment_id,
        discussions: updatedDiscussions as unknown as ReadonlyJSONValue,
        updated_at: now,
      });
    }
  }

  await tx.mutate.change_request.update({
    id: cr.id,
    status: crStatus,
    voting_status: 'completed',
    resolved_in_mode: resolvedInMode,
    resolution_method: resolutionMethod,
    visibility_scope: visibilityScope,
    ...resolutionSnapshot,
    updated_at: now,
  });

  return { changeRequest: cr, status: crStatus };
}
