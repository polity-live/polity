'use client';

import { useState } from 'react';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useUserState } from '@/zero/users/useUserState';
import { Button } from '@/features/shared/ui/ui/button';
import { ArrowLeft, UserPlus, UserX, Loader2, Plus, X, Check, Trash2, Shield } from 'lucide-react';
import {
  DataTable,
  EntityCell,
  MatrixCheckbox,
  MatrixTable,
  MatrixTableBody,
  MatrixTableCell,
  MatrixTableHead,
  MatrixTableHeader,
  MatrixTableRow,
  type ColumnDef,
} from '@/features/shared/ui/data-table';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { InlineCheckbox, SearchField, ValidatedField } from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { RoleBadge } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { NativeSelect } from '@/features/shared/ui/ui/native-select';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac/usePermissions';
import type { User } from '@/zero';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// Define available action rights for blogs
const ACTION_RIGHTS = [
  {
    resource: 'blogs',
    action: 'update',
    label: translateText('generated.inline.0036_update_blog_09ea894c'),
  },
  {
    resource: 'blogs',
    action: 'delete',
    label: translateText('generated.inline.0037_delete_blog_9c6feb0f'),
  },
  {
    resource: 'blogBloggers',
    action: 'manage',
    label: translateText('generated.inline.0038_manage_bloggers_58827569'),
  },
  {
    resource: 'notifications',
    action: 'viewNotifications',
    label: translateText('generated.inline.0039_view_notifications_26280ee0'),
  },
  {
    resource: 'notifications',
    action: 'manageNotifications',
    label: translateText('generated.inline.0040_manage_notifications_32133a0a'),
  },
];

