/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const collection = vi.hoisted(() => vi.fn((options: Record<string, any>) => options));

vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: collection,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useTodoFilters } from '../useTodoFilters';

it('sorts archived records with absent archival timestamps deterministically', () => {
  renderHook(() => useTodoFilters([], undefined, { archiveMode: 'archived' }));
  const sortItems = collection.mock.calls.at(-1)?.[0].sortItems as (items: any[]) => any[];

  expect(
    sortItems([{ id: 'without-key' }, { id: 'null-value', archived_at: null }]).map(todo => todo.id)
  ).toEqual(['without-key', 'null-value']);
});
