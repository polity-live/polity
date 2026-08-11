/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscription: {} as Record<string, unknown>,
  viewProps: undefined as Record<string, any> | undefined,
  formatLocation: vi.fn(() => 'Formatted place'),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/payments/hooks/useSubscribeUser', () => ({
  useSubscribeUser: () => mocks.subscription,
}));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatLocation: mocks.formatLocation,
}));
vi.mock('../UserTimelineCardView', () => ({
  UserTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div />;
  },
}));

import { UserTimelineCard, type UserTimelineCardProps } from '../UserTimelineCard';

const user: UserTimelineCardProps['user'] = { id: 'user-1', name: 'Ada Lovelace' };

function renderUser(
  overrides: Partial<UserTimelineCardProps['user']> = {},
  props: Partial<Omit<UserTimelineCardProps, 'user'>> = {}
) {
  render(<UserTimelineCard user={{ ...user, ...overrides }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  mocks.subscription = { subscriberCount: 3 };
  mocks.viewProps = undefined;
  mocks.formatLocation.mockClear();
});
afterEach(cleanup);

describe('UserTimelineCard controller', () => {
  it('formats a missing location and builds multi-word initials', () => {
    const props = renderUser();
    expect(props.location).toBe('Formatted place');
    expect(props.initials).toBe('AL');
    expect(props.subscription).toBe(mocks.subscription);
    expect(mocks.formatLocation).toHaveBeenCalledWith(user);
  });

  it('prioritizes the explicit location and truncates initials', () => {
    const props = renderUser({ name: 'Ada Byron Lovelace', location: 'London' });
    expect(props.location).toBe('London');
    expect(props.initials).toBe('AB');
    expect(mocks.formatLocation).not.toHaveBeenCalled();
  });

  it('uses the anonymous initial for an empty name', () => {
    expect(renderUser({ name: '' }).initials).toBe('U');
  });

  it('forwards actions, callbacks, href, class, and projected state', () => {
    const onFollow = vi.fn();
    const onMessage = vi.fn();
    const actions = <span>Custom action</span>;
    const projectedSubscriptionState = { isSubscribed: true } as any;
    const props = renderUser(
      {},
      {
        onFollow,
        onMessage,
        actions,
        href: '/people/ada',
        className: 'custom',
        projectedSubscriptionState,
      }
    );
    expect(props).toMatchObject({
      onFollow,
      onMessage,
      actions,
      href: '/people/ada',
      className: 'custom',
    });
  });
});
