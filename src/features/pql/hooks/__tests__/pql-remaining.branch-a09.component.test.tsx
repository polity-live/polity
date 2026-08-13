/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PqlFieldDefinition, PqlFilter } from '../../logic/applyPqlFilter';

const state = vi.hoisted(() => ({
  createFilter: vi.fn(),
  deleteFilter: vi.fn(),
  filters: [] as any[],
  isLoading: false,
  updateFilter: vi.fn(),
}));

vi.mock('@/zero/pql/usePqlFilterState', () => ({
  usePqlFilterState: () => ({ filters: state.filters, isLoading: state.isLoading }),
}));
vi.mock('@/zero/pql/usePqlFilterActions', () => ({
  usePqlFilterActions: () => ({
    createFilter: state.createFilter,
    deleteFilter: state.deleteFilter,
    updateFilter: state.updateFilter,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { usePqlCollection } from '../usePqlCollection';
import { usePqlFilterBuilderDialogController } from '../usePqlFilterBuilderDialogController';
import { usePqlQueryEditorController } from '../usePqlQueryEditorController';

interface Item {
  id: string;
  title: string;
  status: string;
  tag?: string;
}

type Field = 'title' | 'status' | 'tag';

const items: Item[] = [
  { id: 'one', title: 'Alpha', status: 'open', tag: 'one' },
  { id: 'two', title: '', status: 'closed' },
];
const fields: readonly PqlFieldDefinition<Item, Field>[] = [
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
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed state' },
    ],
    getValue: item => item.status,
  },
  {
    key: 'tag',
    label: 'Tag',
    kind: 'text',
    operators: ['is_set'],
    getValue: item => item.tag,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.filters = [];
  state.isLoading = false;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PQL collection remaining branches A09', () => {
  it('normalizes empty, array, and absent search values and applies one and multiple quick fields', () => {
    const { result } = renderHook(() =>
      usePqlCollection({
        items,
        fields,
        searchValues: [
          item => item.title,
          item => (item.id === 'one' ? [' OPEN ', ''] : null),
          () => undefined,
        ],
        quickFilters: [
          { fieldKey: 'status', multiple: true },
          { fieldKey: 'title', operator: 'eq' },
          { fieldKey: 'tag', serializeValue: values => values.join('|') },
        ],
      })
    );

    act(() => result.current.setSearchQuery('open'));
    expect(result.current.filteredItems.map(item => item.id)).toEqual(['one']);
    act(() => result.current.setSearchQuery('missing'));
    expect(result.current.filteredItems).toEqual([]);
    act(() => result.current.setSearchQuery(''));

    act(() => result.current.toggleQuickFilterValue('status', 'open'));
    expect(result.current.filteredItems.map(item => item.id)).toEqual(['one']);
    act(() => result.current.toggleQuickFilterValue('status', 'closed'));
    expect(result.current.quickFilterValues.status).toEqual(['open', 'closed']);
    act(() => result.current.toggleQuickFilterValue('status', 'open'));
    act(() => result.current.toggleQuickFilterValue('status', 'closed'));
    expect(result.current.quickFilterValues.status).toBeUndefined();

    act(() => result.current.toggleQuickFilterValue('title', 'Alpha'));
    expect(result.current.quickFilterValues.title).toEqual(['Alpha']);
    act(() => result.current.toggleQuickFilterValue('tag', 'one'));
    expect(result.current.quickFilterValues.tag).toEqual(['one']);
    act(() => result.current.setQuickFilterValues('tag', []));
    expect(result.current.quickFilterValues.tag).toBeUndefined();
  });

  it('handles absent, corrupt, incomplete, loading, and already-migrated legacy state', () => {
    const plain = renderHook(() => usePqlCollection({ items, fields, storageKey: 'plain' }));
    expect(state.createFilter).not.toHaveBeenCalled();
    plain.unmount();

    localStorage.setItem('corrupt', '{');
    const corrupt = renderHook(() => usePqlCollection({ items, fields, storageKey: 'corrupt' }));
    expect(state.createFilter).not.toHaveBeenCalled();
    corrupt.unmount();

    localStorage.setItem('defaults', '{}');
    const defaults = renderHook(() => usePqlCollection({ items, fields, storageKey: 'defaults' }));
    expect(state.createFilter).not.toHaveBeenCalled();
    defaults.unmount();

    state.isLoading = true;
    localStorage.setItem('loading', JSON.stringify({ savedFilters: [] }));
    const loading = renderHook(() => usePqlCollection({ items, fields, storageKey: 'loading' }));
    expect(localStorage.getItem('loading')).not.toBeNull();
    loading.unmount();

    state.isLoading = false;
    state.filters = [{ id: 'existing', label: 'Existing', query: '', is_active: false }];
    localStorage.setItem('existing', JSON.stringify({ savedFilters: [] }));
    const existing = renderHook(() => usePqlCollection({ items, fields, storageKey: 'existing' }));
    expect(localStorage.getItem('existing')).not.toBeNull();
    existing.unmount();
  });

  it('skips invalid legacy filters and migrates valid filters with default active ids', () => {
    localStorage.setItem(
      'legacy',
      JSON.stringify({
        savedFilters: [
          { id: 'blank-label', label: ' ', query: 'status == open' },
          { id: 'blank-query', label: 'Valid', query: '' },
          { id: 'valid', label: ' Valid ', query: 'status == open' },
        ],
      })
    );
    renderHook(() => usePqlCollection({ items, fields, storageKey: 'legacy' }));
    expect(state.createFilter).toHaveBeenCalledOnce();
    expect(state.createFilter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'valid', is_active: false, label: 'Valid' })
    );
    expect(localStorage.getItem('legacy')).toBeNull();
  });

  it('guards persistence without storage, invalid data, missing toggles, and inactive clears', () => {
    state.filters = [
      { id: 'active', label: 'Active', query: 'status == open', is_active: true },
      { id: 'inactive', label: 'Inactive', query: 'status == closed', is_active: false },
      { id: 'invalid-expression', label: 'Invalid', query: '???', is_active: true },
    ];
    const noStorage = renderHook(() => usePqlCollection({ items, fields }));
    act(() =>
      noStorage.result.current.saveCustomFilter({
        id: 'new',
        label: 'New',
        query: 'status == open',
      })
    );
    expect(state.createFilter).not.toHaveBeenCalled();
    noStorage.unmount();

    const { result } = renderHook(() =>
      usePqlCollection({ items, fields, storageKey: 'persist', quickFilters: [] })
    );
    act(() => result.current.saveCustomFilter({ id: 'bad-label', label: ' ', query: 'x' }));
    act(() => result.current.saveCustomFilter({ id: 'bad-query', label: 'Good', query: '' }));
    act(() => result.current.toggleCustomFilter('missing'));
    act(() => result.current.clearAllFilters());
    expect(state.updateFilter).toHaveBeenCalledWith({ id: 'active', is_active: false });
    expect(state.updateFilter).not.toHaveBeenCalledWith({ id: 'inactive', is_active: false });
    expect(result.current.filteredItems.map(item => item.id)).toEqual(['one']);
  });

  it('updates existing and creates new filters and toggles inactive filters on', () => {
    state.filters = [{ id: 'saved', label: 'Saved', query: 'status == open', is_active: false }];
    const { result } = renderHook(() =>
      usePqlCollection({ items, fields, storageKey: 'persist', groupId: 'group-1' })
    );
    const filter: PqlFilter<Field> = {
      id: 'saved',
      label: ' Updated ',
      query: 'status == closed',
    };
    act(() => result.current.saveCustomFilter(filter));
    act(() => result.current.saveCustomFilter({ ...filter, id: 'new' }));
    act(() => result.current.toggleCustomFilter('saved'));
    act(() => result.current.deleteCustomFilter('saved'));
    expect(state.updateFilter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved', label: 'Updated' })
    );
    expect(state.createFilter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new', group_id: 'group-1' })
    );
    expect(state.updateFilter).toHaveBeenCalledWith({ id: 'saved', is_active: true });
    expect(state.deleteFilter).toHaveBeenCalledWith('saved');
  });
});

describe('PQL filter builder remaining branches A09', () => {
  const onOpenChange = vi.fn();
  const onSave = vi.fn();

  it('builds placeholders for empty, equality, IN, IS SET, and quoted option fields', () => {
    const empty = renderHook(() =>
      usePqlFilterBuilderDialogController({
        open: false,
        fields: [] as readonly PqlFieldDefinition<Item, Field>[],
        onOpenChange,
        onSave,
      })
    );
    expect(empty.result.current.queryPlaceholder).toContain('field == value');
    empty.unmount();

    const equalityField = [
      { ...fields[0], operators: ['eq'] as const, options: undefined },
    ] as readonly PqlFieldDefinition<Item, Field>[];
    const equality = renderHook(() =>
      usePqlFilterBuilderDialogController({
        open: true,
        fields: equalityField,
        onOpenChange,
        onSave,
      })
    );
    expect(equality.result.current.queryPlaceholder).toContain('title == value');
    equality.unmount();

    const inFields = [
      fields[0],
      {
        ...fields[1],
        options: [{ value: 'closed', label: 'Closed state' }],
      },
    ];
    const inResult = renderHook(() =>
      usePqlFilterBuilderDialogController({
        open: true,
        fields: inFields,
        onOpenChange,
        onSave,
      })
    );
    expect(inResult.result.current.queryPlaceholder).toContain('"Closed state"');
    inResult.unmount();

    const isSet = renderHook(() =>
      usePqlFilterBuilderDialogController({
        open: true,
        fields: [fields[0], fields[2]],
        onOpenChange,
        onSave,
      })
    );
    expect(isSet.result.current.queryPlaceholder).toContain('tag IS SET');
  });

  it('resets new filters, restores existing filters, validates input, and saves', () => {
    const existingFilter: PqlFilter<Field> = {
      id: 'saved',
      label: 'Saved',
      query: 'status == open',
    };
    const props = { open: true, fields, onOpenChange, onSave };
    const { result, rerender } = renderHook(
      ({ filter }: { filter?: PqlFilter<Field> | null }) =>
        usePqlFilterBuilderDialogController({ ...props, filter }),
      { initialProps: { filter: existingFilter as PqlFilter<Field> | null | undefined } }
    );
    expect(result.current.label).toBe('Saved');
    act(() => result.current.onSave());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'saved' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender({ filter: null });
    expect(result.current).toMatchObject({ label: '', query: '', isValid: false });
    act(() => result.current.onSave());
    act(() => result.current.onLabelChange('New'));
    act(() => result.current.onQueryChange('invalid ???'));
    expect(result.current.isQueryValid).toBe(false);
    act(() => result.current.onQueryChange('status == closed'));
    expect(result.current.isValid).toBe(true);
    act(() => result.current.onSave());
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'New' }));
  });
});

