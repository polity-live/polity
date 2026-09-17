import { useIsMobileScreen } from '@/features/shared/hooks/useIsMobileScreen';
import { useCallback, useMemo, useRef } from 'react';

import {
  PolityLocalListView,
  rowAttributes,
  usePolityZeroList,
  ZeroVirtualSpacer,
} from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';
import { CompactTodoRow } from './CompactTodoRow';
import { handleWorkspaceListKeyDown } from '@/features/shared/ui/preview/list-keyboard';
import type { Todo, TodoStatus } from '../types/todo.types';

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
  onTodoClick,
  queryConfig,
}: Omit<TodoListProps, 'todos' | 'virtualQuery'> & {
  canManageTodos: boolean;
  queryConfig: NonNullable<TodoListProps['virtualQuery']>;
}) {
  const isMobile = useIsMobileScreen();
  const rowHeight = isMobile ? 100 : 64;
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
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
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
    <div
      ref={scrollRef}
      data-workspace-list
      onKeyDown={handleWorkspaceListKeyDown}
      className="h-[calc(100vh-20rem)] overflow-y-auto"
    >
      <div className="space-y-0">
        <ZeroVirtualSpacer position="before" size={virtualList.spaceBefore} />
        {virtualList.items.map((item, itemPosition) => (
          <div
            key={item.key}
            {...rowAttributes(item.index, item.key)}
            style={itemPosition === 0 ? { marginTop: 0 } : undefined}
          >
            {item.row ? (
              <CompactTodoRow
                todo={item.row}
                canManageTodos={canManageTodos}
                onTodoClick={onTodoClick}
              />
            ) : (
              <Skeleton className="h-16 w-full rounded-none" />
            )}
          </div>
        ))}
        <ZeroVirtualSpacer position="after" size={virtualList.spaceAfter} />
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
  const isMobile = useIsMobileScreen();
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
    <div data-workspace-list onKeyDown={handleWorkspaceListKeyDown}>
      <PolityLocalListView
        items={todos}
        getItemKey={todo => todo.id}
        estimateSize={isMobile ? 100 : 64}
        overscan={8}
        className="h-[calc(100vh-20rem)] overflow-y-auto"
        renderItem={todo => (
          <CompactTodoRow todo={todo} canManageTodos={canManageTodos} onTodoClick={onTodoClick} />
        )}
      />
    </div>
  );
}
