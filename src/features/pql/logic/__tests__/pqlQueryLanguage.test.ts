import { describe, expect, it } from 'vitest';
import { applyPqlFilter, createPqlFieldRegistry, type PqlFieldDefinition } from '../applyPqlFilter';
import { applyPqlSuggestion, buildPqlCodeFilter, getPqlSuggestions } from '../pqlQueryLanguage';

interface DemoTodo {
  id: string;
  title: string;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  tags: readonly string[];
  assignee_ids: readonly string[];
}

type DemoTodoFieldKey = 'title' | 'status' | 'priority' | 'tags' | 'assignee_ids';

const DEMO_TODOS: readonly DemoTodo[] = [
  {
    id: 'todo-1',
    title: 'Prepare budget proposal',
    status: 'pending',
    priority: 'high',
    tags: ['finance', 'board'],
    assignee_ids: ['user-a'],
  },
  {
    id: 'todo-2',
    title: 'Archive meeting notes',
    status: 'completed',
    priority: 'low',
    tags: ['docs'],
    assignee_ids: ['user-b'],
  },
  {
    id: 'todo-3',
    title: 'Publish campaign timeline',
    status: 'pending',
    priority: 'medium',
    tags: ['campaign', 'public'],
    assignee_ids: ['user-a', 'user-c'],
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
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    getValue: item => item.status,
  },
  {
    key: 'priority',
    label: 'Priority',
    kind: 'enum',
    operators: ['eq', 'in'],
    options: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    getValue: item => item.priority,
  },
  {
    key: 'tags',
    label: 'Tags',
    kind: 'text',
    operators: ['contains', 'in'],
    options: [
      { value: 'finance', label: 'finance' },
      { value: 'board', label: 'board' },
      { value: 'docs', label: 'docs' },
    ],
    getValue: item => item.tags,
  },
  {
    key: 'assignee_ids',
    label: 'Assigned To',
    kind: 'entity',
    operators: ['eq', 'in'],
    options: [
      { value: 'user-a', label: 'Ada Lovelace' },
      { value: 'user-b', label: 'Grace Hopper' },
      { value: 'user-c', label: 'Linus Torvalds' },
    ],
    getValue: item => item.assignee_ids,
  },
];

describe('buildPqlCodeFilter', () => {
  it('parses nested PQL expressions and evaluates them against collections', () => {
    const { filter, issues } = buildPqlCodeFilter({
      id: 'filter-1',
      label: 'Work in progress',
      query: 'status == Pending AND (priority == High OR assignee_ids IN ("Ada Lovelace"))',
      fields: TODO_FIELDS,
    });

    expect(issues).toEqual([]);
    expect(filter).not.toBeNull();

    const fieldRegistry = createPqlFieldRegistry(TODO_FIELDS);
    expect(applyPqlFilter(DEMO_TODOS, filter, fieldRegistry).map(item => item.id)).toEqual([
      'todo-1',
      'todo-3',
    ]);
  });

  it('reports an issue for unknown fields', () => {
    const { filter, issues } = buildPqlCodeFilter({
      label: 'Broken filter',
      query: 'unknown_field == true',
      fields: TODO_FIELDS,
    });

    expect(filter).toBeNull();
    expect(issues[0]?.message).toContain('Unknown field');
  });
});

describe('getPqlSuggestions', () => {
  it('suggests fields at the start of the query', () => {
    const suggestions = getPqlSuggestions('sta', 3, TODO_FIELDS);

    expect(suggestions[0]?.label).toBe('status');
    expect(suggestions[0]?.kind).toBe('field');
  });

  it('suggests operators after a field', () => {
    const suggestions = getPqlSuggestions('status ', 'status '.length, TODO_FIELDS);

    expect(suggestions.some(suggestion => suggestion.label === '==')).toBe(true);
    expect(suggestions.some(suggestion => suggestion.label === 'IN')).toBe(true);
  });

  it('applies suggestions by replacing the active partial token', () => {
    const [suggestion] = getPqlSuggestions('stat', 4, TODO_FIELDS);
    const result = applyPqlSuggestion('stat', 4, suggestion);

    expect(result.value).toBe('status ');
    expect(result.caretPosition).toBe('status '.length);
  });
});
