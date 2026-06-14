import { CheckSquare, Square, Users, Clock, UserPlus, Activity, UserCheck } from 'lucide-react';

import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';
import type { TodoStatus } from '@/features/todos/types/todo.types';
import type {
  TodoTimelineCardLabels,
  TodoTimelineCardTodo,
  TodoTimelineUrgency,
} from '../../types/todoTimelineCard.types';
import {
  TimelineCardActionButton,
  TimelineCardActions,
  TimelineCardBadge,
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardHeader,
} from './TimelineCardBase';

interface TodoTimelineCardViewProps {
  todo: TodoTimelineCardTodo;
  className?: string;
  canManageTodos: boolean;
  showStatusAction: boolean;
  detailHref?: string;
  onCardClick?: () => void;
  onToggle?: () => void;
  urgency: TodoTimelineUrgency | null;
  progress?: number;
  assignmentsCount: number;
  isAssignedToMe: boolean;
  currentStatus: TodoStatus;
  statusLabels: Record<TodoStatus, string>;
  statusOpen: boolean;
  onStatusOpenChange: (open: boolean) => void;
  onStatusUpdate: (status: TodoStatus) => Promise<void>;
  isStatusUpdating: boolean;
  assigning: boolean;
  onAssignToMe: () => Promise<void>;
  labels: TodoTimelineCardLabels;
}

export function TodoTimelineCardView({
  todo,
  className,
  canManageTodos,
  showStatusAction,
  detailHref,
  onCardClick,
  onToggle,
  urgency,
  progress,
  assignmentsCount,
  isAssignedToMe,
  currentStatus,
  statusLabels,
  statusOpen,
  onStatusOpenChange,
  onStatusUpdate,
  isStatusUpdating,
  assigning,
  onAssignToMe,
  labels,
}: TodoTimelineCardViewProps) {
  const displayedAssigneeCount = todo.assigneeCount ?? assignmentsCount;

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
        badge={<TimelineCardBadge label={labels.contentType} icon={CheckSquare} />}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canManageTodos ? (
            <Button
              type="button"
              variant="outline"
              onClick={event => {
                event.stopPropagation();
                onToggle?.();
              }}
              className="text-foreground h-auto gap-2 rounded-full border-white/70 bg-white/80 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-gray-700/70 dark:bg-gray-950/70 dark:text-gray-100 dark:hover:bg-gray-950"
            >
              {todo.isCompleted ? (
                <CheckSquare className="h-4 w-4 text-green-600" />
              ) : (
                <Square className="text-muted-foreground hover:text-primary h-4 w-4 transition-colors" />
              )}
              <span>{todo.isCompleted ? labels.completed : labels.markComplete}</span>
            </Button>
          ) : null}

          {urgency && !todo.isCompleted ? (
            <BadgeControl
              variant="outline"
              className={cn('text-xs', urgency.bgColor, urgency.color)}
            >
              <Clock className="mr-1 h-3 w-3" />
              {urgency.label}
            </BadgeControl>
          ) : null}
        </div>
      </TimelineCardHeader>

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {todo.description ? (
            <p
              className={cn(
                'text-muted-foreground line-clamp-2 text-sm',
                todo.isCompleted && 'line-through'
              )}
            >
              {todo.description}
            </p>
          ) : null}

          {progress !== undefined ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{labels.progress}</span>
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
          ) : null}

          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            {(todo.assigneeCount !== undefined || assignmentsCount > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">{displayedAssigneeCount}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {displayedAssigneeCount || 0} {labels.assigned}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {progress !== undefined ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="font-medium">{progress}%</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {progress}% {labels.progress}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {canManageTodos && showStatusAction ? (
          <Popover open={statusOpen} onOpenChange={onStatusOpenChange}>
            <PopoverTrigger asChild onClick={event => event.stopPropagation()}>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="text-xs">{statusLabels[currentStatus]}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-2"
              align="start"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                {(['pending', 'in_progress', 'completed', 'cancelled'] as TodoStatus[])
                  .filter(status => status !== currentStatus)
                  .map(status => (
                    <Button
                      key={status}
                      variant="ghost"
                      size="sm"
                      onClick={event => {
                        event.preventDefault();
                        void onStatusUpdate(status);
                      }}
                      disabled={isStatusUpdating}
                      className="justify-start"
                    >
                      {statusLabels[status]}
                    </Button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {canManageTodos ? (
          <TimelineCardActionButton
            icon={isAssignedToMe ? UserCheck : UserPlus}
            label={isAssignedToMe ? labels.assignedToMe : labels.assignToMe}
            onClick={event => {
              event?.preventDefault();
              event?.stopPropagation();
              void onAssignToMe();
            }}
            disabled={assigning || isAssignedToMe}
            variant={isAssignedToMe ? 'secondary' : 'outline'}
          />
        ) : null}

        <div onClick={event => event.preventDefault()}>
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
