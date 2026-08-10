// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  allHashtags: undefined as { id: string; tag: string }[] | undefined,
  syncEntityHashtags: vi.fn(),
}));

vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({ allHashtags: mocks.allHashtags }),
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncEntityHashtags }),
}));

import { useHashtags } from '../useHashtags';

beforeEach(() => {
  mocks.allHashtags = undefined;
  mocks.syncEntityHashtags.mockReset();
});

describe('useHashtags', () => {
  it('uses empty defaults and skips synchronization without an entity id', async () => {
    const { result } = renderHook(() => useHashtags({ entityType: 'event' }));
    expect(result.current.allHashtags).toEqual([]);
    expect(result.current.suggestions).toEqual([]);
    await act(async () => result.current.syncHashtags());
    expect(mocks.syncEntityHashtags).not.toHaveBeenCalled();

    const identified = renderHook(() => useHashtags({ entityType: 'event', entityId: 'event-1' }));
    await act(async () => identified.result.current.syncHashtags());
    expect(mocks.syncEntityHashtags).toHaveBeenCalledWith('event', 'event-1', [], [], []);
    identified.unmount();
  });

  it('derives suggestions and synchronizes the latest local tags', async () => {
    mocks.allHashtags = [
      { id: 'h1', tag: 'one' },
      { id: 'h2', tag: 'two' },
    ];
    mocks.syncEntityHashtags.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useHashtags({ entityType: 'statement', entityId: 'statement-1' })
    );
    expect(result.current.suggestions).toEqual(['one', 'two']);
    expect(result.current.allHashtags).toBe(mocks.allHashtags);

    act(() => result.current.setTags(['two']));
    await act(async () => result.current.syncHashtags());
    expect(mocks.syncEntityHashtags).toHaveBeenCalledWith(
      'statement',
      'statement-1',
      ['two'],
      [],
      mocks.allHashtags
    );
  });
});
