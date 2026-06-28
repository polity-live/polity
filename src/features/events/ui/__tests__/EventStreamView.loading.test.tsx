/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamView } from '../EventStreamView';

afterEach(() => {
  cleanup();
});

describe('EventStreamView loading state', () => {
  it('renders a section skeleton instead of loading text', () => {
    const props = {
      eventId: 'event-1',
      navigate: vi.fn(),
      t: (key: string) => key,
      carouselRef: { current: null },
      activeContentRef: { current: null },
      canScrollLeft: false,
      canScrollRight: false,
      event: null,
      currentAgendaItem: null,
      speakerList: [],
      user: null,
      isLoading: true,
      addingSpeaker: false,
      removingSpeaker: false,
      canJoinSpeakerList: false,
      userSpeaker: null,
      handleAddToSpeakerList: vi.fn(),
      handleRemoveFromSpeakerList: vi.fn(),
      calculateSpeakerTime: vi.fn(),
      formatTime: vi.fn(),
      speakersExpanded: false,
      setSpeakersExpanded: vi.fn(),
      attendanceMode: 'offline',
      confirmedOfflineParticipantCount: 0,
      election: null,
      indicativeSelections: [],
      finalSelections: [],
      userHasElectionVoted: false,
      userSelectedCandidateIds: [],
      isUserCandidate: false,
      voteEntity: null,
      indicativeDecisions: [],
      finalDecisions: [],
      userHasVoteVoted: false,
      userSelectedChoiceIds: [],
      scroll: vi.fn(),
      getAgendaItemIcon: vi.fn(),
      getStatusColor: vi.fn(),
      getTypeColor: vi.fn(),
    } as any;

    render(<EventStreamView {...props} />);

    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('common.loading.general')).toBeNull();
  });
});
