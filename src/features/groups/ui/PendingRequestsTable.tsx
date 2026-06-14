/**
 * Pending Requests Table Component
 *
 * Displays pending membership requests for group admins to approve or reject.
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { Check, Trash2, Users } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '../logic/groupConflictPreflight';
import { GroupConflictDialog } from './GroupConflictPanel';
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
}

interface PendingRequestActionCellProps<TParticipation extends ParticipationLike> {
  membership: TParticipation;
  onApprove: (membershipId: string, userId: string) => void;
  onReject: (membershipId: string, userId: string) => void;
  getApprovePreflightInput?: (
    membership: TParticipation
  ) => GroupConflictMembershipPreflight | null | undefined;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}

function PendingRequestActionCell<TParticipation extends ParticipationLike>({
  membership,
  onApprove,
  onReject,
  getApprovePreflightInput,
  primaryActionLabel,
  secondaryActionLabel,
}: PendingRequestActionCellProps<TParticipation>) {
  const userId = membership.user?.id ?? null;
  const preflightInput = getApprovePreflightInput?.(membership) ?? null;
  const { response, blocking } = useGroupConflictPreflight(preflightInput, {
    enabled: Boolean(preflightInput),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={!userId || blocking}
        onClick={() => userId && onApprove(membership.id, userId)}
      >
        <Check className="mr-1 h-4 w-4" />
        {primaryActionLabel}
      </Button>
      {blocking ? (
        <GroupConflictDialog
          response={response}
          triggerLabel={translateText('generated.inline.0693_warum_194dad5c')}
          triggerVariant="ghost"
          title={translateText('generated.inline.0709_warum_ist_diese_freigabe_blockiert_29129791')}
        />
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={!userId}
        onClick={() => userId && onReject(membership.id, userId)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="ml-2">{secondaryActionLabel}</span>
      </Button>
    </div>
  );
}

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
}: PendingRequestsTableProps<TParticipation>) {
  const columns = useMemo<ColumnDef<TParticipation>[]>(
    () => [
      {
        id: 'user',
        header: translateText('generated.inline.0090_user_9f8a2389'),
        accessorFn: membership =>
          [membership.user?.first_name, membership.user?.last_name].filter(Boolean).join(' ') ||
          'Unknown User',
        cell: ({ row }) => {
          const membership = row.original;
          const user = membership.user;
          const userName =
            [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Unknown User';
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
      {
        id: 'createdAt',
        header: dateColumnLabel,
        accessorFn: membership => membership.created_at ?? '',
        cell: ({ row }) => {
          const createdAt = row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString()
            : 'N/A';

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
      fallbackRoleLabel,
      getApprovePreflightInput,
      onApprove,
      onReject,
      primaryActionLabel,
      roleColumnLabel,
      secondaryActionLabel,
    ]
  );

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title} ({requests.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={requests}
          getRowId={membership => membership.id}
          enablePagination={false}
          tableClassName="[&_td:last-child]:text-right"
        />
      </CardContent>
    </Card>
  );
}
