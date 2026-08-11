/* @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: ComponentProps<'span'> & { children?: ReactNode }) => (
      <span {...props}>{children}</span>
    ),
  },
  useReducedMotion: () => false,
}));

import { LoadingProgressBar } from '../LoadingProgressBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('loading progress post-typefix animation cleanup', () => {
  it('accepts a host that does not allocate an animation-frame handle', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(null as unknown as number);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');

    const view = render(<LoadingProgressBar motionStyle="optimistic" />);
    view.unmount();

    expect(cancel).not.toHaveBeenCalled();
  });
});
