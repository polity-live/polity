/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgendaSpeakerListSectionView } from '../AgendaSpeakerListSectionView';

const mocks = vi.hoisted(() => ({
  zeroList: vi.fn((_props: unknown) => <div data-testid="zero-list" />),
  speakerPage: vi.fn((args: unknown) => ({ kind: 'page', args })),
  speakerById: vi.fn((args: unknown) => ({ kind: 'single', args })),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselPrevious: () => null,
  CarouselNext: () => null,
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: unknown) => mocks.zeroList(props),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    agendas: {
      speakerPage: (args: unknown) => mocks.speakerPage(args),
      speakerById: (args: unknown) => mocks.speakerById(args),
    },
  },
}));

const labels: Record<string, string> = {
  'features.events.agenda.speakerList': 'Speaker list',
  'features.events.agenda.noSpeakersYet': 'No speakers yet',
  'features.events.agenda.joinSpeakerList': 'Join Speaker List',
  'features.events.agenda.joiningSpeakerList': 'Joining speaker list',
  'features.events.agenda.leaveSpeakerList': 'Leave Speaker List',
  'features.events.agenda.leavingSpeakerList': 'Leaving speaker list',
  'features.events.agenda.alreadyOnList': 'Already on list',
  'features.events.agenda.userSpeakerPendingSummary': 'Waiting for placement',
};

function baseProps(overrides?: Partial<Record<string, unknown>>) {
  return {
    speakers: [],
    isUserInSpeakerList: false,
    canManageSpeakers: false,
    isAddingSpeaker: false,
    isRemovingSpeaker: false,
    userId: 'user-1',
    agendaStartTime: Date.now(),
    showGender: false,
    onAddToSpeakerList: vi.fn(),
    onRemoveFromSpeakerList: vi.fn(),
    onMarkCompleted: vi.fn(),
    className: '',
    t: (key: string) => labels[key] ?? key,
    expanded: true,
    setExpanded: vi.fn(),
    carouselApi: null,
    setCarouselApi: vi.fn(),
    now: Date.now(),
    setNow: vi.fn(),
    sortedSpeakers: [],
    currentSpeakerIndex: -1,
    currentSpeaker: null,
    queueStartTime: Date.now(),
    speakerQueue: [],
    userSpeaker: null,
    showMembershipState: false,
    renderRelativeTime: vi.fn(() => 'soon'),
    renderTimingLabel: vi.fn(() => 'soon'),
    ...overrides,
  } as any;
}

afterEach(() => {
  cleanup();
});

