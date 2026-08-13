/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PqlFieldDefinition, PqlFilter } from '../../logic/applyPqlFilter';

import { usePqlCollection } from '../usePqlCollection';
import { usePqlComboboxController } from '../usePqlComboboxController';
import { usePqlQueryEditorController } from '../usePqlQueryEditorController';

interface Item {
  id: string;
  title: string;
  status: 'open' | 'closed';
}

type Field = 'title' | 'status';

const items: Item[] = [
  { id: 'item-1', title: 'Climate budget', status: 'open' },
  { id: 'item-2', title: 'Archived minutes', status: 'closed' },
  { id: 'item-3', title: 'Budget report', status: 'closed' },
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
      { value: 'closed', label: 'Closed' },
    ],
    getValue: item => item.status,
  },
];

const mocks = vi.hoisted(() => ({
  filters: [] as any[],
  isLoading: false,
  createFilter: vi.fn(),
  updateFilter: vi.fn(),
  deleteFilter: vi.fn(),
}));

vi.mock('@/zero/pql/usePqlFilterState', () => ({
  usePqlFilterState: () => ({ filters: mocks.filters, isLoading: mocks.isLoading }),
}));

vi.mock('@/zero/pql/usePqlFilterActions', () => ({
  usePqlFilterActions: () => ({
    createFilter: mocks.createFilter,
    updateFilter: mocks.updateFilter,
    deleteFilter: mocks.deleteFilter,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.filters = [];
  mocks.isLoading = false;
  localStorage.clear();
});

describe('usePqlCollection', () => {
  it('combines normalized search, quick filters, persisted expressions, sorting, and active state', () => {
    mocks.filters = [
      {
        id: 'saved-1',
        label: 'Closed',
        query: 'status == closed',
        is_active: true,
      },
    ];
    const { result } = renderHook(() =>
      usePqlCollection({
        items,
        fields,
        searchValues: [(item: Item) => item.title, (item: Item) => [item.status]],
        quickFilters: [{ fieldKey: 'status' as const, multiple: true }],
        storageKey: 'pql-items',
        groupId: 'group-1',
        sortItems: nextItems => [...nextItems].reverse(),
      })
    );

    expect(result.current.filteredItems.map(item => item.id)).toEqual(['item-3', 'item-2']);
    expect(result.current.savedFilters[0]).toMatchObject({ id: 'saved-1', label: 'Closed' });
    expect(result.current.activeCustomFilterIds).toEqual(['saved-1']);

    act(() => result.current.setSearchQuery(' BUDGET '));
    expect(result.current.filteredItems.map(item => item.id)).toEqual(['item-3']);
    act(() => result.current.toggleQuickFilterValue('status', 'open'));
    expect(result.current.filteredItems).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.toggleQuickFilterValue('status', 'open'));
    act(() => result.current.setQuickFilterValues('status', ['closed']));
    expect(result.current.quickFilterValues.status).toEqual(['closed']);
    act(() => result.current.clearQuickFilter('status'));
    expect(result.current.quickFilterValues.status).toBeUndefined();
  });

  it('migrates valid legacy filters once and provides guarded create, update, delete, toggle, and clear actions', () => {
    const legacy: PqlFilter<Field> = {
      id: 'legacy-1',
      label: ' Legacy closed ',
      query: 'status == closed',
    };
    localStorage.setItem(
      'pql-items',
      JSON.stringify({ savedFilters: [legacy], activeCustomFilterIds: ['legacy-1'] })
    );
    const { result, rerender } = renderHook(() =>
      usePqlCollection({ items, fields, storageKey: 'pql-items', groupId: 'group-1' })
    );
    expect(mocks.createFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'legacy-1',
        label: 'Legacy closed',
        storage_key: 'pql-items',
        group_id: 'group-1',
        is_active: true,
      })
    );
    expect(localStorage.getItem('pql-items')).toBeNull();

    mocks.filters = [
      { id: 'saved-1', label: 'Closed', query: 'status == closed', is_active: true },
      { id: 'saved-2', label: 'Open', query: 'status == open', is_active: false },
    ];
    rerender();
    act(() => result.current.saveCustomFilter({ ...legacy, id: 'saved-1', label: ' Updated ' }));
    expect(mocks.updateFilter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-1', label: 'Updated' })
    );
    act(() => result.current.saveCustomFilter({ ...legacy, id: 'new-1', label: ' New ' }));
    expect(mocks.createFilter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-1', label: 'New', is_active: false })
    );
    act(() =>
      result.current.saveCustomFilter({ ...legacy, id: 'invalid', label: '  ', query: '' })
    );
    act(() => result.current.toggleCustomFilter('missing'));
    act(() => result.current.toggleCustomFilter('saved-1'));
    expect(mocks.updateFilter).toHaveBeenCalledWith({ id: 'saved-1', is_active: false });
    act(() => result.current.deleteCustomFilter('saved-2'));
    expect(mocks.deleteFilter).toHaveBeenCalledWith('saved-2');

    act(() => result.current.setSearchQuery('query'));
    act(() => result.current.clearAllFilters());
    expect(result.current.searchQuery).toBe('');
    expect(mocks.updateFilter).toHaveBeenCalledWith({ id: 'saved-1', is_active: false });
  });
});

