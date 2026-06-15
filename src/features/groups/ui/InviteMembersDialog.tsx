import { useEffect, useMemo } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { UserPlus } from 'lucide-react';
import { useActionSubmission } from '@/features/shared/ui/action-submission';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
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
import { InviteMembersDialogView } from './InviteMembersDialogView';
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
  const actionSubmission = useActionSubmission('invite');
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

  const handleInvite = () => {
    void actionSubmission
      .runActionWithSubmission(async () => onInvite(), {
        onSuccess: () => {
          actionSubmission.reset();
          onOpenChange(false);
        },
      })
      .catch(() => undefined);
  };

  return (
    <InviteMembersDialogView
      actionSubmission={actionSubmission}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      selectedUsers={selectedUsers}
      onSelectedUsersChange={onSelectedUsersChange}
      excludeUserIds={excludeUserIds}
      excludeUserId={excludeUserId}
      roles={roles}
      selectedRoleIds={selectedRoleIds}
      onSelectedRoleIdsChange={onSelectedRoleIdsChange}
      onInvite={handleInvite}
      isInviting={isInviting}
      disabled={disabled}
      disabledReason={disabledReason}
      triggerLabel={triggerLabel}
      dialogTitle={dialogTitle}
      dialogDescription={dialogDescription}
      peopleSectionDescription={peopleSectionDescription}
      userSearchLabel={userSearchLabel}
      userSearchPlaceholder={userSearchPlaceholder}
      roleSectionTitle={roleSectionTitle}
      roleSectionDescription={roleSectionDescription}
      defaultRoleFallbackName={defaultRoleFallbackName}
      defaultInviteLabel={defaultInviteLabel}
      emptyRolesLabel={emptyRolesLabel}
      cancelLabel={cancelLabel}
      inviteLabel={inviteLabel}
      submitDisabled={submitDisabled}
      submitDisabledReason={submitDisabledReason}
      submitConflictResponse={submitConflictResponse}
      submitConflictLoading={submitConflictLoading}
      defaultRoleId={defaultRoleId}
      toggleRoleSelection={toggleRoleSelection}
      inviteDisabled={inviteDisabled}
      triggerButton={triggerButton}
    />
  );
}
