/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreatePaymentForm } from '../useCreatePaymentForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const createPayment = vi.fn();
const navigate = vi.fn();
let searchParams: Record<string, string | undefined> = {};
let authUser: { id: string } | null = { id: 'user-current' };
let activeGroups: any[] = [{ id: 'group-1', name: 'Budget Circle' }];
let activeGroupsLoading = false;
let membersLoading = false;
let displayCurrency = 'EUR';
let preferenceLoading = false;
let restoreDraft: any = null;
const finalizationMocks = vi.hoisted(() => ({
  track: vi.fn(),
  wait: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => searchParams,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: authUser,
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroups: () => ({
    groups: activeGroups,
    isLoading: activeGroupsLoading,
  }),
  useAssignableGroupMembersByGroupIds: (groupIds: readonly string[] = []) => ({
    members: groupIds.includes('group-1') ? [{ user_id: 'user-1', user: { id: 'user-1' } }] : [],
    isLoading: membersLoading,
  }),
  useGroupById: (id?: string) => ({
    group: id ? { id, name: 'Budget Circle' } : undefined,
  }),
}));

vi.mock('@/zero/payments/usePaymentActions', () => ({
  usePaymentActions: () => ({
    createPayment,
  }),
}));

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency, isLoading: preferenceLoading }),
}));

vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => restoreDraft,
  trackCreateFinalization: finalizationMocks.track,
  waitForOptimisticCreate: finalizationMocks.wait,
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    allUsers: [{ id: 'user-1', first_name: 'Ari', last_name: 'Example', handle: 'ari' }],
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    ({
      'generated.inline.0039_income_0f613350': 'income',
      'generated.inline.0026_user_12dea96f': 'user',
    })[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: finalizationMocks.toastError,
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}));

function findField<TKind extends CreateFormFieldDescriptor['kind']>(
  fields: CreateFormFieldDescriptor[],
  key: string,
  kind: TKind
): Extract<CreateFormFieldDescriptor, { kind: TKind }> {
  const field = fields.find(candidate => candidate.key === key && candidate.kind === kind);
  if (!field) {
    throw new Error(`Field ${key} not found`);
  }
  return field as Extract<CreateFormFieldDescriptor, { kind: TKind }>;
}

function fillRequiredPaymentFields(
  result: { current: ReturnType<typeof useCreatePaymentForm> },
  amount: string
) {
  const labelField = findField(result.current.steps[0].fields ?? [], 'label', 'text');
  const amountField = findField(result.current.steps[0].fields ?? [], 'amount', 'text');
  const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
  const userField = findField(
    result.current.steps[1].fields ?? [],
    'entity-user',
    'customComponent'
  );

  act(() => {
    labelField.onValueChange('Membership fee');
    amountField.onValueChange(amount);
    (groupField.props as { onChange: (item: { id: string } | null) => void }).onChange({
      id: 'group-1',
    });
    (userField.props as { onChange: (ids: string[]) => void }).onChange(['user-1']);
  });
}

