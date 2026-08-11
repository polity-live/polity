/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamView, type EventStreamViewProps } from '../EventStreamView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/agenda">{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/hooks/useHorizontalArrowNavigation', () => ({
  INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR: '[data-arrow-keys]',
  useHorizontalArrowNavigation: () => ({ onKeyDown: vi.fn() }),
}));
vi.mock('@/features/agendas/ui/AgendaNavigationControls', () => ({
  AgendaNavigationControls: () => null,
}));
vi.mock('@/features/agendas/ui/AgendaElectionSection', () => ({
  AgendaElectionSection: () => null,
  isAutoAssignedRoleElection: () => false,
}));
vi.mock('@/features/agendas/ui/AgendaVoteSection', () => ({ AgendaVoteSection: () => null }));
vi.mock('../EventLivestreamPlayer', () => ({ EventLivestreamPlayer: () => null }));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', async () => {
  const { cloneElement, createContext, isValidElement, useContext } = await import('react');
  const Context = createContext<(open: boolean) => void>(() => undefined);
  return {
    Collapsible: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => <Context.Provider value={onOpenChange}>{children}</Context.Provider>,
    CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CollapsibleTrigger: ({ children }: { children: ReactNode }) => {
      const onOpenChange = useContext(Context);
      return isValidElement(children)
        ? cloneElement(children, { onClick: () => onOpenChange(false) } as never)
        : children;
    },
  };
});

afterEach(cleanup);

const t = (key: string) => key;

function props(overrides: Partial<EventStreamViewProps> = {}): EventStreamViewProps {
  return {
    activeContentRef: createRef<HTMLDivElement>(),
    addingSpeaker: false,
    attendanceMode: 'online',
    calculateSpeakerTime: vi.fn(() => new Date('2026-08-02T12:00:00Z')),
    canJoinSpeakerList: true,
    canScrollLeft: true,
    canScrollRight: true,
    carouselRef: createRef<HTMLDivElement>(),
    confirmedOfflineParticipantCount: 0,
    currentAgendaItem: { id: 'agenda-1', status: 'active', title: 'Opening', type: 'discussion' },
    election: null,
    event: { gender_quota_enabled: false, stream_url: null, title: 'Covered event' },
    eventId: 'event-1',
    finalDecisions: [],
    finalSelections: [],
    formatTime: vi.fn(() => '12:00'),
    getAgendaItemIcon: vi.fn(() => null),
    getStatusColor: vi.fn(() => ''),
    getTypeColor: vi.fn(() => ''),
    handleAddToSpeakerList: vi.fn(),
    handleRemoveFromSpeakerList: vi.fn(),
    indicativeDecisions: [],
    indicativeSelections: [],
    isLoading: false,
    isUserCandidate: false,
    navigate: vi.fn(),
    previousAgendaItemIdRef: { current: null },
    removingSpeaker: null,
    scroll: vi.fn(),
    setCanScrollLeft: vi.fn(),
    setCanScrollRight: vi.fn(),
    setSpeakersExpanded: vi.fn(),
    speakerList: [{ completed: false, id: 'speaker-1', user: { first_name: 'Ada', id: 'user-1' } }],
    speakersExpanded: true,
    t,
    updateScrollButtons: vi.fn(),
    user: { id: 'user-1' },
    userHasElectionVoted: false,
    userHasVoteVoted: false,
    userSelectedCandidateIds: [],
    userSelectedChoiceIds: [],
    userSpeaker: { id: 'speaker-1' },
    voteEntity: null,
    ...overrides,
  };
}

describe('EventStreamView action contracts', () => {
  it('returns to the event when no active agenda item exists', () => {
    const navigate = vi.fn();
    render(<EventStreamView {...props({ currentAgendaItem: null, navigate })} />);
    const back = screen.getByRole('button', { name: 'features.events.backToEvent' });
    expect(back.getAttribute('data-action-id')).toBe('events.stream.back-to-event');
    fireEvent.click(back);
    expect(navigate).toHaveBeenCalledWith({ to: '/event/event-1' });
  });

  it('controls the speaker list, carousel and current speaker through stable actions', () => {
    const remove = vi.fn();
    const scroll = vi.fn();
    const setSpeakersExpanded = vi.fn();
    const view = render(
      <EventStreamView
        {...props({ handleRemoveFromSpeakerList: remove, scroll, setSpeakersExpanded })}
      />
    );

    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.toggle"]')!
    );
    expect(setSpeakersExpanded).toHaveBeenCalled();
    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.remove-self.header"]')!
    );
    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.remove-self.card"]')!
    );
    expect(remove).toHaveBeenCalledTimes(2);

    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.previous"]')!
    );
    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.next"]')!
    );
    expect(scroll).toHaveBeenNthCalledWith(1, 'left');
    expect(scroll).toHaveBeenNthCalledWith(2, 'right');

    const add = vi.fn();
    view.rerender(
      <EventStreamView
        {...props({
          handleAddToSpeakerList: add,
          speakerList: [],
          userSpeaker: null,
        })}
      />
    );
    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.add-self"]')!
    );
    expect(add).toHaveBeenCalledOnce();
  });
});
