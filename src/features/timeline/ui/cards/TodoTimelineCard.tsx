'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useState } from 'react';
import { CheckSquare, Square, Users, Clock, UserPlus, Activity, UserCheck } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Button } from '@/features/shared/ui/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { differenceInDays, format, isPast, isToday } from 'date-fns';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import type { TodoStatus } from '@/features/todos/types/todo.types';
import { useAuth } from '@/providers/auth-provider';
import { useTodoActions } from '@/zero/todos/useTodoActions';
import { useTodoState } from '@/zero/todos/useTodoState';
import { toast } from 'sonner';
import { notifyStandaloneTodoAssigned } from '@/features/notifications/utils/notification-helpers.ts';
import {
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardActionButton,
  TimelineCardBadge,
  TimelineCardHeader,
} from './TimelineCardBase';

export interface TodoTimelineCardProps {
  todo: {
    id: string;
    title: string;
    description?: string;
    isCompleted?: boolean;
    dueDate?: string | number | Date;
    progress?: number; // 0-100
    currentValue?: number;
    targetValue?: number;
    unit?: string;
    assigneeCount?: number;
    groupName?: string;
    groupId?: string;
    status?: TodoStatus;
    visibility?: 'public' | 'authenticated' | 'private';
    creatorId?: string;
    creatorName?: string;
  };
  onToggle?: () => void;
  onVolunteer?: () => void;
  onShare?: () => void;
  className?: string;
  canManageTodos?: boolean;
  showStatusAction?: boolean;
  linkToDetail?: boolean;
  onCardClick?: () => void;
}

/**
 * Get urgency configuration based on due date
 */
function getUrgencyConfig(dueDate: Date): { color: string; bgColor: string; label: string } {
  const daysUntilDue = differenceInDays(dueDate, new Date());

  if (isPast(dueDate)) {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/40',
      label: translateText('generated.inline.0533_overdue_07217c77'),
    };
  }

  if (isToday(dueDate) || daysUntilDue === 0) {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/40',
      label: translateText('generated.inline.0534_due_today_e2219e75'),
    };
  }

  if (daysUntilDue <= 3) {
    return {
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/40',
      label: translateText('generated.inline.0535_due_in_daysuntildue_days_bb3b7b94', {
        daysUntilDue: daysUntilDue,
      }),
    };
  }

  if (daysUntilDue <= 7) {
    return {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
      label: translateText('generated.inline.0535_due_in_daysuntildue_days_bb3b7b94', {
        daysUntilDue: daysUntilDue,
      }),
    };
  }

  return {
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    label: format(dueDate, 'MMM d'),
  };
}

/**
 * TodoTimelineCard - The Action Item card
 *
 * Displays a shared/community todo with:
 * - Checkbox visual for completion status
 * - Title and description
 * - Urgency badge (color-coded by due date)
 * - Progress bar (if applicable)
 * - Assignee count
 * - Actions: View, Volunteer, Share
 */
