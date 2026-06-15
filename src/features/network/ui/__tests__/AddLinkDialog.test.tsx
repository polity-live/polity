/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddLinkDialog } from '../AddLinkDialog';

vi.mock('motion/react', async () => {
  const React = await import('react');
  const cleanMotionProps = ({
    initial,
    animate,
    exit,
    transition,
    ...props
  }: Record<string, unknown>) => {
    void initial;
    void animate;
    void exit;
    void transition;
    return props;
  };

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: React.ComponentProps<'div'>) => (
        <div {...cleanMotionProps(props)}>{children}</div>
      ),
      span: ({ children, ...props }: React.ComponentProps<'span'>) => (
        <span {...cleanMotionProps(props)}>{children}</span>
      ),
    },
    useReducedMotion: () => true,
  };
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AddLinkDialog', () => {
  it('shows the shared fullscreen submission overlay while adding a link', async () => {
    let resolveSubmit: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        })
    );

    render(<AddLinkDialog isOpen onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('generated.inline.0535_label_74341e3c'), {
      target: { value: 'Polity docs' },
    });
    fireEvent.change(screen.getByLabelText('generated.inline.0028_url_0e2d9b07'), {
      target: { value: 'https://example.com' },
    });
    const addButtons = screen.getAllByRole('button', {
      name: 'generated.inline.0761_add_link_2cf006b1',
    });
    const submitButton = addButtons[addButtons.length - 1];
    expect(submitButton).toBeTruthy();
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(document.querySelector('[data-slot="action-submission-card"]')).toBeTruthy()
    );
    const overlay = document.querySelector('[data-slot="action-submission-card"]');
    expect(overlay?.textContent).toContain('Polity docs');
    expect(screen.getByRole('dialog', { name: /POLITY verbindet/i }).className).toContain('fixed');
    expect(onSubmit).toHaveBeenCalledWith({
      label: 'Polity docs',
      url: 'https://example.com',
    });

    resolveSubmit();
    await waitFor(() => expect(screen.getByText('Link bereit')).toBeTruthy());
  });
});
