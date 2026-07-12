'use client';

import type { CSSProperties } from 'react';

import { Button } from '@/features/shared/ui/ui/button';
import { UserPlus, Plus, Trash2, Shield } from 'lucide-react';
import {
  DataTable,
  MatrixCheckbox,
  MatrixTable,
  MatrixTableBody,
  MatrixTableCell,
  MatrixTableHead,
  MatrixTableHeader,
  MatrixTableRow,
} from '@/features/shared/ui/data-table';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { InlineCheckbox, SearchField, ValidatedField } from '@/features/shared/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { RoleTag } from '@/features/groups/ui/RoleTag';
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
  ActionSubmissionOverlay,
  type ActionSubmissionController,
} from '@/features/shared/ui/action-submission';
import { ParticipationRoleFilterBar } from '@/features/shared/ui/participation';
import { PageSkeleton, SectionSkeleton } from '@/features/shared/ui/feedback';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import type { User } from '@/zero';
import { BLOG_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

function displayName(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'Unknown';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function initials(u: Pick<User, 'first_name' | 'last_name'> | undefined | null): string {
  if (!u) return 'U';
  return u.first_name?.charAt(0) || u.last_name?.charAt(0) || 'U';
}
export interface BlogBloggersManagerViewProps {
  blogId: any;
  blogActions: any;
  groupActions: any;
  blogWithManagement: any;
  allUsers: any;
  actionSubmission: ActionSubmissionController;
  usersData: any;
  searchQuery: any;
  setSearchQuery: any;
  selectedRoleIds: string[];
  setSelectedRoleIds: (roleIds: string[]) => void;
  inviteSearchQuery: any;
  setInviteSearchQuery: any;
  selectedUsers: any;
  setSelectedUsers: any;
  inviteDialogOpen: any;
  setInviteDialogOpen: any;
  isInviting: any;
  setIsInviting: any;
  activeTab: any;
  setActiveTab: any;
  newRoleName: any;
  setNewRoleName: any;
  newRoleDescription: any;
  setNewRoleDescription: any;
  addRoleDialogOpen: any;
  setAddRoleDialogOpen: any;
  blog: any;
  bloggers: any;
  rolesData: any;
  isLoading: any;
  isLoadingUsers: any;
  error: any;
  user: any;
  currentUserId: any;
  can: any;
  canManageBloggers: any;
  existingBloggerIds: any;
  filteredUsers: any;
  toggleUserSelection: any;
  handleInviteBloggers: any;
  handleUpdateRole: any;
  handleRemoveBlogger: any;
  handleToggleActionRight: any;
  handleCreateRole: any;
  handleDeleteRole: any;
  filteredBloggers: any;
  activeBloggers: any;
  invitedBloggers: any;
  requestedBloggers: any;
  getCreatedAt: any;
  invitedColumns: any;
  activeColumns: any;
  requestedColumns: any;
}

export function BlogBloggersManagerView({
  allUsers,
  actionSubmission,
  searchQuery,
  setSearchQuery,
  selectedRoleIds,
  setSelectedRoleIds,
  inviteSearchQuery,
  setInviteSearchQuery,
  selectedUsers,
  inviteDialogOpen,
  setInviteDialogOpen,
  isInviting,
  activeTab,
  setActiveTab,
  newRoleName,
  setNewRoleName,
  newRoleDescription,
  setNewRoleDescription,
  addRoleDialogOpen,
  setAddRoleDialogOpen,
  blog,
  bloggers,
  rolesData,
  isLoading,
  isLoadingUsers,
  error,
  canManageBloggers,
  filteredUsers,
  toggleUserSelection,
  handleInviteBloggers,
  handleToggleActionRight,
  handleCreateRole,
  handleDeleteRole,
  filteredBloggers,
  activeBloggers,
  invitedBloggers,
  requestedBloggers,
  invitedColumns,
  activeColumns,
  requestedColumns,
}: BlogBloggersManagerViewProps) {
  const submissionActive = actionSubmission.isActive;
  const selectedPeople = (allUsers ?? [])
    .filter((selectedUser: any) => selectedUsers.includes(selectedUser.id))
    .map((selectedUser: any) => ({
      id: selectedUser.id,
      name: displayName(selectedUser),
      avatar: selectedUser.avatar,
    }));

  if (isLoading) {
    return <PageSkeleton variant="settings" />;
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
      <div className="mb-4">
        <SearchField
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={translateText('generated.inline.0244_search_bloggers_98b779c5')}
        />
      </div>
      {activeTab !== 'roles' && rolesData.roles.length > 0 ? (
        <ParticipationRoleFilterBar
          roles={rolesData.roles}
          selectedRoleIds={selectedRoleIds}
          onSelectedRoleIdsChange={setSelectedRoleIds}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ScrollableTabsList>
            <TabsTrigger value="bloggers">
              {`${translateText('generated.inline.0250_bloggers_4e649307')} (${filteredBloggers.length})`}
            </TabsTrigger>
            <TabsTrigger value="roles">
              {`${translateText('generated.inline.0251_roles_a7aef93e')} (${rolesData.roles.length})`}
            </TabsTrigger>
          </ScrollableTabsList>
          {canManageBloggers ? (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0245_invite_bloggers_0224f12b')}
                </Button>
              </DialogTrigger>
              <ScrollableDialogContent
                showCloseButton={!submissionActive}
                className={
                  submissionActive
                    ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
                    : 'max-w-2xl'
                }
              >
                {!submissionActive ? (
                  <>
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
                              <SectionSkeleton rows={3} density="compact" className="p-2" />
                            ) : (
                              filteredUsers?.map((u: any) => (
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
                      {selectedUsers.length > 0 ? (
                        <div className="text-muted-foreground text-sm">
                          {translateText('generated.inline.0249_selected_2e084478')}
                          {selectedUsers.length}{' '}
                          {selectedUsers.length === 1
                            ? translateText('generated.inline.0026_user_12dea96f')
                            : translateText('generated.inline.0027_users_5b7dcd14')}
                        </div>
                      ) : null}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        {translateText('generated.inline.0065_cancel_77dfd213')}
                      </Button>
                      <Button
                        onClick={handleInviteBloggers}
                        disabled={selectedUsers.length === 0 || isInviting}
                      >
                        {`Invite ${selectedUsers.length || ''} ${selectedUsers.length === 1 ? translateText('generated.inline.0032_blogger_9b156370') : translateText('generated.inline.0033_bloggers_06e71e76')}`}
                      </Button>
                    </DialogFooter>
                  </>
                ) : null}
                <ActionSubmissionOverlay
                  kind="invite"
                  status={actionSubmission.status}
                  steps={actionSubmission.progressSteps}
                  error={actionSubmission.error}
                  preview={{
                    entityLabel: translateText('generated.inline.0245_invite_bloggers_0224f12b'),
                    title:
                      blog.title || translateText('generated.inline.0245_invite_bloggers_0224f12b'),
                    description: translateText(
                      'generated.inline.0246_search_and_select_users_to_invite_as_bloggers_c657d837'
                    ),
                    people: selectedPeople,
                    badges: ['Writer'],
                  }}
                  target={{
                    label: translateText('common.done', 'Fertig'),
                    onClick: actionSubmission.reset,
                  }}
                  onBack={actionSubmission.reset}
                  onRetry={() => void actionSubmission.retry()}
                />
              </ScrollableDialogContent>
            </Dialog>
          ) : null}
        </div>

        <TabsContent value="bloggers" className="space-y-4">
          {/* Invited Bloggers */}
          {invitedBloggers.length > 0 ? (
            <section
              className="civic-load-card-reveal space-y-3"
              style={{ '--civic-load-index': 0 } as CSSProperties}
            >
              <div className="space-y-1.5 px-3 sm:px-4">
                <h2 className="text-base leading-none font-semibold">
                  {translateText('generated.inline.0252_invited_bloggers_ab803262')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0116_users_who_have_been_invited_but_haven_t_accep_6522078d'
                  )}
                </p>
              </div>
              <DataTable
                columns={invitedColumns}
                data={invitedBloggers}
                getRowId={(blogger: any) => blogger.id}
                enablePagination={false}
              />
            </section>
          ) : null}

          {/* Active Bloggers */}
          <section
            className="civic-load-card-reveal space-y-3"
            style={{ '--civic-load-index': 1 } as CSSProperties}
          >
            <div className="space-y-1.5 px-3 sm:px-4">
              <h2 className="text-base leading-none font-semibold">
                {translateText('generated.inline.0253_active_bloggers_1806b44e')}
              </h2>
              <p className="text-muted-foreground text-sm">
                {translateText(
                  'generated.inline.0254_users_with_blogger_access_to_this_blog_89f5e930'
                )}
              </p>
            </div>
            <DataTable
              columns={activeColumns}
              data={activeBloggers}
              getRowId={(blogger: any) => blogger.id}
              enablePagination={false}
              emptyTitle={
                bloggers.length === 0
                  ? translateText('generated.inline.0035_no_active_bloggers_yet_f9a61b2d')
                  : translateText(
                      'generated.inline.0036_no_active_bloggers_match_your_search_eae577bf'
                    )
              }
            />
          </section>

          {/* Pending Requests */}
          {requestedBloggers.length > 0 ? (
            <section
              className="civic-load-card-reveal space-y-3"
              style={{ '--civic-load-index': 2 } as CSSProperties}
            >
              <div className="space-y-1.5 px-3 sm:px-4">
                <h2 className="text-base leading-none font-semibold">
                  {translateText('generated.inline.0256_pending_requests_45daa007')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0257_users_who_have_requested_to_be_bloggers_87cd4984'
                  )}
                </p>
              </div>
              <DataTable
                columns={requestedColumns}
                data={requestedBloggers}
                getRowId={(blogger: any) => blogger.id}
                enablePagination={false}
              />
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4">
              <div className="space-y-1.5">
                <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
                  <Shield className="h-5 w-5" />
                  {translateText('generated.inline.0258_role_permissions_2dbfb26f')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0259_manage_roles_and_their_permissions_for_this_b_991517af'
                  )}
                </p>
              </div>
              {canManageBloggers ? (
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
                        label={translateText('generated.inline.0130_description_optional_f1da5c02')}
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
              ) : null}
            </div>
            {rolesData.roles && rolesData.roles.length > 0 ? (
              <div className="bg-card border-border/70 overflow-x-auto rounded-md border shadow-[var(--shadow-panel)]">
                <MatrixTable>
                  <MatrixTableHeader>
                    <MatrixTableRow>
                      <MatrixTableHead className="min-w-[200px]">
                        {translateText('generated.inline.0262_permission_17857134')}
                      </MatrixTableHead>
                      {rolesData.roles.map((r: any) => (
                        <MatrixTableHead key={r.id} className="min-w-[120px] text-center">
                          <div className="flex flex-col items-center gap-1">
                            <RoleTag roleId={r.id} roleName={r.name || 'Role'} />
                            {r.description ? (
                              <span className="text-muted-foreground text-xs font-normal">
                                {r.description}
                              </span>
                            ) : null}
                            {canManageBloggers && r.name !== 'Owner' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-6 w-6 p-0"
                                onClick={() => handleDeleteRole(r.id)}
                              >
                                <Trash2 className="text-destructive h-3 w-3" />
                              </Button>
                            ) : null}
                          </div>
                        </MatrixTableHead>
                      ))}
                    </MatrixTableRow>
                  </MatrixTableHeader>
                  <MatrixTableBody>
                    {BLOG_ACTION_RIGHTS.map(({ resource, action, label }) => {
                      const rightKey = `${resource}-${action}`;
                      return (
                        <MatrixTableRow key={rightKey}>
                          <MatrixTableCell className="font-medium">{label}</MatrixTableCell>
                          {rolesData.roles.map((r: any) => {
                            const hasRight = r.action_rights?.some(
                              (ar: any) => ar.resource === resource && ar.action === action
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
              <div className="bg-card border-border/70 rounded-md border py-12 text-center shadow-[var(--shadow-panel)]">
                <Shield className="text-muted-foreground/50 mx-auto h-12 w-12" />
                <p className="text-muted-foreground mt-4">
                  {translateText(
                    'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
                  )}
                </p>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
