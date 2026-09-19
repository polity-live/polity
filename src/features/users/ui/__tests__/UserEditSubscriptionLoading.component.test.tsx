/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { UserEdit } from '../UserEdit';

const status = vi.hoisted(() => vi.fn());

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'session-token' } }),
}));
vi.mock('@/server/stripe-subscription-status', () => ({
  stripeSubscriptionStatusFn: status,
}));
vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ user: { id: 'user' }, isLoading: false }),
}));
vi.mock('../../hooks/useUserProfileForm', () => ({
  useUserProfileForm: () => ({ formData: {}, updateField: vi.fn() }),
}));
vi.mock('../../hooks/useAvatarUpload', () => ({
  useAvatarUpload: () => ({ uploadAvatar: vi.fn() }),
}));
vi.mock('@/features/payments/hooks/useStripeCheckout', () => ({
  useStripeCheckout: () => ({}),
}));
vi.mock('../UserEditView', () => ({
  UserEditView: ({ activeSubscription }: { activeSubscription: { id: string } | null }) => (
    <span>{activeSubscription?.id ?? 'no subscription'}</span>
  ),
}));

beforeEach(() => {
  status.mockReset();
  status.mockResolvedValue({ subscription: { id: 'subscription-1' }, hasCustomer: true });
});
afterEach(cleanup);

it('loads billing only when opening subscriptions and refreshes when returning', async () => {
  const view = render(<UserEdit userId="user" />);
  for (const activeTab of ['basic-info', 'preferences', 'passwords', 'notifications', 'ai']) {
    view.rerender(<UserEdit userId="user" activeTab={activeTab} />);
  }
  expect(status).not.toHaveBeenCalled();

  view.rerender(<UserEdit userId="user" activeTab="subscriptions" />);
  await screen.findByText('subscription-1');
  expect(status).toHaveBeenCalledTimes(1);
  expect(status).toHaveBeenCalledWith({
    data: { userId: 'user' },
    headers: { Authorization: 'Bearer session-token' },
  });

  view.rerender(<UserEdit userId="user" activeTab="preferences" />);
  expect(status).toHaveBeenCalledTimes(1);
  view.rerender(<UserEdit userId="user" activeTab="subscriptions" />);
  await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
});
