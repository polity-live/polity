/**
 * Pending Invitations Table Component
 *
 * Displays pending invitations that haven't been accepted yet.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Trash2, UserPlus } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';

interface PendingInvitationsTableProps<TParticipation extends ParticipationLike> {
  invitations: TParticipation[];
  onWithdraw: (membershipId: string, userId: string) => void;
  onNavigateToUser: (userId: string) => void;
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
  onNavigateToUser,
  title = 'Pending Invitations',
  description = "Users who have been invited but haven't accepted yet",
  roleColumnLabel = 'Invited Role',
  dateColumnLabel = 'Invited',
  fallbackRoleLabel = 'Member',
  withdrawActionLabel = 'Withdraw Invitation',
}: PendingInvitationsTableProps<TParticipation>) {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {title} ({invitations.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>{roleColumnLabel}</TableHead>
              <TableHead>{dateColumnLabel}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map(membership => {
              const user = membership.user;
              const userName =
                [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Unknown User';
              const userAvatar = user?.avatar || '';
              const userHandle = user?.handle || '';
              const invitedRoles = getMembershipDisplayRoles(membership);
              const createdAt = membership.created_at
                ? new Date(membership.created_at).toLocaleDateString()
                : 'N/A';

              return (
                <TableRow key={membership.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        className="h-10 w-10 cursor-pointer"
                        onClick={() => user?.id && onNavigateToUser(user.id)}
                      >
                        <AvatarImage src={userAvatar} alt={userName} />
                        <AvatarFallback>
                          {userName
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => user?.id && onNavigateToUser(user.id)}
                      >
                        <div className="font-medium">{userName}</div>
                        {userHandle && (
                          <div className="text-muted-foreground text-sm">@{userHandle}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {invitedRoles.length > 0 ? (
                        invitedRoles.map(role => (
                          <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
                        ))
                      ) : (
                        <RoleTag fallbackKey={`invite-${membership.id}`}>
                          {fallbackRoleLabel}
                        </RoleTag>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => user?.id && onWithdraw(membership.id, user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ml-2">{withdrawActionLabel}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