describe('useCreatePaymentForm', () => {
  beforeEach(() => {
    searchParams = {};
    authUser = { id: 'user-current' };
    activeGroups = [{ id: 'group-1', name: 'Budget Circle' }];
    activeGroupsLoading = false;
    membersLoading = false;
    displayCurrency = 'EUR';
    preferenceLoading = false;
    restoreDraft = null;
    createPayment.mockReset();
    createPayment.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    navigate.mockClear();
    finalizationMocks.track.mockReset();
    finalizationMocks.wait.mockReset().mockResolvedValue(undefined);
    finalizationMocks.toastError.mockReset();
    vi.stubGlobal('crypto', { randomUUID: () => 'payment-1' });
  });

  it('orders details first and requires group before enabling the user selector', () => {
    const { result } = renderHook(() => useCreatePaymentForm());

    expect(result.current.steps[0].fields?.map(field => field.key)).toEqual([
      'label',
      'type',
      'amount',
      'currency',
      'direction',
    ]);
    expect(result.current.steps[1].fields?.map(field => field.key)).toEqual([
      'group',
      'entity-user',
    ]);

    const userField = findField(
      result.current.steps[1].fields ?? [],
      'entity-user',
      'customComponent'
    );
    expect(userField.props).toMatchObject({ disabled: true, allowedUserIds: [] });

    const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    expect(groupField.props).toMatchObject({
      items: [{ id: 'group-1', entityType: 'group', label: 'Budget Circle' }],
      disabled: false,
    });
    act(() => {
      (groupField.props as { onChange: (item: { id: string } | null) => void }).onChange({
        id: 'group-1',
      });
    });

    const enabledUserField = findField(
      result.current.steps[1].fields ?? [],
      'entity-user',
      'customComponent'
    );
    expect(enabledUserField.props).toMatchObject({
      disabled: false,
      allowedUserIds: ['user-1'],
    });
  });

  it('rejects a payment for a group outside the current user memberships', async () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    const labelField = findField(result.current.steps[0].fields ?? [], 'label', 'text');
    const amountField = findField(result.current.steps[0].fields ?? [], 'amount', 'text');
    const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    const userField = findField(
      result.current.steps[1].fields ?? [],
      'entity-user',
      'customComponent'
    );

    act(() => {
      labelField.onValueChange('Membership fee');
      amountField.onValueChange('12.34');
      (groupField.props as { onChange: (item: { id: string } | null) => void }).onChange({
        id: 'group-outside-memberships',
      });
      (userField.props as { onChange: (ids: string[]) => void }).onChange(['user-1']);
    });

    expect(result.current.steps[1].isValid()).toBe(false);
    await act(async () => {
      expect(await result.current.onSubmit()).toEqual({ status: 'blocked' });
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('reports missing payment requirements in submit order', () => {
    const { result } = renderHook(() => useCreatePaymentForm());

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.payment.validation.labelRequired'
    );
    expect(result.current.steps[1].getInvalidReason?.()).toBe(
      'pages.create.payment.validation.groupRequired'
    );

    const labelField = findField(result.current.steps[0].fields ?? [], 'label', 'text');
    act(() => {
      labelField.onValueChange('Membership fee');
    });

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.payment.validation.amountRequired'
    );

    const amountField = findField(result.current.steps[0].fields ?? [], 'amount', 'text');
    act(() => {
      amountField.onValueChange('12abc');
    });

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.payment.validation.amountInvalid'
    );

    const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => {
      (groupField.props as { onChange: (item: { id: string } | null) => void }).onChange({
        id: 'group-1',
      });
    });

    expect(result.current.steps[1].getInvalidReason?.()).toBe(
      'pages.create.payment.validation.counterpartyRequired'
    );
  });

  it('blocks submit without calling createPayment when amount is invalid', async () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    fillRequiredPaymentFields(result, '12abc');

    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[2].isValid()).toBe(false);

    let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
    await act(async () => {
      outcome = await result.current.onSubmit();
    });

    expect(outcome).toEqual({ status: 'blocked' });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('submits a finite parsed amount when amount is valid', async () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    fillRequiredPaymentFields(result, '12.34');

    let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
    await act(async () => {
      outcome = await result.current.onSubmit();
    });

    expect(outcome).toMatchObject({ status: 'success' });
    expect(outcome).toMatchObject({
      target: {
        to: '/group/$id/operation',
        params: { id: 'group-1' },
        hash: 'payments',
      },
    });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'payment-1',
        amount: 12.34,
        label: 'Membership fee',
        payer_user_id: 'user-1',
        payer_group_id: null,
        receiver_user_id: null,
        receiver_group_id: 'group-1',
      }),
      { notificationMode: 'silent' }
    );
  });

  it('maps expense payments as group payer and selected user receiver', async () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    const directionField = findField(
      result.current.steps[0].fields ?? [],
      'direction',
      'customComponent'
    );

    act(() => {
      (directionField.props as { onChange: (direction: 'income' | 'expense') => void }).onChange(
        'expense'
      );
    });
    fillRequiredPaymentFields(result, '99');

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payer_user_id: null,
        payer_group_id: 'group-1',
        receiver_user_id: 'user-1',
        receiver_group_id: null,
      }),
      { notificationMode: 'silent' }
    );
  });

  it('initializes from search, syncs group clearing, and honors the requested return hash', async () => {
    searchParams = { groupId: 'group-1', direction: 'expense', returnSection: 'payments' };
    const { result } = renderHook(() => useCreatePaymentForm());
    expect(
      (findField(result.current.steps[0].fields ?? [], 'direction', 'customComponent').props as any)
        .value
    ).toBe('expense');
    expect(findField(result.current.steps[1].fields ?? [], 'group', 'typeahead').props.value).toBe(
      'group-1'
    );

    const user = findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent');
    act(() => (user.props as any).onChange(['user-1']));
    const group = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => (group.props as any).onChange(null));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { direction: 'expense', returnSection: 'payments', groupId: undefined },
      })
    );
    expect(
      (
        findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent')
          .props as any
      ).value
    ).toEqual([]);
  });

  it('restores full payment state and uses restore defaults when values are absent', () => {
    restoreDraft = {
      formState: {
        groupId: 'group-1',
        direction: 'expense',
        label: 'Restored',
        type: 'material',
        amount: '20',
        currency: 'USD',
        entityId: 'user-1',
      },
    };
    let hook = renderHook(() => useCreatePaymentForm());
    expect(findField(hook.result.current.steps[0].fields ?? [], 'label', 'text').value).toBe(
      'Restored'
    );
    expect(
      (
        findField(hook.result.current.steps[0].fields ?? [], 'currency', 'customComponent')
          .props as any
      ).value
    ).toBe('USD');
    expect(hook.result.current.steps[2].isValid()).toBe(true);
    hook.unmount();

    restoreDraft = { formState: {} };
    displayCurrency = 'GBP';
    hook = renderHook(() => useCreatePaymentForm());
    expect(
      (
        findField(hook.result.current.steps[0].fields ?? [], 'direction', 'customComponent')
          .props as any
      ).value
    ).toBe('income');
    expect(
      (
        findField(hook.result.current.steps[0].fields ?? [], 'currency', 'customComponent')
          .props as any
      ).value
    ).toBe('GBP');
  });

  it('waits for preferences once and exposes currency-specific amount controls', () => {
    preferenceLoading = true;
    displayCurrency = 'EUR';
    const { result, rerender } = renderHook(() => useCreatePaymentForm());
    expect(
      (findField(result.current.steps[0].fields ?? [], 'currency', 'customComponent').props as any)
        .value
    ).toBe('EUR');
    expect(findField(result.current.steps[0].fields ?? [], 'amount', 'text').placeholder).toBe(
      '0.00'
    );

    preferenceLoading = false;
    displayCurrency = 'JPY';
    rerender();
    let amount = findField(result.current.steps[0].fields ?? [], 'amount', 'text');
    expect(amount.step).toBe(1);
    expect(amount.placeholder).toBe('0');
    expect(amount.validator?.('invalid')).toBe('pages.create.payment.validation.amountInvalid');
    expect(amount.validator?.('12')).toBeNull();

    displayCurrency = 'USD';
    rerender();
    amount = findField(result.current.steps[0].fields ?? [], 'amount', 'text');
    expect(amount.placeholder).toBe('0');
  });

  it('preserves an invalid counterparty while members load and clears it afterwards', () => {
    const { result, rerender } = renderHook(() => useCreatePaymentForm());
    const group = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => (group.props as any).onChange({ id: 'group-1' }));
    const user = findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent');
    membersLoading = true;
    act(() => (user.props as any).onChange(['unknown-user']));
    expect(
      (
        findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent')
          .props as any
      ).value
    ).toEqual(['unknown-user']);

    membersLoading = false;
    rerender();
    expect(
      (
        findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent')
          .props as any
      ).value
    ).toEqual([]);
  });

  it('blocks anonymous creation before validation', async () => {
    authUser = null;
    const { result } = renderHook(() => useCreatePaymentForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('blocks a signed-in submission with no label', async () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('covers group validity without a counterparty and clears an empty user selection', () => {
    const { result } = renderHook(() => useCreatePaymentForm());
    const group = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => (group.props as any).onChange({ id: 'group-1' }));
    expect(result.current.steps[1].isValid()).toBe(false);
    const user = findField(result.current.steps[1].fields ?? [], 'entity-user', 'customComponent');
    act(() => (user.props as any).onChange([]));
    expect((user.props as any).value).toEqual([]);
  });

  it('reports progress, sets recovery, and exposes a reusable finalization retry', async () => {
    const reportProgress = vi.fn();
    const setRecoveryTarget = vi.fn();
    const { result } = renderHook(() => useCreatePaymentForm());
    fillRequiredPaymentFields(result, '12.34');

    await act(async () => {
      await result.current.onSubmit({ reportProgress, setRecoveryTarget } as any);
    });
    expect(finalizationMocks.wait).toHaveBeenCalledOnce();
    expect(reportProgress).toHaveBeenCalledTimes(4);
    expect(setRecoveryTarget).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/group/$id/operation', hash: 'payments' })
    );
    const firstFinalization = finalizationMocks.track.mock.calls[0]?.[0];
    expect(firstFinalization.retry).toEqual(expect.any(Function));
    firstFinalization.retry();
    expect(createPayment).toHaveBeenCalledTimes(2);
    expect(finalizationMocks.track).toHaveBeenCalledTimes(2);
  });

  it('reports optimistic failures and always clears submitting state', async () => {
    finalizationMocks.wait.mockRejectedValueOnce(new Error('optimistic failed'));
    const { result } = renderHook(() => useCreatePaymentForm());
    fillRequiredPaymentFields(result, '12.34');
    await expect(result.current.onSubmit()).rejects.toThrow('optimistic failed');
    expect(finalizationMocks.toastError).toHaveBeenCalledWith('pages.create.error.createFailed');
    expect(result.current.isSubmitting).toBe(false);
  });
});