export function TodoTimelineCard({
  todo,
  onToggle,
  className,
  canManageTodos = true,
  showStatusAction = true,
  linkToDetail = true,
  onCardClick,
}: TodoTimelineCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [statusOpen, setStatusOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const { updateTodo, isLoading } = useTodoMutations();
  const { assignUser } = useTodoActions();
  const { assignments: assignmentsRaw } = useTodoState({ todoId: todo.id });

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
  const urgency = dueDate ? getUrgencyConfig(dueDate) : null;
  const progress =
    todo.progress ??
    (todo.currentValue && todo.targetValue
      ? Math.round((todo.currentValue / todo.targetValue) * 100)
      : undefined);
  const assignments = assignmentsRaw ?? [];
  const isAssignedToMe = !!user?.id && assignments.some(a => a.user?.id === user.id);
  const detailHref = linkToDetail ? `/todos/${todo.id}` : undefined;

  const currentStatus = todo.status || (todo.isCompleted ? 'completed' : 'pending');
  const statusLabels: Record<TodoStatus, string> = {
    pending: t('features.todos.status.pending'),
    in_progress: t('features.todos.status.in_progress'),
    completed: t('features.todos.status.completed'),
    cancelled: t('features.todos.status.cancelled'),
  };

  const handleStatusUpdate = async (newStatus: TodoStatus) => {
    await updateTodo(
      todo.id,
      { status: newStatus },
      {
        senderId: user?.id,
        senderName: user?.email?.split('@')[0] || 'Someone',
        creatorId: todo.creatorId,
        todoTitle: todo.title,
        visibility: todo.visibility,
      }
    );
    setStatusOpen(false);
  };

  const handleAssignToMe = async () => {
    if (!user?.id) {
      toast.error(t('features.todos.kanban.updateFailed'));
      return;
    }
    if (isAssignedToMe) {
      toast.success(t('features.todos.assignee.assignedToMe'));
      return;
    }
    setAssigning(true);
    try {
      const assignmentId = crypto.randomUUID();
      await assignUser({
        id: assignmentId,
        todo_id: todo.id,
        user_id: user.id,
        role: 'assignee',
      });

      // Notify the todo creator that someone volunteered
      if (todo.creatorId && todo.creatorId !== user.id) {
        await notifyStandaloneTodoAssigned({
          senderId: user.id,
          recipientUserId: todo.creatorId,
          todoId: todo.id,
          todoTitle: todo.title || 'Todo',
        });
      }

      toast.success(t('features.todos.assignee.assignedToMe'));
    } catch (error) {
      console.error('Failed to assign todo:', error);
      toast.error(t('features.todos.kanban.updateFailed'));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <TimelineCardBase
      contentType="todo"
      className={className}
      href={detailHref}
      onClick={onCardClick}
    >
      <TimelineCardHeader
        contentType="todo"
        title={todo.title}
        href={detailHref}
        subtitle={todo.groupName}
        subtitleHref={todo.groupId ? `/group/${todo.groupId}` : undefined}
        badge={
          <TimelineCardBadge label={t('features.timeline.contentTypes.todo')} icon={CheckSquare} />
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canManageTodos ? (
            <button
              onClick={e => {
                e.stopPropagation();
                onToggle?.();
              }}
              className="text-foreground inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-gray-700/70 dark:bg-gray-950/70 dark:text-gray-100 dark:hover:bg-gray-950"
            >
              {todo.isCompleted ? (
                <CheckSquare className="h-4 w-4 text-green-600" />
              ) : (
                <Square className="text-muted-foreground hover:text-primary h-4 w-4 transition-colors" />
              )}
              <span>
                {todo.isCompleted
                  ? t('features.todos.status.completed')
                  : t('features.todos.actions.markComplete')}
              </span>
            </button>
          ) : null}

          {urgency && !todo.isCompleted && (
            <BadgeControl
              variant="outline"
              className={cn('text-xs', urgency.bgColor, urgency.color)}
            >
              <Clock className="mr-1 h-3 w-3" />
              {urgency.label}
            </BadgeControl>
          )}
        </div>
      </TimelineCardHeader>

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {todo.description && (
            <p
              className={cn(
                'text-muted-foreground line-clamp-2 text-sm',
                todo.isCompleted && 'line-through'
              )}
            >
              {todo.description}
            </p>
          )}

          {/* Progress Bar */}
          {progress !== undefined && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('features.timeline.cards.progress')}
                </span>
                <span className="font-medium">
                  {todo.currentValue !== undefined && todo.targetValue !== undefined
                    ? `${todo.currentValue} / ${todo.targetValue}${todo.unit ? ` ${todo.unit}` : ''}`
                    : `${progress}%`}
                </span>
              </div>
              <Progress
                value={progress}
                className={cn('h-2', progress >= 100 && '[&>div]:bg-green-500')}
              />
            </div>
          )}

          {/* Meta Info */}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            {(todo.assigneeCount !== undefined || assignments.length > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">{todo.assigneeCount ?? assignments.length}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {(todo.assigneeCount ?? assignments.length) || 0}{' '}
                    {t('features.timeline.cards.assigned')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {progress !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="font-medium">{progress}%</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {progress}% {t('features.timeline.cards.progress')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {canManageTodos && showStatusAction && (
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="text-xs">{statusLabels[currentStatus]}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                {(['pending', 'in_progress', 'completed', 'cancelled'] as TodoStatus[])
                  .filter(status => status !== currentStatus)
                  .map(status => (
                    <Button
                      key={status}
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.preventDefault();
                        handleStatusUpdate(status);
                      }}
                      disabled={isLoading}
                      className="justify-start"
                    >
                      {statusLabels[status]}
                    </Button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {canManageTodos ? (
          <TimelineCardActionButton
            icon={isAssignedToMe ? UserCheck : UserPlus}
            label={
              isAssignedToMe
                ? t('features.todos.assignee.assignedToMe')
                : t('features.todos.assignee.assignToMe')
            }
            onClick={e => {
              e?.preventDefault();
              e?.stopPropagation();
              handleAssignToMe();
            }}
            disabled={assigning || isAssignedToMe}
            variant={isAssignedToMe ? 'secondary' : 'outline'}
          />
        ) : null}

        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={`/todos/${todo.id}`}
            title={todo.title}
            description={todo.description || ''}
            variant="outline"
            size="sm"
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}
