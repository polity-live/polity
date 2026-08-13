/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarItemDetailsDialog } from '../CalendarItemDetailsDialog';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string, params?: any) => (params ? `${key}:${params.count}` : key),
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ asChild, children, ...props }: any) =>
    asChild ? <span {...props}>{children}</span> : <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));

afterEach(() => cleanup());
beforeEach(() => {
  mocks.language = 'en';
});

function event(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'event-1_rrule_1',
    title: 'Council session',
    description: 'Discuss policy',
    start_date: Date.UTC(2026, 7, 2, 10),
    end_date: Date.UTC(2026, 7, 2, 11, 30),
    location: 'Town hall',
    location_url: 'https://meet.example.test/session',
    organizerName: 'Ada Lovelace',
    bookingCount: 2,
    max_bookings: 10,
    hashtags: [{ id: 'tag-1', tag: 'policy' }],
    isMeeting: false,
    ...overrides,
  };
}

describe('CalendarItemDetailsDialog', () => {
  it('renders complete event details, safe online navigation, close, and canonical event deep link', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <CalendarItemDetailsDialog item={event()} open onOpenChange={onOpenChange} />
    );
    expect(screen.getByRole('heading', { name: 'Council session' })).toBeTruthy();
    expect(screen.getByText('Town hall')).toBeTruthy();
    expect(screen.getByText('2 / 10')).toBeTruthy();
    expect(screen.getByText('#policy')).toBeTruthy();
    const online = screen.getByRole('link', { name: 'https://meet.example.test/session' });
    expect(online.getAttribute('target')).toBe('_blank');
    expect(online.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    const eventLink = container.querySelector<HTMLAnchorElement>(
      'a[data-action-id="calendar.item-details.event.open"]'
    );
    expect(eventLink?.getAttribute('href')).toBe('/event/event-1');
  });

  it('models meeting booking badges, participant labels, URL fallback, invalid ranges, and null input', () => {
    const item = event({
      id: 'meeting-1',
      isMeeting: true,
      isBookedByMe: false,
      is_bookable: true,
      bookingCount: undefined,
      attendeeCount: 1,
      max_bookings: undefined,
      location_url: null,
      stream_url: 'https://stream.example.test',
      end_date: 0,
      organizerName: null,
      description: '',
      hashtags: [],
    });
    const { rerender } = render(
      <CalendarItemDetailsDialog item={item} open onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('features.calendar.meeting.available')).toBeTruthy();
    expect(screen.getByText('features.calendar.eventCard.participant:1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://stream.example.test' })).toBeTruthy();
    expect(screen.queryByText('features.calendar.details.openEventWiki')).toBeNull();
    rerender(<CalendarItemDetailsDialog item={null} open onOpenChange={vi.fn()} />);
    expect(document.body.textContent).toBe('');
  });

  it('renders German booked meetings and omits unavailable participant and online data', () => {
    mocks.language = 'de';
    const { rerender } = render(
      <CalendarItemDetailsDialog
        item={event({
          id: 'meeting-1',
          isMeeting: true,
          isBookedByMe: true,
          is_bookable: false,
          bookingCount: undefined,
          attendeeCount: undefined,
          max_bookings: 4,
          location_url: null,
          stream_url: null,
        })}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText('features.calendar.meeting.booked')).toBeTruthy();
    expect(screen.getByText('0 / 4')).toBeTruthy();
    expect(screen.queryByText('generated.inline.0028_url_0e2d9b07')).toBeNull();

    rerender(
      <CalendarItemDetailsDialog
        item={event({
          bookingCount: undefined,
          attendeeCount: undefined,
          max_bookings: undefined,
          location_url: null,
          stream_url: null,
        })}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByText('features.events.detail.participants')).toBeNull();
  });
});
