import { useEffect, useMemo } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { StatusBadge } from '@/features/shared/ui/status';
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
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
import { GroupConflictDialog } from './GroupConflictPanel';
import type { GroupConflictResponse } from '../logic/groupConflict';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface InviteMembersDialogProps<TRole extends ParticipationRoleLike> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: string[];
  onSelectedUsersChange: (userIds: string[]) => void;
  excludeUserIds?: string[];
  excludeUserId?: string;
  roles: TRole[];
  selectedRoleIds: string[];
  onSelectedRoleIdsChange: (roleIds: string[]) => void;
  onInvite: () => void;
  isInviting: boolean;
  disabled?: boolean;
  disabledReason?: string;
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  peopleSectionDescription?: string;
  userSearchLabel?: string;
  userSearchPlaceholder?: string;
  roleSectionTitle?: string;
  roleSectionDescription?: string;
  defaultRoleFallbackName?: string;
  defaultInviteLabel?: string;
  emptyRolesLabel?: string;
  cancelLabel?: string;
  inviteLabel?: string;
  submitDisabled?: boolean;
  submitDisabledReason?: string;
  submitConflictResponse?: GroupConflictResponse | null;
  submitConflictLoading?: boolean;
}

export function InviteMembersDialog<TRole extends ParticipationRoleLike>({
  isOpen,
  onOpenChange,
  selectedUsers,
  onSelectedUsersChange,
  excludeUserIds = [],
  excludeUserId,
  roles,
  selectedRoleIds,
  onSelectedRoleIdsChange,
  onInvite,
  isInviting,
  disabled,
  disabledReason,
  triggerLabel = translateText('generated.inline.0087_invite_member_b9c0e6a1'),
  dialogTitle = translateText('generated.inline.0088_invite_members_4ee56217'),
  dialogDescription = translateText(
    'generated.inline.0089_search_and_select_users_to_invite_then_choose_dd41962a'
  ),
  peopleSectionDescription = translateText(
    'generated.inline.0090_reuse_the_full_user_search_to_pick_one_or_mor_0bc3e1f3'
  ),
  userSearchLabel = translateText('generated.inline.0091_search_users_1bd6226d'),
  userSearchPlaceholder = translateText(
    'generated.inline.0044_search_users_by_name_or_handle_00f8d0a6'
  ),
  roleSectionTitle = translateText('generated.inline.0092_role_type_5a4faa8d'),
  roleSectionDescription = translateText(
    'generated.inline.0093_tick_one_or_more_roles_for_invited_people_the_1ac4d4b3'
  ),
  defaultRoleFallbackName = 'Member',
  defaultInviteLabel = translateText('generated.inline.0094_default_invite_85f158c0'),
  emptyRolesLabel = translateText(
    'generated.inline.0095_create_a_role_first_before_inviting_members_9626758c'
  ),
  cancelLabel = 'Cancel',
  inviteLabel = 'Invite',
  submitDisabled = false,
  submitDisabledReason,
  submitConflictResponse,
  submitConflictLoading = false,
}: InviteMembersDialogProps<TRole>) {
  const defaultRoleId = useMemo(
    () =>
      roles.find(role => role.default_invite_role)?.id ??
      roles.find(role => role.name === defaultRoleFallbackName)?.id ??
      roles[0]?.id ??
      null,
    [defaultRoleFallbackName, roles]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (selectedRoleIds.length === 0 && defaultRoleId) {
      onSelectedRoleIdsChange([defaultRoleId]);
    }
  }, [defaultRoleId, isOpen, onSelectedRoleIdsChange, selectedRoleIds]);

  const toggleRoleSelection = (roleId: string, checked: boolean) => {
    if (checked) {
      onSelectedRoleIdsChange(
        selectedRoleIds.includes(roleId) ? selectedRoleIds : [...selectedRoleIds, roleId]
      );
      return;
    }

    onSelectedRoleIdsChange(selectedRoleIds.filter(currentRoleId => currentRoleId !== roleId));
  };

  const inviteDisabled =
    selectedUsers.length === 0 ||
    isInviting ||
    selectedRoleIds.length === 0 ||
    submitDisabled ||
    submitConflictLoading;

  const triggerButton = (
    <Button disabled={disabled}>
      <UserPlus className="mr-2 h-4 w-4" />
      {triggerLabel}
    </Button>
  );

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
      <ScrollableDialogContent className="sm:max-w-[760px]">
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
                  {roles.map(role => (
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
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {translateText('generated.inline.0113_inviting_dc7a6e8b')}
                </>
              ) : submitConflictLoading ? (
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
      </ScrollableDialogContent>
    </Dialog>
  );
}
