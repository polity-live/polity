/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en',
  confirmations: [] as any[],
  loading: false,
  confirm: vi.fn(),
  decline: vi.fn(),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mocks.language },
  }),
}));
vi.mock('../../hooks/useSupportConfirmation', () => ({
  useSupportConfirmation: () => ({
    pendingConfirmations: mocks.confirmations,
    isLoading: mocks.loading,
    confirmSupport: mocks.confirm,
    declineSupport: mocks.decline,
  }),
}));

import { useSupportConfirmationPanelController } from '../useSupportConfirmationPanelController';

describe('useSupportConfirmationPanelController A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.language = 'en';
    mocks.confirmations = [];
    mocks.loading = false;
    mocks.confirm.mockResolvedValue(undefined);
    mocks.decline.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('derives loading, empty, and ready states and both locales', () => {
    mocks.loading = true;
    const { result, rerender } = renderHook(() =>
      useSupportConfirmationPanelController({ groupId: 'group' })
    );
    expect(result.current.status).toBe('loading');
    mocks.loading = false;
    rerender();
    expect(result.current.status).toBe('empty');
    mocks.confirmations = [{ id: 'confirmation' }];
    mocks.language = 'de';
    rerender();
    expect(result.current.status).toBe('ready');
    expect(result.current.dateLocale.code).toBe('de');
  });

  it('clears processing and comparison state after confirm and decline', async () => {
    const { result } = renderHook(() =>
      useSupportConfirmationPanelController({ groupId: 'group' })
    );
    act(() => result.current.setSelectedConfirmation('confirmation'));
    await act(async () => result.current.handleConfirm('confirmation'));
    expect(mocks.confirm).toHaveBeenCalledWith('confirmation');
    expect(result.current.selectedConfirmation).toBeNull();
    expect(result.current.processingId).toBeNull();

    act(() => result.current.setSelectedConfirmation('confirmation'));
    await act(async () => result.current.handleDecline('confirmation'));
    expect(mocks.decline).toHaveBeenCalledWith('confirmation');
    expect(result.current.processingId).toBeNull();
  });

  it('clears processing in finally when confirmation rejects', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('failed'));
    const { result } = renderHook(() =>
      useSupportConfirmationPanelController({ groupId: 'group' })
    );
    await expect(act(async () => result.current.handleConfirm('confirmation'))).rejects.toThrow(
      'failed'
    );
    await waitFor(() => expect(result.current.processingId).toBeNull());
  });
});
