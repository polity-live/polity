import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Button } from '@/features/shared/ui/ui/button';

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
  onRevoke?: (guestAccessId: string) => void;
}

function getGuestDisplayName(user: GuestAccessUserLike | null | undefined) {
  if (!user) {
    return 'Unknown user';
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown user'
  );
}

export function GuestsTable<TGuestAccess extends GuestAccessLike>({
  guests,
  onRevoke,
}: GuestsTableProps<TGuestAccess>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead className="w-[120px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {guests.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground text-center">
              No guests yet
            </TableCell>
          </TableRow>
        ) : (
          guests.map(guest => (
            <TableRow key={guest.id}>
              <TableCell>{getGuestDisplayName(guest.user)}</TableCell>
              <TableCell>{guest.status ?? 'unknown'}</TableCell>
              <TableCell>
                {(guest.roles ?? [])
                  .map(role => role.name)
                  .filter((roleName): roleName is string => Boolean(roleName))
                  .join(', ') || 'No guest role'}
              </TableCell>
              <TableCell>
                {onRevoke ? (
                  <Button variant="outline" size="sm" onClick={() => onRevoke(guest.id)}>
                    Revoke
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