describe('PQL query editor remaining branches A09', () => {
  it('covers empty and non-opening keys, wrapping navigation, tab, escape, and null cursors', () => {
    const onChange = vi.fn();
    const empty = renderHook(() =>
      usePqlQueryEditorController({ fields: [], value: '', onChange })
    );
    const preventDefault = vi.fn();
    act(() => empty.result.current.onKeyDown({ key: 'Other', preventDefault } as never));
    expect(preventDefault).not.toHaveBeenCalled();
    empty.unmount();

    const noMatches = renderHook(() =>
      usePqlQueryEditorController({ fields: [], value: 'zzzz', onChange })
    );
    act(() => noMatches.result.current.onKeyDown({ key: 'ArrowDown', preventDefault } as never));
    expect(preventDefault).not.toHaveBeenCalled();
    noMatches.unmount();

    const { result } = renderHook(() =>
      usePqlQueryEditorController({ fields, value: '', onChange })
    );
    act(() => result.current.onFocus());
    expect(result.current.suggestions.length).toBeGreaterThan(1);
    act(() => result.current.onKeyDown({ key: 'Other', preventDefault } as never));
    act(() => result.current.onSuggestionHover(result.current.suggestions.length - 1));
    act(() => result.current.onKeyDown({ key: 'ArrowDown', preventDefault } as never));
    expect(result.current.selectedSuggestionIndex).toBe(0);
    act(() => result.current.onKeyDown({ key: 'ArrowUp', preventDefault } as never));
    expect(result.current.selectedSuggestionIndex).toBe(result.current.suggestions.length - 1);
    act(() => result.current.onKeyDown({ key: 'Tab', preventDefault } as never));
    expect(onChange).toHaveBeenCalled();
    act(() => result.current.onKeyDown({ key: 'Escape', preventDefault } as never));
    expect(result.current.suggestionsOpen).toBe(false);

    act(() =>
      result.current.onChange({ target: { value: 'status', selectionStart: null } } as never)
    );
    result.current.textareaRef.current = null;
    act(() => {
      result.current.onClick();
      result.current.onKeyUp();
      result.current.onSelect();
    });
  });

  it('clears a pending blur on focus and selection and ignores a missing RAF textarea', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
    const { result, unmount } = renderHook(() =>
      usePqlQueryEditorController({ fields, value: '', onChange: vi.fn() })
    );
    act(() => result.current.onBlur());
    act(() => result.current.onFocus());
    act(() => result.current.onBlur());
    const suggestion = result.current.suggestions[0]!;
    act(() => result.current.onSuggestionSelect(suggestion));
    result.current.textareaRef.current = null;
    act(() => vi.runAllTimers());
    act(() => result.current.onBlur());
    unmount();
  });
});
