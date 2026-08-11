/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en',
  navigate: vi.fn(),
  view: vi.fn((_props: unknown) => null),
  formatDistanceToNow: vi.fn(() => 'relative'),
  electionController: { open: false },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mocks.language },
  }),
}));
vi.mock('@/features/agendas/hooks/useElectionDetailsSectionController', () => ({
  useElectionDetailsSectionController: () => mocks.electionController,
}));
vi.mock('date-fns', () => ({
  addMinutes: (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000),
  formatDistanceToNow: mocks.formatDistanceToNow,
}));
vi.mock('date-fns/locale', () => ({ de: { code: 'de' }, enUS: { code: 'en' } }));
vi.mock('../AgendaItemContextCardView', () => ({
  AgendaItemContextCardView: (props: unknown) => mocks.view(props),
}));

import { AgendaItemContextCard } from '../AgendaItemContextCard';

afterEach(() => {
  cleanup();
  mocks.language = 'en';
  vi.clearAllMocks();
});

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agenda-1',
    title: 'Budget',
    type: 'discussion',
    status: 'pending',
    ...overrides,
  } as never;
}

describe('AgendaItemContextCard controller branches', () => {
  it.each(['election', 'vote', 'accreditation', 'speech', 'discussion', 'unknown'])(
    'selects the icon and theme for %s items',
    type => {
      render(<AgendaItemContextCard agendaItem={item({ type })} />);
      const props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
      expect(props.TypeIcon).toBeTypeOf('object');
      expect(props.gradientClass).toBeTypeOf('string');
      expect(props.showHeaderStatusBadge).toBe(true);
      expect(props.presentation).toBe('standalone');
    }
  );

  it('derives scheduled and actual timing with a positive duration', () => {
    const scheduled = '2026-01-01T10:00:00.000Z';
    const started = new Date('2026-01-01T10:05:00.000Z');
    const completed = new Date('2026-01-01T10:25:00.000Z');
    render(
      <AgendaItemContextCard
        agendaItem={item({
          status: 'completed',
          duration: 20,
          scheduledTime: scheduled,
          startTime: new Date('2026-01-01T10:01:00.000Z'),
          activatedAt: started,
          endTime: new Date('2026-01-01T10:24:00.000Z'),
          completedAt: completed,
        })}
        showHeaderStatusBadge={false}
        presentation="embedded"
      />
    );
    const props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props.durationMinutes).toBe(20);
    expect(props.estimatedDurationMinutes).toBe(20);
    expect(props.scheduledAt.toISOString()).toBe(scheduled);
    expect(props.actualStartedAt).toBe(started);
    expect(props.actualCompletedAt).toBe(completed);
    expect(props.estimatedCompletedAt.toISOString()).toBe('2026-01-01T10:20:00.000Z');
    expect(props.estimatedOngoingCompletedAt.toISOString()).toBe('2026-01-01T10:25:00.000Z');
    expect(props.isCompleted).toBe(true);
    expect(props.isOngoing).toBe(false);
  });

  it('uses fallback timing, ongoing states, locale, and relative formatting', () => {
    mocks.language = 'de';
    const startTime = new Date('2026-01-01T10:00:00.000Z');
    render(
      <AgendaItemContextCard
        agendaItem={item({ status: 'active', duration: 0, startTime })}
        agendaDetailLink={{ eventId: 'event-1', agendaItemId: 'agenda-1' }}
      />
    );
    const props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props.durationMinutes).toBeNull();
    expect(props.estimatedDurationMinutes).toBe(30);
    expect(props.scheduledAt).toBeUndefined();
    expect(props.actualStartedAt).toBe(startTime);
    expect(props.actualCompletedAt).toBeUndefined();
    expect(props.estimatedStartedAt).toBe(startTime);
    expect(props.isCompleted).toBe(false);
    expect(props.isOngoing).toBe(true);
    expect(props.hasAgendaDetailLink).toBe(true);
    expect(props.electionDetailsController).toBe(mocks.electionController);
    expect(props.formatRelativeTime(startTime)).toBe('relative');
    expect(mocks.formatDistanceToNow).toHaveBeenCalledWith(
      startTime,
      expect.objectContaining({ addSuffix: true, locale: { code: 'de' } })
    );
    props.navigateToAgendaDetail();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/event/$id/agenda/$agendaItemId',
      params: { id: 'event-1', agendaItemId: 'agenda-1' },
    });
  });

  it('handles missing links, non-ongoing states, and every link operand', () => {
    const { rerender } = render(
      <AgendaItemContextCard
        agendaItem={item({ status: 'in-progress', endTime: new Date(1) })}
        agendaDetailLink={{ eventId: '', agendaItemId: 'agenda-1' }}
      />
    );
    let props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props.isCompleted).toBe(true);
    expect(props.isOngoing).toBe(false);
    expect(props.hasAgendaDetailLink).toBe(false);

    rerender(
      <AgendaItemContextCard
        agendaItem={item({ status: 'in-progress', duration: -1 })}
        agendaDetailLink={{ eventId: 'event-1', agendaItemId: '' }}
      />
    );
    props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props.hasAgendaDetailLink).toBe(false);

    rerender(<AgendaItemContextCard agendaItem={item({ status: 'pending' })} />);
    props = mocks.view.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props.isOngoing).toBe(false);
    props.navigateToAgendaDetail();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
