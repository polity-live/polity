/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { getAgendaRuntimeStatus } from '@/features/agendas/logic/getAgendaRuntimeStatus';
import { useVotingTimer } from '@/features/votes/hooks/useVotingTimer';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/features/agendas/ui/FixedAgendaToolbar', () => ({
  FixedAgendaToolbar: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({
    children,
    asChild: _asChild,
    loading: _loading,
    successState: _successState,
    tooltip,
    ...props
  }: {
    children: ReactNode;
    tooltip?: ReactNode;
    [key: string]: unknown;
  }) => (
    <button type="button" aria-label={typeof tooltip === 'string' ? tooltip : undefined} {...props}>
      {children}
    </button>
  ),
  ToolbarSeparator: () => <span role="separator" />,
}));

import { AgendaActionBar } from '@/features/agendas/ui/AgendaActionBar';

interface Item {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
}

function RuntimeHarness({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [index, setIndex] = useState(0);
  const current = items[index] ?? null;
  const replaceCurrentStatus = (status: Item['status']) =>
    setItems(existing =>
      existing.map((item, itemIndex) => (itemIndex === index ? { ...item, status } : item))
    );

  return (
    <div>
      <output data-testid="runtime-status">
        {current
          ? getAgendaRuntimeStatus({
              ...current,
              currentAgendaItemId: current.status === 'in-progress' ? current.id : null,
            })
          : 'none'}
      </output>
      <AgendaActionBar
        eventId="event-1"
        currentAgendaItem={current ? { ...current, type: 'amendment' } : null}
        currentItemLabel={current?.title ?? null}
        canManageAgenda
        canVote={false}
        canBeCandidate={false}
        isEventStarted
        isUserInSpeakerList={false}
        isUserCandidate={false}
        hasPreviousItem={index > 0}
        hasNextItem={index < items.length - 1}
        hasStartableItem={Boolean(current && current.status !== 'in-progress')}
        canMoveToNextItem={Boolean(current && current.status === 'completed')}
        isCurrentItemCompleted={current?.status === 'completed'}
        onStartItem={() => replaceCurrentStatus('in-progress')}
        onPreviousItem={() => setIndex(value => Math.max(0, value - 1))}
        onNextItem={() => setIndex(value => Math.min(items.length - 1, value + 1))}
        onCompleteItem={() => replaceCurrentStatus('completed')}
      />
    </div>
  );
}

function RuntimeTimerHarness() {
  const timer = useVotingTimer({ autoStart: true, initialDuration: 3 });
  return (
    <div>
      <output data-testid="timer-state">
        {timer.isRunning ? 'running' : 'paused'}:{timer.timeRemaining}
      </output>
      <button type="button" onClick={timer.pause}>
        Pause runtime
      </button>
      <button type="button" onClick={timer.resume}>
        Resume runtime
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('agenda runtime component flow', () => {
  it('starts the selected pending item and exposes the active runtime state', () => {
    renderComponentFlow(
      <RuntimeHarness initial={[{ id: 'agenda-1', title: 'Budget', status: 'pending' }]} />
    );
    expect(screen.getByTestId('runtime-status').textContent).toBe('pending');

    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.start"]')!);

    expect(screen.getByTestId('runtime-status').textContent).toBe('in-progress');
    expect(screen.getByText('Budget')).toBeTruthy();
  });

  it('pauses and resumes the active agenda voting timer without losing elapsed state', () => {
    vi.useFakeTimers();
    renderComponentFlow(<RuntimeTimerHarness />);

    expect(screen.getByTestId('timer-state').textContent).toBe('running:3');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('timer-state').textContent).toBe('running:2');

    fireEvent.click(screen.getByRole('button', { name: 'Pause runtime' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('timer-state').textContent).toBe('paused:2');

    fireEvent.click(screen.getByRole('button', { name: 'Resume runtime' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('timer-state').textContent).toBe('running:1');
  });

  it('moves to the next item only after the current item has completed', () => {
    renderComponentFlow(
      <RuntimeHarness
        initial={[
          { id: 'agenda-1', title: 'Budget', status: 'in-progress' },
          { id: 'agenda-2', title: 'Housing', status: 'pending' },
        ]}
      />
    );
    const next = document.querySelector(
      '[data-action-id="agendas.toolbar.item.next"]'
    ) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.complete"]')!);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);

    expect(screen.getByText('Housing')).toBeTruthy();
    expect(screen.getByTestId('runtime-status').textContent).toBe('pending');
  });
});