describe('usePqlComboboxController', () => {
  it('normalizes mention queries and resets query and popover state for select and clear actions', () => {
    const onValueChange = vi.fn();
    const options = [
      { value: 'ada', label: 'Ada Lovelace', keywords: ['analytical engine'] },
      { value: 'grace', label: 'Grace Hopper', keywords: ['compiler'] },
    ];
    const { result } = renderHook(() =>
      usePqlComboboxController({ value: 'ada', onValueChange, options })
    );
    expect(result.current.selectedOption).toEqual(options[0]);
    expect(result.current.filteredOptions).toEqual(options);

    act(() => {
      result.current.onOpenChange(true);
      result.current.onQueryChange('@@ COMPILER ');
    });
    expect(result.current.open).toBe(true);
    expect(result.current.filteredOptions).toEqual([options[1]]);
    act(() => result.current.onSelectOption('grace'));
    expect(onValueChange).toHaveBeenCalledWith('grace');
    expect(result.current).toMatchObject({ open: false, query: '' });
    act(() => result.current.onClearSelection());
    expect(onValueChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe('usePqlQueryEditorController', () => {
  it('opens suggestions through editing and keyboard navigation and applies a selected suggestion', () => {
    const animationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePqlQueryEditorController({ fields, value: '', onChange })
    );
    const textarea = document.createElement('textarea');
    const setSelectionRange = vi.spyOn(textarea, 'setSelectionRange');
    result.current.textareaRef.current = textarea;

    const preventDefault = vi.fn();
    act(() => result.current.onKeyDown({ key: 'ArrowDown', preventDefault } as any));
    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.suggestionsOpen).toBe(true);
    expect(result.current.suggestions.length).toBeGreaterThan(0);

    act(() => result.current.onKeyDown({ key: 'ArrowDown', preventDefault } as any));
    expect(result.current.selectedSuggestionIndex).toBe(1);
    act(() => result.current.onKeyDown({ key: 'ArrowUp', preventDefault } as any));
    expect(result.current.selectedSuggestionIndex).toBe(0);
    const suggestion = result.current.suggestions[0]!;
    act(() => result.current.onKeyDown({ key: 'Enter', preventDefault } as any));
    expect(onChange).toHaveBeenCalledWith(expect.any(String));
    expect(setSelectionRange).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    act(() => result.current.onKeyDown({ key: 'Escape', preventDefault } as any));
    expect(result.current.suggestionsOpen).toBe(false);
    result.current.textareaRef.current = null;
    act(() => result.current.onSuggestionSelect(suggestion));
    animationFrame.mockRestore();
  });

  it('synchronizes cursor events, delayed blur, hover, and editor changes without stale timers', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      usePqlQueryEditorController({ fields, value: 'status', onChange })
    );
    const textarea = document.createElement('textarea');
    textarea.value = 'status';
    textarea.setSelectionRange(3, 3);
    result.current.textareaRef.current = textarea;

    act(() => result.current.onChange({ target: { value: 'status ', selectionStart: 7 } } as any));
    expect(onChange).toHaveBeenCalledWith('status ');
    act(() => {
      result.current.onClick();
      result.current.onKeyUp();
      result.current.onSelect();
      result.current.onSuggestionHover(4);
      result.current.onBlur();
      vi.advanceTimersByTime(120);
    });
    expect(result.current.suggestionsOpen).toBe(false);
    unmount();
    vi.useRealTimers();
  });
});
