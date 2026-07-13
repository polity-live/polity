import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useNetworkPage } from '@/features/network/hooks/useNetworkPage';
import { ManageNetworkTab } from '@/features/network/ui/ManageNetworkTab';
import { usePermissions } from '@/zero/rbac/usePermissions';

export const Route = createFileRoute('/_authed/group/$id/relationships')({
  component: GroupRelationshipsPage,
});

function GroupRelationshipsPage() {
  const { id: groupId } = Route.useParams();
  const np = useNetworkPage(groupId);
  const { canManage, canView, isLoading, isMember } = usePermissions({ groupId });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isMember() || !canView('groupRelationships')) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-4">
      <ManageNetworkTab
        virtualize
        canManageRelationships={canManage('groupRelationships')}
        groupId={groupId}
        groupName={np.groupName}
        currentGroupType={np.group?.group_type}
        currentGroupSiblingMembershipMode={np.group?.sibling_membership_mode}
        searchQuery={np.searchQuery}
        onSearchQueryChange={np.setSearchQuery}
        directionFilter={np.directionFilter}
        onDirectionFilterChange={np.setDirectionFilter}
        manageRightFilter={np.manageRightFilter}
        onToggleRightFilter={np.toggleManageRightFilter}
        incomingRequests={np.filteredIncoming}
        outgoingRequests={np.filteredOutgoing}
        filteredRelationships={np.filteredRelationships}
        allRelationships={np.allRelationships}
        onAcceptRequest={np.handleAcceptRequest}
        onRejectRequest={np.handleRejectRequest}
        onDeleteRelationship={np.handleDeleteRelationship}
      />
    </div>
  );
}
