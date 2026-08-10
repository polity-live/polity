/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
import { useSupporterDirectorySectionModel } from '../useSupporterDirectorySectionModel';

describe('useSupporterDirectorySectionModel A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sorts items, filters missing map rows, selects, and clears only the active group', () => {
    const alpha = { groupId: 'alpha', name: 'Alpha' } as any;
    const beta = { groupId: 'beta', name: 'Beta' } as any;
    const { result } = renderHook(() =>
      useSupporterDirectorySectionModel({ items: [beta, alpha], mapItems: [beta] })
    );
    expect(result.current.sortedItems).toEqual([alpha, beta]);
    expect(result.current.sortedMapItems).toEqual([beta]);
    act(() => result.current.onActiveGroupChange('alpha'));
    act(() => result.current.onClearActiveGroup('beta'));
    expect(result.current.activeGroupId).toBe('alpha');
    act(() => result.current.onClearActiveGroup('alpha'));
    expect(result.current.activeGroupId).toBeNull();
    act(() => result.current.onSelect('beta'));
    expect(navigate).toHaveBeenCalledWith({ to: '/group/$id', params: { id: 'beta' } });
  });
});
