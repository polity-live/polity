/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubscribeButton } from '../SubscribeButton';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

afterEach(() => cleanup());

describe('SubscribeButton', () => {
  it('renders the default subscribe action and forwards clicks', () => {
    const onToggleSubscribe = vi.fn();
    render(
      <SubscribeButton
        entityType="group"
        entityId="group-1"
        isSubscribed={false}
        onToggleSubscribe={onToggleSubscribe}
        data-action-id="subscribe-group"
        className="custom"
      />
    );

    const button = screen.getByRole('button', {
      name: 'translated:components.actionBar.subscribe',
    });
    expect(button.getAttribute('data-action-id')).toBe('subscribe-group');
    expect(button.className).toContain('custom');
    expect(button.querySelector('svg')?.className.baseVal).toContain('mr-2');
    fireEvent.click(button);
    expect(onToggleSubscribe).toHaveBeenCalledOnce();
  });

  it('renders a disabled compact unsubscribe action', () => {
    const onToggleSubscribe = vi.fn();
    render(
      <SubscribeButton
        entityType="user"
        entityId="user-1"
        isSubscribed
        isLoading
        compactOnMobile
        onToggleSubscribe={onToggleSubscribe}
      />
    );

    const button = screen.getByRole('button', {
      name: 'translated:components.actionBar.unsubscribe',
    });
    expect(button).toHaveProperty('disabled', true);
    expect(button.className).toContain('h-8 gap-1 px-2');
    expect(button.querySelector('svg')?.className.baseVal).toContain('mr-0 sm:mr-2');
    fireEvent.click(button);
    expect(onToggleSubscribe).not.toHaveBeenCalled();
  });

  it('covers complementary compact icon spacing for both subscription states', () => {
    const compactSubscribe = render(
      <SubscribeButton
        entityType="blog"
        entityId="blog-1"
        isSubscribed={false}
        compactOnMobile
        onToggleSubscribe={vi.fn()}
      />
    );
    expect(compactSubscribe.container.querySelector('svg')?.className.baseVal).toContain(
      'mr-0 sm:mr-2'
    );
    compactSubscribe.unmount();

    const regularUnsubscribe = render(
      <SubscribeButton
        entityType="event"
        entityId="event-1"
        isSubscribed
        compactOnMobile={false}
        isLoading={false}
        onToggleSubscribe={vi.fn()}
      />
    );
    expect(regularUnsubscribe.container.querySelector('svg')?.className.baseVal).toContain('mr-2');
  });
});
