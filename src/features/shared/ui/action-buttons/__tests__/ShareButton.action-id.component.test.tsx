/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
});
