/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn((value: any) => value) }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({ gatedToast: { success: vi.fn() } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ useTranslation: () => ({ t: (key: string) => key }), translate: (key: string) => key }));
vi.mock('@/zero/mutators', () => ({ mutators: { groups: new Proxy({}, { get: (_target, name) => (args: any) => ({ name, args }) }) } }));
vi.mock('@/zero/mutate-with-server-check', () => ({ onServerError: vi.fn(), toMutationError: (value: any) => value }));
vi.mock('@/zero/rbac/handleMutationError', () => ({ handleMutationError: vi.fn() }));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({ trackCreationUnlessSilent: vi.fn() }));
vi.mock('@/zero/rbac/constants', () => ({ DEFAULT_GROUP_ROLES: [{ name: 'Member', description: 'Member', permissions: [] }] }));

import { useGroupActions } from '../useGroupActions';

describe('useGroupActions without an admin role', () => {
  it('skips creator membership setup', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid' as any);
    const { result } = renderHook(() => useGroupActions());
    expect(result.current.setupGroupAdminRoles('g')).toHaveLength(1);
    expect(mocks.mutate).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'joinGroup' }));
  });
});
