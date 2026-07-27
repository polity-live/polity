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
  return (
    title ||
    translate('features.amendments.branches.numbered', {
      number: index + 1,
    })
  );
}

export function buildMergeVoteTitle(
  amendmentTitle: string | null | undefined,
  branches: readonly MergeVoteBranchTitleSource[]
) {
  const title = amendmentTitle?.trim() || translate('common.entities.amendment');
  const branchLabels = getOrderedMergeVoteBranches(branches).map(getMergeVoteBranchLabel);
  return branchLabels.length > 0
    ? translate('features.amendments.branches.mergeVoteTitle', {
        title,
        branches: branchLabels.join(translate('features.amendments.branches.mergeVoteSeparator')),
      })
    : title;
}
import { translate } from '@/features/shared/hooks/use-translation';
