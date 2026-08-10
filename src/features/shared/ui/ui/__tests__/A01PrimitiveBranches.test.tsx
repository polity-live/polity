/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-context-menu', () => ({
  Item: forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => (
    <div ref={ref} {...props} />
  )),
}));
vi.mock('@radix-ui/react-scroll-area', () => ({
  Corner: (props: Record<string, unknown>) => <div {...props} />,
  Root: Object.assign(
    forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => (
      <div ref={ref} {...props} />
    )),
    { displayName: 'Root' }
  ),
  ScrollAreaScrollbar: forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ orientation: _orientation, ...props }, ref) => <div ref={ref} {...props} />
  ),
  ScrollAreaThumb: (props: Record<string, unknown>) => <div {...props} />,
  Viewport: (props: Record<string, unknown>) => <div {...props} />,
}));

import { Button } from '../button';
import { ContextMenuItem } from '../context-menu';
import { ScrollBar } from '../scroll-area';

describe('A01 primitive branches', () => {
  it('does not derive a wrapper aria label from rich tooltip content', () => {
    const { container } = render(
      <Button disabled tooltip={<span>Rich tip</span>}>
        Disabled
      </Button>
    );
    expect(container.firstElementChild?.getAttribute('aria-label')).toBeNull();
  });

  it('uses the default context-menu item variant', () => {
    render(<ContextMenuItem>Item</ContextMenuItem>);
    expect(screen.getByText('Item').getAttribute('data-variant')).toBe('default');
  });

  it('renders the horizontal scrollbar classes', () => {
    const { container } = render(<ScrollBar orientation="horizontal" />);
    expect(container.firstElementChild?.className).toContain('flex-col');
  });
});
