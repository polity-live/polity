'use client';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Link } from 'lucide-react';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { getSelectedMembershipDirection } from '../logic/groupConnectionComposer';
import { GroupConnectionComposer } from './GroupConnectionComposer';
export interface LinkGroupDialogViewProps {
  currentGroupId: any;
  currentGroupName: any;
  initialTargetGroupId: any;
  initialRelationshipType: any;
  initialRights: any;
  trigger: any;
  allRelationships: any;
  t: any;
  proposeGroupConnectionChange: any;
  open: any;
  setOpen: any;
  initializedForOpenRef: any;
  lastHydratedStateRef: any;
  isEditMode: any;
  availableGroupsRaw: any;
  groupStateLoading: any;
  availableGroups: any;
  composer: any;
  value: any;
  setValue: any;
  activeTab: any;
  setActiveTab: any;
  resetComposer: any;
  isSubmitting: any;
  setIsSubmitting: any;
  selectedGroupRoles: any;
  currentGroupRoles: any;
  pairConnections: any;
  pairConnectionsLoading: any;
  pairConnectionRequests: any;
  pairConnectionRequestsLoading: any;
  relevantConnections: any;
  pairRelationships: any;
  pairRequestRelationships: any;
  currentPrimaryConnection: any;
  currentPrimaryRequest: any;
  relevantRelationships: any;
  currentSelectionRelationships: any;
  existingRightStatuses: any;
  existingRightIdsByKey: any;
  existingGrantIdsByKeyAndHolder: any;
  selectableRolesByDirection: any;
  preflight: any;
  handleSubmit: any;
}

export function LinkGroupDialogView({
  currentGroupId,
  currentGroupName,
  trigger,
  t,
  open,
  setOpen,
  isEditMode,
  groupStateLoading,
  availableGroups,
  value,
  setValue,
  activeTab,
  setActiveTab,
  isSubmitting,
  pairConnectionsLoading,
  pairConnectionRequestsLoading,
  existingRightStatuses,
  selectableRolesByDirection,
  preflight,
  handleSubmit,
}: LinkGroupDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline">
            <Link className="mr-2 h-4 w-4" />
            {t('components.actionBar.linkGroup')}
          </Button>
        )}
      </DialogTrigger>
      <ScrollableDialogContent className="h-[min(90dvh,46rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="px-6 pt-6 pr-12 pb-4">
          <DialogTitle>
            {isEditMode ? t('common.network.editRelationship') : t('common.network.linkGroupTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('common.network.editRelationshipDescription', {
                  groupName: currentGroupName || t('common.unspecified'),
                })
              : t('common.network.linkGroupDescription', { groupName: currentGroupName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto px-6 py-4">
          <GroupConnectionComposer
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            value={value}
            onValueChange={setValue}
            currentGroupId={currentGroupId}
            currentGroupName={currentGroupName}
            availableGroups={availableGroups}
            selectableRolesByDirection={selectableRolesByDirection}
            existingRightStatuses={existingRightStatuses}
            preflight={preflight}
            disableGroupSelection={isEditMode}
            groupSelectorLabel={t('common.network.selectGroup')}
          />
        </div>

        <DialogFooter separator className="px-6 py-4">
          {preflight.isLoading ? (
            <div className="text-muted-foreground mr-auto text-sm">
              {translateText('generated.inline.0798_pr_fe_konflikte_f9c644cd')}
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !value.selectedGroupId ||
              isSubmitting ||
              groupStateLoading ||
              pairConnectionsLoading ||
              pairConnectionRequestsLoading ||
              preflight.isLoading ||
              preflight.blocking ||
              (() => {
                const selectedMembershipDirection = getSelectedMembershipDirection({
                  membershipDirection: value.membershipDirection,
                  membershipRule: value.membershipRule,
                });

                if (!selectedMembershipDirection) {
                  return false;
                }

                const selectedMembershipRule = value.membershipRule;
                return (
                  (selectedMembershipRule.membershipMode === 'role_members' &&
                    !selectedMembershipRule.roleId) ||
                  (selectedMembershipRule.membershipMode === 'selected_source_groups' &&
                    selectedMembershipRule.sourceGroupIds.length === 0)
                );
              })()
            }
          >
            {isSubmitting
              ? t('common.network.saving')
              : isEditMode
                ? t('common.network.saveChanges')
                : t('common.actions.create')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
