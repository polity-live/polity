import { useAuth } from '@/providers/auth-provider';
import type { AmendmentTimelineCardProps } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { normalizeEditingMode } from '@/zero/rbac/workflow-constants';
import {
  getOrderedBranches,
  mapAmendmentBranchStatusChips,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { type SearchAmendment } from '../types/search.types';

interface UseAmendmentSearchCardControllerOptions {
  amendment: SearchAmendment;
}

interface AmendmentSearchCardViewModel {
  amendment: AmendmentTimelineCardProps['amendment'];
}

function normalizeCollaborationStatus(
  status: string | null | undefined
): 'admin' | 'member' | 'invited' | 'requested' | undefined {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'admin') return 'admin';
  if (
    normalizedStatus === 'active' ||
    normalizedStatus === 'collaborator' ||
    normalizedStatus === 'member'
  ) {
    return 'member';
  }
  if (normalizedStatus === 'invited') return 'invited';
  if (normalizedStatus === 'requested') return 'requested';

  return undefined;
}

export function useAmendmentSearchCardController({
  amendment,
}: UseAmendmentSearchCardControllerOptions): AmendmentSearchCardViewModel {
  const { user } = useAuth();
  const supporters = (amendment.upvotes || 0) - (amendment.downvotes || 0);
  const collaboratorsCount = amendment.collaborators?.length || 0;
  const currentUserCollaboration = amendment.collaborators?.find(
    collab => collab.user?.id === user?.id
  );
  const collaborationStatus = normalizeCollaborationStatus(currentUserCollaboration?.status);
  const firstBranch = getOrderedBranches(amendment.current_process_run?.branches ?? [])[0] ?? null;
  const branchStatuses = mapAmendmentBranchStatusChips(
    amendment.current_process_run?.branches ?? []
  );

  return {
    amendment: {
      id: String(amendment.id),
      title: amendment.title ?? '',
      subtitle: amendment.group?.name ?? undefined,
      description: amendment.reason ?? undefined,
      status: normalizeEditingMode(firstBranch?.editing_mode),
      supportCount: supporters,
      groupName: amendment.group?.name ?? undefined,
      groupId: amendment.group?.id,
      collaboratorCount: collaboratorsCount,
      changeRequestCount: amendment.change_requests?.length,
      hashtags: extractHashtags(amendment.amendment_hashtags),
      collaborationStatus,
      branchStatuses,
    },
  };
}
