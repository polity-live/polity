/**
 * Card displaying pending collaboration requests
 */

import { Check, Trash2, Users } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { DataTable, EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import type { Collaborator } from '../hooks/useCollaborators';

interface PendingRequestsCardProps {
  requests: Collaborator[];
  onApproveRequest: (collaboratorId: string) => Promise<void>;
  onRejectRequest: (collaboratorId: string) => Promise<void>;
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

export function PendingRequestsCard({
  requests,
  onApproveRequest,
  onRejectRequest,
}: PendingRequestsCardProps) {
  const columns: ColumnDef<Collaborator>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <CollaboratorUserCell collaboration={row.original} />,
    },
    {
      id: 'requested',
      header: translateText('generated.inline.0120_requested_c26bf60f'),
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
        <div className="flex justify-end gap-2">
          <Button variant="default" size="sm" onClick={() => onApproveRequest(row.original.id)}>
            <Check className="mr-1 h-4 w-4" />
            {translateText('generated.inline.0121_accept_bb54db51')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRejectRequest(row.original.id)}>
            <Trash2 className="h-4 w-4" />
            <span className="ml-2">{translateText('generated.inline.0122_decline_b59cf9ed')}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Panel className="mb-6">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {translateText('generated.inline.0119_pending_collaboration_requests_0e65bf5a')}
          {requests.length})
        </PanelTitle>
        <PanelDescription>
          {translateText(
            'generated.inline.0103_review_and_approve_collaboration_requests_0cd489d8'
          )}
        </PanelDescription>
      </PanelHeader>
      <PanelContent>
        <DataTable
          columns={columns}
          data={requests}
          getRowId={request => request.id}
          enablePagination={false}
        />
      </PanelContent>
    </Panel>
  );
}
