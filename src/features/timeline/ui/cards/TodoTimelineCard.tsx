'use client';

import { useTodoTimelineCardController } from '../../hooks/useTodoTimelineCardController';
import type { TodoTimelineCardTodo } from '../../types/todoTimelineCard.types';
import { TodoTimelineCardView } from './TodoTimelineCardView';

export interface TodoTimelineCardProps {
  todo: TodoTimelineCardTodo;
  onToggle?: () => void;
  onVolunteer?: () => void;
  onShare?: () => void;
  className?: string;
  canManageTodos?: boolean;
  showStatusAction?: boolean;
  linkToDetail?: boolean;
  href?: string;
  onCardClick?: () => void;
}

export function TodoTimelineCard({
  todo,
  onToggle,
  className,
  canManageTodos = true,
  showStatusAction = true,
  linkToDetail = true,
  href,
  onCardClick,
}: TodoTimelineCardProps) {
  const controller = useTodoTimelineCardController({ todo, linkToDetail });

  return (
    <TodoTimelineCardView
      todo={todo}
      className={className}
      canManageTodos={canManageTodos}
      showStatusAction={showStatusAction}
      detailHref={href ?? controller.detailHref}
      onCardClick={onCardClick}
      onToggle={onToggle}
      urgency={controller.urgency}
      progress={controller.progress}
      assignmentsCount={controller.assignmentsCount}
      isAssignedToMe={controller.isAssignedToMe}
      currentStatus={controller.currentStatus}
      statusLabels={controller.statusLabels}
      statusOpen={controller.statusOpen}
      onStatusOpenChange={controller.setStatusOpen}
      onStatusUpdate={controller.handleStatusUpdate}
      isStatusUpdating={controller.isStatusUpdating}
      assigning={controller.assigning}
      onAssignToMe={controller.handleAssignToMe}
      labels={controller.labels}
    />
  );
}
