/* @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SubscribersTable } from '../SubscribersTable';
import { SubscriptionsTable } from '../SubscriptionsTable';

afterEach(cleanup);

describe('payment table actions', () => {
  it('opens and removes subscriber and subscription rows through exact stable actions', () => {
    const onRemove = vi.fn();
    const subscriberView = render(
      <SubscribersTable
        subscribers={[
          {
            id: 'subscriber-row-1',
            subscriber_user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
          },
        ]}
        onRemove={onRemove}
      />
    );

    const subscriberLink = subscriberView.container.querySelector(
      '[data-action-id="payments.subscribers.user.open"]'
    ) as HTMLAnchorElement;
    const removeSubscriber = subscriberView.container.querySelector(
      '[data-action-id="payments.subscribers.remove"]'
    ) as HTMLButtonElement;
    expect(subscriberLink.getAttribute('href')).toBe('/user/user-1');
    subscriberLink.focus();
    expect(document.activeElement).toBe(subscriberLink);
    fireEvent.click(removeSubscriber);
    expect(onRemove).toHaveBeenCalledWith('subscriber-row-1');
    subscriberView.unmount();

    const onUnsubscribe = vi.fn();
    const subscriptionView = render(
      <SubscriptionsTable
        subscriptions={[
          {
            id: 'subscription-row-1',
            group: { id: 'group-1', name: 'Civic Assembly' },
          },
        ]}
        onUnsubscribe={onUnsubscribe}
        getSubscriptionHref={() => '/group/group-1'}
      />
    );
    const entityLink = subscriptionView.container.querySelector(
      '[data-action-id="payments.subscriptions.entity.open"]'
    ) as HTMLAnchorElement;
    const unsubscribe = subscriptionView.container.querySelector(
      '[data-action-id="payments.subscriptions.remove"]'
    ) as HTMLButtonElement;
    expect(entityLink.getAttribute('href')).toBe('/group/group-1');
    fireEvent.click(unsubscribe);
    expect(onUnsubscribe).toHaveBeenCalledWith('subscription-row-1');
  });
});
