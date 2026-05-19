/**
 * Active Members Table Component
 *
 * Displays active group members with role management and actions.
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
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2, Users } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import type { MembershipSort, MembershipSortField } from '../types/group.types';
import { RoleTag } from './RoleTag';

interface ActiveMembersTableProps<TMembership extends ParticipationLike> {
  members: TMembership[];
  sort: MembershipSort;
  onSortChange: (field: MembershipSortField) => void;
  onOpenRightsDialog: (membership: TMembership) => void;
  onOpenChangeRoleDialog: (membership: TMembership) => void;
  onRemove: (membershipId: string, userId: string) => void;
  title?: string;
  description?: string;
  fallbackRoleLabel?: string;
  manageRolesLabel?: string;
  removeLabel?: string;
}

export function ActiveMembersTable<TMembership extends ParticipationLike>({
  members,
  sort,
  onSortChange,
  onOpenRightsDialog,
  onOpenChangeRoleDialog,
  onRemove,
  title = 'Active Members',
  description = 'Current group members and administrators',
  fallbackRoleLabel = 'Member',
  manageRolesLabel = 'Manage Roles',
  removeLabel = 'Remove',
}: ActiveMembersTableProps<TMembership>) {
  return (
    <Card className="border-border/70 from-background to-muted/20 mb-6 bg-gradient-to-b">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title} ({members.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No active members found</p>
        ) : (
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton label="User" field="user" sort={sort} onSortChange={onSortChange} />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Role" field="role" sort={sort} onSortChange={onSortChange} />
                  </TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(membership => {
                  const user = membership.user;
                  const userName =
                    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Unknown User';
                  const userAvatar = user?.avatar || '';
                  const userHandle = user?.handle || '';
                  const displayRoles = getMembershipDisplayRoles(membership);
                  const createdAt = membership.created_at
                    ? new Date(membership.created_at).toLocaleDateString()
                    : 'N/A';

                  return (
                    <TableRow key={membership.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => onOpenRightsDialog(membership)}
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
                          <div className="hover:underline">
                            <div className="font-medium">{userName}</div>
                            {userHandle && (
                              <div className="text-muted-foreground text-sm">@{userHandle}</div>
                            )}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {displayRoles.length > 0 ? (
                            displayRoles.map(role => (
                              <RoleTag
                                key={role.id}
                                roleId={role.id}
                                roleName={role.name || 'Role'}
                              />
                            ))
                          ) : (
                            <RoleTag fallbackKey={`member-${membership.id}`}>
                              {fallbackRoleLabel}
                            </RoleTag>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChangeRoleDialog(membership)}
                          >
                            <ArrowUpDown className="mr-1 h-4 w-4" />
                            {manageRolesLabel}
                          </Button>
                          {membership.source !== 'derived' && user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemove(membership.id, user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="ml-2">{removeLabel}</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SortButtonProps {
  label: string;
  field: MembershipSortField;
  sort: MembershipSort;
  onSortChange: (field: MembershipSortField) => void;
}

function SortButton({ label, field, sort, onSortChange }: SortButtonProps) {
  const Icon = sort.field !== field ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-foreground hover:text-foreground -ml-3 h-auto px-3 py-1 font-semibold hover:bg-transparent"
      onClick={() => onSortChange(field)}
    >
      {label}
      <Icon className="ml-2 h-4 w-4" />
    </Button>
  );
}
