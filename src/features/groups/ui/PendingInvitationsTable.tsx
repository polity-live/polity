/**
 * Pending Invitations Table Component
 *
 * Displays pending invitations that haven't been accepted yet.
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { Trash2, UserPlus } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PendingInvitationsTableProps<TParticipation extends ParticipationLike> {
  invitations: TParticipation[];
  onWithdraw: (membershipId: string, userId: string) => void;
  title?: string;
  description?: string;
  roleColumnLabel?: string;
  dateColumnLabel?: string;
  fallbackRoleLabel?: string;
  withdrawActionLabel?: string;
}

export function PendingInvitationsTable<TParticipation extends ParticipationLike>({
  invitations,
  onWithdraw,
  title = translateText('generated.inline.0102_pending_invitations_12c1d759'),
  description = translateText(
    'generated.inline.0103_users_who_have_been_invited_but_haven_t_accep_6522078d'
  ),
  roleColumnLabel = translateText('generated.inline.0104_invited_role_e219a54b'),
  dateColumnLabel = 'Invited',
  fallbackRoleLabel = 'Member',
  withdrawActionLabel = translateText('generated.inline.0105_withdraw_invitation_0beb2d10'),
}: PendingInvitationsTableProps<TParticipation>) {
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
          const invitedRoles = getMembershipDisplayRoles(membership);

          return (
            <div className="flex flex-wrap gap-2">
              {invitedRoles.length > 0 ? (
                invitedRoles.map(role => (
                  <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
                ))
              ) : (
                <RoleTag fallbackKey={`invite-${membership.id}`}>{fallbackRoleLabel}</RoleTag>
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
        cell: ({ row }) => {
          const membership = row.original;
          const userId = membership.user?.id;

          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={!userId}
                onClick={() => userId && onWithdraw(membership.id, userId)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">{withdrawActionLabel}</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [dateColumnLabel, fallbackRoleLabel, onWithdraw, roleColumnLabel, withdrawActionLabel]
  );

  if (invitations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <UserPlus className="h-5 w-5" />
          {title} ({invitations.length})
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <DataTable
        columns={columns}
        data={invitations}
        getRowId={membership => membership.id}
        enablePagination={false}
        tableClassName="[&_td:last-child]:text-right"
      />
    </section>
  );
}