function displayName(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'Unknown';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function initials(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'U';
  return u.first_name?.charAt(0) || u.last_name?.charAt(0) || 'U';
}

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
  const [activeTab, setActiveTab] = useState('bloggers');
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
    try {
      // Find Writer role ID
      const writerRole = rolesData.roles.find(r => r.name === 'Writer');
      if (!writerRole) {
        throw new Error('Writer role not found');
      }

      for (const userId of selectedUsers) {
        const bloggerId = crypto.randomUUID();
        await blogActions.createEntry({
          id: bloggerId,
          status: 'invited',
          user_id: userId,
          blog_id: blogId,
          role_id: writerRole.id,
          visibility: '',
        });
      }

      toast.success(
        `Invited ${selectedUsers.length} ${selectedUsers.length === 1 ? 'blogger' : 'bloggers'}`
      );

      // Reset state
      setSelectedUsers([]);
      setInviteSearchQuery('');
      setInviteDialogOpen(false);
    } catch (error) {
      console.error('Failed to invite bloggers:', error);
      toast.error(
        translateText('generated.inline.0227_failed_to_invite_bloggers_please_try_again_76577b9e')
      );
    } finally {
      setIsInviting(false);
    }
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
  const filteredBloggers = bloggers.filter(blogger => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      displayName(blogger.user).toLowerCase().includes(q) ||
      blogger.user?.handle?.toLowerCase().includes(q) ||
      blogger.user?.email?.toLowerCase().includes(q);

    return matchesSearch;
  });

  // Separate bloggers by status
  const activeBloggers = filteredBloggers.filter(b => b.status === 'member');
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
        <RoleBadge>
          {row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')}
        </RoleBadge>
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
          <RoleBadge>
            {row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')}
          </RoleBadge>
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
        <RoleBadge>
          {row.original.role?.name || translateText('generated.inline.0034_no_role_2e54b8e7')}
        </RoleBadge>
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold">
            {translateText('generated.inline.0239_blog_not_found_70b91de2')}
          </h2>
          <Button onClick={() => window.history.back()}>
            {translateText('generated.inline.0240_go_back_f03e2d07')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => window.history.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0241_back_to_blog_68c5e1c7')}
        </Button>
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.0242_manage_bloggers_58827569')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {translateText(
            'generated.inline.0243_manage_blogger_access_roles_and_permissions_f_1fb4db78'
          )}
          {blog.title}
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={translateText('generated.inline.0244_search_bloggers_98b779c5')}
            fieldClassName="flex-1"
          />
          {canManageBloggers && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0245_invite_bloggers_0224f12b')}
                </Button>
              </DialogTrigger>
              <ScrollableDialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {translateText('generated.inline.0245_invite_bloggers_0224f12b')}
                  </DialogTitle>
                  <DialogDescription>
                    {translateText(
                      'generated.inline.0246_search_and_select_users_to_invite_as_bloggers_c657d837'
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Command className="rounded-lg border">
                    <CommandInput
                      placeholder={translateText('generated.inline.0247_search_users_8cdc4c09')}
                      value={inviteSearchQuery}
                      onValueChange={setInviteSearchQuery}
                    />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>
                        {translateText('generated.inline.0248_no_users_found_e611ef57')}
                      </CommandEmpty>
                      <CommandGroup>
                        {isLoadingUsers ? (
                          <div className="p-4 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                          </div>
                        ) : (
                          filteredUsers?.map(u => (
                            <CommandItem
                              key={u.id}
                              className="flex cursor-pointer items-center space-x-2"
                              onSelect={() => toggleUserSelection(u.id)}
                            >
                              <InlineCheckbox
                                checked={selectedUsers.includes(u.id)}
                                onCheckedChange={() => toggleUserSelection(u.id)}
                              />
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={u.avatar || ''} />
                                <AvatarFallback>{initials(u)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="font-medium">{displayName(u)}</div>
                                <div className="text-muted-foreground text-sm">
                                  @
                                  {u.handle ||
                                    u.email ||
                                    translateText('generated.inline.0025_unknown_50d8b4a9')}
                                </div>
                              </div>
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  {selectedUsers.length > 0 && (
                    <div className="text-muted-foreground text-sm">
                      {translateText('generated.inline.0249_selected_2e084478')}
                      {selectedUsers.length}{' '}
                      {selectedUsers.length === 1
                        ? translateText('generated.inline.0026_user_12dea96f')
                        : translateText('generated.inline.0027_users_5b7dcd14')}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    {translateText('generated.inline.0065_cancel_77dfd213')}
                  </Button>
                  <Button
                    onClick={handleInviteBloggers}
                    disabled={selectedUsers.length === 0 || isInviting}
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {translateText('generated.inline.0113_inviting_dc7a6e8b')}
                      </>
                    ) : (
                      `Invite ${selectedUsers.length || ''} ${selectedUsers.length === 1 ? translateText('generated.inline.0032_blogger_9b156370') : translateText('generated.inline.0033_bloggers_06e71e76')}`
                    )}
                  </Button>
                </DialogFooter>
              </ScrollableDialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="bloggers">
            {translateText('generated.inline.0250_bloggers_4e649307')}
            {filteredBloggers.length})
          </TabsTrigger>
          <TabsTrigger value="roles">
            {translateText('generated.inline.0251_roles_a7aef93e')}
            {rolesData.roles.length})
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="bloggers" className="space-y-4">
          {/* Invited Bloggers */}
          {invitedBloggers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {translateText('generated.inline.0252_invited_bloggers_ab803262')}
                </CardTitle>
                <CardDescription>
                  {translateText(
                    'generated.inline.0116_users_who_have_been_invited_but_haven_t_accep_6522078d'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={invitedColumns}
                  data={invitedBloggers}
                  getRowId={blogger => blogger.id}
                  enablePagination={false}
                />
              </CardContent>
            </Card>
          )}

          {/* Active Bloggers */}
          <Card>
            <CardHeader>
              <CardTitle>
                {translateText('generated.inline.0253_active_bloggers_1806b44e')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0254_users_with_blogger_access_to_this_blog_89f5e930'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeBloggers.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  {bloggers.length === 0
                    ? translateText('generated.inline.0035_no_active_bloggers_yet_f9a61b2d')
                    : translateText(
                        'generated.inline.0036_no_active_bloggers_match_your_search_eae577bf'
                      )}
                </p>
              ) : (
                <DataTable
                  columns={activeColumns}
                  data={activeBloggers}
                  getRowId={blogger => blogger.id}
                  enablePagination={false}
                />
              )}
            </CardContent>
          </Card>

          {/* Pending Requests */}
          {requestedBloggers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {translateText('generated.inline.0256_pending_requests_45daa007')}
                </CardTitle>
                <CardDescription>
                  {translateText(
                    'generated.inline.0257_users_who_have_requested_to_be_bloggers_87cd4984'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={requestedColumns}
                  data={requestedBloggers}
                  getRowId={blogger => blogger.id}
                  enablePagination={false}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {translateText('generated.inline.0258_role_permissions_2dbfb26f')}
                  </CardTitle>
                  <CardDescription>
                    {translateText(
                      'generated.inline.0259_manage_roles_and_their_permissions_for_this_b_991517af'
                    )}
                  </CardDescription>
                </div>
                {canManageBloggers && (
                  <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        {translateText('generated.inline.0125_add_role_82d0afcc')}
                      </Button>
                    </DialogTrigger>
                    <ScrollableDialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {translateText('generated.inline.0126_add_new_role_241eb33f')}
                        </DialogTitle>
                        <DialogDescription>
                          {translateText(
                            'generated.inline.0260_create_a_new_role_with_custom_permissions_for_4c7a8490'
                          )}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <ValidatedField
                          label={translateText('generated.inline.0128_role_name_a8b23a08')}
                          placeholder={translateText(
                            'generated.inline.0261_e_g_editor_contributor_27c5d564'
                          )}
                          value={newRoleName}
                          onValueChange={setNewRoleName}
                          required
                        />
                        <ValidatedField
                          label={translateText(
                            'generated.inline.0130_description_optional_f1da5c02'
                          )}
                          placeholder={translateText(
                            'generated.inline.0131_describe_this_role_s_purpose_16c2c88f'
                          )}
                          value={newRoleDescription}
                          onValueChange={setNewRoleDescription}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAddRoleDialogOpen(false)}
                        >
                          {translateText('generated.inline.0065_cancel_77dfd213')}
                        </Button>
                        <Button type="button" onClick={handleCreateRole}>
                          {translateText('generated.inline.0132_create_role_5bea05a8')}
                        </Button>
                      </DialogFooter>
                    </ScrollableDialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {rolesData.roles && rolesData.roles.length > 0 ? (
                <div className="overflow-x-auto">
                  <MatrixTable>
                    <MatrixTableHeader>
                      <MatrixTableRow>
                        <MatrixTableHead className="min-w-[200px]">
                          {translateText('generated.inline.0262_permission_17857134')}
                        </MatrixTableHead>
                        {rolesData.roles.map(r => (
                          <MatrixTableHead key={r.id} className="min-w-[120px] text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-semibold">{r.name}</span>
                              {r.description && (
                                <span className="text-muted-foreground text-xs font-normal">
                                  {r.description}
                                </span>
                              )}
                              {canManageBloggers && r.name !== 'Owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 h-6 w-6 p-0"
                                  onClick={() => handleDeleteRole(r.id)}
                                >
                                  <Trash2 className="text-destructive h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </MatrixTableHead>
                        ))}
                      </MatrixTableRow>
                    </MatrixTableHeader>
                    <MatrixTableBody>
                      {ACTION_RIGHTS.map(({ resource, action, label }) => {
                        const rightKey = `${resource}-${action}`;
                        return (
                          <MatrixTableRow key={rightKey}>
                            <MatrixTableCell className="font-medium">{label}</MatrixTableCell>
                            {rolesData.roles.map(r => {
                              const hasRight = r.action_rights?.some(
                                ar => ar.resource === resource && ar.action === action
                              );
                              return (
                                <MatrixTableCell key={r.id} className="text-center">
                                  <div className="flex justify-center">
                                    <MatrixCheckbox
                                      checked={hasRight}
                                      disabled={!canManageBloggers}
                                      onCheckedChange={() =>
                                        handleToggleActionRight(r.id, resource, action, hasRight)
                                      }
                                    />
                                  </div>
                                </MatrixTableCell>
                              );
                            })}
                          </MatrixTableRow>
                        );
                      })}
                    </MatrixTableBody>
                  </MatrixTable>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Shield className="text-muted-foreground/50 mx-auto h-12 w-12" />
                  <p className="text-muted-foreground mt-4">
                    {translateText(
                      'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
