/**
 * Card displaying pending invitations
 */

import { Trash2, UserPlus } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { DataTable, EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import type { Collaborator } from '../hooks/useCollaborators';

interface PendingInvitationsCardProps {
  invitations: Collaborator[];
  onWithdrawInvitation: (collaboratorId: string) => Promise<void>;
}

function CollaboratorUserCell({ collaboration }: { collaboration: Collaborator }) {
  const user = collaboration.user;
  const userName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User'
    : 'Unknown User';
  const userHandle = user?.handle || '';
  const userHref = user?.id ? `/user/${user.id}` : null;
  const initials = userName
    .split(' ')
    .map((namePart: string) => namePart[0])
    .join('')
    .toUpperCase();
  const content = (
    <EntityCell
      title={userName}
      description={userHandle ? `@${userHandle}` : undefined}
      leading={
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.avatar || ''} alt={userName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      }
    />
  );

  if (!userHref) {
    return content;
  }

  return (
    <SmartLink href={userHref} className="block hover:underline">
      {content}
    </SmartLink>
  );
}

export function PendingInvitationsCard({
  invitations,
  onWithdrawInvitation,
}: PendingInvitationsCardProps) {
  const columns: ColumnDef<Collaborator>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <CollaboratorUserCell collaboration={row.original} />,
    },
    {
      id: 'invited',
      header: translateText('generated.inline.0117_invited_53469df1'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => onWithdrawInvitation(row.original.id)}>
          <Trash2 className="h-4 w-4" />
          <span className="ml-2">
            {translateText('generated.inline.0118_withdraw_invitation_0beb2d10')}
          </span>
        </Button>
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <UserPlus className="h-5 w-5" />
          {translateText('features.amendments.collaborators.pendingInvitationsTitle', {
            count: invitations.length,
          })}
        </h2>
        <p className="text-muted-foreground text-sm">
          {translateText(
            'generated.inline.0116_users_who_have_been_invited_but_haven_t_accep_6522078d'
          )}
        </p>
      </div>
      <DataTable
        columns={columns}
        data={invitations}
        getRowId={invitation => invitation.id}
        enablePagination={false}
      />
    </section>
  );
}
