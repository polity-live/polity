/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useFacadeGroupLinksMock = vi.fn();
const createLinkMock = vi.fn();
const deleteLinkMock = vi.fn();
const waitForClientApplyMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupLinks: (...args: unknown[]) => useFacadeGroupLinksMock(...args),
}));

vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ createLink: createLinkMock, deleteLink: deleteLinkMock }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => waitForClientApplyMock(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

import { useGroupLinks } from '../useGroupLinks';

describe('useGroupLinks', () => {
  beforeEach(() => {
    useFacadeGroupLinksMock.mockReset();
    createLinkMock.mockReset();
    deleteLinkMock.mockReset();
    waitForClientApplyMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useFacadeGroupLinksMock.mockReturnValue({ links: [{ id: 'link-1' }], isLoading: false });
    waitForClientApplyMock.mockResolvedValue(undefined);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'new-link') });
  });

  it('adds links with optional senders and exposes mutation loading', async () => {
    createLinkMock.mockReturnValue('create-result');
    let resolveApply!: () => void;
    waitForClientApplyMock.mockImplementationOnce(
      () => new Promise<void>(resolve => (resolveApply = resolve))
    );
    const { result } = renderHook(() => useGroupLinks('group-1'));

    let addPromise!: ReturnType<typeof result.current.addLink>;
    await act(async () => {
      addPromise = result.current.addLink('Label', 'https://example.com');
      await Promise.resolve();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      resolveApply();
      await addPromise;
    });
    expect(createLinkMock).toHaveBeenCalledWith({
      id: 'new-link',
      label: 'Label',
      url: 'https://example.com',
      group_id: 'group-1',
      user_id: null,
      event_id: null,
    });
    expect(result.current.isLoading).toBe(false);
    expect(await result.current.addLink('Second', 'https://second.example', 'sender-1')).toEqual({
      success: true,
      linkId: 'new-link',
    });
    expect(createLinkMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: 'sender-1' })
    );
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('reports add and delete failures and successful deletion', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createLinkMock.mockReturnValue('create-result');
    deleteLinkMock.mockReturnValue('delete-result');
    waitForClientApplyMock
      .mockRejectedValueOnce(new Error('add failed'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('delete failed'));
    const { result } = renderHook(() => useGroupLinks('group-1'));

    expect(await result.current.addLink('Label', 'https://example.com')).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    expect(await result.current.deleteLink('link-1')).toEqual({ success: true });
    expect(deleteLinkMock).toHaveBeenCalledWith({ id: 'link-1' });
    expect(await result.current.deleteLink('link-2')).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('combines query loading with local mutation loading', () => {
    useFacadeGroupLinksMock.mockReturnValue({ links: [], isLoading: true });
    const { result } = renderHook(() => useGroupLinks('group-1'));
    expect(result.current.links).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
