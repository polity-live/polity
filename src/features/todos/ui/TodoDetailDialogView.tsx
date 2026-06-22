'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, TodoPriorityBadge, TodoPriorityIcon } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlLabel,
  FormControlTextarea,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/features/shared/ui/ui/dialog.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilitySelector } from '@/features/shared/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover.tsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command.tsx';
import {
  Calendar,
  Tag,
  Users,
  Globe,
  Building2,
  Edit,
  Save,
  Lock,
  X,
  AlertCircle,
  Flag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
  UserPlus,
  Trash2,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/features/shared/utils/utils.ts';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
type TodoVisibility = 'public' | 'authenticated' | 'private';
function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="text-muted-foreground h-4 w-4" />;
    case 'in_progress':
      return <Clock className={featureThemeClassName('eventCancelEventDialogInfoIcon')} />;
    case 'completed':
      return (
        <CheckCircle2 className={featureThemeClassName('agendaAgendaElectionSectionSuccessIcon')} />
      );
    case 'cancelled':
      return <XCircle className={featureThemeClassName('paymentSubscriptionStatusDangerIcon')} />;
  }
}

function VisibilityIcon({ visibility }: { visibility: TodoVisibility }) {
  switch (visibility) {
    case 'public':
      return <Globe className="text-muted-foreground h-4 w-4" />;
    case 'authenticated':
      return <Users className="text-muted-foreground h-4 w-4" />;
    case 'private':
      return <Lock className="text-muted-foreground h-4 w-4" />;
  }
}

