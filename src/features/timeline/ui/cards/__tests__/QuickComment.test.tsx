/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { QuickComment } from '../QuickComment';

afterEach(cleanup);

describe('QuickComment', () => {
  it('uses a compact borderless discussion action before opening its composer', () => {
    render(
      <QuickComment
        contentId="amendment-1"
        contentType="amendment"
        commentCount={3}
        placeholder="Join discussion"
      />
    );

    const trigger = screen.getByRole('button', { name: /join discussion/i });

    expect(trigger.getAttribute('data-slot')).toBe('discussion-action-bar');
    expect(trigger.className.split(/\s+/)).not.toContain('border');

    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Join discussion')).toBeTruthy();
  });
});
