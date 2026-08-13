/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/create/ui/inputs/DateTimeRangeInput', () => ({
  DateTimeRangeInput: ({ onChange }: { onChange: (field: string, value: string) => void }) => (
    <div>
      <button type="button" onClick={() => onChange('startDate', '2026-09-15')}>
        Select start date
      </button>
      <button type="button" onClick={() => onChange('endDate', '2026-09-15')}>
        Select end date
      </button>
    </div>
  ),
}));
vi.mock('@/features/create/ui/inputs/RecurringPatternInput', () => ({
  RecurringPatternInput: ({
    onChange,
    onWeekdaysChange,
  }: {
    onChange: (value: 'weekly') => void;
    onWeekdaysChange: (value: number[]) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange('weekly')}>
        Repeat weekly
      </button>
      <button type="button" onClick={() => onWeekdaysChange([1, 3])}>
        Select weekdays
      </button>
    </div>
  ),
}));

import { EventTimeSeriesSection } from '../ui/EventTimeSeriesSection';
import { getEventTimeSeriesValidationError } from '../logic/eventTimeSeriesValidation';

afterEach(cleanup);

function SchedulingFlow({ overlap = false }: { overlap?: boolean }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pattern, setPattern] = useState<'none' | 'weekly'>('none');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const validation = getEventTimeSeriesValidationError({
    startDate,
    startTime: '18:00',
    endDate,
    endTime: '20:00',
    recurrencePattern: pattern,
    recurrenceWeekdays: weekdays,
    requireCompleteDateTimeRange: true,
  });
  return (
    <EventTimeSeriesSection
      startDate={startDate}
      startTime="18:00"
      endDate={endDate}
      endTime="20:00"
      onDateTimeChange={(field, value) => {
        if (field === 'startDate') setStartDate(value);
        if (field === 'endDate') setEndDate(value);
      }}
      recurrencePattern={pattern}
      onRecurrencePatternChange={value => setPattern(value as 'none' | 'weekly')}
      recurrenceEndDate="2026-12-31"
      onRecurrenceEndDateChange={vi.fn()}
      recurrenceInterval={1}
      onRecurrenceIntervalChange={vi.fn()}
      recurrenceWeekdays={weekdays}
      onRecurrenceWeekdaysChange={setWeekdays}
      validationMessage={overlap ? 'The selected window overlaps an existing event.' : validation}
      schedulingWindowMessage="Timezone: Europe/Berlin"
    />
  );
}

describe('event scheduling component flow', () => {
  it('validates the complete local date range while retaining timezone context', () => {
    render(<SchedulingFlow />);
    expect(screen.getByText('missing-required-range')).toBeTruthy();
    expect(screen.getByText('Timezone: Europe/Berlin')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select start date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select end date' }));
    expect(screen.queryByText('missing-required-range')).toBeNull();
    expect(screen.getAllByText(/2026-09-15/).length).toBeGreaterThan(0);
  });

  it('configures a weekly recurrence only after start date and weekdays exist', () => {
    render(<SchedulingFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Repeat weekly' }));
    expect(screen.getByText('missing-required-range')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select start date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select end date' }));
    expect(screen.getByText('missing-weekdays')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select weekdays' }));
    expect(screen.queryByText('missing-weekdays')).toBeNull();
    expect(document.body.textContent).toContain('2026-12-31');
  });

  it('surfaces an observed scheduling overlap next to the time-series editor', () => {
    render(<SchedulingFlow overlap />);
    expect(screen.getByText('The selected window overlaps an existing event.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Select start date' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
