export interface MergeVoteBranchTitleSource {
  id: string;
  title?: string | null;
  created_at?: number | string | null;
}

function getBranchCreatedAt(branch: MergeVoteBranchTitleSource) {
  const value = branch.created_at;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getOrderedMergeVoteBranches<T extends MergeVoteBranchTitleSource>(
  branches: readonly T[]
) {
  return [...branches].sort((left, right) => {
    const byCreatedAt = getBranchCreatedAt(left) - getBranchCreatedAt(right);
    return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
  });
}

export function getMergeVoteBranchLabel(branch: MergeVoteBranchTitleSource, index: number) {
  const title = branch.title?.trim();
  return title || `Branch ${index + 1}`;
}

export function buildMergeVoteTitle(
  amendmentTitle: string | null | undefined,
  branches: readonly MergeVoteBranchTitleSource[]
) {
  const title = amendmentTitle?.trim() || 'Amendment';
  const branchLabels = getOrderedMergeVoteBranches(branches).map(getMergeVoteBranchLabel);
  return branchLabels.length > 0 ? `${title}: ${branchLabels.join(' vs ')}` : title;
}
