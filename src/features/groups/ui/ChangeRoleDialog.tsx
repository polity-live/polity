/**
 * Change Role Dialog Component
 *
 * Allows promoting or demoting a member by selecting a new role.
 * Roles are split into promotion and demotion sections based on sort_order.
 */

import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@/features/shared/ui/data-table';
import { RoleBadge, StatusBadge } from '@/features/shared/ui/status';
import {
  buildRightsSummaryForRoles,
  sortGroupRoles,
  type MembershipRightSummary,
} from '../logic/buildMembershipRightsSummary';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ChangeRoleDialogProps<TRole extends ParticipationRoleLike> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRoles: TRole[];
  roles: TRole[];
  onConfirm: (newRoleIds: string[]) => void;
  title?: string;
  emptyRolesLabel?: string;
  noSelectedRolesLabel?: string;
  emptyRightsLabel?: string;
  cancelLabel?: string;
  submitLabel?: string;
}
import { ChangeRoleDialogView } from './ChangeRoleDialogView';
export function ChangeRoleDialog<TRole extends ParticipationRoleLike>({
  isOpen,
  onOpenChange,
  memberName,
  currentRoles,
  roles,
  onConfirm,
  title = translateText('generated.inline.0077_manage_roles_5f9b8531'),
  emptyRolesLabel = translateText('generated.inline.0078_no_roles_available_ba017ee7'),
  noSelectedRolesLabel = translateText('generated.inline.0079_no_roles_selected_3f84503b'),
  emptyRightsLabel = translateText(
    'generated.inline.0080_no_explicit_action_rights_are_assigned_throug_a897bc09'
  ),
  cancelLabel = 'Cancel',
  submitLabel = translateText('generated.inline.0081_save_roles_61bdd2b8'),
}: ChangeRoleDialogProps<TRole>) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rightsOpen, setRightsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedRoleIds(
      currentRoles.map(role => role.id).filter((roleId): roleId is string => Boolean(roleId))
    );
    setRightsOpen(true);
  }, [currentRoles, isOpen]);

  const sortedRoles = useMemo(() => sortGroupRoles(roles), [roles]);

  const selectedRoles = useMemo(
    () => sortedRoles.filter(role => selectedRoleIds.includes(role.id)),
    [selectedRoleIds, sortedRoles]
  );

  const rightsSummary = useMemo(() => buildRightsSummaryForRoles(selectedRoles), [selectedRoles]);

  const currentRoleNames = currentRoles
    .map(role => role.name)
    .filter(Boolean)
    .join(', ');
  const selectedRoleNames = selectedRoles.map(role => role.name || 'Role').join(', ');
  const rightsColumns: ColumnDef<MembershipRightSummary>[] = [
    {
      id: 'right',
      header: translateText('generated.inline.0669_effective_right_706cda84'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.label}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.resource} / {row.original.action}
          </div>
        </div>
      ),
    },
    {
      id: 'grantedBy',
      header: translateText('generated.inline.0670_granted_by_9db3801b'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {row.original.sources.map(source => (
            <div
              key={`${row.original.key}-${source.roleId}`}
              className="border-border/70 bg-muted/30 rounded-md border px-3 py-2 text-xs"
            >
              <RoleBadge>{source.roleName}</RoleBadge>
              {!source.isDirect ? (
                <span className="text-muted-foreground ml-2">
                  {translateText('generated.inline.0082_via_a19e070e')}
                  {source.viaLabel}
                </span>
              ) : null}
              <StatusBadge
                status={source.isDirect ? 'direct' : 'implied'}
                tone={source.isDirect ? 'success' : 'info'}
                className="ml-2"
              >
                {source.isDirect
                  ? translateText('generated.inline.0083_direct_24a1733c')
                  : translateText('generated.inline.0084_implied_b0cc834f')}
              </StatusBadge>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const handleConfirm = () => {
    onConfirm(selectedRoleIds);
    setSelectedRoleIds([]);
    setRightsOpen(true);
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRoleIds([]);
      setRightsOpen(true);
    }
    onOpenChange(open);
  };

  const toggleRoleSelection = (roleId: string, checked: boolean) => {
    setSelectedRoleIds(previous =>
      checked ? [...previous, roleId] : previous.filter(id => id !== roleId)
    );
  };
  return (
    <ChangeRoleDialogView
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      memberName={memberName}
      currentRoles={currentRoles}
      roles={roles}
      onConfirm={onConfirm}
      title={title}
      emptyRolesLabel={emptyRolesLabel}
      noSelectedRolesLabel={noSelectedRolesLabel}
      emptyRightsLabel={emptyRightsLabel}
      cancelLabel={cancelLabel}
      submitLabel={submitLabel}
      selectedRoleIds={selectedRoleIds}
      setSelectedRoleIds={setSelectedRoleIds}
      rightsOpen={rightsOpen}
      setRightsOpen={setRightsOpen}
      sortedRoles={sortedRoles}
      selectedRoles={selectedRoles}
      rightsSummary={rightsSummary}
      currentRoleNames={currentRoleNames}
      selectedRoleNames={selectedRoleNames}
      rightsColumns={rightsColumns}
      handleConfirm={handleConfirm}
      handleOpenChange={handleOpenChange}
      toggleRoleSelection={toggleRoleSelection}
    />
  );
}
