// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useSharedWeekViewController } from '../useSharedWeekViewController';

describe('useSharedWeekViewController', () => {
  it('groups non-empty event layouts by their week day', () => {
    const { result } = renderHook(() =>
      useSharedWeekViewController({
        selectedDate: new Date('2026-07-27T12:00:00.000Z'),
        events: [
          {
            id: 'event',
            title: 'Event',
            description: '',
            start_date: new Date('2026-07-27T10:00:00.000Z').getTime(),
            end_date: new Date('2026-07-27T11:00:00.000Z').getTime(),
          } as never,
        ],
      })
    );

    expect(result.current.dayLayouts.flat()).toHaveLength(1);
  });

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

  it('tracks pointer ranges, ignores invalid pointer transitions, and finalizes through day events', () => {
    const { result } = renderHook(() =>
      useSharedWeekViewController({
        selectedDate: new Date('2026-07-27T12:00:00.000Z'),
        events: [],
      })
    );
    const dayColumn = document.createElement('div');
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
    const pointerEvent = (clientY: number, extras: Record<string, unknown> = {}) =>
      ({
        button: 0,
        clientY,
        currentTarget: dayColumn,
        pointerType: 'touch',
        preventDefault: vi.fn(),
        target: dayColumn,
        ...extras,
      }) as unknown as ReactPointerEvent<HTMLDivElement>;

    act(() => result.current.handleDayPointerMove(0)(pointerEvent(100)));
    act(() => result.current.handleDayPointerUp(0)(pointerEvent(100)));
    expect(result.current.selection).toBeNull();

    act(() =>
      result.current.handleDayPointerDown(0)(pointerEvent(100, { pointerType: 'mouse', button: 1 }))
    );
    expect(result.current.displayedSelection).toBeNull();

    act(() => result.current.handleDayPointerDown(0)(pointerEvent(-100)));
    expect(result.current.displayedSelection).toMatchObject({ startSlot: 0, endSlot: 2 });
    act(() => result.current.handleDayPointerMove(1)(pointerEvent(300)));
    act(() => result.current.handleDayPointerMove(0)(pointerEvent(-100)));
    expect(result.current.displayedSelection).toMatchObject({ startSlot: 0, endSlot: 2 });
    act(() => result.current.handleDayPointerMove(0)(pointerEvent(10_000)));
    expect(result.current.displayedSelection).toMatchObject({ dayIndex: 0, startSlot: 0 });
    expect(result.current.displayedSelection!.endSlot).toBeGreaterThan(2);
    act(() => result.current.handleDayPointerUp(1)(pointerEvent(500)));
    expect(result.current.selection).toBeNull();
    act(() => result.current.handleDayPointerUp(0)(pointerEvent(500)));
    expect(result.current.selection).toMatchObject({ dayIndex: 0, startSlot: 0, endSlot: 16 });
    expect(result.current.selectedRange).not.toBeNull();

    act(() => result.current.handleDayPointerDown(0)(pointerEvent(100)));
    act(() => {
      result.current.clearSelection();
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(result.current.selection).toBeNull();

    act(() => result.current.clearSelection());
    expect(result.current.selection).toBeNull();
  });

  it('handles global finalization, cancellation, outside clicks, invalid days, and scroll reset', () => {
    const hook = renderHook(
      ({ selectedDate }) => useSharedWeekViewController({ selectedDate, events: [] }),
      { initialProps: { selectedDate: new Date('2026-07-27T12:00:00.000Z') } }
    );
    const container = document.createElement('div');
    const inside = document.createElement('span');
    container.append(inside);
    document.body.append(container);
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    act(() => {
      hook.result.current.containerRef.current = container;
    });
    hook.rerender({ selectedDate: new Date('2026-08-03T12:00:00.000Z') });
    expect(container.scrollTop).toBeGreaterThan(0);

    const dayColumn = document.createElement('div');
    dayColumn.getBoundingClientRect = vi.fn().mockReturnValue({
      height: 1_440,
      top: 0,
    });
    const event = {
      button: 0,
      clientY: 300,
      currentTarget: dayColumn,
      pointerType: 'touch',
      preventDefault: vi.fn(),
      target: dayColumn,
    } as unknown as ReactPointerEvent<HTMLDivElement>;

    act(() => hook.result.current.handleDayPointerDown(2)(event));
    act(() => window.dispatchEvent(new Event('pointerup')));
    expect(hook.result.current.selection?.dayIndex).toBe(2);

    act(() => inside.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(hook.result.current.selection).not.toBeNull();
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(hook.result.current.selection).toBeNull();

    act(() => hook.result.current.handleDayPointerDown(99)(event));
    act(() => window.dispatchEvent(new Event('pointerup')));
    expect(hook.result.current.selection?.dayIndex).toBe(99);
    expect(hook.result.current.selectedRange).toBeNull();

    act(() => hook.result.current.handleDayPointerDown(1)(event));
    act(() => window.dispatchEvent(new Event('pointercancel')));
    expect(hook.result.current.displayedSelection).toBeNull();
    container.remove();
  });
});
