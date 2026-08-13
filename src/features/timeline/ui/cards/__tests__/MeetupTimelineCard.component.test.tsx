/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ baseProps: undefined as Record<string, any> | undefined }));

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: () => ({ softSurface: 'event-surface' }),
  getSemanticToneClasses: (tone: string) => ({
    border: `${tone}-border`,
    dot: `${tone}-dot`,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ children, title, subtitle, badge }: any) => (
    <header>
      {title}
      {subtitle ? `:${subtitle}` : ''}
      {badge}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import {
  MeetupTimelineCard,
  getMeetupDateLabel,
  getMeetupStateClassName,
  getMeetupTimelineState,
} from '../MeetupTimelineCard';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 9, 12));
  mocks.baseProps = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('meetup timeline helpers', () => {
  it('labels today, tomorrow, and later dates', () => {
    expect(getMeetupDateLabel(new Date(2026, 7, 9, 18))).toBe('Today');
    expect(getMeetupDateLabel(new Date(2026, 7, 10, 18))).toBe('Tomorrow');
    expect(getMeetupDateLabel(new Date(2026, 7, 12, 18))).toBeNull();
  });

  it('classifies past, live, and upcoming windows', () => {
    expect(getMeetupTimelineState(new Date(2026, 7, 8), new Date(2026, 7, 8, 13))).toBe('past');
    expect(getMeetupTimelineState(new Date(2026, 7, 9, 11), new Date(2026, 7, 9, 13))).toBe('live');
    expect(getMeetupTimelineState(new Date(2026, 7, 10), new Date(2026, 7, 10, 13))).toBe(
      'upcoming'
    );
  });

  it('prioritizes booked, available, past, and neutral state classes', () => {
    expect(
      getMeetupStateClassName({
        isPast: false,
        isBookedByMe: true,
        isBookable: true,
        isFull: false,
      })
    ).toBe('success-border');
    expect(
      getMeetupStateClassName({
        isPast: false,
        isBookedByMe: false,
        isBookable: true,
        isFull: false,
      })
    ).toBe('info-border');
    expect(
      getMeetupStateClassName({
        isPast: true,
        isBookedByMe: false,
        isBookable: true,
        isFull: false,
      })
    ).toBe('opacity-70');
    expect(
      getMeetupStateClassName({
        isPast: false,
        isBookedByMe: false,
        isBookable: false,
        isFull: true,
      })
    ).toBeUndefined();
  });
});

describe('MeetupTimelineCard', () => {
  it('renders and books a rich available public meetup', () => {
    const onBook = vi.fn();
    const onSelect = vi.fn();
    render(
      <MeetupTimelineCard
        href="/meetup/1"
        onSelect={onSelect}
        onBook={onBook}
        className="custom"
        meetup={{
          id: 'meetup-1',
          title: 'Town hall',
          description: '  Public discussion  ',
          startDate: new Date(2026, 7, 10, 18),
          endDate: new Date(2026, 7, 10, 20),
          meetingType: 'public-meeting',
          organizerName: 'Ada',
          location: 'Hall',
          onlineUrl: 'https://example.test/meet',
          bookingCount: 1,
          maxBookings: 5,
          isBookable: true,
          participants: [{ id: 'user-1', name: 'Ada', avatar: 'ada.jpg' }],
        }}
      />
    );
    expect(mocks.baseProps).toMatchObject({ href: '/meetup/1', onClick: onSelect });
    expect(document.body.textContent).toContain('Public discussion');
    expect(document.body.textContent).toContain('Hall');
    expect(document.body.textContent).toContain(' / 5');
    fireEvent.click(screen.getByText('generated.inline.1163_book_meeting_1b8711e4'));
    expect(onBook).toHaveBeenCalledOnce();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.test/meet');
  });

  it('renders a booked private meetup and cancellation action using participant count fallback', () => {
    const onCancel = vi.fn();
    render(
      <MeetupTimelineCard
        onCancel={onCancel}
        meetup={{
          id: 'meetup-2',
          title: 'Private call',
          startDate: new Date(2026, 7, 12, 18),
          meetingType: null,
          isBookedByMe: true,
          participants: [
            { id: 'user-1', name: null },
            { id: 'user-2', name: 'Bo' },
          ],
        }}
      />
    );
    expect(document.body.textContent).toContain('features.calendar.meeting.booked');
    expect(document.body.textContent).toContain('features.calendar.eventCard.participantPlural');
    expect(document.body.textContent).toContain('U');
    fireEvent.click(screen.getByText('generated.inline.1164_cancel_booking_c6085eb5'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('allows an owner to delete only a non-recurring upcoming meetup', () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <MeetupTimelineCard
        onDelete={onDelete}
        meetup={{
          id: 'meetup-3',
          title: '',
          startDate: new Date(2026, 7, 12),
          isOwner: true,
        }}
      />
    );
    expect(document.body.textContent).toContain('features.calendar.eventCard.meeting');
    fireEvent.click(screen.getByLabelText('generated.inline.0167_delete_6d432a50'));
    expect(onDelete).toHaveBeenCalledOnce();

    rerender(
      <MeetupTimelineCard
        onDelete={onDelete}
        meetup={{
          id: 'meetup-3',
          title: 'Recurring',
          startDate: new Date(2026, 7, 12),
          isOwner: true,
          isRecurringInstance: true,
        }}
      />
    );
    expect(screen.queryByLabelText('generated.inline.0167_delete_6d432a50')).toBeNull();
  });

  it('shows live, full, and past states without invalid actions', () => {
    render(
      <MeetupTimelineCard
        onBook={vi.fn()}
        meetup={{
          id: 'meetup-live',
          title: 'Live',
          startDate: new Date(2026, 7, 9, 11),
          endDate: new Date(2026, 7, 9, 13),
          bookingCount: 1,
          maxBookings: 1,
          isBookable: true,
        }}
      />
    );
    expect(document.body.textContent).toContain('features.timeline.cards.happeningNow');
    expect(document.body.textContent).toContain('features.calendar.meeting.fullyBooked');
    expect(screen.queryByText('generated.inline.1163_book_meeting_1b8711e4')).toBeNull();
    cleanup();

    render(
      <MeetupTimelineCard
        onCancel={vi.fn()}
        meetup={{
          id: 'meetup-past',
          title: 'Past',
          startDate: new Date(2026, 7, 8, 10),
          isBookedByMe: true,
        }}
      />
    );
    expect(document.body.textContent).toContain('generated.inline.1161_past_405c12fb');
    expect(screen.queryByText('generated.inline.1164_cancel_booking_c6085eb5')).toBeNull();
  });
});
