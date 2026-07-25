/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '../editor';

vi.mock('platejs/react', () => ({
  PlateContainer: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  PlateContent: ({
    disableDefaultStyles: _disableDefaultStyles,
    ...props
  }: ComponentProps<'div'> & { disableDefaultStyles?: boolean }) => <div {...props} />,
}));

afterEach(cleanup);

describe('Editor mobile spacing', () => {
  it.each([
    ['default', 'md:px-[max(64px,calc(50%-350px))]'],
    ['demo', 'md:px-[max(64px,calc(50%-350px))]'],
    ['fullWidth', 'md:px-24'],
  ] as const)('uses compact mobile padding for the %s variant', (variant, desktopPadding) => {
    const { container } = render(<Editor variant={variant} />);
    const editor = container.firstElementChild;

    expect(editor?.className).toContain('px-4');
    expect(editor?.className).toContain(desktopPadding);
    expect(editor?.className).not.toContain('px-16');
  });
});
