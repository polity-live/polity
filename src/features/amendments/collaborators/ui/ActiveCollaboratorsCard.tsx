/**
 * Card displaying active collaborators with management options
 */

import { Shield, Trash2, Users } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { DataTable, EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { NativeSelect } from '@/features/shared/ui/ui/native-select';
import type { Collaborator, Role } from '../hooks/useCollaborators';

interface ActiveCollaboratorsCardProps {
  collaborators: Collaborator[];
  roles: Role[];
  onChangeRole: (collaboratorId: string, newRoleId: string) => Promise<void>;
  onPromoteToAdmin: (collaboratorId: string, roles: Role[]) => Promise<void>;
  onDemoteToMember: (collaboratorId: string, roles: Role[]) => Promise<void>;
  onRemoveCollaborator: (collaboratorId: string) => Promise<void>;
}

function getCollaboratorUser(collaboration: Collaborator) {
  const user = collaboration.user;
  const userName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User'
    : 'Unknown User';

  return {
    user,
    userName,
    userAvatar: user?.avatar || '',
    userHandle: user?.handle || '',
    userHref: user?.id ? `/user/${user.id}` : null,
    initials: userName
      .split(' ')
      .map((namePart: string) => namePart[0])
      .join('')
      .toUpperCase(),
  };
}

function CollaboratorUserCell({ collaboration }: { collaboration: Collaborator }) {
  const { userName, userAvatar, userHandle, userHref, initials } =
    getCollaboratorUser(collaboration);
  const content = (
    <EntityCell
      title={userName}
      description={userHandle ? `@${userHandle}` : undefined}
      leading={
        <Avatar className="h-10 w-10">
          <AvatarImage src={userAvatar} alt={userName} />
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

export function ActiveCollaboratorsCard({
  collaborators,
  roles,
  onChangeRole,
  onPromoteToAdmin,
  onDemoteToMember,
  onRemoveCollaborator,
}: ActiveCollaboratorsCardProps) {
  const columns: ColumnDef<Collaborator>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <CollaboratorUserCell collaboration={row.original} />,
    },
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => {
        const collaboration = row.original;
        const matchedRole = roles.find(role => role.id === collaboration.role_id);
        const roleName = matchedRole?.name || 'Collaborator';
        const roleId = collaboration.role_id ?? undefined;

        return (
          <NativeSelect
            value={roleId ?? ''}
            className="w-40"
            onChange={event => void onChangeRole(collaboration.id, event.target.value)}
          >
            {roleId ? null : <option value="">{roleName}</option>}
            {roles?.map(roleOption => (
              <option key={roleOption.id} value={roleOption.id}>
                {roleOption.name}
              </option>
            ))}
          </NativeSelect>
        );
      },
    },
    {
      id: 'joined',
      header: translateText('generated.inline.0092_joined_43a1c626'),
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
      cell: ({ row }) => {
        const collaboration = row.original;
        const matchedRole = roles.find(role => role.id === collaboration.role_id);
        const roleName = matchedRole?.name || 'Collaborator';

        return (
          <div className="flex justify-end gap-2">
            {roleName !== 'Author' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPromoteToAdmin(collaboration.id, roles)}
              >
                <Shield className="mr-1 h-4 w-4" />
                {translateText('generated.inline.0094_promote_to_author_88d1b3f9')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDemoteToMember(collaboration.id, roles)}
              >
                {translateText('generated.inline.0095_demote_to_collaborator_f2101f10')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveCollaborator(collaboration.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">{translateText('generated.inline.0096_remove_e963907d')}</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="mb-6 space-y-3">
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <Users className="h-5 w-5" />
          {translateText('generated.inline.0087_active_collaborators_7b4089f1')}
          {collaborators.length})
        </h2>
        <p className="text-muted-foreground text-sm">
          {translateText(
            'generated.inline.0088_current_amendment_collaborators_and_administr_a73f4579'
          )}
        </p>
      </div>
      <DataTable
        columns={columns}
        data={collaborators}
        getRowId={collaborator => collaborator.id}
        enablePagination={false}
        emptyTitle={translateText('generated.inline.0089_no_active_collaborators_found_25e117c5')}
      />
    </section>
  );
}
