/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PageFrame } from '../page-frame';

afterEach(cleanup);

describe('page frame', () => {
  it('leaves bare content unwrapped and maps every framed variant to its layout contract', () => {
    const { container, rerender } = render(
      <PageFrame frame="bare">
        <p>Content</p>
      </PageFrame>
    );
    expect(container.querySelector('[data-slot="app-shell-page-frame"]')).toBeNull();

    for (const frame of ['contained', 'fullWidth', 'messages', 'uncontained'] as const) {
      rerender(
        <PageFrame frame={frame}>
          <p>Content</p>
        </PageFrame>
      );
      const wrapper = container.querySelector('[data-slot="app-shell-page-frame"]');
      expect(wrapper?.getAttribute('data-frame')).toBe(frame);
      expect(wrapper?.className.length).toBeGreaterThan(0);
      expect(screen.getByText('Content')).toBeTruthy();
    }
  });
});