function formatDate(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp));
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return translateText('features.todos.dueDate.today');
  if (diffDays === 1) return translateText('features.todos.dueDate.tomorrow');
  if (diffDays === -1) return translateText('features.todos.dueDate.yesterday');
  if (diffDays > 0 && diffDays <= 7) {
    return translateText('features.todos.dueDate.inDays', { count: diffDays });
  }
  if (diffDays < 0 && diffDays >= -7) {
    return translateText('features.todos.dueDate.daysAgo', { count: Math.abs(diffDays) });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface TodoDetailDialogViewProps {
  canManageTodos: any;
  todo: any;
  open: any;
  onOpenChange: any;
  t: any;
  updateTodo: any;
  assignUser: any;
  unassignUser: any;
  isEditing: any;
  setIsEditing: any;
  isSaving: any;
  setIsSaving: any;
  searchQuery: any;
  setSearchQuery: any;
  popoverOpen: any;
  setPopoverOpen: any;
  selectedUserIds: any;
  setSelectedUserIds: any;
  formData: any;
  setFormData: any;
  isOverdue: any;
  visibilityLabels: any;
  membershipsRaw: any;
  members: any;
  filteredMembers: any;
  resetForm: any;
  handleDialogOpenChange: any;
  handleSave: any;
  handleCancel: any;
  handleRemoveAssignee: any;
  handleAddAssignee: any;
}

export function TodoDetailDialogView({
  canManageTodos,
  todo,
  open,
  t,
  isEditing,
  setIsEditing,
  isSaving,
  searchQuery,
  setSearchQuery,
  popoverOpen,
  setPopoverOpen,
  selectedUserIds,
  formData,
  setFormData,
  isOverdue,
  visibilityLabels,
  members,
  filteredMembers,
  handleDialogOpenChange,
  handleSave,
  handleCancel,
  handleRemoveAssignee,
  handleAddAssignee,
}: TodoDetailDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <ScrollableDialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
      >
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DialogTitle className="min-w-0 flex-1">
              {isEditing ? (
                <FormControlInput
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="text-2xl font-bold"
                  placeholder={t('features.todos.detail.todoTitle')}
                />
              ) : (
                <span className="text-2xl">{formData.title}</span>
              )}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
              {isEditing && canManageTodos ? (
                <>
                  <Button onClick={handleSave} disabled={isSaving} size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    {t('features.todos.detail.save')}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm" disabled={isSaving}>
                    <X className="mr-2 h-4 w-4" />
                    {t('features.todos.detail.cancel')}
                  </Button>
                </>
              ) : canManageTodos ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('features.todos.actions.edit')}
                </Button>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={t('common.close')}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormControlLabel className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.status')}
              </FormControlLabel>
              {isEditing && canManageTodos ? (
                <FormControlSelect
                  value={formData.status}
                  onValueChange={(v: TodoStatus) => setFormData({ ...formData, status: v })}
                >
                  <FormControlSelectTrigger>
                    <FormControlSelectValue />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    <FormControlSelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4" />
                        {t('features.todos.status.pending')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {t('features.todos.status.inProgress')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('features.todos.status.completed')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="cancelled">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {t('features.todos.status.cancelled')}
                      </div>
                    </FormControlSelectItem>
                  </FormControlSelectContent>
                </FormControlSelect>
              ) : (
                <div className="flex items-center gap-2">
                  <StatusIcon status={(todo.status ?? 'pending') as TodoStatus} />
                  <span className="capitalize">{(todo.status ?? '').replace('_', ' ')}</span>
                </div>
              )}
            </div>

            <div>
              <FormControlLabel className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.priority')}
              </FormControlLabel>
              {isEditing && canManageTodos ? (
                <FormControlSelect
                  value={formData.priority}
                  onValueChange={(v: TodoPriority) => setFormData({ ...formData, priority: v })}
                >
                  <FormControlSelectTrigger>
                    <FormControlSelectValue />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    <FormControlSelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className={featureThemeClassName('eventCancelEventDialogInfoIcon')} />
                        {t('features.todos.priority.low')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag
                          className={featureThemeClassName(
                            'agendaAgendaElectionSectionWarningIcon'
                          )}
                        />
                        {t('features.todos.priority.medium')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag
                          className={featureThemeClassName('positionPositionsTableWarningIcon')}
                        />
                        {t('features.todos.priority.high')}
                      </div>
                    </FormControlSelectItem>
                    <FormControlSelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <AlertCircle
                          className={featureThemeClassName('paymentSubscriptionStatusDangerIcon')}
                        />
                        {t('features.todos.priority.urgent')}
                      </div>
                    </FormControlSelectItem>
                  </FormControlSelectContent>
                </FormControlSelect>
              ) : (
                <div className="flex items-center gap-2">
                  <TodoPriorityIcon priority={(todo.priority ?? 'medium') as TodoPriority} />
                  <TodoPriorityBadge priority={(todo.priority ?? 'medium') as TodoPriority} />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <FormControlLabel className="mb-2 block text-sm font-medium">
              {t('features.todos.detail.description')}
            </FormControlLabel>
            {isEditing && canManageTodos ? (
              <FormControlTextarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('features.todos.detail.addDescription')}
                rows={6}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {todo.description || t('features.todos.detail.noDescription')}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <FormControlLabel className="mb-2 block text-sm font-medium">
              {t('features.todos.dueDate.title')}
            </FormControlLabel>
            {isEditing && canManageTodos ? (
              <FormControlInput
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            ) : todo.due_date ? (
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                  {formatDate(todo.due_date)}
                </span>
                {isOverdue && (
                  <BadgeControl variant="destructive" className="ml-2">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {t('features.todos.status.overdue')}
                  </BadgeControl>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('features.todos.detail.noDueDateSet')}
              </p>
            )}
          </div>

          {/* Visibility */}
          <div>
            {isEditing && canManageTodos ? (
              <VisibilitySelector
                value={formData.visibility}
                onChange={visibility => setFormData({ ...formData, visibility })}
              />
            ) : (
              <div>
                <FormControlLabel className="mb-2 block text-sm font-medium">
                  {t('common.visibility.label')}
                </FormControlLabel>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <VisibilityIcon visibility={(todo.visibility || 'private') as TodoVisibility} />
                  <span>
                    {
                      visibilityLabels[
                        (todo.visibility ||
                          translateText('generated.inline.0173_private_e8072179')) as TodoVisibility
                      ]
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Creator */}
          {todo.creator && (
            <div>
              <FormControlLabel className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.createdBy')}
              </FormControlLabel>
              <Link
                to="/user/$id"
                params={{ id: todo.creator.id }}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={todo.creator.avatar ?? undefined} />
                  <AvatarFallback>
                    {(todo.creator.first_name?.[0] || todo.creator.email?.[0])?.toUpperCase() ||
                      '?'}
                  </AvatarFallback>
                </Avatar>
                <span>
                  {[todo.creator.first_name, todo.creator.last_name].filter(Boolean).join(' ') ||
                    todo.creator.email?.split('@')[0] ||
                    translateText('generated.inline.0031_unknown_bc7819b3')}
                </span>
              </Link>
            </div>
          )}

          {/* Assigned Users */}
          <div>
            <FormControlLabel className="mb-2 block text-sm font-medium">
              <Users className="mr-2 inline h-4 w-4" />
              {t('features.todos.detail.assignedTo')}
            </FormControlLabel>
            {isEditing && canManageTodos ? (
              <div className="space-y-3">
                {/* Show currently selected users */}
                {selectedUserIds.length > 0 && (
                  <div className="space-y-2">
                    {selectedUserIds.map((userId: string) => {
                      const membership = members.find((m: any) => m.user?.id === userId);
                      const user =
                        membership?.user ||
                        todo.assignments?.find((a: any) => a.user?.id === userId)?.user;
                      if (!user) return null;
                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={user.avatar ?? undefined} />
                              <AvatarFallback>
                                {(user.first_name?.[0] || user.email?.[0])?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                                user.email?.split('@')[0] ||
                                translateText('generated.inline.0031_unknown_bc7819b3')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAssignee(userId)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Add user button */}
                {todo.group?.id && (
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        disabled={!members.length}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('features.todos.assignee.addAssignee')}
                        <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={t('features.todos.assignee.searchMembers')}
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>{t('features.todos.assignee.noMembersFound')}</CommandEmpty>
                          <CommandGroup>
                            {filteredMembers
                              .filter(
                                (m: any) =>
                                  m.user?.id != null && !selectedUserIds.includes(m.user.id)
                              )
                              .map((membership: any) => {
                                const user = membership.user;
                                if (!user) return null;
                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={user.id}
                                    onSelect={() => handleAddAssignee(user.id)}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedUserIds.includes(user.id)
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <Avatar className="mr-2 h-6 w-6">
                                      <AvatarImage src={user.avatar ?? undefined} />
                                      <AvatarFallback>
                                        {(user.first_name?.[0] || user.email?.[0])?.toUpperCase() ||
                                          'U'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">
                                        {[user.first_name, user.last_name]
                                          .filter(Boolean)
                                          .join(' ') ||
                                          user.handle ||
                                          translateText('generated.inline.0031_unknown_bc7819b3')}
                                      </span>
                                      {user.email && (
                                        <span className="text-muted-foreground text-xs">
                                          {user.email}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ) : todo.assignments && todo.assignments.length > 0 ? (
              <div className="space-y-2">
                {todo.assignments.map((assignment: any, idx: number) => (
                  <Link
                    key={idx}
                    to="/user/$id"
                    params={{ id: assignment.user?.id ?? '' }}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={assignment.user?.avatar ?? undefined} />
                      <AvatarFallback>
                        {(
                          assignment.user?.first_name?.[0] || assignment.user?.email?.[0]
                        )?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {[assignment.user?.first_name, assignment.user?.last_name]
                        .filter(Boolean)
                        .join(' ') ||
                        assignment.user?.email?.split('@')[0] ||
                        translateText('generated.inline.0031_unknown_bc7819b3')}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('features.todos.assignee.noUsersAssigned')}
              </p>
            )}
          </div>

          {/* Group */}
          {todo.group && (
            <div>
              <FormControlLabel className="mb-2 block text-sm font-medium">
                <Building2 className="mr-2 inline h-4 w-4" />
                {t('features.todos.group.title')}
              </FormControlLabel>
              <Link
                to="/group/$id"
                params={{ id: todo.group.id }}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={todo.group.image_url ?? undefined} />
                  <AvatarFallback>{todo.group.name?.[0]?.toUpperCase() || 'G'}</AvatarFallback>
                </Avatar>
                <span>{todo.group.name}</span>
              </Link>
            </div>
          )}

          {/* Tags */}
          {(isEditing || (todo.tags && todo.tags.length > 0)) && (
            <div>
              {isEditing && canManageTodos ? (
                <HashtagEditor
                  value={formData.tags}
                  onChange={tags => setFormData({ ...formData, tags })}
                  label={t('features.todos.detail.tags')}
                  placeholder={t('pages.create.todo.tagPlaceholder')}
                />
              ) : (
                <>
                  <FormControlLabel className="mb-2 block text-sm font-medium">
                    <Tag className="mr-2 inline h-4 w-4" />
                    {t('features.todos.detail.tags')}
                  </FormControlLabel>
                  <div className="flex flex-wrap gap-2">
                    {(todo.tags ?? []).map((tag: string, idx: number) => (
                      <BadgeControl key={idx} variant="secondary">
                        {tag}
                      </BadgeControl>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="text-muted-foreground border-t pt-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                {t('features.todos.detail.created')}:{' '}
                {todo.created_at ? new Date(todo.created_at).toLocaleString() : 'N/A'}
              </div>
              <div>
                {t('features.todos.detail.updated')}:{' '}
                {todo.updated_at ? new Date(todo.updated_at).toLocaleString() : 'N/A'}
              </div>
              {todo.completed_at && (
                <div className="col-span-2">
                  {t('features.todos.status.completed')}:{' '}
                  {new Date(todo.completed_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
