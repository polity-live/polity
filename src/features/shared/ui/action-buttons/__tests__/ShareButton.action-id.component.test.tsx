/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';

import { ShareButton } from '../ShareButton';

afterEach(() => {
  cleanup();
});

describe('ShareButton action identity', () => {
  it('forwards a consumer action ID to the focusable trigger', () => {
    render(
      <ShareButton
        data-action-id="search.statement.share"
        url="/statement/statement-1"
        title="Statement"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Share' });
    expect(trigger.getAttribute('data-action-id')).toBe('search.statement.share');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it('applies compact mobile presentation when requested', () => {
    render(<ShareButton url="/item" title="Item" compactOnMobile />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('opens sharing from a custom canvas toolbar trigger and preserves its action identity', async () => {
    const user = userEvent.setup();
    render(
      <ShareButton
        url="/amendment/amendment-1/citydesign"
        title="Street design"
        trigger={<button data-action-id="amendment.city-design.share.open">Share design</button>}
      />
    );
    const trigger = screen.getByRole('button', { name: 'Share design' });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(trigger.getAttribute('data-action-id')).toBe('amendment.city-design.share.open');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
