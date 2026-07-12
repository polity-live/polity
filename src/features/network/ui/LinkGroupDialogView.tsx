'use client';
import {
  ManagementDialogBody,
  ManagementDialogContent,
  ManagementDialogFooter,
  ManagementDialogHeader,
} from '@/features/shared/ui/dialog';
import { Link } from 'lucide-react';
import {
  ActionSubmissionOverlay,
  type ActionSubmissionController,
} from '@/features/shared/ui/action-submission';
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  hasConfiguredGroupConnection,
  getSelectedMembershipDirection,
  hasIncompleteMembershipRule,
} from '../logic/groupConnectionComposer';
import { GroupConnectionComposer } from './GroupConnectionComposer';

interface LinkGroupSubmitState {
  disabled: boolean;
  label: string;
  reason?: string;
  isChecking: boolean;
}

function getLinkGroupSubmitState({
  t,
  value,
  isEditMode,
  isSubmitting,
  groupStateLoading,
  pairConnectionsLoading,
  pairConnectionRequestsLoading,
  preflight,
}: {
  t: (key: string, paramsOrFallback?: unknown) => string;
  value: any;
  isEditMode: boolean;
  isSubmitting: boolean;
  groupStateLoading: boolean;
  pairConnectionsLoading: boolean;
  pairConnectionRequestsLoading: boolean;
  preflight: { isLoading: boolean; blocking: boolean };
}): LinkGroupSubmitState {
  const defaultLabel = isEditMode ? t('common.network.saveChanges') : t('common.actions.create');
  const checkingLabel = t('common.network.linkGroupCheckingConnection');

  if (isSubmitting) {
    return {
      disabled: true,
      label: t('common.network.saving'),
      reason: t('common.network.linkGroupSavingStatus'),
      isChecking: false,
    };
  }

  if (!value.selectedGroupId) {
    return {
      disabled: true,
      label: defaultLabel,
      reason: t('common.network.linkGroupSelectTarget'),
      isChecking: false,
    };
  }

  if (groupStateLoading) {
    return {
      disabled: true,
      label: checkingLabel,
      reason: t('common.network.linkGroupLoadingGroups'),
      isChecking: true,
    };
  }

  if (pairConnectionsLoading || pairConnectionRequestsLoading) {
    return {
      disabled: true,
      label: checkingLabel,
      reason: t('common.network.linkGroupCheckingExistingLinks'),
      isChecking: true,
    };
  }

  if (preflight.isLoading) {
    return {
      disabled: true,
      label: checkingLabel,
      reason: t('common.network.linkGroupCheckingConflicts'),
      isChecking: true,
    };
  }

  if (preflight.blocking) {
    return {
      disabled: true,
      label: defaultLabel,
      reason: t('common.network.linkGroupConflictBlocked'),
      isChecking: false,
    };
  }

  const selectedMembershipDirection = getSelectedMembershipDirection({
    membershipDirection: value.membershipDirection,
    membershipRule: value.membershipRule,
  });
  const incompleteMembershipRule = selectedMembershipDirection
    ? hasIncompleteMembershipRule({
        membershipDirection: value.membershipDirection,
        membershipRule: value.membershipRule,
      })
    : false;

  if (incompleteMembershipRule) {
    return {
      disabled: true,
      label: defaultLabel,
      reason: t('common.network.linkGroupSelectRole'),
      isChecking: false,
    };
  }

  if (
    !hasConfiguredGroupConnection({
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
    })
  ) {
    return {
      disabled: true,
      label: defaultLabel,
      reason: t('common.network.linkGroupSelectRightsOrMembership'),
      isChecking: false,
    };
  }

  return {
    disabled: false,
    label: defaultLabel,
    isChecking: false,
  };
}

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
  const submitState = getLinkGroupSubmitState({
    t,
    value,
    isEditMode,
    isSubmitting,
    groupStateLoading,
    pairConnectionsLoading,
    pairConnectionRequestsLoading,
    preflight,
  });

  return (
    <Dialog open={open} onOpenChange={submissionActive ? undefined : setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button>
            <Link className="mr-2 h-4 w-4" />
            {t('components.actionBar.linkGroup')}
          </Button>
        )}
      </DialogTrigger>
      <ManagementDialogContent
        showCloseButton={!submissionActive}
        className={
          submissionActive
            ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
            : 'h-[min(90dvh,46rem)] sm:max-w-[760px]'
        }
      >
        {!submissionActive ? (
          <>
            <ManagementDialogHeader>
              <DialogTitle>{relationshipLabel}</DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? t('common.network.editRelationshipDescription', {
                      groupName: currentGroupName || t('common.unspecified'),
                    })
                  : t('common.network.linkGroupDescription', { groupName: currentGroupName })}
              </DialogDescription>
            </ManagementDialogHeader>

            <ManagementDialogBody className="grid content-start gap-4">
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
            </ManagementDialogBody>

            <ManagementDialogFooter>
              {submitState.reason ? (
                <div className="text-muted-foreground mr-auto min-w-0 text-sm" aria-live="polite">
                  {submitState.reason}
                </div>
              ) : null}
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitState.disabled}
                loading={submitState.isChecking}
                loadingLabel={submitState.label}
              >
                {submitState.label}
              </Button>
            </ManagementDialogFooter>
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
      </ManagementDialogContent>
    </Dialog>
  );
}
