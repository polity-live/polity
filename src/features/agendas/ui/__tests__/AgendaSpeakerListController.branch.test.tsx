/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAgendaSpeakerListSectionController } from '../useAgendaSpeakerListSectionController';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAgendaSpeakerListSectionController branches', () => {
  it('sorts the queue, applies timing defaults, and advances its clock', () => {
    const speakers = [
      {
        id: 'future',
        order: 3,
        time: null,
        completed: false,
        user: { id: 'other' },
      },
      {
        id: 'past',
        order: 1,
        time: 1,
        completed: true,
        startTime: 1_000,
      },
      {
        id: 'current',
        order: 2,
        time: 61,
        completed: false,
        user: { id: 'me' },
      },
    ];
    const { result, unmount } = renderHook(() =>
      useAgendaSpeakerListSectionController({
        speakers: speakers as never,
        isUserInSpeakerList: false,
        canManageSpeakers: true,
        isAddingSpeaker: false,
        userId: 'me',
        agendaStartTime: 0,
      })
    );

    expect(result.current.sortedSpeakers.map(speaker => speaker.id)).toEqual([
      'past',
      'current',
      'future',
    ]);
    expect(result.current.currentSpeaker?.id).toBe('current');
    expect(result.current.queueStartTime).toBe(0);
    expect(result.current.speakerQueue[2]?.durationMinutes).toBe(3);
    expect(result.current.userSpeaker?.id).toBe('current');
    expect(result.current.showMembershipState).toBe(true);

    const previousNow = result.current.now;
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.now).toBeGreaterThan(previousNow);
    unmount();
  });

  it('uses every queue-start fallback and handles an exhausted queue', () => {
    const currentStart = renderHook(() =>
      useAgendaSpeakerListSectionController({
        speakers: [
          { id: 'current', order: 1, time: 1, completed: false, startTime: 2_000 },
        ] as never,
        isUserInSpeakerList: true,
        canManageSpeakers: false,
        isAddingSpeaker: false,
      })
    );
    expect(currentStart.result.current.queueStartTime).toBe(2_000);
    expect(currentStart.result.current.showMembershipState).toBe(true);
    currentStart.unmount();

    const firstStart = renderHook(() =>
      useAgendaSpeakerListSectionController({
        speakers: [{ id: 'past', order: 1, time: 1, completed: true, startTime: 3_000 }] as never,
        isUserInSpeakerList: false,
        canManageSpeakers: false,
        isAddingSpeaker: false,
      })
    );
    expect(firstStart.result.current.currentSpeakerIndex).toBe(-1);
    expect(firstStart.result.current.currentSpeaker).toBeNull();
    expect(firstStart.result.current.queueStartTime).toBe(3_000);
    const scrollTo = vi.fn();
    act(() => firstStart.result.current.setCarouselApi({ scrollTo } as never));
    expect(scrollTo).toHaveBeenCalledWith(0, true);
    firstStart.unmount();

    const empty = renderHook(() =>
      useAgendaSpeakerListSectionController({
        speakers: [],
        isUserInSpeakerList: false,
        canManageSpeakers: false,
        isAddingSpeaker: false,
      })
    );
    expect(empty.result.current.queueStartTime).toBe(10_000);
    expect(empty.result.current.showMembershipState).toBe(false);
    empty.unmount();
  });

  it('scrolls only an expanded carousel and formats every timing state', () => {
    const scrollTo = vi.fn();
    const { result } = renderHook(() =>
      useAgendaSpeakerListSectionController({
        speakers: [{ id: 'current', order: 1, time: 1, completed: false }] as never,
        isUserInSpeakerList: false,
        canManageSpeakers: false,
        isAddingSpeaker: false,
      })
    );

    act(() => result.current.setCarouselApi({ scrollTo } as never));
    expect(scrollTo).toHaveBeenCalledWith(0, true);
    act(() => result.current.setExpanded(false));
    scrollTo.mockClear();
    act(() => result.current.setCarouselApi({ scrollTo, marker: true } as never));
    expect(scrollTo).not.toHaveBeenCalled();

    expect(result.current.renderRelativeTime({ completed: true } as never)).toBe(
      'features.events.agenda.completedSpeaker'
    );
    expect(
      result.current.renderRelativeTime({
        completed: false,
        isCurrent: true,
        msUntilEnd: 3_661_000,
      } as never)
    ).toBe('1:01:01');
    expect(
      result.current.renderRelativeTime({
        completed: false,
        isCurrent: false,
        msUntilStart: -1,
      } as never)
    ).toBe('features.events.agenda.upNext');
    expect(
      result.current.renderRelativeTime({
        completed: false,
        isCurrent: false,
        msUntilStart: 61_000,
      } as never)
    ).toBe('1:01');
    expect(result.current.renderTimingLabel({ completed: true } as never)).toBe(
      'features.events.agenda.turnCompletedLabel'
    );
    expect(result.current.renderTimingLabel({ completed: false, isCurrent: true } as never)).toBe(
      'features.events.agenda.timeRemainingLabel'
    );
    expect(result.current.renderTimingLabel({ completed: false, isCurrent: false } as never)).toBe(
      'features.events.agenda.turnStartsIn'
    );
  });
});
