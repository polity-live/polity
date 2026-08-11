/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn((value: any) => value), success: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutators', () => ({
  mutators: { groups: new Proxy({}, { get: (_target, name) => (args: any) => ({ name, args }) }) },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: vi.fn(),
  toMutationError: (value: any) => value,
}));
vi.mock('@/zero/rbac/handleMutationError', () => ({ handleMutationError: vi.fn() }));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: vi.fn(),
}));

import { useGroupActions } from '../useGroupActions';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid' as any);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useGroupActions branches', () => {
  it('shows or suppresses update toast and creates default admin setup', () => {
    const { result } = renderHook(() => useGroupActions());
    result.current.updateGroup({ id: 'g' } as any);
    expect(mocks.success).toHaveBeenCalled();
    mocks.success.mockClear();
    result.current.updateGroup({ id: 'g' } as any, { silent: true });
    expect(mocks.success).not.toHaveBeenCalled();
    const results = result.current.setupGroupAdminRoles('g');
    expect(results.length).toBeGreaterThan(0);
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'joinGroup' }));
  });
});
