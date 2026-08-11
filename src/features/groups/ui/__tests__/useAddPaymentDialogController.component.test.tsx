/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currency: 'EUR',
  users: undefined as any[] | undefined,
  groups: undefined as any[] | undefined,
  error: vi.fn(),
  submit: vi.fn(),
  openChange: vi.fn(),
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: mocks.currency }),
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ allUsers: mocks.users }) }));
vi.mock('@/zero/groups/useGroupState', () => ({ useAllGroups: () => ({ groups: mocks.groups }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { useAddPaymentDialogController } from '../useAddPaymentDialogController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currency = 'EUR';
  mocks.users = undefined;
  mocks.groups = undefined;
});

const props = (direction: 'income' | 'expense' = 'income', open = true) => ({
  open,
  onOpenChange: mocks.openChange,
  onSubmit: mocks.submit,
  direction,
  groupId: 'group',
});

describe('useAddPaymentDialogController', () => {
  it('filters users and groups and formats every user-name fallback', () => {
    mocks.users = [
      null,
      { id: null },
      { id: 'full', first_name: 'First', last_name: 'Last' },
      { id: 'handle', handle: 'Handle', email: 'handle@mail' },
      { id: 'email', email: 'match@mail' },
      { id: 'unnamed' },
    ];
    mocks.groups = [
      { id: 'one', name: 'Matching Group' },
      { id: 'two', name: undefined },
    ];
    const hook = renderHook(() => useAddPaymentDialogController(props()));
    expect(hook.result.current.getUserDisplayName({ first_name: 'A', last_name: 'B' })).toBe('A B');
    expect(hook.result.current.getUserDisplayName({ handle: 'handle' })).toBe('handle');
    expect(hook.result.current.getUserDisplayName({})).toBe('Unnamed User');
    expect(hook.result.current.filteredUsers).toHaveLength(4);
    expect(hook.result.current.filteredGroups).toEqual([]);
    act(() => hook.result.current.setSearchQuery('match'));
    expect(hook.result.current.filteredUsers?.map(user => user.id)).toEqual(['email']);
    act(() => hook.result.current.setSearchQuery('handle'));
    expect(hook.result.current.filteredUsers?.map(user => user.id)).toEqual(['handle']);
    act(() => hook.result.current.setEntityType('group'));
    act(() => hook.result.current.setSearchQuery('matching'));
    expect(hook.result.current.filteredUsers).toEqual([]);
    expect(hook.result.current.filteredGroups?.map(group => group.id)).toEqual(['one']);
  });

  it('keeps undefined collections and syncs currency only while open', () => {
    const closed = renderHook(({ open }) => useAddPaymentDialogController(props('income', open)), {
      initialProps: { open: false },
    });
    expect(closed.result.current.filteredUsers).toBeUndefined();
    act(() => closed.result.current.setCurrency('GBP'));
    mocks.currency = 'USD';
    closed.rerender({ open: false });
    expect(closed.result.current.currency).toBe('GBP');
    closed.rerender({ open: true });
    expect(closed.result.current.currency).toBe('USD');
  });

  it('rejects missing counterparties with direction-specific errors', () => {
    for (const direction of ['income', 'expense'] as const) {
      const { result } = renderHook(() => useAddPaymentDialogController(props(direction)));
      const event = { preventDefault: vi.fn() } as any;
      act(() => result.current.handleSubmit(event));
      expect(event.preventDefault).toHaveBeenCalled();
    }
    expect(mocks.error.mock.calls[0][0]).toContain('selectPayer');
    expect(mocks.error.mock.calls[1][0]).toContain('selectReceiver');
  });

  it('submits all four direction/entity combinations and resets the form', () => {
    for (const direction of ['income', 'expense'] as const) {
      for (const entityType of ['user', 'group'] as const) {
        const { result } = renderHook(() => useAddPaymentDialogController(props(direction)));
        act(() => {
          result.current.setLabel('Payment');
          result.current.setType('donation');
          result.current.setAmount('12.5');
          result.current.setCurrency('USD');
          result.current.setSearchQuery('query');
          result.current.setEntityType(entityType);
          result.current.setSelectedEntity({ id: 'entity', name: 'Entity', type: entityType });
        });
        act(() => result.current.handleSubmit({ preventDefault: vi.fn() } as any));
        const submitted = mocks.submit.mock.calls.at(-1)?.[0] as any;
        expect(submitted).toMatchObject({
          label: 'Payment',
          type: 'donation',
          amount: 12.5,
          currency: 'USD',
          direction,
        });
        if (direction === 'income' && entityType === 'user')
          expect(submitted).toMatchObject({ receiverGroupId: 'group', payerUserId: 'entity' });
        if (direction === 'income' && entityType === 'group')
          expect(submitted).toMatchObject({ receiverGroupId: 'group', payerGroupId: 'entity' });
        if (direction === 'expense' && entityType === 'user')
          expect(submitted).toMatchObject({ payerGroupId: 'group', receiverUserId: 'entity' });
        if (direction === 'expense' && entityType === 'group')
          expect(submitted).toMatchObject({ payerGroupId: 'group', receiverGroupId: 'entity' });
        expect(result.current).toMatchObject({
          label: '',
          type: 'donation',
          amount: '',
          currency: 'EUR',
          selectedEntity: null,
          searchQuery: '',
          entityType: 'user',
        });
      }
    }
  });
});
