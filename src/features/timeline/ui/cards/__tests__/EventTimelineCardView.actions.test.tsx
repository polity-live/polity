/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  hashtagProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: () => ({
    gradient: 'event-gradient',
    badge: 'event-badge',
    dot: 'event-dot',
    softSurface: 'event-surface',
    text: 'event-text',
  }),
  getHashtagToneClasses: () => ({ badge: 'hashtag-badge' }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: (props: Record<string, any>) => {
    mocks.hashtagProps = props;
    return <div>Hashtags</div>;
  },
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

import { EventTimelineCardView } from '../EventTimelineCardView';

const Icon = () => <span>Icon</span>;

function props(overrides: Record<string, any> = {}) {
  return {
    event: { id: 'event-1', title: 'Assembly', startDate: '2026-08-09T10:00:00Z' },
    href: undefined,
    onSelect: undefined,
    onRequestParticipation: undefined,
    onLeave: undefined,
    onAcceptInvitation: undefined,
    onWithdrawRequest: undefined,
    onToggleSubscription: undefined,
    isParticipationLoading: false,
    isSubscriptionLoading: false,
    className: undefined,
    t: (key: string) => key,
    rsvpOpen: false,
    setRsvpOpen: vi.fn(),
    participation: {
      isLoading: false,
      requestParticipation: vi.fn(),
      leaveEvent: vi.fn(),
      acceptInvitation: vi.fn(),
    },
    subscription: { isLoading: false, isSubscribed: false, toggleSubscribe: vi.fn() },
    startDate: new Date('2026-08-09T10:00:00Z'),
    day: '9',
    month: 'AUG',
    time: '10:00',
    eventTimeStatus: 'upcoming',
    dateLabel: null,
    locationDisplay: null,
    eventStyle: {},
    eventHref: '/event/event-1',
    eventDescription: undefined,
    eventSubtitle: undefined,
    eventSubtitleHref: undefined,
    resolvedParticipationStatus: null,
    isParticipant: false,
    isInvited: false,
    hasRequested: false,
    hasParticipationRelationship: false,
    getRsvpLabel: () => 'RSVP',
    getRsvpVariant: () => 'default',
    stats: [],
    ...overrides,
  };
}

function action(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtagProps = undefined;
});
afterEach(cleanup);

describe('EventTimelineCardView', () => {
  it('renders upcoming defaults and dispatches request/subscription hook fallbacks', () => {
    const viewProps = props();
    const { container } = render(<EventTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps?.href).toBe('/event/event-1');
    fireEvent.click(action(container, 'timeline.event.participation.request'));
    fireEvent.click(action(container, 'timeline.event.subscription.toggle'));
    expect(viewProps.participation.requestParticipation).toHaveBeenCalledOnce();
    expect(viewProps.subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.description).toBe('');
    expect(mocks.shareProps?.shareContextItem.endDate).toBeUndefined();
    expect(mocks.shareProps?.shareContextItem.tags).toEqual([]);
  });

  it('renders rich live metadata and explicit request/subscription callbacks', () => {
    const onRequestParticipation = vi.fn();
    const onToggleSubscription = vi.fn();
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      tag: `tag-${index}`,
    }));
    const viewProps = props({
      event: {
        id: 'event-1',
        title: 'Assembly',
        startDate: '2026-08-09T10:00:00Z',
        endDate: '2026-08-09T12:00:00Z',
        isSubscribed: true,
        hashtags,
        groupName: 'Group',
        organizerName: 'Organizer',
      },
      onRequestParticipation,
      onToggleSubscription,
      isParticipationLoading: true,
      isSubscriptionLoading: true,
      eventTimeStatus: 'live',
      dateLabel: 'Today',
      locationDisplay: 'Hall',
      eventDescription: 'Description',
      eventSubtitle: 'Group',
      stats: [{ icon: Icon, value: 3, label: 'participants' }],
    });
    const { container } = render(<EventTimelineCardView {...(viewProps as any)} />);
    expect(container.textContent).toContain('features.timeline.cards.happeningNow');
    expect(container.textContent).toContain('Hall');
    expect(container.textContent).toContain('Description');
    expect(container.textContent).toContain('3 participants');
    expect(mocks.hashtagProps?.hashtags).toEqual(hashtags.slice(0, 3));
    fireEvent.click(action(container, 'timeline.event.participation.request'));
    fireEvent.click(action(container, 'timeline.event.subscription.toggle'));
    expect(onRequestParticipation).toHaveBeenCalledOnce();
    expect(onToggleSubscription).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.shareContextItem.endDate).toEqual(expect.any(Date));
    expect(mocks.shareProps?.shareContextItem.groupName).toBe('Group');
  });

  it('disables past requests unless a participation action is loading', () => {
    let view = render(<EventTimelineCardView {...(props({ eventTimeStatus: 'past' }) as any)} />);
    expect(
      action(view.container, 'timeline.event.participation.menu.open').hasAttribute('disabled')
    ).toBe(true);
    expect(
      view.container.querySelector('[data-action-id="timeline.event.participation.request"]')
    ).toBeNull();
    cleanup();

    view = render(
      <EventTimelineCardView
        {...(props({
          eventTimeStatus: 'past',
          isParticipationLoading: true,
          hasParticipationRelationship: true,
        }) as any)}
      />
    );
    expect(
      action(view.container, 'timeline.event.participation.menu.open').hasAttribute('disabled')
    ).toBe(false);
  });

  it('handles participant leave with explicit and hook callbacks', () => {
    const onLeave = vi.fn();
    let viewProps = props({ isParticipant: true, onLeave });
    let view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.participation.leave'));
    expect(onLeave).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({
      isParticipant: true,
      participation: { ...props().participation, isLoading: true },
    });
    view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.participation.leave'));
    expect(viewProps.participation.leaveEvent).toHaveBeenCalledOnce();
  });

  it('handles invitation accept/reject callback priorities', () => {
    const onAcceptInvitation = vi.fn();
    const onLeave = vi.fn();
    let viewProps = props({ isInvited: true, onAcceptInvitation, onLeave });
    let view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.event.invitation.reject'));
    expect(onAcceptInvitation).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({ isInvited: true });
    view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.event.invitation.reject'));
    expect(viewProps.participation.acceptInvitation).toHaveBeenCalledOnce();
    expect(viewProps.participation.leaveEvent).toHaveBeenCalledOnce();
  });

  it('handles requested withdrawal and subscription hook loading state', () => {
    const onWithdrawRequest = vi.fn();
    let viewProps = props({ hasRequested: true, onWithdrawRequest });
    let view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.request.withdraw'));
    expect(onWithdrawRequest).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({
      hasRequested: true,
      event: { ...props().event, organizerName: 'Organizer' },
      subscription: { ...props().subscription, isLoading: true, isSubscribed: true },
    });
    view = render(<EventTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.event.request.withdraw'));
    expect(viewProps.participation.leaveEvent).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.shareContextItem.groupName).toBe('Organizer');
  });
});
