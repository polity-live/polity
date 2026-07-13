import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useNetworkPage } from '@/features/network/hooks/useNetworkPage';
import { NetworkTabs } from '@/features/network/ui/NetworkTabs';
import { CurrentNetworkTab } from '@/features/network/ui/CurrentNetworkTab';
import { ManageNetworkTab } from '@/features/network/ui/ManageNetworkTab';
import { ManageWorkflowsTab } from '@/features/network/ui/ManageWorkflowsTab';
import { NetworkViewportPanel } from '@/features/network/ui/NetworkViewportPanel';
import { usePermissions } from '@/zero/rbac';

const networkSearchSchema = z.object({
  tab: z.enum(['current-network', 'manage-network', 'manage-workflows']).optional(),
});

export const Route = createFileRoute('/_authed/group/$id/network')({
  validateSearch: networkSearchSchema,
  component: GroupNetworkPage,
});

function GroupNetworkPage() {
  const { id: groupId } = Route.useParams();
  const { tab } = Route.useSearch();
  const np = useNetworkPage(groupId, tab);
  const { canManage, canView, isMember } = usePermissions({ groupId });
  const canAccessManageNetwork = isMember() && canView('groupRelationships');
  const canManageNetwork = isMember() && canManage('groupRelationships');
  const activeTab = canAccessManageNetwork ? np.activeTab : 'current-network';

  return (
    <div className="space-y-4">
      <NetworkTabs
        activeTab={activeTab}
        onTabChange={tab => np.setActiveTab(canAccessManageNetwork ? tab : 'current-network')}
        showManageNetworkTab={canAccessManageNetwork}
        showManageWorkflowsTab={canAccessManageNetwork}
        currentNetworkContent={
          <NetworkViewportPanel className="flex min-h-0 flex-col">
            <CurrentNetworkTab groupId={groupId} />
          </NetworkViewportPanel>
        }
        manageNetworkContent={
          canAccessManageNetwork ? (
            <ManageNetworkTab
              virtualize
              canManageRelationships={canManageNetwork}
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
          ) : null
        }
        manageWorkflowsContent={
          canAccessManageNetwork ? (
            <ManageWorkflowsTab
              canManageWorkflows={canManageNetwork}
              groupId={groupId}
              groupName={np.groupName}
              allRelationships={np.allRelationships}
              incomingRequests={np.workflowIncomingRequests}
              acceptedPendingRequests={np.workflowAcceptedPendingRequests}
              outgoingRequests={np.workflowOutgoingRequests}
              activeRelevantWorkflows={np.workflowActiveRelevant}
              isWorkflowEditorOpen={np.isWorkflowEditorOpen}
              editingWorkflow={np.editingWorkflow}
              workflowDraftStartGroupId={np.workflowDraftStartGroupId}
              onWorkflowDraftStartGroupIdChange={np.setWorkflowDraftStartGroupId}
              workflowDraftName={np.workflowDraftName}
              onWorkflowDraftNameChange={np.setWorkflowDraftName}
              workflowDraftDescription={np.workflowDraftDescription}
              onWorkflowDraftDescriptionChange={np.setWorkflowDraftDescription}
              workflowDraftIsDefaultEntry={np.workflowDraftIsDefaultEntry}
              onWorkflowDraftIsDefaultEntryChange={np.setWorkflowDraftIsDefaultEntry}
              workflowDraftSteps={np.workflowDraftSteps}
              availableGroups={np.availableGroups}
              availableWorkflows={np.availableWorkflows}
              onOpenNewWorkflow={np.openNewWorkflow}
              onOpenEditWorkflow={np.openEditWorkflow}
              onCloseWorkflowEditor={np.closeWorkflowEditor}
              onAddWorkflowStep={np.addWorkflowStep}
              onUpdateWorkflowStep={np.updateWorkflowStepDraft}
              onRemoveWorkflowStep={np.removeWorkflowStep}
              onMoveWorkflowStep={np.moveWorkflowStep}
              onSaveWorkflow={np.handleSaveWorkflow}
              onDeleteWorkflow={np.handleDeleteWorkflow}
              onApproveWorkflowApproval={np.handleApproveWorkflowApproval}
              onRejectWorkflowApproval={np.handleRejectWorkflowApproval}
            />
          ) : null
        }
      />
    </div>
  );
}
