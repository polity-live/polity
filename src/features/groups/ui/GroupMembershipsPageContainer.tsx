import { usePermissions } from '@/zero/rbac/usePermissions';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/feedback';
import type { MembershipTab } from '@/features/groups/types/group.types';
import { GroupMembershipsContentContainer } from '@/features/groups/ui/GroupMembershipsContentContainer';

interface GroupMembershipsPageContainerProps {
  groupId: string;
  defaultTab?: MembershipTab;
}

export function GroupMembershipsPageContainer({
  groupId,
  defaultTab,
}: GroupMembershipsPageContainerProps) {
  const controller = useGroupMembershipsPageController({ groupId, defaultTab });

  if (controller.isLoading) {
    return <GroupMembershipsLoadingView />;
  }

  if (!controller.canAccess) {
    return <GroupMembershipsAccessDeniedView />;
  }

  return (
    <GroupMembershipsContentContainer
      groupId={controller.groupId}
      canManageMembers={controller.canManageMembers}
      canManageAssignments={controller.canManageAssignments}
      defaultTab={controller.defaultTab}
    />
  );
}

export function useGroupMembershipsPageController({
  groupId,
  defaultTab,
}: GroupMembershipsPageContainerProps) {
  const { can, isMember, isLoading } = usePermissions({ groupId });
  const canManageMembers = can('manage', 'groupMemberships');
  const canManageAssignments =
    can('manage', 'events') || can('manage', 'elections') || can('manage', 'agendaItems');

  return {
    groupId,
    defaultTab,
    isLoading,
    canAccess: isMember() && (canManageMembers || canManageAssignments),
    canManageMembers,
    canManageAssignments,
  };
}

function GroupMembershipsLoadingView() {
  return <GlobalLoadingAnimation connectionStatus="connecting" />;
}

function GroupMembershipsAccessDeniedView() {
  return <AccessDenied />;
}
