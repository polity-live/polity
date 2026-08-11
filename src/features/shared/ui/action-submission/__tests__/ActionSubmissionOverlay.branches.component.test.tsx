/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('motion/react', () => {
  const Motion = ({ animate: _a, exit: _e, initial: _i, transition: _t, ...props }: any) => (
    <div {...props} />
  );
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: Motion, span: Motion },
    useReducedMotion: () => mocks.reducedMotion,
  };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/errors', () => ({
  localizeAppError: (error: any) => `localized:${error?.message ?? 'error'}`,
  parseAppError: (error: any) => error ?? null,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt }: any) => <span>{`avatar:${alt}`}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  LoadingProgressBar: ({ steps }: any) => <div data-testid="progress">{steps.length}</div>,
}));

import { ActionSubmissionOverlay, type ActionSubmissionStep } from '../ActionSubmissionOverlay';

const steps: ActionSubmissionStep[] = [
  { copy: { key: 'prepare' }, key: 'prepare', status: 'pending' },
  { copy: { key: 'commit' }, key: 'commit', status: 'active' },
  { copy: { key: 'sync' }, key: 'sync', status: 'error' },
  { copy: { key: 'sync' }, key: 'sync', status: 'complete' },
];

function props(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'workflow' as const,
    onBack: vi.fn(),
    onRetry: vi.fn(),
    preview: { title: 'Workflow preview' },
    status: 'submitting' as const,
    steps,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mocks.reducedMotion = false;
});
afterEach(cleanup);

describe('ActionSubmissionOverlay branches', () => {
  it('stays closed while idle and renders every action kind while active', () => {
    const view = render(<ActionSubmissionOverlay {...props({ status: 'idle' })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const kind of ['tally', 'process', 'workflow', 'link', 'accept', 'invite'] as const) {
      view.rerender(<ActionSubmissionOverlay {...props({ kind })} />);
      expect(screen.getByRole('dialog').getAttribute('data-kind')).toBe(kind);
    }
  });

  it('renders rich preview content, every step state, and both target states', () => {
    const people = Array.from({ length: 9 }, (_, index) => ({
      avatar: index === 0 ? 'avatar.png' : null,
      id: `person-${index}`,
      name: `Person ${index}`,
    }));
    const targetClick = vi.fn();
    const view = render(
      <ActionSubmissionOverlay
        {...props({
          preview: {
            badges: ['Badge'],
            description: 'Description',
            entityLabel: 'Entity',
            path: ['Start', 'End'],
            people,
            title: 'Rich preview',
          },
          target: { label: 'Open target', onClick: targetClick },
        })}
      />
    );
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('→')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Open target' }) as HTMLButtonElement).disabled
    ).toBe(true);

    view.rerender(
      <ActionSubmissionOverlay
        {...props({
          preview: { title: 'Ready preview' },
          status: 'ready',
          target: { label: 'Open target', onClick: targetClick },
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open target' }));
    expect(targetClick).toHaveBeenCalled();
    view.rerender(
      <ActionSubmissionOverlay
        {...props({ preview: { people: people.slice(0, 1), title: 'One person' } })}
      />
    );
    expect(screen.queryByText('+1')).toBeNull();
    view.rerender(<ActionSubmissionOverlay {...props({ status: 'success', target: null })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['action_blocked', 'already_exists', 'permission_denied'])(
    'renders non-retryable %s errors',
    code => {
      const onBack = vi.fn();
      render(<ActionSubmissionOverlay {...props({ error: { code }, onBack, status: 'error' })} />);
      expect(screen.queryByText('common.submissionOverlay.retry')).toBeNull();
      fireEvent.click(screen.getByRole('button'));
      expect(onBack).toHaveBeenCalled();
    }
  );

  it('renders retryable errors and reduced-motion paths', () => {
    mocks.reducedMotion = true;
    const onRetry = vi.fn();
    const onBack = vi.fn();
    render(
      <ActionSubmissionOverlay
        {...props({
          error: { code: 'network', message: 'Offline' },
          onBack,
          onRetry,
          status: 'error',
        })}
      />
    );
    expect(screen.getByText('localized:Offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.submissionOverlay.retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.submissionOverlay.back' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
