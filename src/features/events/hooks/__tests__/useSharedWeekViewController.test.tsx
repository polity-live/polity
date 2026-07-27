// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useSharedWeekViewController } from '../useSharedWeekViewController';

describe('useSharedWeekViewController', () => {
  it('starts a range selection only on the free day column, not on a contained event', () => {
    const { result } = renderHook(() =>
      useSharedWeekViewController({
        selectedDate: new Date('2026-07-27T12:00:00.000Z'),
        events: [],
      })
    );
    const dayColumn = document.createElement('div');
    const event = document.createElement('button');
    dayColumn.append(event);
    dayColumn.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 160,
      top: 0,
      width: 160,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    const preventDefault = vi.fn();
    const pointerEvent = (target: EventTarget) =>
      ({
        button: 0,
        clientY: 510,
        currentTarget: dayColumn,
        pointerType: 'touch',
        preventDefault,
        target,
      }) as unknown as ReactPointerEvent<HTMLDivElement>;

    act(() => result.current.handleDayPointerDown(0)(pointerEvent(event)));

    expect(result.current.displayedSelection).toBeNull();
    expect(preventDefault).not.toHaveBeenCalled();

    act(() => result.current.handleDayPointerDown(0)(pointerEvent(dayColumn)));

    expect(result.current.displayedSelection).toMatchObject({
      dayIndex: 0,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
