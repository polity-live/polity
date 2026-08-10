import { useMemo, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  usePqlCollection,
  type PqlQuickFilterDefinition,
} from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';
import { Todo, TodoTab } from '../types/todo.types';
import { toLocalDayTimestamp, toLocalTimestamp } from '@/features/shared/logic/localDateTime';

export type TodoFieldKey =
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'due_date_preset'
  | 'creator_id'
  | 'tags'
  | 'assignee_ids'
  | 'due_date'
  | 'created_at';

interface UseTodoFiltersOptions {
  storageKey?: string;
  groupId?: string;
  includeStatusQuickFilter?: boolean;
  archiveMode?: 'active' | 'archived';
}

function getTodoUserLabel(
  user: NonNullable<Todo['creator'] | Todo['assignments'][number]['user']>
): string {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.handle ||
    user.email ||
    user.id
  );
}

function getTodoSearchValues(todo: Todo): readonly string[] {
  return [
    todo.title,
    todo.description,
    ...(todo.tags ?? []),
    ...(todo.assignments?.map(assignment =>
      [
        assignment.user?.first_name,
        assignment.user?.last_name,
        assignment.user?.handle,
        assignment.user?.email,
      ]
        .filter(Boolean)
        .join(' ')
    ) ?? []),
  ].filter((value): value is string => Boolean(value));
}

function getTodoDueDatePreset(todo: Todo): string | null {
  if (!todo.due_date) {
    return null;
  }

  const dueDate = new Date(todo.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfNextWeek = new Date(today);
  const daysUntilNextWeek = 8 - (today.getDay() || 7);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + daysUntilNextWeek);

  const startOfWeekAfterNext = new Date(startOfNextWeek);
  startOfWeekAfterNext.setDate(startOfWeekAfterNext.getDate() + 7);

  if (dueDate.getTime() === yesterday.getTime()) {
    return 'yesterday';
  }

  if (dueDate.getTime() === today.getTime()) {
    return 'today';
  }

  if (dueDate.getTime() === tomorrow.getTime()) {
    return 'tomorrow';
  }

  if (dueDate >= startOfNextWeek && dueDate < startOfWeekAfterNext) {
    return 'next_week';
  }

  return null;
}

function sortTodos(items: Todo[], archived: boolean): Todo[] {
  return [...items].sort((leftTodo, rightTodo) => {
    if (archived) {
      return (rightTodo.archived_at ?? 0) - (leftTodo.archived_at ?? 0);
    }

    if (leftTodo.due_date && rightTodo.due_date) {
      return leftTodo.due_date - rightTodo.due_date;
    }

    if (leftTodo.due_date) {
      return -1;
    }

    if (rightTodo.due_date) {
      return 1;
    }

    return rightTodo.created_at - leftTodo.created_at;
  });
}

