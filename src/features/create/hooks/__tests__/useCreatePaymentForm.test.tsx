/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreatePaymentForm } from '../useCreatePaymentForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const createPayment = vi.fn();
const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => ({}),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-current' },
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroups: () => ({
    groups: [{ id: 'group-1', name: 'Budget Circle' }],
    isLoading: false,
  }),
  useAssignableGroupMembersByGroupIds: (groupIds: readonly string[] = []) => ({
    members: groupIds.includes('group-1') ? [{ user_id: 'user-1', user: { id: 'user-1' } }] : [],
    isLoading: false,
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
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
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
    createPayment.mockReset();
    createPayment.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    navigate.mockClear();
    vi.stubGlobal('crypto', { randomUUID: () => 'payment-1' });
  });

  it('orders details first and requires group before enabling the user selector', () => {
    const { result } = renderHook(() => useCreatePaymentForm());

    expect(result.current.steps[0].fields?.map(field => field.key)).toEqual([
      'label',
      'type',
      'amount',
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
      })
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
      })
    );
  });
});
