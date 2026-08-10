/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupSubscribeButton } from '../GroupSubscribeButton';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('GroupSubscribeButton actions', () => {
  it('toggles subscriptions through a stable action and disables while loading', () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <GroupSubscribeButton subscribed={false} onClick={onClick} />
    );
    const action = container.querySelector<HTMLButtonElement>(
      '[data-action-id="groups.subscription.toggle.current"]'
    )!;
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<GroupSubscribeButton subscribed onClick={onClick} isLoading />);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });
});
