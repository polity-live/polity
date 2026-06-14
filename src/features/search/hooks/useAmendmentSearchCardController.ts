import { useAuth } from '@/providers/auth-provider';
import type { AmendmentTimelineCardProps } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { normalizeEditingMode } from '@/zero/rbac/workflow-constants';
import { type SearchAmendment } from '../types/search.types';

interface UseAmendmentSearchCardControllerOptions {
  amendment: SearchAmendment;
}

interface AmendmentSearchCardViewModel {
  amendment: AmendmentTimelineCardProps['amendment'];
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
  const collaborationRole = currentUserCollaboration?.user ? 'collaborator' : undefined;

  const normalizedCollaborationStatus = collaborationRole
    ? collaborationRole.toLowerCase()
    : undefined;
  const collaborationStatus: 'admin' | 'member' | 'invited' | 'requested' | undefined =
    normalizedCollaborationStatus === 'admin'
      ? 'admin'
      : normalizedCollaborationStatus === 'collaborator' ||
          normalizedCollaborationStatus === 'member'
        ? 'member'
        : normalizedCollaborationStatus === 'invited'
          ? 'invited'
          : normalizedCollaborationStatus === 'requested'
            ? 'requested'
            : undefined;

  return {
    amendment: {
      id: String(amendment.id),
      title: amendment.title ?? '',
      subtitle: amendment.group?.name ?? undefined,
      description: amendment.reason ?? undefined,
      status: normalizeEditingMode(amendment.editing_mode),
      supportCount: supporters,
      groupName: amendment.group?.name ?? undefined,
      groupId: amendment.group?.id,
      collaboratorCount: collaboratorsCount,
      changeRequestCount: amendment.change_requests?.length,
      hashtags: extractHashtags(amendment.amendment_hashtags),
      collaborationStatus,
    },
  };
}
