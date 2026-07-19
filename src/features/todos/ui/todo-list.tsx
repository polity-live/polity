import { useCallback, useMemo, useRef } from 'react';

import {
  PolityLocalListView,
  rowAttributes,
  usePolityZeroList,
} from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';
import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import type { Todo, TodoStatus } from '../types/todo.types';

function isTodoStatus(status: string | null | undefined): status is TodoStatus {
  return ['pending', 'in_progress', 'completed', 'cancelled'].includes(status ?? '');
}

function TodoCard({
  todo,
  canManageTodos,
  onToggleComplete,
  onTodoClick,
}: {
  todo: Todo;
  canManageTodos: boolean;
  onToggleComplete: (todo: Todo) => void;
  onTodoClick?: (todo: Todo) => void;
}) {
  return (
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
      onCardClick={() => onTodoClick?.(todo)}
      linkToDetail={false}
      showStatusAction={false}
    />
  );
}

interface TodoListProps {
  canManageTodos?: boolean;
  todos: Todo[];
  onToggleComplete: (todo: Todo) => void;
  onTodoClick?: (todo: Todo) => void;
  virtualQuery?: {
    status: 'all' | TodoStatus;
    archive: 'active' | 'archived';
    query: string;
  };
}

function VirtualTodoList({
  canManageTodos,
  onToggleComplete,
  onTodoClick,
  queryConfig,
}: Omit<TodoListProps, 'todos' | 'virtualQuery'> & {
  canManageTodos: boolean;
  queryConfig: NonNullable<TodoListProps['virtualQuery']>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listContextParams = useMemo(() => queryConfig, [queryConfig]);
  const virtualList = usePolityZeroList<
    typeof listContextParams,
    Todo,
    { created_at?: number; archived_at?: number; id: string }
  >({
    scrollStateKey: 'todos-list',
    listContextParams,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => 132, []),
    overscan: 8,
    getRowKey: todo => todo.id,
    toStartRow: todo =>
      queryConfig.archive === 'archived'
        ? { archived_at: Number(todo.archived_at), id: todo.id }
        : { created_at: Number(todo.created_at), id: todo.id },
    getPageQuery: useCallback(
      ({ limit, start, dir, settled }) => ({
        query: queries.todos.page({
          status: queryConfig.status,
          archive: queryConfig.archive,
          query: queryConfig.query,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      [queryConfig]
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
    <div ref={scrollRef} className="h-[calc(100vh-20rem)] overflow-y-auto">
      <div
        className="space-y-3"
        style={{ paddingTop: virtualList.spaceBefore, paddingBottom: virtualList.spaceAfter }}
      >
        {virtualList.items.map(item => (
          <div key={item.key} {...rowAttributes(item.index, item.key)}>
            {item.row ? (
              <TodoCard
                todo={item.row}
                canManageTodos={canManageTodos}
                onToggleComplete={onToggleComplete}
                onTodoClick={onTodoClick}
              />
            ) : (
              <Skeleton className="h-28 w-full rounded-xl" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodoList({
  canManageTodos = true,
  todos,
  onToggleComplete,
  onTodoClick,
  virtualQuery,
}: TodoListProps) {
  if (virtualQuery) {
    return (
      <VirtualTodoList
        canManageTodos={canManageTodos}
        onToggleComplete={onToggleComplete}
        onTodoClick={onTodoClick}
        queryConfig={virtualQuery}
      />
    );
  }

  return (
    <PolityLocalListView
      items={todos}
      getItemKey={todo => todo.id}
      estimateSize={132}
      overscan={8}
      className="h-[calc(100vh-20rem)] overflow-y-auto"
      renderItem={todo => (
        <TodoCard
          todo={todo}
          canManageTodos={canManageTodos}
          onToggleComplete={onToggleComplete}
          onTodoClick={onTodoClick}
        />
      )}
    />
  );
}
