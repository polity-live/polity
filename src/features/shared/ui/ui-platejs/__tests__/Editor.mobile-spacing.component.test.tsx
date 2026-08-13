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
    renderPlaceholder,
    ...props
  }: ComponentProps<'div'> & {
    disableDefaultStyles?: boolean;
    renderPlaceholder?: (props: {
      attributes: {
        'data-slate-placeholder': boolean;
        contentEditable: boolean;
        ref: React.RefCallback<HTMLElement>;
        style: React.CSSProperties;
      };
      children: React.ReactNode;
    }) => React.ReactNode;
  }) => (
    <div {...props}>
      {renderPlaceholder?.({
        attributes: {
          'data-slate-placeholder': true,
          contentEditable: false,
          ref: () => undefined,
          style: { opacity: 0.333 },
        },
        children: 'Placeholder copy',
      })}
    </div>
  ),
}));

afterEach(cleanup);

describe('Editor mobile spacing', () => {
  it('names the Slate textbox from explicit ARIA or placeholder copy', () => {
    const { rerender } = render(<Editor placeholder="Describe the group" />);
    expect(document.querySelector('[aria-label="Describe the group"]')).toBeTruthy();

    rerender(<Editor aria-label="Group description" placeholder="Describe the group" />);
    expect(document.querySelector('[aria-label="Group description"]')).toBeTruthy();

    rerender(<Editor aria-labelledby="description-label" placeholder="Describe the group" />);
    const editor = document.querySelector('[aria-labelledby="description-label"]');
    expect(editor?.getAttribute('aria-label')).toBeNull();
  });

  it('renders default placeholder copy at the accessible muted contrast without transparency', () => {
    const { container, rerender } = render(<Editor placeholder="Describe the group" />);
    const placeholder = container.querySelector<HTMLElement>('[data-slate-placeholder]');

    expect(placeholder?.style.color).toBe('var(--muted-foreground)');
    expect(placeholder?.style.opacity).toBe('1');

    rerender(
      <Editor
        placeholder="Describe the group"
        renderPlaceholder={({ attributes, children }) => (
          <span {...attributes} data-testid="custom-placeholder">
            {children}
          </span>
        )}
      />
    );
    expect(document.querySelector('[data-testid="custom-placeholder"]')).toBeTruthy();
  });

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
