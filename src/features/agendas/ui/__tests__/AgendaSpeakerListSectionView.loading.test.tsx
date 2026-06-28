/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgendaSpeakerListSectionView } from '../AgendaSpeakerListSectionView';

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
});
