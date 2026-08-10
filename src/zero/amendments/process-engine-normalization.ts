export type MainScopeDiscussion = Record<string, any> & { id?: string };
export type MainScopeChangeRequest = Record<string, any> & {
  id: string;
  suggestion_id?: string | null;
  title?: string | null;
  branch_sequence_number?: number | null;
  created_at?: number | string | null;
};

function changeRequestCreatedAt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  return Number.POSITIVE_INFINITY;
}

export function normalizeMainScopeChangeRequestsForFirstBranch(
  discussionsValue: readonly unknown[],
  changeRequestsValue: readonly unknown[]
) {
  const discussions = discussionsValue.filter((value): value is MainScopeDiscussion =>
    Boolean(value && typeof value === 'object')
  );
  const changeRequests = changeRequestsValue
    .filter((value): value is MainScopeChangeRequest =>
      Boolean(
        value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof (value as { id?: unknown }).id === 'string'
      )
    )
    .sort((left, right) => {
      const byCreatedAt =
        changeRequestCreatedAt(left.created_at) - changeRequestCreatedAt(right.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : String(left.id).localeCompare(String(right.id));
    })
    .map((changeRequest, index): MainScopeChangeRequest => ({
      ...changeRequest,
      branch_sequence_number: index + 1,
      title:
        changeRequest.title == null || /^CR-\d+$/.test(String(changeRequest.title))
          ? `CR-${index + 1}`
          : changeRequest.title,
    }));

  const candidateByDiscussionId = new Map<string, MainScopeChangeRequest>();
  const discussionIdsByChangeRequestId = new Map<string, string[]>();

  for (const discussion of discussions) {
    if (typeof discussion.id !== 'string' || !discussion.id) continue;
    const candidates = changeRequests.filter(
      changeRequest =>
        changeRequest.suggestion_id === discussion.id ||
        changeRequest.id === discussion.changeRequestEntityId
    );
    if (candidates.length !== 1) continue;

    const [changeRequest] = candidates;
    const changeRequestId = changeRequest.id;
    candidateByDiscussionId.set(discussion.id, changeRequest);
    discussionIdsByChangeRequestId.set(changeRequestId, [
      ...(discussionIdsByChangeRequestId.get(changeRequestId) ?? []),
      discussion.id,
    ]);
  }

  const unambiguousDiscussionIdByChangeRequestId = new Map<string, string>();
  for (const [changeRequestId, discussionIds] of discussionIdsByChangeRequestId) {
    if (discussionIds.length === 1) {
      unambiguousDiscussionIdByChangeRequestId.set(changeRequestId, discussionIds[0]);
    }
  }

  const normalizedChangeRequests = changeRequests.map(changeRequest => {
    const discussionId = unambiguousDiscussionIdByChangeRequestId.get(String(changeRequest.id));
    return discussionId ? { ...changeRequest, suggestion_id: discussionId } : changeRequest;
  });
  const normalizedDiscussions = discussions.map(discussion => {
    const changeRequest =
      typeof discussion.id === 'string' ? candidateByDiscussionId.get(discussion.id) : undefined;
    if (
      !changeRequest ||
      unambiguousDiscussionIdByChangeRequestId.get(changeRequest.id) !== discussion.id
    ) {
      return discussion;
    }

    const sequenceNumber = changeRequest.branch_sequence_number as number;
    const crId = `CR-${sequenceNumber}`;
    return {
      ...discussion,
      crId,
      displayCrId: crId,
      changeRequestEntityId: changeRequest.id,
      branchSequenceNumber: sequenceNumber,
      branchScopedCrNumber: sequenceNumber,
    };
  });

  return { discussions: normalizedDiscussions, changeRequests: normalizedChangeRequests };
}
