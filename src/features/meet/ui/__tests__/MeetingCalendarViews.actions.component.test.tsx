/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MeetingInstance } from '../../hooks/useMeetPage';
import { MeetingMonthView } from '../MeetingCalendarViews';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

afterEach(cleanup);

function meeting(startDate: number): MeetingInstance {
  return {
    id: 'meeting-1',
    parentEventId: 'event-1',
    title: 'Civic office hour',
    description: null,
    meetingType: null,
    startDate,
    endDate: startDate + 60 * 60 * 1000,
    isBookable: true,
    maxBookings: 10,
    bookingCount: 1,
    isBookedByMe: false,
    isRecurringInstance: false,
    instanceDate: null,
    locationName: 'Town hall',
    locationUrl: null,
    streamUrl: null,
    participants: [],
    creator: null,
  };
}

describe('MeetingMonthView actions', () => {
  it('selects month days and meeting instances through separate keyboard-focusable actions', () => {
    const selectedDate = new Date(2026, 7, 2);
    const instance = meeting(new Date(2026, 7, 2, 10).getTime());
    const onDateSelect = vi.fn();
    const onSelectInstance = vi.fn();
    const { container } = render(
      <MeetingMonthView
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        getInstancesForDate={date => (date.getDate() === 2 ? [instance] : [])}
        onSelectInstance={onSelectInstance}
      />
    );

    const day = container.querySelector(
      '[data-action-id="meet.month.day.select"][aria-pressed="true"]'
    ) as HTMLButtonElement;
    const instanceAction = screen.getByRole('button', { name: 'Civic office hour' });

    expect(day).toBeTruthy();
    expect(instanceAction.getAttribute('data-action-id')).toBe('meet.month.instance.select');
    day.focus();
    expect(document.activeElement).toBe(day);
    fireEvent.click(day);
    instanceAction.focus();
    fireEvent.keyDown(instanceAction, { key: 'Enter' });
    fireEvent.keyDown(instanceAction, { key: ' ' });
    fireEvent.click(instanceAction);

    expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    expect(onSelectInstance).toHaveBeenCalledTimes(3);
    expect(onSelectInstance).toHaveBeenCalledWith(instance);
  });

  it('renders a non-interactive meeting summary when no selection handler exists', () => {
    const selectedDate = new Date(2026, 7, 2);
    const instance = meeting(new Date(2026, 7, 2, 10).getTime());
    const { container } = render(
      <MeetingMonthView
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        getInstancesForDate={date => (date.getDate() === 2 ? [instance] : [])}
      />
    );

    const summary = container.querySelector(
      '[data-action-id="meet.month.instance.select"]'
    ) as HTMLElement;
    expect(summary.getAttribute('role')).toBeNull();
    expect(summary.getAttribute('tabindex')).toBeNull();
    fireEvent.keyDown(summary, { key: 'Enter' });
    fireEvent.click(summary);
  });
});
