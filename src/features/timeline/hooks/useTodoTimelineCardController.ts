import { featureThemeClassName } from '@/features/shared/theme';
import { useState } from 'react';
import { differenceInDays, format, isPast, isToday } from 'date-fns';
import { toast } from '@/features/shared/ui/ui/sonner';

import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import type { TodoStatus } from '@/features/todos/types/todo.types';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useTodoActions } from '@/zero/todos/useTodoActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { useTodoState } from '@/zero/todos/useTodoState';
import { notifyStandaloneTodoAssigned } from '@/features/notifications/utils/notification-helpers.ts';
import type { TodoTimelineCardTodo, TodoTimelineUrgency } from '../types/todoTimelineCard.types';

function getUrgencyConfig(dueDate: Date): TodoTimelineUrgency {
  const daysUntilDue = differenceInDays(dueDate, new Date());

  if (isPast(dueDate)) {
    return {
      color: featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
      bgColor: featureThemeClassName('timelineUseTodoTimelineCardDangerBackground'),
      label: translateText('generated.inline.0533_overdue_07217c77'),
    };
  }

  if (isToday(dueDate) || daysUntilDue === 0) {
    return {
      color: featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
      bgColor: featureThemeClassName('timelineUseTodoTimelineCardDangerBackground'),
      label: translateText('generated.inline.0534_due_today_e2219e75'),
    };
  }

  if (daysUntilDue <= 3) {
    return {
      color: featureThemeClassName('timelineUseTodoTimelineCardWarningText'),
      bgColor: featureThemeClassName('timelineUseTodoTimelineCardWarningBackground'),
      label: translateText('generated.inline.0535_due_in_daysuntildue_days_bb3b7b94', {
        daysUntilDue,
      }),
    };
  }

  if (daysUntilDue <= 7) {
    return {
      color: featureThemeClassName('editorEditorHeaderWarningText'),
      bgColor: featureThemeClassName('timelineUseTodoTimelineCardWarningBackgroundAlpha'),
      label: translateText('generated.inline.0535_due_in_daysuntildue_days_bb3b7b94', {
        daysUntilDue,
      }),
    };
  }

  return {
    color: featureThemeClassName('timelineUseTodoTimelineCardSuccessText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
    label: format(dueDate, 'MMM d'),
  };
}

export function useTodoTimelineCardController({
  todo,
  linkToDetail,
}: {
  todo: TodoTimelineCardTodo;
  linkToDetail: boolean;
}) {
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
  const isAssignedToMe =
    !!user?.id && assignments.some(assignment => assignment.user?.id === user.id);
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
        senderName: user?.email?.split('@')[0] || t('features.messages.fallbacks.someone'),
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
      await waitForClientApply(
        assignUser({
          id: assignmentId,
          todo_id: todo.id,
          user_id: user.id,
          role: 'assignee',
        })
      );

      if (todo.creatorId && todo.creatorId !== user.id) {
        await notifyStandaloneTodoAssigned({
          senderId: user.id,
          recipientUserId: todo.creatorId,
          todoId: todo.id,
          todoTitle: todo.title || t('features.search.entityLabels.todo'),
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

  return {
    detailHref,
    urgency,
    progress,
    assignmentsCount: assignments.length,
    isAssignedToMe,
    currentStatus,
    statusLabels,
    statusOpen,
    setStatusOpen,
    isStatusUpdating: isLoading,
    assigning,
    handleStatusUpdate,
    handleAssignToMe,
    labels: {
      contentType: t('features.timeline.contentTypes.todo'),
      completed: t('features.todos.status.completed'),
      markComplete: t('features.todos.actions.markComplete'),
      progress: t('features.timeline.cards.progress'),
      assigned: t('features.timeline.cards.assigned'),
      assignedToMe: t('features.todos.assignee.assignedToMe'),
      assignToMe: t('features.todos.assignee.assignToMe'),
    },
  };
}
