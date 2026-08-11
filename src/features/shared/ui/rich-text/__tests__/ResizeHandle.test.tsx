/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Resizable, ResizeHandle } from '../ResizeHandle';

const state = vi.hoisted(() => ({ isResizing: false, readOnly: false }));
vi.mock('@platejs/resizable', () => ({
  Resizable: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="resizable" {...props} />
  ),
  useResizeHandleState: () => state,
  useResizeHandle: () => ({ props: { 'data-handle': 'yes' } }),
}));

afterEach(() => {
  cleanup();
  state.readOnly = false;
  state.isResizing = false;
});

describe('rich-text resize primitives', () => {
  it('hides read-only handles', () => {
    state.readOnly = true;
    expect(render(<ResizeHandle />).container.firstChild).toBeNull();
  });

  it('renders default and directed resize handles', () => {
    const first = render(<ResizeHandle className="custom" />);
    expect(first.container.firstElementChild?.className).toContain('custom');
    first.unmount();
    state.isResizing = true;
    render(<ResizeHandle options={{ direction: 'left' } as never} />);
    expect(document.querySelector('[data-resizing="true"]')).toBeTruthy();
    expect(document.querySelector('[data-handle="yes"]')).toBeTruthy();
  });

  it('renders aligned resizable content', () => {
    render(
      <Resizable align="center" className="custom" options={{} as never}>
        Content
      </Resizable>
    );
    expect(screen.getByTestId('resizable').className).toContain('mx-auto');
    expect(screen.getByTestId('resizable').className).toContain('custom');
  });
});
