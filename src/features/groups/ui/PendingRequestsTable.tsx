/**
 * Pending Requests Table Component
 *
 * Displays pending membership requests for group admins to approve or reject.
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { type ColumnDef } from '@/features/shared/ui/data-table';
import { EntityBadge } from '@/features/shared/ui/status';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import { getMembershipProvenanceDisplayLabel } from '../logic/membershipComposition';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
import type { GroupConflictMembershipPreflight } from '../logic/groupConflictPreflight';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PendingRequestsTableProps<TParticipation extends ParticipationLike> {
  requests: TParticipation[];
  onApprove: (membershipId: string, userId: string) => void;
  onReject: (membershipId: string, userId: string) => void;
  getApprovePreflightInput?: (
    membership: TParticipation
  ) => GroupConflictMembershipPreflight | null | undefined;
  title?: string;
  description?: string;
  roleColumnLabel?: string;
  dateColumnLabel?: string;
  fallbackRoleLabel?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  showBaseGroupColumn?: boolean;
}

import { PendingRequestActionCell } from './PendingRequestActionCell';
import { PendingRequestsTableView } from './PendingRequestsTableView';
export function PendingRequestsTable<TParticipation extends ParticipationLike>({
  requests,
  onApprove,
  onReject,
  getApprovePreflightInput,
  title = translateText('generated.inline.0106_pending_join_requests_306b38df'),
  description = translateText(
    'generated.inline.0107_review_and_approve_membership_requests_d79e0a71'
  ),
  roleColumnLabel = translateText('generated.inline.0108_requested_role_599518e7'),
  dateColumnLabel = 'Requested',
  fallbackRoleLabel = 'Member',
  primaryActionLabel = 'Accept',
  secondaryActionLabel = 'Remove',
  showBaseGroupColumn = false,
}: PendingRequestsTableProps<TParticipation>) {
  const directWithoutPathLabel = translateText(
    'features.groups.memberships.composition.directWithoutPath',
    'Direct / no path'
  );
  const renderBaseGroupTag = (membership: TParticipation) => {
    const label = getMembershipProvenanceDisplayLabel(membership, 'baseGroup', {
      directWithoutPathLabel,
    });

    if (!membership.baseGroup?.id) {
      return <span className="text-muted-foreground">{label}</span>;
    }

    return (
      <EntityBadge asChild tone="info" className="hover:opacity-90">
        <Link to="/group/$id" params={{ id: membership.baseGroup.id }}>
          {label}
        </Link>
      </EntityBadge>
    );
  };
  const baseGroupColumns: ColumnDef<TParticipation>[] = showBaseGroupColumn
    ? [
        {
          id: 'baseGroup',
          header: () => translateText('components.tableColumns.baseGroup', 'Base group'),
          cell: ({ row }) => renderBaseGroupTag(row.original),
        },
      ]
    : [];
  const columns = useMemo<ColumnDef<TParticipation>[]>(
    () => [
      {
        id: 'user',
        header: translateText('generated.inline.0090_user_9f8a2389'),
        accessorFn: membership =>
          [membership.user?.first_name, membership.user?.last_name].filter(Boolean).join(' ') ||
          translateText('components.memberRightsDialog.unknownUser'),
        cell: ({ row }) => {
          const membership = row.original;
          const user = membership.user;
          const userName =
            [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
            translateText('components.memberRightsDialog.unknownUser');
          const userAvatar = user?.avatar || '';
          const userHandle = user?.handle || '';
          const avatar = (
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback>
                {userName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
          const userContent = (
            <>
              {avatar}
              <div>
                <div className="font-medium">{userName}</div>
                {userHandle ? (
                  <div className="text-muted-foreground text-sm">@{userHandle}</div>
                ) : null}
              </div>
            </>
          );

          return user?.id ? (
            <Link to="/user/$id" params={{ id: user.id }} className="group flex items-center gap-3">
              {userContent}
            </Link>
          ) : (
            <div className="flex items-center gap-3">{userContent}</div>
          );
        },
      },
      {
        id: 'role',
        header: roleColumnLabel,
        cell: ({ row }) => {
          const membership = row.original;
          const requestedRoles = getMembershipDisplayRoles(membership);

          return (
            <div className="flex flex-wrap gap-2">
              {requestedRoles.length > 0 ? (
                requestedRoles.map(role => (
                  <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
                ))
              ) : (
                <RoleTag fallbackKey={`request-${membership.id}`}>{fallbackRoleLabel}</RoleTag>
              )}
            </div>
          );
        },
      },
      ...baseGroupColumns,
      {
        id: 'createdAt',
        header: dateColumnLabel,
        accessorFn: membership => membership.created_at ?? '',
        cell: ({ row }) => {
          const createdAt = row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString()
            : translateText('components.membershipTables.notAvailable');

          return <span className="text-muted-foreground">{createdAt}</span>;
        },
      },
      {
        id: 'actions',
        header: () => (
          <span className="block text-right">
            {translateText('generated.inline.0093_actions_c3cd636a')}
          </span>
        ),
        cell: ({ row }) => (
          <PendingRequestActionCell
            membership={row.original}
            onApprove={onApprove}
            onReject={onReject}
            getApprovePreflightInput={getApprovePreflightInput}
            primaryActionLabel={primaryActionLabel}
            secondaryActionLabel={secondaryActionLabel}
          />
        ),
      },
    ],
    [
      dateColumnLabel,
      baseGroupColumns,
      fallbackRoleLabel,
      getApprovePreflightInput,
      onApprove,
      onReject,
      primaryActionLabel,
      roleColumnLabel,
      secondaryActionLabel,
    ]
  );
  return (
    <PendingRequestsTableView
      requests={requests}
      onApprove={onApprove}
      onReject={onReject}
      getApprovePreflightInput={getApprovePreflightInput}
      title={title}
      description={description}
      roleColumnLabel={roleColumnLabel}
      dateColumnLabel={dateColumnLabel}
      fallbackRoleLabel={fallbackRoleLabel}
      primaryActionLabel={primaryActionLabel}
      secondaryActionLabel={secondaryActionLabel}
      columns={columns}
    />
  );
}
