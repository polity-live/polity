'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { Textarea } from '@/features/shared/ui/ui/textarea.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor.tsx';
import { VisibilitySelector } from '@/features/shared/ui/ui/visibility-selector.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select.tsx';
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
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import { useTodoActions } from '@/zero/todos/useTodoActions.ts';
import { toast } from 'sonner';
import { cn } from '@/features/shared/utils/utils.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { Todo } from '../types/todo.types';

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
type TodoVisibility = 'public' | 'authenticated' | 'private';

interface TodoFormData {
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string;
  tags: string[];
  visibility: TodoVisibility;
}

interface TodoDetailDialogProps {
  canManageTodos?: boolean;
  todo: Todo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getSelectedUserIds(todo: Todo): string[] {
  return (
    todo.assignments
      ?.map(assignment => assignment.user?.id)
      .filter((id): id is string => Boolean(id)) || []
  );
}

function getInitialFormData(todo: Todo): TodoFormData {
  return {
    title: todo.title || '',
    description: todo.description || '',
    status: (todo.status || 'pending') as TodoStatus,
    priority: (todo.priority || 'medium') as TodoPriority,
    dueDate: todo.due_date ? new Date(todo.due_date).toISOString().split('T')[0] : '',
    tags: todo.tags || [],
    visibility: (todo.visibility || 'private') as TodoVisibility,
  };
}

export function TodoDetailDialog({
  canManageTodos = true,
  todo,
  open,
  onOpenChange,
}: TodoDetailDialogProps) {
  const { t } = useTranslation();
  const { updateTodo, assignUser, unassignUser } = useTodoActions();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => getSelectedUserIds(todo));
  const [formData, setFormData] = useState<TodoFormData>(() => getInitialFormData(todo));

  const isOverdue = todo.due_date && todo.status !== 'completed' && todo.due_date < Date.now();
  const visibilityLabels: Record<TodoVisibility, string> = {
    public: t('common.visibility.public'),
    authenticated: t('common.visibility.authenticated'),
    private: t('common.visibility.private'),
  };

  // Query group members if the todo belongs to a group
  const { membershipsWithUsers: membershipsRaw } = useGroupState(
    todo.group?.id ? { groupId: todo.group.id, includeMembershipsWithUsers: true } : {}
  );

  const members = membershipsRaw || [];

