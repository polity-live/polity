/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { toasterProps } = vi.hoisted(() => ({
  toasterProps: { current: null as unknown },
}));

vi.mock('sonner', () => ({
  Toaster: (props: unknown) => {
    toasterProps.current = props;
    return <div data-testid="sonner" />;
  },
}));

import { ToasterView } from '../ToasterView';

describe('ToasterView interactions', () => {
  it('keeps the container transparent to clicks while making each toast interactive', () => {
    render(<ToasterView theme="light" />);

    const props = toasterProps.current as {
      className: string;
      swipeDirections: string[];
      toastOptions: { classNames: Record<string, string> };
    };
    expect(props.className).toContain('pointer-events-none');
    expect(props.swipeDirections).toEqual([]);
    expect(props.toastOptions.classNames.toast).toContain('pointer-events-auto');
    expect(props.toastOptions.classNames.toast).toContain('!select-text');
    expect(props.toastOptions.classNames.closeButton).toContain('pointer-events-auto');
    expect(props.toastOptions.classNames.success).toBe('!text-success');
  });

  it('allows callers to override the accessible success color deliberately', () => {
    render(
      <ToasterView theme="light" toastOptions={{ classNames: { success: '!text-foreground' } }} />
    );

    const props = toasterProps.current as {
      toastOptions: { classNames: Record<string, string> };
    };
    expect(props.toastOptions.classNames.success).toBe('!text-foreground');
  });
});
