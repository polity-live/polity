/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SharedWeekViewController } from '@/features/events/hooks/useSharedWeekViewController';
import { SharedMonthView } from '../SharedMonthView';
import { SharedWeekView } from '../SharedWeekView';
import { SharedWeekViewView } from '../SharedWeekViewView';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: mocks.language, t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);
beforeEach(() => {
  mocks.language = 'en';
});

describe('calendar action contracts', () => {
  it('selects month dates and events through separate semantic controls', () => {
    const onDateSelect = vi.fn();
    const onEventSelect = vi.fn();
    const event = {
      id: 'event-1',
      isMeeting: false,
      start_date: new Date(2026, 7, 2, 12).getTime(),
      title: 'Civic event',
    } as any;
    const { container } = render(
      <SharedMonthView
        selectedDate={new Date(2026, 7, 2)}
        onDateSelect={onDateSelect}
        events={[event]}
        onEventSelect={onEventSelect}
      />
    );

    const date = container.querySelector('[data-action-id="events.month.select-date"]')!;
    const eventButton = container.querySelector('[data-action-id="events.month.select-event"]')!;
    fireEvent.click(date);
    expect(onDateSelect).toHaveBeenCalled();
    fireEvent.click(eventButton);
    expect(onEventSelect).toHaveBeenCalledWith(event);
  });

  it('renders German meeting, tutorial, and location variants in complete and partial grids', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 12));
    mocks.language = 'de';
    const selectedDate = new Date(2026, 7, 9);
    const event = {
      id: 'meeting-1',
      isMeeting: true,
      tutorial_run_id: 'tutorial-1',
      location: 'Town hall',
      start_date: new Date(2026, 7, 9, 10).getTime(),
      title: 'Meeting',
    } as any;
    const earlierEvent = {
      ...event,
      id: 'meeting-0',
      start_date: new Date(2026, 7, 9, 9).getTime(),
    } as any;
    const { rerender, container } = render(
      <SharedMonthView
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        events={[event, earlierEvent]}
        onEventSelect={vi.fn()}
      />
    );
    expect(container.textContent).toContain('So');
    expect(container.textContent).toContain('📅 Meeting');
    expect(container.textContent).toContain('Town hall');
    expect(container.querySelector('[data-tutorial-anchor="tutorial-first-event"]')).toBeTruthy();

    mocks.language = 'en';
    rerender(
      <SharedMonthView
        selectedDate={new Date(2026, 1, 1)}
        onDateSelect={vi.fn()}
        events={[]}
        onEventSelect={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Sun');
    vi.useRealTimers();
  });

  it('selects week headers and events and creates the chosen range', () => {
    const day = new Date(2026, 7, 2, 12);
    const event = {
      end_date: day.getTime() + 30 * 60 * 1000,
      id: 'event-1',
      isMeeting: false,
      start_date: day.getTime(),
      title: 'Civic event',
    } as any;
    const clearSelection = vi.fn();
    const controller = {
      clearSelection,
      containerRef: createRef<HTMLDivElement>(),
      dayLayouts: [[{ column: 0, columnCount: 1, event, height: 40, top: 20 }]],
      displayedSelection: { dayIndex: 0, endSlot: 2, startSlot: 1 },
      halfHourMarkers: [],
      handleDayPointerDown: () => vi.fn(),
      handleDayPointerMove: () => vi.fn(),
      handleDayPointerUp: () => vi.fn(),
      hourMarkers: [0],
      selectedRange: {
        end: new Date(2026, 7, 2, 12, 30),
        start: new Date(2026, 7, 2, 12),
      },
      selection: { dayIndex: 0, endSlot: 2, startSlot: 1 },
      weekDays: [day],
    } as unknown as SharedWeekViewController;
    const onCreateEventRange = vi.fn();
    const onDateSelect = vi.fn();
    const onEventSelect = vi.fn();
    const { container } = render(
      <SharedWeekViewView
        selectedDate={day}
        onDateSelect={onDateSelect}
        onEventSelect={onEventSelect}
        onCreateEventRange={onCreateEventRange}
        controller={controller}
        locale="en"
        createEventLabel="Create event"
      />
    );

    fireEvent.click(container.querySelector('[data-action-id="events.week.select-date"]')!);
    expect(onDateSelect).toHaveBeenCalledWith(day);
    fireEvent.click(container.querySelector('[data-action-id="events.week.select-event"]')!);
    expect(clearSelection).toHaveBeenCalledOnce();
    expect(onEventSelect).toHaveBeenCalledWith(event);
    fireEvent.click(container.querySelector('[data-action-id="events.week.create-range"]')!);
    expect(onCreateEventRange).toHaveBeenCalledWith(controller.selectedRange);
    fireEvent.pointerDown(
      container.querySelector('[data-action-id="events.week.create-range"]')!.parentElement!
    );
  });

  it('renders week wrapper locales and sparse meeting event blocks', () => {
    vi.useFakeTimers();
    const today = new Date(2026, 7, 2, 12);
    vi.setSystemTime(today);
    const meeting = {
      id: 'meeting-1',
      title: 'Meeting',
      start_date: today.getTime(),
      end_date: undefined,
      isMeeting: true,
      tutorial_run_id: 'tutorial-1',
      location: 'Town hall',
    } as any;
    const regular = {
      id: 'event-2',
      title: 'Short event',
      start_date: today.getTime() + 60 * 60_000,
      end_date: today.getTime() + 75 * 60_000,
      isMeeting: false,
      location: 'Hidden room',
    } as any;
    mocks.language = 'de';
    const wrapper = render(
      <SharedWeekView
        selectedDate={today}
        events={[meeting, regular]}
        onDateSelect={vi.fn()}
        onEventSelect={vi.fn()}
      />
    );
    expect(wrapper.container.textContent).toContain('Meeting');
    wrapper.unmount();

    mocks.language = 'en';
    render(
      <SharedWeekView
        selectedDate={today}
        events={[]}
        onDateSelect={vi.fn()}
        onEventSelect={vi.fn()}
      />
    );
    cleanup();

    const controller = {
      clearSelection: vi.fn(),
      containerRef: createRef<HTMLDivElement>(),
      dayLayouts: [
        [
          { column: 0, columnCount: 1, event: meeting, height: 80, top: 20 },
          { column: 0, columnCount: 1, event: regular, height: 10, top: 100 },
        ],
      ],
      displayedSelection: { dayIndex: 99, endSlot: 2, startSlot: 1 },
      halfHourMarkers: [20],
      handleDayPointerDown: () => vi.fn(),
      handleDayPointerMove: () => vi.fn(),
      handleDayPointerUp: () => vi.fn(),
      hourMarkers: [0, 24],
      selectedRange: null,
      selection: null,
      weekDays: [today],
    } as unknown as SharedWeekViewController;
    const { container } = render(
      <SharedWeekViewView
        selectedDate={today}
        onDateSelect={vi.fn()}
        onEventSelect={vi.fn()}
        controller={controller}
        locale="de-DE"
        createEventLabel="Create event"
      />
    );
    expect(container.textContent).toContain('📅 Meeting');
    expect(container.textContent).toContain('Town hall');
    expect(container.querySelector('[data-tutorial-anchor="tutorial-first-event"]')).toBeTruthy();
    vi.useRealTimers();
  });
});
