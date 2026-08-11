/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const family = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, property: string) => (args: unknown) => ({
          mutation: `${name}.${property}`,
          args,
        }),
      }
    );
  const mutate = vi.fn((mutation: unknown) => ({ mutation }));
  return {
    mutate,
    mutators: { amendments: family('amendments'), common: family('common') },
    success: vi.fn(),
    error: vi.fn(),
    onServerError: vi.fn(),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: mocks.mutators }));
vi.mock('../../mutate-with-server-check', () => ({ onServerError: mocks.onServerError }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  getEditingModeOption: (mode: string) => ({ label: mode }),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: vi.fn(),
}));

import { useAmendmentActions } from '../useAmendmentActions';

beforeEach(() => {
  mocks.mutate.mockClear();
  mocks.success.mockClear();
  mocks.error.mockClear();
  mocks.onServerError.mockClear();
});

describe('useAmendmentActions branch contracts', () => {
  it('finalizes passed and rejected branches with the matching feedback', () => {
    const { result } = renderHook(() => useAmendmentActions());

    result.current.finalizeAmendment('branch-1', 'passed');
    result.current.finalizeAmendment('branch-2', 'rejected');

    expect(mocks.mutate).toHaveBeenNthCalledWith(1, {
      mutation: 'amendments.updateProcessBranch',
      args: { id: 'branch-1', editing_mode: 'passed' },
    });
    expect(mocks.mutate).toHaveBeenNthCalledWith(2, {
      mutation: 'amendments.updateProcessBranch',
      args: { id: 'branch-2', editing_mode: 'rejected' },
    });
    expect(mocks.success).toHaveBeenNthCalledWith(1, 'features.amendments.toasts.passed');
    expect(mocks.success).toHaveBeenNthCalledWith(2, 'features.amendments.toasts.rejected');
  });

  it('only shows resolved support feedback for confirmed or declined decisions', () => {
    const { result } = renderHook(() => useAmendmentActions());

    result.current.updateSupportConfirmation({ id: 'one', status: 'confirmed' } as never);
    result.current.updateSupportConfirmation({ id: 'two', status: 'declined' } as never);
    result.current.updateSupportConfirmation({ id: 'three', status: 'pending' } as never);

    expect(mocks.success).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenNthCalledWith(1, 'features.amendments.toasts.supportConfirmed');
    expect(mocks.success).toHaveBeenNthCalledWith(2, 'features.amendments.toasts.supportDeclined');
    expect(mocks.onServerError).toHaveBeenCalledTimes(3);
  });
});
