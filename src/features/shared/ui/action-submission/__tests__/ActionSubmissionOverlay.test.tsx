/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionSubmissionOverlay, type ActionSubmissionStep } from '../ActionSubmissionOverlay';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const steps: ActionSubmissionStep[] = [
  { key: 'prepare', label: 'Empfänger prüfen', status: 'complete' },
  { key: 'commit', label: 'Einladungen senden', status: 'active' },
  { key: 'sync', label: 'Listen synchronisieren', status: 'pending' },
];

describe('ActionSubmissionOverlay', () => {
  it('renders as a fullscreen dialog with progress and preview content', () => {
    render(
      <ActionSubmissionOverlay
        kind="invite"
        status="submitting"
        steps={steps}
        preview={{
          entityLabel: 'Invite',
          title: '3 Nutzer',
          description: 'Einladungen werden versendet.',
          badges: ['Member'],
        }}
        target={{ label: 'Fertig' }}
        onBack={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const overlay = screen.getByRole('dialog', { name: /POLITY lädt ein/i });
    expect(overlay.getAttribute('data-slot')).toBe('action-submission-overlay');
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
    expect(screen.getByText('3 Nutzer')).toBeTruthy();
    expect(screen.getByText('Einladungen senden')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Aktionsfortschritt' })).toBeTruthy();
    expect(document.querySelector('[data-slot="loading-progress-bar"]')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Fertig' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('normalizes duplicate errors without showing the raw error as primary copy', () => {
    render(
      <ActionSubmissionOverlay
        kind="accept"
        status="error"
        steps={[{ ...steps[0], status: 'error' }]}
        preview={{ title: 'Gruppe A' }}
        error={new Error('duplicate key value violates unique constraint "invite_id_key"')}
        onBack={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Bereits vorhanden')).toBeTruthy();
    expect(screen.queryByText(/duplicate key value/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});
