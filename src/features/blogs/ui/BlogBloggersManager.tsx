'use client';

import { useMemo, useState } from 'react';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useUserState } from '@/zero/users/useUserState';
import { Button } from '@/features/shared/ui/ui/button';
import { UserX, X, Check } from 'lucide-react';
import { EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { NativeSelect } from '@/features/shared/ui/ui/native-select';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useActionSubmission } from '@/features/shared/ui/action-submission';
import { filterParticipationsByRole } from '@/features/shared/ui/participation';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac/usePermissions';
import type { User } from '@/zero';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
function displayName(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'Unknown';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function initials(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'U';
  return u.first_name?.charAt(0) || u.last_name?.charAt(0) || 'U';
}

const ACTIVE_BLOGGER_STATUSES = new Set(['owner', 'admin', 'member', 'writer']);

interface BloggerUserLike extends Pick<User, 'first_name' | 'last_name'> {
  avatar?: string | null;
  handle?: string | null;
  email?: string | null;
}

function BloggerUserCell({ user }: { user?: BloggerUserLike | null }) {
  return (
    <EntityCell
      title={displayName(user)}
      description={
        user?.handle || user?.email
          ? `@${user.handle || user.email || translateText('generated.inline.0025_unknown_50d8b4a9')}`
          : undefined
      }
      leading={
        <Avatar>
          <AvatarImage src={user?.avatar || ''} />
          <AvatarFallback>{initials(user)}</AvatarFallback>
        </Avatar>
      }
    />
  );
}

interface BlogBloggersManagerProps {
  blogId: string;
}
import { BlogBloggersManagerView } from './BlogBloggersManagerView';
export function BlogBloggersManager({ blogId }: BlogBloggersManagerProps) {
  const blogActions = useBlogActions();
  const groupActions = useGroupActions();
  const { blogWithManagement } = useBlogState({ blogId, includeManagement: true });
  const { allUsers } = useUserState({ includeAllUsers: true });
  const usersData = allUsers;

  const [searchQuery, setSearchQuery] = useState('');
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const actionSubmission = useActionSubmission('invite');
  const [activeTab, setActiveTab] = useState('bloggers');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);

  const blog = blogWithManagement;
  const bloggers = blog?.bloggers || [];
  const rolesData = { roles: blog?.roles || [] };
  const isLoading = !blogWithManagement;
  const isLoadingUsers = !usersData;
  const error = null;

  // Check if current user is owner
  const { user } = useAuth();
  const currentUserId = user?.id;

  // Use permission hooks to check access
  const { can } = usePermissions({ blogId });
  const canManageBloggers = can('manage', 'blogBloggers');
  const roleFilterRoleIds = useMemo(
    () => new Set(rolesData.roles.map(role => role.id).filter(Boolean)),
    [rolesData.roles]
  );
  const activeRoleFilterIds = useMemo(
    () => selectedRoleIds.filter(roleId => roleFilterRoleIds.has(roleId)),
    [roleFilterRoleIds, selectedRoleIds]
  );

  // Get existing blogger IDs to exclude from invite search
  const existingBloggerIds = bloggers.map(b => b.user_id).filter(Boolean) as string[];

  // Filter users for invite search
  const filteredUsers = usersData?.filter(u => {
    if (!u?.id) return false;
    if (existingBloggerIds.includes(u.id)) return false;

    const q = inviteSearchQuery.toLowerCase();
    return (
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.handle?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleInviteBloggers = async () => {
    if (selectedUsers.length === 0) return;

    setIsInviting(true);
    void actionSubmission
      .runActionWithSubmission(
        async () => {
          // Find Writer role ID
          const writerRole = rolesData.roles.find(r => r.name === 'Writer');
          if (!writerRole) {
            throw new Error('Writer role not found');
          }

          await Promise.all(
            selectedUsers.map(userId =>
              blogActions.createEntry({
                id: crypto.randomUUID(),
                status: 'invited',
                user_id: userId,
                blog_id: blogId,
                role_id: writerRole.id,
                visibility: '',
              })
            )
          );

          toast.success(
            `Invited ${selectedUsers.length} ${selectedUsers.length === 1 ? 'blogger' : 'bloggers'}`
          );
        },
        {
          onSuccess: () => {
            setSelectedUsers([]);
            setInviteSearchQuery('');
            setIsInviting(false);
            actionSubmission.reset();
            setInviteDialogOpen(false);
          },
        }
      )
      .catch(error => {
        console.error('Failed to invite bloggers:', error);
        toast.error(
          translateText('generated.inline.0227_failed_to_invite_bloggers_please_try_again_76577b9e')
        );
        setIsInviting(false);
      });
  };

  // Handle role updates
  const handleUpdateRole = async (bloggerId: string, newRoleId: string) => {
    try {
      await blogActions.updateEntry({ id: bloggerId, role_id: newRoleId });
      toast.success(
        translateText('generated.inline.0228_blogger_role_updated_successfully_e8d4a3f6')
      );
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error(translateText('generated.inline.0229_failed_to_update_blogger_role_fd1c311d'));
    }
  };

  // Handle removing blogger
  const handleRemoveBlogger = async (bloggerId: string) => {
    try {
      await blogActions.deleteEntry(bloggerId);
      toast.success(translateText('generated.inline.0230_blogger_removed_successfully_09b87897'));
    } catch (err) {
      console.error('Error removing blogger:', err);
      toast.error(translateText('generated.inline.0231_failed_to_remove_blogger_5c712772'));
    }
  };

  // Handle adding action right to role
  const handleToggleActionRight = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHasRight: boolean
  ) => {
    try {
      if (currentlyHasRight) {
        // Find and remove the action right
        const foundRole = rolesData.roles.find(r => r.id === roleId);
        const actionRightToRemove = foundRole?.action_rights?.find(
          ar => ar.resource === resource && ar.action === action
        );
        if (actionRightToRemove) {
          await groupActions.removeActionRight({ id: actionRightToRemove.id });
        }
      } else {
        // Add the action right
        const actionRightId = crypto.randomUUID();
        await groupActions.assignActionRight({
          id: actionRightId,
          resource,
          action,
          role_id: roleId,
          blog_id: blogId,
          group_id: null,
          event_id: null,
          amendment_id: null,
        });
      }
      toast.success(
        translateText('generated.inline.0232_permission_updated_successfully_b593d649')
      );
    } catch (error) {
      console.error('Failed to toggle action right:', error);
      toast.error(translateText('generated.inline.0233_failed_to_update_permission_9cd30398'));
    }
  };

  // Handle creating new role
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return;
    }

    try {
      const roleId = crypto.randomUUID();
      await groupActions.createRole({
        id: roleId,
        name: newRoleName,
        description: newRoleDescription,
        scope: 'blog',
        blog_id: blogId,
        group_id: null,
        event_id: null,
        amendment_id: null,
        sort_order: 0,
      });

      toast.success(translateText('generated.inline.0235_role_created_successfully_150cd5c5'));

      setNewRoleName('');
      setNewRoleDescription('');
      setAddRoleDialogOpen(false);
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(
        translateText('generated.inline.0236_failed_to_create_role_please_try_again_7383aeaf')
      );
    }
  };

  // Handle deleting a role
  const handleDeleteRole = async (roleId: string) => {
    try {
      await groupActions.deleteRole({ id: roleId });
      toast.success(translateText('generated.inline.0237_role_deleted_successfully_b714d57c'));
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(
        translateText('generated.inline.0238_failed_to_delete_role_please_try_again_fe4624de')
      );
    }
  };

  // Filter bloggers based on search and status
  const searchFilteredBloggers = bloggers.filter(blogger => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      displayName(blogger.user).toLowerCase().includes(q) ||
      blogger.user?.handle?.toLowerCase().includes(q) ||
      blogger.user?.email?.toLowerCase().includes(q);

    return matchesSearch;
  });
  const filteredBloggers = filterParticipationsByRole(searchFilteredBloggers, activeRoleFilterIds);

  // Separate bloggers by status
  const activeBloggers = filteredBloggers.filter(b => ACTIVE_BLOGGER_STATUSES.has(b.status ?? ''));
  const invitedBloggers = filteredBloggers.filter(b => b.status === 'invited');
  const requestedBloggers = filteredBloggers.filter(b => b.status === 'requested');
  type BloggerRow = (typeof bloggers)[number];

  const getCreatedAt = (blogger: BloggerRow) =>
    blogger.created_at ? new Date(blogger.created_at).toLocaleDateString() : 'N/A';

  const invitedColumns: ColumnDef<BloggerRow>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <BloggerUserCell user={row.original.user} />,
    },
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => (
        <RoleTag
          roleId={row.original.role?.id}
          roleName={
            row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')
          }
        />
      ),
    },
    {
      id: 'invited',
      header: translateText('generated.inline.0117_invited_53469df1'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{getCreatedAt(row.original)}</span>
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      cell: ({ row }) =>
        canManageBloggers ? (
          <Button variant="ghost" size="sm" onClick={() => handleRemoveBlogger(row.original.id)}>
            <UserX className="h-4 w-4" />
            <span className="ml-2">{translateText('generated.inline.0065_cancel_77dfd213')}</span>
          </Button>
        ) : null,
    },
  ];

  const activeColumns: ColumnDef<BloggerRow>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <BloggerUserCell user={row.original.user} />,
    },
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) =>
        canManageBloggers && row.original.user?.id !== currentUserId ? (
          <NativeSelect
            value={row.original.role?.id ?? ''}
            className="w-[180px]"
            onChange={event => void handleUpdateRole(row.original.id, event.target.value)}
          >
            {row.original.role?.id ? null : (
              <option value="">
                {translateText('generated.inline.0255_select_role_04fa02bb')}
              </option>
            )}
            {rolesData.roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <RoleTag
            roleId={row.original.role?.id}
            roleName={
              row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')
            }
          />
        ),
    },
    {
      id: 'joined',
      header: translateText('generated.inline.0092_joined_43a1c626'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{getCreatedAt(row.original)}</span>
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      cell: ({ row }) =>
        canManageBloggers && row.original.user?.id !== currentUserId ? (
          <Button variant="ghost" size="sm" onClick={() => handleRemoveBlogger(row.original.id)}>
            <UserX className="h-4 w-4" />
            <span className="ml-2">{translateText('generated.inline.0096_remove_e963907d')}</span>
          </Button>
        ) : null,
    },
  ];

  const requestedColumns: ColumnDef<BloggerRow>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => <BloggerUserCell user={row.original.user} />,
    },
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => (
        <RoleTag
          roleId={row.original.role?.id}
          roleName={
            row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')
          }
        />
      ),
    },
    {
      id: 'requested',
      header: translateText('generated.inline.0120_requested_c26bf60f'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{getCreatedAt(row.original)}</span>
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      cell: ({ row }) =>
        canManageBloggers ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                blogActions.updateEntry({
                  id: row.original.id,
                  status: 'member',
                });
              }}
            >
              <Check className="mr-1 h-4 w-4" />
              {translateText('generated.inline.0121_accept_bb54db51')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRemoveBlogger(row.original.id)}
            >
              <X className="mr-1 h-4 w-4" />
              {translateText('generated.inline.0122_decline_b59cf9ed')}
            </Button>
          </div>
        ) : null,
    },
  ];
  return (
    <BlogBloggersManagerView
      blogId={blogId}
      blogActions={blogActions}
      groupActions={groupActions}
      blogWithManagement={blogWithManagement}
      allUsers={allUsers}
      usersData={usersData}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedRoleIds={activeRoleFilterIds}
      setSelectedRoleIds={setSelectedRoleIds}
      inviteSearchQuery={inviteSearchQuery}
      setInviteSearchQuery={setInviteSearchQuery}
      selectedUsers={selectedUsers}
      actionSubmission={actionSubmission}
      setSelectedUsers={setSelectedUsers}
      inviteDialogOpen={inviteDialogOpen}
      setInviteDialogOpen={setInviteDialogOpen}
      isInviting={isInviting}
      setIsInviting={setIsInviting}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      newRoleName={newRoleName}
      setNewRoleName={setNewRoleName}
      newRoleDescription={newRoleDescription}
      setNewRoleDescription={setNewRoleDescription}
      addRoleDialogOpen={addRoleDialogOpen}
      setAddRoleDialogOpen={setAddRoleDialogOpen}
      blog={blog}
      bloggers={bloggers}
      rolesData={rolesData}
      isLoading={isLoading}
      isLoadingUsers={isLoadingUsers}
      error={error}
      user={user}
      currentUserId={currentUserId}
      can={can}
      canManageBloggers={canManageBloggers}
      existingBloggerIds={existingBloggerIds}
      filteredUsers={filteredUsers}
      toggleUserSelection={toggleUserSelection}
      handleInviteBloggers={handleInviteBloggers}
      handleUpdateRole={handleUpdateRole}
      handleRemoveBlogger={handleRemoveBlogger}
      handleToggleActionRight={handleToggleActionRight}
      handleCreateRole={handleCreateRole}
      handleDeleteRole={handleDeleteRole}
      filteredBloggers={filteredBloggers}
      activeBloggers={activeBloggers}
      invitedBloggers={invitedBloggers}
      requestedBloggers={requestedBloggers}
      getCreatedAt={getCreatedAt}
      invitedColumns={invitedColumns}
      activeColumns={activeColumns}
      requestedColumns={requestedColumns}
    />
  );
}
