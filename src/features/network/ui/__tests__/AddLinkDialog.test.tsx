/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddLinkDialog } from '../AddLinkDialog';

vi.mock('motion/react', async () => {
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
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: ComponentProps<'div'>) => (
        <div {...cleanMotionProps(props)}>{children}</div>
      ),
      span: ({ children, ...props }: ComponentProps<'span'>) => (
        <span {...cleanMotionProps(props)}>{children}</span>
      ),
    },
    useReducedMotion: () => true,
  };
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => {
    const labels: Record<string, string> = {
      'common.actionSubmission.kinds.link.headline': 'POLITY verbindet.',
      'common.actionSubmission.kinds.link.active': 'Verknüpfung wird aktiviert',
      'common.actionSubmission.kinds.link.success': 'Verknüpfung bereit',
      'common.actionSubmission.kinds.link.description':
        'Die Verbindung wird geprüft, aktiviert und im Netzwerk aktualisiert.',
    };
    return labels[key] ?? fallback ?? key;
  },
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'common.actionSubmission.steps.link.prepare': 'Verbindung wird geprüft',
        'common.actionSubmission.steps.link.commit': 'Verknüpfung wird aktiviert',
        'common.actionSubmission.steps.link.sync': 'Netzwerk wird aktualisiert',
      };
      return labels[key] ?? key;
    },
  }),
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

    expect(document.querySelector('[data-action-id="network.add-link.open"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="network.add-link.form.submit"]')).toBeTruthy();

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
    await waitFor(() => expect(screen.getByText('Verknüpfung bereit')).toBeTruthy());
  });
});
