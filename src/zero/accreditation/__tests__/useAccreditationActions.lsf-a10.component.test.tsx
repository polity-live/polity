/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const action = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    mutate: vi.fn((descriptor: unknown) => ({ descriptor })),
    serverConfirmed: vi.fn(() => Promise.resolve()),
    toastSuccess: vi.fn(),
    accreditation: {
      requestAccreditation: action('requestAccreditation'),
      approveAccreditation: action('approveAccreditation'),
      rejectAccreditation: action('rejectAccreditation'),
      revokeAccreditation: action('revokeAccreditation'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { accreditation: mocks.accreditation } }));
vi.mock('../../mutate-with-server-check', () => ({ serverConfirmed: mocks.serverConfirmed }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAccreditationActions } from '../useAccreditationActions';

describe('useAccreditationActions action facade', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('requests/confirms and invokes all three decisions', async () => {
    const { result } = renderHook(() => useAccreditationActions());

    await act(async () => {
      await result.current.requestAccreditation({ id: 'request' } as never);
      await result.current.confirmAccreditation({ id: 'confirm' } as never);
      await result.current.approveAccreditation({ accreditation_id: 'accreditation' });
      await result.current.rejectAccreditation({ accreditation_id: 'accreditation', reason: 'no' });
      await result.current.revokeAccreditation({
        accreditation_id: 'accreditation',
        reason: 'later',
      });
    });

    expect(mocks.accreditation.requestAccreditation).toHaveBeenCalledTimes(2);
    expect(mocks.accreditation.approveAccreditation).toHaveBeenCalledOnce();
    expect(mocks.accreditation.rejectAccreditation).toHaveBeenCalledOnce();
    expect(mocks.accreditation.revokeAccreditation).toHaveBeenCalledOnce();
    expect(mocks.serverConfirmed).toHaveBeenCalledTimes(5);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
  });
});
