import { useEffect, useMemo } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Label } from '@/features/shared/ui/ui/label';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { UserSearchInput } from '@/features/create/ui/inputs/UserSearchInput';
import { Loader2, UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';

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
  triggerLabel = 'Invite Member',
  dialogTitle = 'Invite Members',
  dialogDescription = 'Search and select users to invite, then choose which roles they should start with.',
  peopleSectionDescription = 'Reuse the full user search to pick one or more invitees.',
  userSearchLabel = 'Search users',
  userSearchPlaceholder = 'Search users by name or handle...',
  roleSectionTitle = 'Role type',
  roleSectionDescription = 'Tick one or more roles for invited people. The default invite role is preselected.',
  defaultRoleFallbackName = 'Member',
  defaultInviteLabel = 'Default invite',
  emptyRolesLabel = 'Create a role first before inviting members.',
  cancelLabel = 'Cancel',
  inviteLabel = 'Invite',
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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="border-border/70 bg-muted/20 rounded-2xl border p-4">
            <div className="mb-3 space-y-1">
              <h3 className="text-sm font-semibold">People</h3>
              <p className="text-muted-foreground text-sm">{peopleSectionDescription}</p>
            </div>
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
          </div>

          <div className="border-border/70 bg-muted/20 rounded-2xl border p-4">
            <div className="mb-3 space-y-1">
              <h3 className="text-sm font-semibold">{roleSectionTitle}</h3>
              <p className="text-muted-foreground text-sm">{roleSectionDescription}</p>
            </div>
            {roles.length > 0 ? (
              <div className="space-y-2">
                {roles.map(role => {
                  const isSelected = selectedRoleIds.includes(role.id);

                  return (
                    <Label
                      key={role.id}
                      htmlFor={`invite-role-${role.id}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        id={`invite-role-${role.id}`}
                        checked={isSelected}
                        onCheckedChange={checked => toggleRoleSelection(role.id, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <RoleTag
                            roleId={role.id}
                            roleName={role.name || 'Role'}
                            className="text-xs"
                          />
                          {role.default_invite_role ? (
                            <Badge className="border-transparent bg-gradient-to-r from-emerald-100 via-teal-100 to-cyan-100 text-emerald-950">
                              {defaultInviteLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {role.description || 'No role summary yet.'}
                        </p>
                      </div>
                    </Label>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm">
                <UserPlus className="h-4 w-4" />
                {emptyRolesLabel}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onInvite}
            disabled={selectedUsers.length === 0 || isInviting || selectedRoleIds.length === 0}
          >
            {isInviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {inviteLabel} {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
