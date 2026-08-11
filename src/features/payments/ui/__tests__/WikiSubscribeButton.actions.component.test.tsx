/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WikiSubscribeButton } from '../WikiSubscribeButton';

afterEach(cleanup);

describe('WikiSubscribeButton actions', () => {
  it('toggles subscription through a stable selected and unselected action', () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <WikiSubscribeButton subscribed={false} onClick={onClick} />
    );
    const action = container.querySelector(
      '[data-action-id="payments.wiki-subscription.toggle"]'
    ) as HTMLButtonElement;
    expect(action.getAttribute('aria-pressed')).toBe('false');
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<WikiSubscribeButton subscribed onClick={onClick} />);
    expect(action.getAttribute('aria-pressed')).toBe('true');
  });
});