describe('AgendaSpeakerListSectionView action loading', () => {
  it('uses verb-specific shared button loading labels', () => {
    const { rerender } = render(
      <AgendaSpeakerListSectionView {...baseProps({ isAddingSpeaker: true })} />
    );

    expect(screen.getByText('Joining speaker list')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Joining speaker list/ }).getAttribute('aria-busy')
    ).toBe('true');

    rerender(
      <AgendaSpeakerListSectionView
        {...baseProps({
          isRemovingSpeaker: true,
          showMembershipState: true,
          onAddToSpeakerList: null,
        })}
      />
    );

    expect(screen.getByText('Leaving speaker list')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Leaving speaker list/ }).getAttribute('aria-busy')
    ).toBe('true');
  });

  it('dispatches section, membership, and current-speaker actions with stable identities', () => {
    const setExpanded = vi.fn();
    const join = vi.fn();
    const leave = vi.fn();
    const complete = vi.fn();
    const currentSpeaker = {
      id: 'speaker-1',
      order: 1,
      order_index: 1,
      isCurrent: true,
      isCurrentUser: true,
      user: { id: 'user-1', name: 'Ada' },
    };

    const { container, rerender } = render(
      <AgendaSpeakerListSectionView
        {...baseProps({
          setExpanded,
          onAddToSpeakerList: join,
          speakerQueue: [currentSpeaker],
          currentSpeaker,
          sortedSpeakers: [currentSpeaker],
          canManageSpeakers: true,
          onMarkCompleted: complete,
        })}
      />
    );

    fireEvent.click(container.querySelector('[data-action-id="agendas.speakers.section.toggle"]')!);
    fireEvent.click(
      container.querySelector('[data-action-id="agendas.speakers.membership.join"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="agendas.speakers.current.complete"]')!
    );
    expect(setExpanded).toHaveBeenCalled();
    expect(join).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith('speaker-1');

    rerender(
      <AgendaSpeakerListSectionView
        {...baseProps({
          showMembershipState: true,
          userSpeaker: currentSpeaker,
          onAddToSpeakerList: null,
          onRemoveFromSpeakerList: leave,
        })}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="agendas.speakers.membership.leave"]')!
    );
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('renders collapsed state and disables joining without a user', () => {
    const { container, rerender } = render(
      <AgendaSpeakerListSectionView
        {...baseProps({ expanded: false, userId: null, speakerQueue: [] })}
      />
    );
    expect(container.querySelector('.lucide-chevron-down')).toBeTruthy();
    rerender(
      <AgendaSpeakerListSectionView
        {...baseProps({ expanded: true, userId: null, speakerQueue: [] })}
      />
    );
    expect(
      (
        container.querySelector(
          '[data-action-id="agendas.speakers.membership.join"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('renders carousel speaker variants, gender labels, and queued membership', () => {
    const queue = [
      {
        id: 'past',
        order: 1,
        order_index: 1,
        isPast: true,
        isCurrent: false,
        isCurrentUser: false,
        completed: true,
        time: 3,
        estimatedStartTime: Date.now(),
        user: { id: 'u1', name: null, email: 'male@example.com', gender: 'male' },
      },
      {
        id: 'current',
        order: 2,
        order_index: 2,
        isPast: false,
        isCurrent: true,
        isCurrentUser: true,
        completed: false,
        time: 4,
        estimatedStartTime: Date.now(),
        user: { id: 'u2', name: 'Ada', email: 'ada@example.com', gender: 'female' },
      },
      {
        id: 'diverse',
        order: 3,
        order_index: 3,
        isPast: false,
        isCurrent: false,
        isCurrentUser: false,
        completed: false,
        time: 5,
        estimatedStartTime: Date.now(),
        user: { id: 'u3', name: null, email: null, gender: 'diverse' },
      },
      {
        id: 'unspecified',
        order: 4,
        order_index: 4,
        isPast: false,
        isCurrent: false,
        isCurrentUser: false,
        completed: false,
        time: 5,
        estimatedStartTime: Date.now(),
        user: { id: 'u4', name: null, email: null, gender: null },
      },
    ];
    const { container } = render(
      <AgendaSpeakerListSectionView
        {...baseProps({
          speakerQueue: queue,
          speakers: queue,
          showGender: true,
          canManageSpeakers: false,
          showMembershipState: true,
          userSpeaker: queue[0],
          onRemoveFromSpeakerList: null,
          t: (key: string, fallback?: unknown) =>
            key === 'common.unspecified'
              ? 'Unspecified'
              : typeof fallback === 'string'
                ? fallback
                : (labels[key] ?? key),
        })}
      />
    );
    expect(container.querySelector('.opacity-60')).toBeTruthy();
    expect(screen.getByText('male@example.com')).toBeTruthy();
    expect(screen.getAllByText('Unspecified')).toHaveLength(2);
    expect(
      container.querySelector('[data-action-id="agendas.speakers.membership.leave"]')
    ).toBeNull();
  });

  it('renders the current-user membership summary and no membership action', () => {
    const userSpeaker = {
      id: 'speaker-1',
      order: 1,
      isCurrent: true,
      estimatedStartTime: Date.now(),
    };
    const { container, rerender } = render(
      <AgendaSpeakerListSectionView
        {...baseProps({
          showMembershipState: true,
          userSpeaker,
          onRemoveFromSpeakerList: null,
        })}
      />
    );
    expect(container.textContent).toContain('features.events.agenda.userSpeakerCurrentSummary');

    rerender(
      <AgendaSpeakerListSectionView
        {...baseProps({
          showMembershipState: false,
          onAddToSpeakerList: null,
        })}
      />
    );
    expect(container.querySelector('[data-action-id*="speakers.membership"]')).toBeNull();
  });

  it('uses safe avatar and link fallbacks for a speaker without a user', () => {
    const speaker = {
      id: 'speaker-1',
      order: 1,
      isCurrent: false,
      isPast: false,
      isCurrentUser: false,
      completed: false,
      time: 3,
      estimatedStartTime: Date.now(),
      user: null,
    };
    const { container } = render(
      <AgendaSpeakerListSectionView
        {...baseProps({
          speakerQueue: [speaker],
          speakers: [speaker],
          t: (key: string) => (key === 'common.unspecified' ? '' : key),
        })}
      />
    );
    expect(container.textContent).toContain('U');
  });

  it('configures virtual speaker queries and renders hydrated and fallback rows', () => {
    const complete = vi.fn();
    const queueSpeaker = {
      id: 'speaker-1',
      order: null,
      order_index: 1,
      isCurrent: true,
      user: { id: 'u1', name: null, email: 'speaker@example.com', avatar: null },
    };
    render(
      <AgendaSpeakerListSectionView
        {...baseProps({
          agendaItemId: 'agenda-1',
          speakers: [queueSpeaker],
          speakerQueue: [queueSpeaker],
          canManageSpeakers: true,
          onMarkCompleted: complete,
          t: (key: string) => (key === 'common.unspecified' ? '' : key),
        })}
      />
    );
    const props = mocks.zeroList.mock.lastCall?.[0] as any;
    expect(props.getRowKey(queueSpeaker)).toBe('speaker-1');
    expect(props.toStartRow(queueSpeaker)).toEqual({ order_index: 1, id: 'speaker-1' });
    expect(
      props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }).options
    ).toEqual({ ttl: '5m' });
    expect(
      props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false }).options
    ).toEqual({ ttl: 'none' });
    expect(props.getSingleQuery({ id: 'speaker-1', settled: true }).options).toEqual({ ttl: '5m' });
    expect(props.getSingleQuery({ id: 'speaker-1', settled: false }).options).toEqual({
      ttl: 'none',
    });

    const hydrated = render(props.renderRow({ id: 'speaker-1', order_index: 9 }));
    expect(screen.getByText('speaker@example.com')).toBeTruthy();
    fireEvent.click(
      hydrated.container.querySelector('[data-action-id="agendas.speakers.current.complete"]')!
    );
    expect(complete).toHaveBeenCalledWith('speaker-1');
    hydrated.unmount();

    const fallback = render(props.renderRow({ id: 'fallback', order_index: 2 }));
    expect(screen.getByText('U')).toBeTruthy();
    expect(
      fallback.container.querySelector('[data-action-id="agendas.speakers.current.complete"]')
    ).toBeNull();
    fallback.unmount();

    const skeleton = render(props.renderSkeleton());
    expect(skeleton.container.querySelector('.h-28')).toBeTruthy();
    skeleton.unmount();
    expect(props.renderEmpty()).toBeNull();
  });
});
