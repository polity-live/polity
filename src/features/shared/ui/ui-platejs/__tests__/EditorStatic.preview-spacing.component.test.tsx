/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorStatic } from '../editor-static';

vi.mock('platejs/static', () => ({
  PlateStatic: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
}));

afterEach(cleanup);

describe('EditorStatic preview spacing', () => {
  it('matches the full-text horizontal insets without adding full-text height', () => {
    const { container } = render(<EditorStatic editor={{} as never} variant="preview" />);
    const editor = container.firstElementChild;

    expect(editor?.className).toContain('w-full');
    expect(editor?.className).toContain('px-4');
    expect(editor?.className).toContain('md:px-[max(64px,calc(50%-350px))]');
    expect(editor?.className).toContain('py-4');
    expect(editor?.className).not.toContain('pb-72');
  });
});