export function useTodoFilters(
  todos: Todo[] | undefined,
  userId: string | undefined,
  options: UseTodoFiltersOptions = {}
) {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<TodoTab>('all');
  const assigneeOptions = useMemo(() => {
    const nextOptions = new Map<string, { value: string; label: string; keywords: string[] }>();

    for (const todo of todos ?? []) {
      for (const assignment of todo.assignments ?? []) {
        const user = assignment.user;
        if (!user?.id) {
          continue;
        }

        const label = getTodoUserLabel(user);

        nextOptions.set(user.id, {
          value: user.id,
          label,
          keywords: [user.handle ?? '', user.email ?? ''].filter(Boolean),
        });
      }
    }

    return [...nextOptions.values()].sort((leftOption, rightOption) =>
      leftOption.label.localeCompare(rightOption.label)
    );
  }, [todos]);

  const creatorOptions = useMemo(() => {
    const nextOptions = new Map<string, { value: string; label: string; keywords: string[] }>();

    for (const todo of todos ?? []) {
      const creator = todo.creator;
      if (!creator?.id) {
        continue;
      }

      nextOptions.set(creator.id, {
        value: creator.id,
        label: getTodoUserLabel(creator),
        keywords: [creator.handle ?? '', creator.email ?? ''].filter(Boolean),
      });
    }

    return [...nextOptions.values()].sort((leftOption, rightOption) =>
      leftOption.label.localeCompare(rightOption.label)
    );
  }, [todos]);

  const assigneeTypeaheadItems = useMemo(
    () =>
      assigneeOptions.map(option => ({
        id: option.value,
        entityType: 'user' as const,
        label: option.label,
        secondaryLabel: option.keywords[0] ?? option.keywords[1] ?? undefined,
        keywords: option.keywords,
      })),
    [assigneeOptions]
  );

  const creatorTypeaheadItems = useMemo(
    () =>
      creatorOptions.map(option => ({
        id: option.value,
        entityType: 'user' as const,
        label: option.label,
        secondaryLabel: option.keywords[0] ?? option.keywords[1] ?? undefined,
        keywords: option.keywords,
      })),
    [creatorOptions]
  );

  const tagOptions = useMemo(() => {
    const nextTags = new Set<string>();

    for (const todo of todos ?? []) {
      for (const tag of todo.tags ?? []) {
        nextTags.add(tag);
      }
    }

    return [...nextTags]
      .sort((leftTag, rightTag) => leftTag.localeCompare(rightTag))
      .map(tag => ({
        value: tag,
        label: tag,
      }));
  }, [todos]);

  const fields = useMemo<readonly PqlFieldDefinition<Todo, TodoFieldKey>[]>(
    () => [
      {
        key: 'title',
        label: t('features.todos.detail.todoTitle'),
        kind: 'text',
        operators: ['contains', 'eq'],
        getValue: todo => todo.title,
      },
      {
        key: 'description',
        label: t('features.todos.detail.description'),
        kind: 'text',
        operators: ['contains', 'eq', 'is_set'],
        getValue: todo => todo.description,
      },
      {
        key: 'status',
        label: t('features.todos.detail.status'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: [
          { value: 'pending', label: t('features.todos.status.pending') },
          { value: 'in_progress', label: t('features.todos.status.in_progress') },
          { value: 'completed', label: t('features.todos.status.completed') },
          { value: 'cancelled', label: t('features.todos.status.cancelled') },
        ],
        getValue: todo => todo.status,
      },
      {
        key: 'priority',
        label: t('features.todos.priority.title'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: [
          { value: 'urgent', label: t('features.todos.priority.urgent') },
          { value: 'high', label: t('features.todos.priority.high') },
          { value: 'medium', label: t('features.todos.priority.medium') },
          { value: 'low', label: t('features.todos.priority.low') },
        ],
        getValue: todo => todo.priority,
      },
      {
        key: 'due_date_preset',
        label: t('features.todos.dueDate.title'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: [
          { value: 'yesterday', label: t('features.todos.dueDate.yesterday') },
          { value: 'today', label: t('features.todos.dueDate.today') },
          { value: 'tomorrow', label: t('features.todos.dueDate.tomorrow') },
          { value: 'next_week', label: t('features.todos.dueDate.nextWeek') },
        ],
        getValue: todo => getTodoDueDatePreset(todo),
      },
      {
        key: 'creator_id',
        label: t('features.todos.detail.createdBy'),
        kind: 'entity',
        operators: ['eq', 'in'],
        options: creatorOptions,
        getValue: todo => todo.creator?.id,
      },
      {
        key: 'tags',
        label: t('features.todos.detail.tags'),
        kind: 'text',
        operators: ['contains', 'eq', 'in'],
        options: tagOptions,
        getValue: todo => todo.tags ?? [],
      },
      {
        key: 'assignee_ids',
        label: t('features.todos.detail.assignedTo'),
        kind: 'entity',
        operators: ['eq', 'in'],
        options: assigneeOptions,
        getValue: todo =>
          todo.assignments
            ?.map(assignment => assignment.user?.id)
            .filter((value): value is string => Boolean(value)) ?? [],
      },
      {
        key: 'due_date',
        label: t('features.todos.dueDate.title'),
        kind: 'date',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'is_set'],
        getValue: todo => toLocalDayTimestamp(todo.due_date),
      },
      {
        key: 'created_at',
        label: t('features.todos.sort.createdAt'),
        kind: 'date',
        operators: ['gt', 'gte', 'lt', 'lte'],
        getValue: todo => todo.created_at,
      },
    ],
    [assigneeOptions, creatorOptions, t, tagOptions]
  );

  const quickFilters = useMemo<readonly PqlQuickFilterDefinition<TodoFieldKey>[]>(() => {
    return [
      {
        fieldKey: 'status',
        label: t('features.todos.detail.status'),
        multiple: true,
      },
      {
        fieldKey: 'priority',
        label: t('features.todos.priority.title'),
        multiple: true,
      },
      {
        fieldKey: 'due_date_preset',
        label: t('features.todos.dueDate.title'),
        multiple: true,
      },
      {
        fieldKey: 'due_date',
        label: t('features.todos.dueDate.custom'),
        inputKind: 'date',
        operator: 'eq',
        placeholder: t('features.todos.dueDate.custom'),
        serializeValue: values => {
          const normalizedDate = values[0];
          if (!normalizedDate) {
            return null;
          }

          return toLocalTimestamp(normalizedDate);
        },
      },
      {
        fieldKey: 'creator_id',
        label: t('features.todos.detail.createdBy'),
        multiple: true,
        inputKind: 'typeahead',
        placeholder: t('features.todos.assignee.searchMembers'),
        typeaheadItems: creatorTypeaheadItems,
      },
      {
        fieldKey: 'assignee_ids',
        label: t('features.todos.detail.assignedTo'),
        multiple: true,
        inputKind: 'typeahead',
        placeholder: t('features.todos.assignee.searchMembers'),
        typeaheadItems: assigneeTypeaheadItems,
      },
      {
        fieldKey: 'tags',
        label: t('features.todos.detail.tags'),
        multiple: true,
        inputKind: 'hashtag',
        placeholder: t('features.todos.detail.tags'),
      },
    ];
  }, [assigneeTypeaheadItems, creatorTypeaheadItems, t]);

  const scopedTodos = useMemo(() => {
    const availableTodos = todos ?? [];

    return userId
      ? availableTodos.filter(
          todo =>
            todo.creator?.id === userId ||
            todo.assignments?.some(assignment => assignment.user?.id === userId)
        )
      : availableTodos;
  }, [todos, userId]);

  const tabScopedTodos = useMemo(() => {
    if (options.archiveMode === 'archived' || selectedTab === 'archived') {
      return scopedTodos.filter(todo => Boolean(todo.archived_at));
    }

    const activeTodos = scopedTodos.filter(todo => !todo.archived_at);
    return selectedTab === 'all'
      ? activeTodos
      : activeTodos.filter(todo => todo.status === selectedTab);
  }, [options.archiveMode, scopedTodos, selectedTab]);

  const pqlState = usePqlCollection({
    items: tabScopedTodos,
    fields,
    quickFilters,
    storageKey: options.storageKey,
    groupId: options.groupId,
    searchValues: [getTodoSearchValues],
    sortItems: items =>
      sortTodos(items, options.archiveMode === 'archived' || selectedTab === 'archived'),
  });

  return {
    fields,
    quickFilters,
    selectedTab,
    setSelectedTab,
    ...pqlState,
    filteredTodos: pqlState.filteredItems,
  };
}
