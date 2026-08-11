/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, values: any) => `${values.fieldKey}:${values.valueb7f0}`,
}));

import { usePqlComboboxController } from '../usePqlComboboxController';
import { usePqlToolbarController } from '../usePqlToolbarController';

it('filters an option without keywords', () => {
  const { result } = renderHook(() =>
    usePqlComboboxController({ options: [{ value: 'one', label: 'One' }], onValueChange: vi.fn() })
  );
  act(() => result.current.onQueryChange('missing'));
  expect(result.current.filteredOptions).toEqual([]);
});

it('builds quick/custom badges with field and value fallbacks and exposes dialog state', () => {
  const onQuickFilterToggle = vi.fn();
  const onCustomFilterToggle = vi.fn();
  const saved = [{ id: 'saved', label: 'Saved', query: 'x' }];
  const { result } = renderHook(() =>
    usePqlToolbarController({
      fields: [
        {
          key: 'status',
          label: 'Status',
          kind: 'text',
          operators: ['eq'],
          getValue: () => '',
          options: [{ value: 'open', label: 'Open' }],
        },
      ] as any,
      quickFilters: [
        { fieldKey: 'status', label: 'State' },
        { fieldKey: 'missing' },
        { fieldKey: 'without-values' },
      ],
      quickFilterValues: { status: ['open'], missing: ['raw'] },
      onQuickFilterToggle,
      savedFilters: saved,
      activeCustomFilterIds: ['saved'],
      onCustomFilterToggle,
    })
  );
  expect(result.current.activeQuickBadgeCount).toBe(2);
  result.current.activeBadges.forEach(badge => badge.onClear());
  expect(onQuickFilterToggle).toHaveBeenCalledTimes(2);
  expect(onCustomFilterToggle).toHaveBeenCalledWith('saved');
  act(() => {
    result.current.onBuilderOpenChange(true);
    result.current.onCustomFiltersOpenChange(true);
    result.current.onFieldFiltersOpenChange(true);
    result.current.onEditFilter(saved[0]);
  });
  expect(result.current).toMatchObject({
    builderOpen: true,
    customFiltersOpen: true,
    fieldFiltersOpen: true,
    editingFilter: saved[0],
  });
});
