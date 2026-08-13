/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ baseProps: undefined as Record<string, any> | undefined }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  StatusBadge: ({ children, tone }: { children: ReactNode; tone: string }) => (
    <span data-testid="status" data-tone={tone}>
      {children}
    </span>
  ),
}));

vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      {title}
      {subtitle ? `:${subtitle}` : ''}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import {
  AgendaItemTimelineCard,
  formatAgendaItemDateTime,
  formatAgendaItemLabel,
  getAgendaItemStatusBadgeTone,
} from '../AgendaItemTimelineCard';

afterEach(cleanup);

describe('agenda item formatters', () => {
  it('normalizes labels and rejects empty values', () => {
    expect(formatAgendaItemLabel()).toBeNull();
    expect(formatAgendaItemLabel(null)).toBeNull();
    expect(formatAgendaItemLabel('   ')).toBeNull();
    expect(formatAgendaItemLabel('closing_vote-item')).toBe('Closing Vote Item');
  });

  it('formats valid dates and preserves only meaningful invalid strings', () => {
    expect(formatAgendaItemDateTime()).toBeNull();
    expect(formatAgendaItemDateTime(null)).toBeNull();
    expect(formatAgendaItemDateTime('not-a-date')).toBe('not-a-date');
    expect(formatAgendaItemDateTime('   ')).toBeNull();
    expect(formatAgendaItemDateTime(new Date(Number.NaN))).toBeNull();
    expect(formatAgendaItemDateTime(new Date('2026-08-09T10:00:00Z'))).toEqual(expect.any(String));
  });

  it.each([
    ['active', 'success'],
    ['in-progress', 'success'],
    ['completed', 'info'],
    ['pending', 'warning'],
    ['planned', 'warning'],
    ['unknown', 'neutral'],
    [null, 'neutral'],
  ] as const)('maps %s status to %s tone', (status, tone) => {
    expect(getAgendaItemStatusBadgeTone(status)).toBe(tone);
  });
});

describe('AgendaItemTimelineCard', () => {
  it('renders all metadata and derives the event agenda destination', () => {
    render(
      <AgendaItemTimelineCard
        className="custom"
        agendaItem={{
          id: 'agenda-1',
          title: 'Closing Vote',
          description: '  Final decision  ',
          type: 'closing_vote',
          status: 'active',
          orderIndex: 0,
          scheduledTime: 'not-a-date',
          createdAt: '2026-08-09T10:00:00Z',
          durationMinutes: 45,
          eventId: 'event-1',
          eventName: 'Assembly',
        }}
      />
    );

    expect(mocks.baseProps).toMatchObject({
      contentType: 'agenda_item',
      className: 'custom',
      href: '/event/event-1/agenda',
    });
    expect(screen.getByText('Closing Vote:Assembly')).toBeTruthy();
    expect(screen.getByText('Final decision')).toBeTruthy();
    expect(screen.getByText('Closing Vote')).toBeTruthy();
    expect(screen.getByTestId('status').dataset.tone).toBe('success');
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('not-a-date')).toBeTruthy();
    expect(screen.getByText('45 minutes')).toBeTruthy();
  });

  it('uses created time, explicit href, and omits absent or non-positive metadata', () => {
    render(
      <AgendaItemTimelineCard
        href="/custom"
        agendaItem={{
          id: 'agenda-2',
          title: 'Discussion',
          description: null,
          type: ' ',
          status: null,
          orderIndex: null,
          scheduledTime: null,
          createdAt: '2026-08-09T10:00:00Z',
          durationMinutes: 0,
          eventId: null,
          eventName: null,
        }}
      />
    );
    expect(mocks.baseProps?.href).toBe('/custom');
    expect(screen.queryByText('minutes')).toBeNull();
    expect(screen.getByText(/2026|Aug|09/)).toBeTruthy();
  });

  it('supports a non-navigating minimal card and a non-number duration', () => {
    render(
      <AgendaItemTimelineCard
        agendaItem={{
          id: 'agenda-3',
          title: 'Minimal',
          durationMinutes: '15' as any,
        }}
      />
    );
    expect(mocks.baseProps?.href).toBeUndefined();
    expect(screen.queryByText('15 minutes')).toBeNull();
  });
});
