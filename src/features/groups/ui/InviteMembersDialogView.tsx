import { Button } from '@/features/shared/ui/ui/button';
import { StatusBadge } from '@/features/shared/ui/status';
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
import { ChoiceField } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout';
import { UserSearchInput } from '@/features/create/ui/inputs/UserSearchInput';
import { Loader2, UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { RoleTag } from './RoleTag';
import { GroupConflictDialog } from './GroupConflictPanel';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface InviteMembersDialogViewProps {
  actionSubmission: ActionSubmissionController;
  isOpen: any;
  onOpenChange: any;
  selectedUsers: any;
  onSelectedUsersChange: any;
  excludeUserIds: any;
  excludeUserId: any;
  roles: any;
  selectedRoleIds: any;
  onSelectedRoleIdsChange: any;
  onInvite: any;
  isInviting: any;
  disabled: any;
  disabledReason: any;
  triggerLabel: any;
  dialogTitle: any;
  dialogDescription: any;
  peopleSectionDescription: any;
  userSearchLabel: any;
  userSearchPlaceholder: any;
  roleSectionTitle: any;
  roleSectionDescription: any;
  defaultRoleFallbackName: any;
  defaultInviteLabel: any;
  emptyRolesLabel: any;
  cancelLabel: any;
  inviteLabel: any;
  submitDisabled: any;
  submitDisabledReason: any;
  submitConflictResponse: any;
  submitConflictLoading: any;
  defaultRoleId: any;
  toggleRoleSelection: any;
  inviteDisabled: any;
  triggerButton: any;
}

export function InviteMembersDialogView({
  actionSubmission,
  isOpen,
  onOpenChange,
  selectedUsers,
  onSelectedUsersChange,
  excludeUserIds,
  excludeUserId,
  roles,
  selectedRoleIds,
  onInvite,
  isInviting,
  disabled,
  disabledReason,
  dialogTitle,
  dialogDescription,
  peopleSectionDescription,
  userSearchLabel,
  userSearchPlaceholder,
  roleSectionTitle,
  roleSectionDescription,
  defaultInviteLabel,
  emptyRolesLabel,
  cancelLabel,
  inviteLabel,
  submitDisabledReason,
  submitConflictResponse,
  submitConflictLoading,
  toggleRoleSelection,
  inviteDisabled,
  triggerButton,
}: InviteMembersDialogViewProps) {
  const submissionActive = actionSubmission.isActive;
  const selectedRoleNames = roles
    .filter((role: any) => selectedRoleIds.includes(role.id))
    .map((role: any) => role.name || 'Role');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {disabled && disabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          triggerButton
        )}
      </DialogTrigger>
      <ScrollableDialogContent
        management={!submissionActive}
        showCloseButton={!submissionActive}
        className={
          submissionActive
            ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
            : 'sm:max-w-[760px]'
        }
      >
        {!submissionActive ? (
          <>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <Panel>
                <PanelHeader>
                  <PanelTitle>{translateText('generated.inline.0692_people_b37554f6')}</PanelTitle>
                  <p className="text-muted-foreground text-sm">{peopleSectionDescription}</p>
                </PanelHeader>
                <PanelContent>
                  <UserSearchInput
                    value={selectedUsers}
                    onChange={onSelectedUsersChange}
                    label={userSearchLabel}
                    placeholder={userSearchPlaceholder}
                    excludeUserId={excludeUserId}
                    excludeUserIds={excludeUserIds}
                    multi
                    disablePortal
                    showAllResults
                  />
                </PanelContent>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>{roleSectionTitle}</PanelTitle>
                  <p className="text-muted-foreground text-sm">{roleSectionDescription}</p>
                </PanelHeader>
                <PanelContent>
                  {roles.length > 0 ? (
                    <div className="space-y-2">
                      {roles.map((role: any) => (
                        <ChoiceField
                          key={role.id}
                          id={`invite-role-${role.id}`}
                          checked={selectedRoleIds.includes(role.id)}
                          onCheckedChange={checked => toggleRoleSelection(role.id, checked)}
                          label={
                            <span className="flex flex-wrap items-center gap-2">
                              <RoleTag
                                roleId={role.id}
                                roleName={role.name || 'Role'}
                                className="text-xs"
                              />
                              {role.default_invite_role ? (
                                <StatusBadge status="active">{defaultInviteLabel}</StatusBadge>
                              ) : null}
                            </span>
                          }
                          description={
                            role.description ||
                            translateText('generated.inline.0101_no_role_summary_yet_84299aed')
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm">
                      <UserPlus className="h-4 w-4" />
                      {emptyRolesLabel}
                    </div>
                  )}
                </PanelContent>
              </Panel>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
                {cancelLabel}
              </Button>
              <div className="flex items-center gap-2">
                {submitConflictResponse?.conflicts.length ? (
                  <GroupConflictDialog
                    response={submitConflictResponse}
                    triggerLabel={translateText('generated.inline.0693_warum_194dad5c')}
                    triggerVariant="ghost"
                    title={translateText(
                      'generated.inline.0694_warum_ist_diese_einladung_blockiert_e17c2345'
                    )}
                  />
                ) : null}
                <Button onClick={onInvite} disabled={inviteDisabled} title={submitDisabledReason}>
                  {submitConflictLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {translateText('generated.inline.0695_checking_494d0f68')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {inviteLabel} {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
        <ActionSubmissionOverlay
          kind="invite"
          status={actionSubmission.status}
          steps={actionSubmission.progressSteps}
          error={actionSubmission.error}
          preview={{
            entityLabel: inviteLabel,
            title: translateText('features.groups.memberships.selectedUsersTitle', {
              count: selectedUsers.length,
            }),
            description: dialogTitle,
            badges: selectedRoleNames.length ? selectedRoleNames : [roleSectionTitle],
          }}
          target={{
            label: translateText('common.actions.done'),
            onClick: actionSubmission.reset,
          }}
          onBack={actionSubmission.reset}
          onRetry={() => void actionSubmission.retry()}
        />
      </ScrollableDialogContent>
    </Dialog>
  );
}
