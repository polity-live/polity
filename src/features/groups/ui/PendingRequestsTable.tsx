/**
 * Pending Requests Table Component
 *
 * Displays pending membership requests for group admins to approve or reject.
 */

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Check, Trash2, Users } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '../logic/groupConflictPreflight';
import { GroupConflictDialog } from './GroupConflictPanel';

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
          triggerLabel="Warum?"
          triggerVariant="ghost"
          title="Warum ist diese Freigabe blockiert?"
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
  title = 'Pending Join Requests',
  description = 'Review and approve membership requests',
  roleColumnLabel = 'Requested Role',
  dateColumnLabel = 'Requested',
  fallbackRoleLabel = 'Member',
  primaryActionLabel = 'Accept',
  secondaryActionLabel = 'Remove',
}: PendingRequestsTableProps<TParticipation>) {
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
            {requests.map(membership => {
              const user = membership.user;
              const userName =
                [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Unknown User';
              const userAvatar = user?.avatar || '';
              const userHandle = user?.handle || '';
              const requestedRoles = getMembershipDisplayRoles(membership);
              const createdAt = membership.created_at
                ? new Date(membership.created_at).toLocaleDateString()
                : 'N/A';

              return (
                <TableRow key={membership.id}>
                  <TableCell>
                    {user?.id ? (
                      <Link
                        to="/user/$id"
                        params={{ id: user.id }}
                        className="group flex items-center gap-3"
                      >
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
                        <div className="group-hover:underline">
                          <div className="font-medium">{userName}</div>
                          {userHandle && (
                            <div className="text-muted-foreground text-sm">@{userHandle}</div>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3">
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
                        <div>
                          <div className="font-medium">{userName}</div>
                          {userHandle && (
                            <div className="text-muted-foreground text-sm">@{userHandle}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {requestedRoles.length > 0 ? (
                        requestedRoles.map(role => (
                          <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
                        ))
                      ) : (
                        <RoleTag fallbackKey={`request-${membership.id}`}>
                          {fallbackRoleLabel}
                        </RoleTag>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                  <TableCell className="text-right">
                    <PendingRequestActionCell
                      membership={membership}
                      onApprove={onApprove}
                      onReject={onReject}
                      getApprovePreflightInput={getApprovePreflightInput}
                      primaryActionLabel={primaryActionLabel}
                      secondaryActionLabel={secondaryActionLabel}
                    />
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
