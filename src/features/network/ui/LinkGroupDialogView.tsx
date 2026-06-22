'use client';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Link } from 'lucide-react';
import {
  ActionSubmissionOverlay,
  type ActionSubmissionController,
} from '@/features/shared/ui/action-submission';
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
import {
  getSelectedMembershipDirection,
  hasIncompleteMembershipRule,
} from '../logic/groupConnectionComposer';
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
  actionSubmission: ActionSubmissionController;
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
  actionSubmission,
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
  const submissionActive = actionSubmission.isActive;
  const selectedGroupName =
    availableGroups.find((group: any) => group.id === value.selectedGroupId)?.name ??
    value.selectedGroupId;
  const relationshipLabel = isEditMode
    ? t('common.network.editRelationship')
    : t('common.network.linkGroupTitle');

  return (
    <Dialog open={open} onOpenChange={submissionActive ? undefined : setOpen}>
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
      <ScrollableDialogContent
        showCloseButton={!submissionActive}
        className={
          submissionActive
            ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
            : 'h-[min(90dvh,46rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[760px]'
        }
      >
        {!submissionActive ? (
          <>
            <DialogHeader className="px-6 pt-6 pr-12 pb-4">
              <DialogTitle>{relationshipLabel}</DialogTitle>
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

                    return hasIncompleteMembershipRule({
                      membershipDirection: value.membershipDirection,
                      membershipRule: value.membershipRule,
                    });
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
          </>
        ) : null}
        <ActionSubmissionOverlay
          kind="link"
          status={actionSubmission.status}
          steps={actionSubmission.progressSteps}
          error={actionSubmission.error}
          preview={{
            entityLabel: relationshipLabel,
            title: selectedGroupName || t('common.network.linkGroupTitle'),
            description: t('common.network.linkPreviewDescription', {
              groupName: currentGroupName || t('common.unspecified'),
              otherGroupName: selectedGroupName || t('common.unspecified'),
              rights: value.relationshipType,
            }),
            path: [currentGroupName || t('common.unspecified'), selectedGroupName].filter(Boolean),
            badges: [value.relationshipType],
          }}
          target={{
            label: t('common.done', 'Fertig'),
            onClick: () => {
              actionSubmission.reset();
              setOpen(false);
            },
          }}
          onBack={actionSubmission.reset}
          onRetry={() => void actionSubmission.retry()}
        />
      </ScrollableDialogContent>
    </Dialog>
  );
}
