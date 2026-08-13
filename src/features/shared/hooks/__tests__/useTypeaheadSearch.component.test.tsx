/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ items: [] as any[] }));

vi.mock('../useTypeaheadData', () => ({
  useTypeaheadData: () => ({ items: mocks.items }),
}));

import { useTypeaheadSearch } from '../useTypeaheadSearch';

const alice = { entityType: 'user', id: 'alice', label: 'Alice' } as any;
const bob = { entityType: 'user', id: 'bob', label: 'Bob' } as any;

describe('useTypeaheadSearch', () => {
  beforeEach(() => {
    mocks.items = [alice];
  });

  it('uses default options and internal data', () => {
    const view = renderHook(() => useTypeaheadSearch({}));
    expect(view.result.current.items).toEqual([alice]);
  });

  it('prefers external items and updates filtered results', () => {
    const view = renderHook(() => useTypeaheadSearch({ items: [alice, bob] }));
    expect(view.result.current.items).toEqual([alice, bob]);

    act(() => view.result.current.setQuery('Bob'));

    expect(view.result.current.results).toEqual([bob]);
  });
});
