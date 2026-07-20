import { useCallback, useMemo, useRef, type DragEventHandler } from 'react';

import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import { cn } from '@/features/shared/utils/utils';
import type { Todo, TodoStatus } from '../types/todo.types';
import {
  PolityLocalListView,
  rowAttributes,
  usePolityZeroList,
  ZeroVirtualSpacer,
} from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';

interface KanbanColumn {
  id: TodoStatus;
  title: string;
  todos: Todo[];
  className?: string;
}

interface KanbanBoardViewProps {
  canManageTodos: boolean;
  columns: KanbanColumn[];
  tasksLabel: string;
  draggedTodoId: string | null;
  onColumnDragOver: DragEventHandler<HTMLDivElement>;
  onColumnDrop: (status: TodoStatus) => void;
  onCardMouseDown: (todo: Todo) => void;
  onCardDragStart: (todo: Todo) => void;
  onCardDragEnd: (todo: Todo) => void;
  onCardClick: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
  virtualQuery?: { query: string };
}

function isTodoStatus(status: string | null | undefined): status is TodoStatus {
  return (
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled'
  );
}

function VirtualKanbanColumn({
  column,
  query,
  renderTodo,
}: {
  column: KanbanColumn;
  query: string;
  renderTodo: (todo: Todo) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const context = useMemo(() => ({ status: column.id, query: query.trim() }), [column.id, query]);
  const list = usePolityZeroList<typeof context, Todo, { created_at: number; id: string }>({
    scrollStateKey: `todos-kanban-${column.id}`,
    listContextParams: context,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => 144, []),
    overscan: 6,
    getRowKey: todo => todo.id,
    toStartRow: todo => ({ created_at: Number(todo.created_at), id: todo.id }),
    getPageQuery: useCallback(
      ({ limit, start, dir, settled }) => ({
        query: queries.todos.page({ ...context, archive: 'active', limit, start, dir }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      [context]
    ),
    getSingleQuery: useCallback(
      ({ id, settled }) => ({
        query: queries.todos.byIdWithRelations({ id }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      []
    ),
  });

  return (
    <div ref={scrollRef} className="max-h-[38rem] min-h-96 overflow-y-auto">
      <div className="space-y-3">
        <ZeroVirtualSpacer position="before" size={list.spaceBefore} />
        {list.items.map((item, itemPosition) => (
          <div
            key={item.key}
            {...rowAttributes(item.index, item.key)}
            style={itemPosition === 0 ? { marginTop: 0 } : undefined}
          >
            {item.row ? renderTodo(item.row) : <Skeleton className="h-32 w-full rounded-xl" />}
          </div>
        ))}
        <ZeroVirtualSpacer position="after" size={list.spaceAfter} />
      </div>
    </div>
  );
}

export function KanbanBoardView({
  canManageTodos,
  columns,
  tasksLabel,
  draggedTodoId,
  onColumnDragOver,
  onColumnDrop,
  onCardMouseDown,
  onCardDragStart,
  onCardDragEnd,
  onCardClick,
  onToggleComplete,
  virtualQuery,
}: KanbanBoardViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {columns.map(column => (
        <div
          key={column.id}
          className={cn('min-h-125 rounded-lg p-4', column.className)}
          onDragOver={onColumnDragOver}
          onDrop={() => onColumnDrop(column.id)}
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{column.title}</h3>
            <p className="text-muted-foreground text-sm">
              {column.todos.length} {tasksLabel}
            </p>
          </div>

          {virtualQuery ? (
            <VirtualKanbanColumn
              column={column}
              query={virtualQuery.query}
              renderTodo={todo => (
                <TodoKanbanCardView
                  key={todo.id}
                  canManageTodos={canManageTodos}
                  todo={todo}
                  isDragging={draggedTodoId === todo.id}
                  onMouseDown={onCardMouseDown}
                  onDragStart={onCardDragStart}
                  onDragEnd={onCardDragEnd}
                  onClick={onCardClick}
                  onToggleComplete={onToggleComplete}
                />
              )}
            />
          ) : (
            <PolityLocalListView
              items={column.todos}
              getItemKey={todo => todo.id}
              estimateSize={144}
              overscan={12}
              className="max-h-[38rem] min-h-96 overflow-y-auto"
              renderItem={todo => (
                <TodoKanbanCardView
                  canManageTodos={canManageTodos}
                  todo={todo}
                  isDragging={draggedTodoId === todo.id}
                  onMouseDown={onCardMouseDown}
                  onDragStart={onCardDragStart}
                  onDragEnd={onCardDragEnd}
                  onClick={onCardClick}
                  onToggleComplete={onToggleComplete}
                />
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface TodoKanbanCardViewProps {
  canManageTodos: boolean;
  todo: Todo;
  onMouseDown: (todo: Todo) => void;
  onDragStart: (todo: Todo) => void;
  onDragEnd: (todo: Todo) => void;
  onClick: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
  isDragging: boolean;
}

export function TodoKanbanCardView({
  canManageTodos,
  todo,
  onMouseDown,
  onDragStart,
  onDragEnd,
  onClick,
  onToggleComplete,
  isDragging,
}: TodoKanbanCardViewProps) {
  return (
    <div
      draggable={canManageTodos}
      onMouseDown={() => onMouseDown(todo)}
      onDragStart={canManageTodos ? () => onDragStart(todo) : undefined}
      onDragEnd={() => onDragEnd(todo)}
      className={isDragging ? 'opacity-50' : undefined}
      data-swipe-lock
    >
      <TodoTimelineCard
        todo={{
          id: todo.id,
          title: todo.title ?? '',
          description: todo.description ?? undefined,
          isCompleted: todo.status === 'completed',
          dueDate: todo.due_date ?? undefined,
          assigneeCount: todo.assignments?.length,
          groupName: todo.group?.name ?? undefined,
          groupId: todo.group?.id ?? undefined,
          status: isTodoStatus(todo.status) ? todo.status : undefined,
          creatorId: todo.creator?.id ?? undefined,
          archived: Boolean(todo.archived_at),
        }}
        canManageTodos={canManageTodos}
        onToggle={canManageTodos ? () => onToggleComplete(todo) : undefined}
        onCardClick={() => onClick(todo)}
        linkToDetail={false}
        showStatusAction={false}
      />
    </div>
  );
}

export type { KanbanColumn, KanbanBoardViewProps };
