/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionTypeFilters } from '../SubscriptionTypeFilters';

afterEach(cleanup);

describe('SubscriptionTypeFilters actions', () => {
  it('selects every subscription type through a stable keyboard-focusable trigger', () => {
    const onFilterChange = vi.fn();
    const counts = { all: 6, users: 1, groups: 1, amendments: 1, events: 1, blogs: 1 };
    const { container } = render(
      <SubscriptionTypeFilters filterType="all" counts={counts} onFilterChange={onFilterChange} />
    );
    const types = ['all', 'users', 'groups', 'amendments', 'events', 'blogs'] as const;
    const actions = types.map(
      type =>
        container.querySelector(
          `[data-action-id="payments.subscription-filter.${type}"]`
        ) as HTMLButtonElement
    );

    expect(actions.every(Boolean)).toBe(true);
    expect(actions[0].getAttribute('data-state')).toBe('active');
    actions[1].focus();
    expect(document.activeElement).toBe(actions[1]);
    onFilterChange.mockClear();
    for (const type of types.slice(1)) {
      fireEvent.mouseDown(
        container.querySelector(
          `[data-action-id="payments.subscription-filter.${type}"]`
        ) as HTMLButtonElement,
        { button: 0 }
      );
    }

    expect(onFilterChange.mock.calls.map(call => call[0])).toEqual([
      'users',
      'groups',
      'amendments',
      'events',
      'blogs',
    ]);
  });
});
