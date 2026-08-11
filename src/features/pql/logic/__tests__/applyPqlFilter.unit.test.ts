import { describe, expect, it } from 'vitest';
import {
  applyPqlFilter,
  createPqlCondition,
  createPqlFieldRegistry,
  type PqlFieldDefinition,
  type PqlFilter,
} from '../applyPqlFilter';

interface DemoTodo {
  id: string;
  title: string;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  tags: readonly string[];
  assignee_ids: readonly string[];
  due_at: number;
}

type DemoTodoFieldKey = 'title' | 'status' | 'priority' | 'tags' | 'assignee_ids' | 'due_at';

const DEMO_TODOS: readonly DemoTodo[] = [
  {
    id: 'todo-1',
    title: 'Prepare budget proposal',
    status: 'pending',
    priority: 'high',
    tags: ['finance', 'board'],
    assignee_ids: ['user-a'],
    due_at: 10,
  },
  {
    id: 'todo-2',
    title: 'Archive meeting notes',
    status: 'completed',
    priority: 'low',
    tags: ['docs'],
    assignee_ids: ['user-b'],
    due_at: 20,
  },
  {
    id: 'todo-3',
    title: 'Publish campaign timeline',
    status: 'pending',
    priority: 'medium',
    tags: ['campaign', 'public'],
    assignee_ids: ['user-a', 'user-c'],
    due_at: 30,
  },
];

const TODO_FIELDS: readonly PqlFieldDefinition<DemoTodo, DemoTodoFieldKey>[] = [
  {
    key: 'title',
    label: 'Title',
    kind: 'text',
    operators: ['contains', 'eq'],
    getValue: item => item.title,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    operators: ['eq', 'in'],
    getValue: item => item.status,
  },
  {
    key: 'priority',
    label: 'Priority',
    kind: 'enum',
    operators: ['eq', 'in'],
    getValue: item => item.priority,
  },
  {
    key: 'tags',
    label: 'Tags',
    kind: 'text',
    operators: ['contains', 'in'],
    getValue: item => item.tags,
  },
  {
    key: 'assignee_ids',
    label: 'Assignees',
    kind: 'entity',
    operators: ['in'],
    getValue: item => item.assignee_ids,
  },
  {
    key: 'due_at',
    label: 'Due date',
    kind: 'date',
    operators: ['gt', 'gte', 'lt', 'lte'],
    getValue: item => item.due_at,
  },
];

const TODO_FIELD_REGISTRY = createPqlFieldRegistry(TODO_FIELDS);

describe('applyPqlFilter', () => {
  it('supports AND filters that combine different field operators', () => {
    const filter: PqlFilter<DemoTodoFieldKey> = {
      id: 'filter-and',
      label: 'High priority pending work',
      query: 'status == pending AND title CONTAINS budget',
      expression: {
        type: 'group',
        combinator: 'and',
        children: [
          createPqlCondition({
            id: 'rule-1',
            fieldKey: 'status',
            operator: 'eq',
            value: 'pending',
          }),
          createPqlCondition({
            id: 'rule-2',
            fieldKey: 'title',
            operator: 'contains',
            value: 'budget',
          }),
        ],
      },
    };

    expect(applyPqlFilter(DEMO_TODOS, filter, TODO_FIELD_REGISTRY).map(item => item.id)).toEqual([
      'todo-1',
    ]);
  });

  it('supports OR filters across rules', () => {
    const filter: PqlFilter<DemoTodoFieldKey> = {
      id: 'filter-or',
      label: 'Completed or medium priority',
      query: 'status == completed OR priority == medium',
      expression: {
        type: 'group',
        combinator: 'or',
        children: [
          createPqlCondition({
            id: 'rule-1',
            fieldKey: 'status',
            operator: 'eq',
            value: 'completed',
          }),
          createPqlCondition({
            id: 'rule-2',
            fieldKey: 'priority',
            operator: 'eq',
            value: 'medium',
          }),
        ],
      },
    };

    expect(applyPqlFilter(DEMO_TODOS, filter, TODO_FIELD_REGISTRY).map(item => item.id)).toEqual([
      'todo-2',
      'todo-3',
    ]);
  });

  it('supports IN filters against scalar and collection fields', () => {
    const scalarFilter: PqlFilter<DemoTodoFieldKey> = {
      id: 'filter-scalar-in',
      label: 'Selected priorities',
      query: 'priority IN (high, medium)',
      expression: createPqlCondition({
        id: 'rule-1',
        fieldKey: 'priority',
        operator: 'in',
        value: ['high', 'medium'],
      }),
    };

    const collectionFilter: PqlFilter<DemoTodoFieldKey> = {
      id: 'filter-collection-in',
      label: 'Assigned to user-a',
      query: 'assignee_ids IN (user-a)',
      expression: createPqlCondition({
        id: 'rule-1',
        fieldKey: 'assignee_ids',
        operator: 'in',
        value: ['user-a'],
      }),
    };

    expect(
      applyPqlFilter(DEMO_TODOS, scalarFilter, TODO_FIELD_REGISTRY).map(item => item.id)
    ).toEqual(['todo-1', 'todo-3']);

    expect(
      applyPqlFilter(DEMO_TODOS, collectionFilter, TODO_FIELD_REGISTRY).map(item => item.id)
    ).toEqual(['todo-1', 'todo-3']);
  });

  it('supports nested expressions that mix AND and OR', () => {
    const filter: PqlFilter<DemoTodoFieldKey> = {
      id: 'filter-nested',
      label: 'Nested logic',
      query: 'status == pending AND (priority == medium OR priority == high)',
      expression: {
        type: 'group',
        combinator: 'and',
        children: [
          createPqlCondition({
            id: 'rule-1',
            fieldKey: 'status',
            operator: 'eq',
            value: 'pending',
          }),
          {
            type: 'group',
            combinator: 'or',
            children: [
              createPqlCondition({
                id: 'rule-2',
                fieldKey: 'priority',
                operator: 'eq',
                value: 'medium',
              }),
              createPqlCondition({
                id: 'rule-3',
                fieldKey: 'priority',
                operator: 'eq',
                value: 'high',
              }),
            ],
          },
        ],
      },
    };

    expect(applyPqlFilter(DEMO_TODOS, filter, TODO_FIELD_REGISTRY).map(item => item.id)).toEqual([
      'todo-1',
      'todo-3',
    ]);
  });
});