  // Filter members based on search query
  const filteredMembers = members.filter(membership => {
    const user = membership.user;
    if (!user?.id) return false;
    const query = searchQuery.toLowerCase();
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return (
      displayName.toLowerCase().includes(query) ||
      user.handle?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setFormData(getInitialFormData(todo));
    setSelectedUserIds(getSelectedUserIds(todo));
    setSearchQuery('');
    setPopoverOpen(false);
    setIsEditing(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!canManageTodos) {
      return;
    }

    setIsSaving(true);
    try {
      const updates: Omit<Parameters<typeof updateTodo>[0], 'id'> = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.dueDate ? new Date(formData.dueDate).getTime() : null,
        tags: formData.tags,
        visibility: formData.visibility,
      };

      if (formData.status === 'completed' && todo.status !== 'completed') {
        updates.completed_at = Date.now();
      } else if (formData.status !== 'completed' && todo.status === 'completed') {
        updates.completed_at = null;
      }

      // Update todo
      await updateTodo({ id: todo.id, ...updates });

      // Handle assignment changes
      const currentAssignmentIds =
        todo.assignments?.map(a => a.user?.id).filter((x): x is string => Boolean(x)) || [];
      const addedUserIds = selectedUserIds.filter(id => !currentAssignmentIds.includes(id));
      const removedAssignments =
        todo.assignments?.filter(a => a.user?.id && !selectedUserIds.includes(a.user.id)) || [];

      // Remove old assignments
      for (const assignment of removedAssignments) {
        await unassignUser(assignment.id);
      }

      // Add new assignments
      for (const userId of addedUserIds) {
        const assignmentId = crypto.randomUUID();
        await assignUser({
          id: assignmentId,
          todo_id: todo.id,
          user_id: userId,
          role: 'assignee',
        });
      }

      // Mutations already executed above
      toast.success(t('features.todos.notifications.todoUpdated'));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update todo:', error);
      toast.error(t('features.todos.notifications.todoUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleRemoveAssignee = (userId: string) => {
    setSelectedUserIds(prev => prev.filter(id => id !== userId));
  };

  const handleAddAssignee = (userId: string) => {
    if (!selectedUserIds.includes(userId)) {
      setSelectedUserIds(prev => [...prev, userId]);
    }
    setPopoverOpen(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DialogTitle className="min-w-0 flex-1">
              {isEditing ? (
                <Input
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.close', 'Close')}
                >
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
              <label className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.status')}
              </label>
              {isEditing && canManageTodos ? (
                <Select
                  value={formData.status}
                  onValueChange={(v: TodoStatus) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4" />
                        {t('features.todos.status.pending')}
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {t('features.todos.status.inProgress')}
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('features.todos.status.completed')}
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelled">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {t('features.todos.status.cancelled')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <StatusIcon status={(todo.status ?? 'pending') as TodoStatus} />
                  <span className="capitalize">{(todo.status ?? '').replace('_', ' ')}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.priority')}
              </label>
              {isEditing && canManageTodos ? (
                <Select
                  value={formData.priority}
                  onValueChange={(v: TodoPriority) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-blue-500" />
                        {t('features.todos.priority.low')}
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-yellow-500" />
                        {t('features.todos.priority.medium')}
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-orange-500" />
                        {t('features.todos.priority.high')}
                      </div>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        {t('features.todos.priority.urgent')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <PriorityIcon priority={(todo.priority ?? 'medium') as TodoPriority} />
                  <PriorityBadge priority={(todo.priority ?? 'medium') as TodoPriority} />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t('features.todos.detail.description')}
            </label>
            {isEditing && canManageTodos ? (
              <Textarea
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
            <label className="mb-2 block text-sm font-medium">
              {t('features.todos.dueDate.title')}
            </label>
            {isEditing && canManageTodos ? (
              <Input
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
                  <Badge variant="destructive" className="ml-2">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {t('features.todos.status.overdue')}
                  </Badge>
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
                <label className="mb-2 block text-sm font-medium">
                  {t('common.visibility.label')}
                </label>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <VisibilityIcon visibility={(todo.visibility || 'private') as TodoVisibility} />
                  <span>{visibilityLabels[(todo.visibility || 'private') as TodoVisibility]}</span>
                </div>
              </div>
            )}
          </div>

          {/* Creator */}
          {todo.creator && (
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t('features.todos.detail.createdBy')}
              </label>
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
                    'Unknown'}
                </span>
              </Link>
            </div>
          )}

          {/* Assigned Users */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              <Users className="mr-2 inline h-4 w-4" />
              {t('features.todos.detail.assignedTo')}
            </label>
            {isEditing && canManageTodos ? (
              <div className="space-y-3">
                {/* Show currently selected users */}
                {selectedUserIds.length > 0 && (
                  <div className="space-y-2">
                    {selectedUserIds.map((userId: string) => {
                      const membership = members.find(m => m.user?.id === userId);
                      const user =
                        membership?.user ||
                        todo.assignments?.find(a => a.user?.id === userId)?.user;
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
                                'Unknown'}
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
                                m => m.user?.id != null && !selectedUserIds.includes(m.user.id)
                              )
                              .map(membership => {
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
                                          'Unknown'}
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
                {todo.assignments.map((assignment, idx: number) => (
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
                        'Unknown'}
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
              <label className="mb-2 block text-sm font-medium">
                <Building2 className="mr-2 inline h-4 w-4" />
                {t('features.todos.group.title')}
              </label>
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
                  <label className="mb-2 block text-sm font-medium">
                    <Tag className="mr-2 inline h-4 w-4" />
                    {t('features.todos.detail.tags')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(todo.tags ?? []).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {tag}
                      </Badge>
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
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="text-muted-foreground h-4 w-4" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function PriorityIcon({ priority }: { priority: TodoPriority }) {
  switch (priority) {
    case 'urgent':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'high':
      return <Flag className="h-3.5 w-3.5 text-orange-500" />;
    case 'medium':
      return <Flag className="h-3.5 w-3.5 text-yellow-500" />;
    case 'low':
      return <Flag className="h-3.5 w-3.5 text-blue-500" />;
  }
}

function PriorityBadge({ priority }: { priority: TodoPriority }) {
  const colors = {
    urgent: 'bg-red-500/10 text-red-500 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <Badge variant="outline" className={`${colors[priority]} capitalize`}>
      {priority}
    </Badge>
  );
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

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
