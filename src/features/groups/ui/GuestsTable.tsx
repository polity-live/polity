import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Check, Trash2, UserRoundCheck } from 'lucide-react';
import { RoleTag } from './RoleTag';

interface GuestAccessRoleLike {
  id?: string | null;
  name?: string | null;
}

interface GuestAccessUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface GuestAccessLike {
  id: string;
  status?: string | null;
  user?: GuestAccessUserLike | null;
  roles?: GuestAccessRoleLike[] | null;
}

interface GuestsTableProps<TGuestAccess extends GuestAccessLike> {
  guests: readonly TGuestAccess[];
  onApprove?: (guestAccessId: string) => void;
  onRevoke?: (guestAccessId: string) => void;
  title?: string;
  description?: string;
}

function getGuestDisplayName(user: GuestAccessUserLike | null | undefined) {
  if (!user) {
    return 'Unknown user';
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown user'
  );
}

function getGuestStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'requested':
      return 'Requested';
    default:
      return 'Unknown';
  }
}

function getGuestStatusVariant(
  status: string | null | undefined
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'requested':
      return 'secondary';
    case 'invited':
      return 'outline';
    default:
      return 'outline';
  }
}

export function GuestsTable<TGuestAccess extends GuestAccessLike>({
  guests,
  onApprove,
  onRevoke,
  title = 'Guest Access',
  description = 'Users with guest roles and access rights',
}: GuestsTableProps<TGuestAccess>) {
  return (
    <Card className="border-border/70 from-background to-muted/20 mb-6 bg-gradient-to-b">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundCheck className="h-5 w-5" />
          {title} ({guests.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {guests.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No guests yet</p>
        ) : (
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map(guest => {
                  const user = guest.user;
                  const userName = getGuestDisplayName(user);
                  const userEmail = user?.email || '';
                  const userId = user?.id || null;

                  return (
                    <TableRow key={guest.id}>
                      <TableCell>
                        {userId ? (
                          <Link
                            to="/user/$id"
                            params={{ id: userId }}
                            className="group flex items-center gap-3 text-left"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src="" alt={userName} />
                              <AvatarFallback>
                                {userName
                                  .split(' ')
                                  .map(namePart => namePart[0])
                                  .join('')
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="group-hover:underline">
                              <div className="font-medium">{userName}</div>
                              {userEmail ? (
                                <div className="text-muted-foreground text-sm">{userEmail}</div>
                              ) : null}
                            </div>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 text-left">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src="" alt={userName} />
                              <AvatarFallback>
                                {userName
                                  .split(' ')
                                  .map(namePart => namePart[0])
                                  .join('')
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{userName}</div>
                              {userEmail ? (
                                <div className="text-muted-foreground text-sm">{userEmail}</div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getGuestStatusVariant(guest.status)}>
                          {getGuestStatusLabel(guest.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(guest.roles ?? []).length > 0 ? (
                            (guest.roles ?? []).map(role => (
                              <RoleTag
                                key={role.id ?? `${guest.id}-${role.name ?? 'role'}`}
                                roleId={role.id}
                                roleName={role.name || 'Role'}
                              />
                            ))
                          ) : (
                            <RoleTag fallbackKey={`guest-${guest.id}`}>No guest role</RoleTag>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {guest.status === 'requested' && onApprove ? (
                            <Button variant="default" size="sm" onClick={() => onApprove(guest.id)}>
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                          ) : null}
                          {onRevoke ? (
                            <Button variant="ghost" size="sm" onClick={() => onRevoke(guest.id)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="ml-2">
                                {guest.status === 'requested' ? 'Reject' : 'Revoke'}
                              </span>
                            </Button>
                          ) : null}
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
