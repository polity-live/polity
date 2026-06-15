import { Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { Check, Trash2, UserRoundCheck } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable, EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import { StatusBadge } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
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

function GuestUserCell({ user }: { user: GuestAccessUserLike | null | undefined }) {
  const userName = getGuestDisplayName(user);
  const userEmail = user?.email || undefined;
  const userId = user?.id || null;
  const initials = userName
    .split(' ')
    .map(namePart => namePart[0])
    .join('')
    .toUpperCase();
  const content = (
    <EntityCell
      title={<span className={userId ? 'group-hover:underline' : undefined}>{userName}</span>}
      description={userEmail}
      leading={
        <Avatar className="h-10 w-10">
          <AvatarImage src="" alt={userName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      }
    />
  );

  if (!userId) {
    return content;
  }

  return (
    <Link to="/user/$id" params={{ id: userId }} className="group block text-left">
      {content}
    </Link>
  );
}

export function GuestsTable<TGuestAccess extends GuestAccessLike>({
  guests,
  onApprove,
  onRevoke,
  title = translateText('generated.inline.0085_guest_access_44eeebf7'),
  description = translateText(
    'generated.inline.0086_users_with_guest_roles_and_access_rights_6ef79881'
  ),
}: GuestsTableProps<TGuestAccess>) {
  const columns: ColumnDef<TGuestAccess>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <GuestUserCell user={row.original.user} />,
    },
    {
      id: 'status',
      header: translateText('generated.inline.0688_status_bae7d5be'),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status}>
          {getGuestStatusLabel(row.original.status)}
        </StatusBadge>
      ),
    },
    {
      id: 'roles',
      header: translateText('generated.inline.0689_roles_47dcc27d'),
      cell: ({ row }) => {
        const guest = row.original;

        return (
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
              <RoleTag fallbackKey={`guest-${guest.id}`}>
                {translateText('generated.inline.0690_no_guest_role_0a807d70')}
              </RoleTag>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => {
        const guest = row.original;

        return (
          <div className="flex justify-end gap-2">
            {guest.status === 'requested' && onApprove ? (
              <Button variant="default" size="sm" onClick={() => onApprove(guest.id)}>
                <Check className="mr-1 h-4 w-4" />
                {translateText('generated.inline.0691_approve_7b2c7f14')}
              </Button>
            ) : null}
            {onRevoke ? (
              <Button variant="ghost" size="sm" onClick={() => onRevoke(guest.id)}>
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">
                  {guest.status === 'requested'
                    ? translateText('generated.inline.0099_reject_2b03b592')
                    : translateText('generated.inline.0100_revoke_0be72075')}
                </span>
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <section
      className="civic-load-card-reveal space-y-3"
      style={{ '--civic-load-index': 3 } as CSSProperties}
    >
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <UserRoundCheck className="h-5 w-5" />
          {title} ({guests.length})
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <DataTable
        columns={columns}
        data={[...guests]}
        getRowId={guest => guest.id}
        enablePagination={false}
        emptyTitle={translateText('generated.inline.0687_no_guests_yet_a19e5185')}
      />
    </section>
  );
}
