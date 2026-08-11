/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroups: () => ({
    groups: [{ id: 'group', name: 'Group' }],
    isLoading: false,
  }),
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useGroupById: () => ({ group: undefined }),
}));
vi.mock('@/zero/payments/usePaymentActions', () => ({
  usePaymentActions: () => ({ createPayment: vi.fn() }),
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: 'EUR', isLoading: false }),
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ allUsers: [] }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

import { useCreatePaymentForm } from '../useCreatePaymentForm';

it('executes the payment review invalid-reason callback', () => {
  const { result } = renderHook(() => useCreatePaymentForm());
  expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
    'pages.create.payment.validation.labelRequired'
  );
});
