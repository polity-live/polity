/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MeetingInstance } from '../../hooks/useMeetPage';
import { MeetingWeekViewView } from '../MeetingWeekViewView';

afterEach(cleanup);

function meeting(startDate: number): MeetingInstance {
  return {
    id: 'meeting-1',
    parentEventId: 'event-1',
    title: 'Weekly civic meeting',
    description: null,
    meetingType: null,
    startDate,
    endDate: startDate + 60 * 60 * 1000,
    isBookable: true,
    maxBookings: 10,
    bookingCount: 0,
    isBookedByMe: false,
    isRecurringInstance: false,
    instanceDate: null,
    locationName: null,
    locationUrl: null,
    streamUrl: 'https://example.test/stream',
    participants: [],
    creator: null,
  };
}

describe('MeetingWeekViewView actions', () => {
  it('selects week headers, empty day columns, and meeting blocks independently', () => {
    const day = new Date(2026, 7, 2);
    const instance = meeting(new Date(2026, 7, 2, 10).getTime());
    const onDateSelect = vi.fn();
    const onSelectInstance = vi.fn();
    const { container } = render(
      <MeetingWeekViewView
        selectedDate={day}
        onDateSelect={onDateSelect}
        getInstancesForDate={() => [instance]}
        onSelectInstance={onSelectInstance}
        containerRef={createRef<HTMLDivElement>()}
        weekDays={[day]}
        halfHourMarkers={[]}
        hourMarkers={[10]}
        locale="en-US"
      />
    );

    const header = container.querySelector(
      '[data-action-id="meet.week.day-header.select"]'
    ) as HTMLButtonElement;
    const column = container.querySelector(
      '[data-action-id="meet.week.day-column.select"]'
    ) as HTMLButtonElement;
    const block = container.querySelector(
      '[data-action-id="meet.week.instance.select"]'
    ) as HTMLButtonElement;

    expect(header).toBeTruthy();
    expect(column).toBeTruthy();
    expect(block).toBeTruthy();
    header.focus();
    expect(document.activeElement).toBe(header);
    fireEvent.click(header);
    fireEvent.click(column);
    block.focus();
    fireEvent.click(block);

    expect(onDateSelect).toHaveBeenNthCalledWith(1, day);
    expect(onDateSelect).toHaveBeenNthCalledWith(2, day);
    expect(onSelectInstance).toHaveBeenCalledWith(instance);
  });

  it('renders booked, full, location, online, missing-end, and today variants', () => {
    vi.useFakeTimers();
    const day = new Date(2026, 7, 2);
    vi.setSystemTime(new Date(2026, 7, 2, 12));
    const start = new Date(2026, 7, 2, 8).getTime();
    const variants = [
      meeting(start),
      {
        ...meeting(start + 2 * 60 * 60_000),
        id: 'booked',
        isBookedByMe: true,
        locationName: 'Town hall',
      },
      {
        ...meeting(start + 4 * 60 * 60_000),
        id: 'full',
        isBookable: true,
        bookingCount: 10,
        maxBookings: 10,
        locationName: null,
        locationUrl: null,
        streamUrl: null,
        endDate: null,
      } as any,
    ];
    const { container } = render(
      <MeetingWeekViewView
        selectedDate={day}
        onDateSelect={vi.fn()}
        getInstancesForDate={() => variants}
        containerRef={createRef<HTMLDivElement>()}
        weekDays={[day]}
        halfHourMarkers={[20]}
        hourMarkers={[8, 24]}
        locale="de-DE"
      />
    );

    expect(container.textContent).toContain('Town hall');
    expect(container.textContent).toContain('Online');
    expect(container.querySelectorAll('[data-action-id="meet.week.instance.select"]')).toHaveLength(
      3
    );
    vi.useRealTimers();
  });
});
