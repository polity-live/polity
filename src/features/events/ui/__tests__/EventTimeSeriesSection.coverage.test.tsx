// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventTimeSeriesSection } from '../EventTimeSeriesSection';

const mocks = vi.hoisted(() => ({
  buildRRule: vi.fn(),
  getRecurrenceDescription: vi.fn(),
  dateTimeProps: null as Record<string, unknown> | null,
  recurrenceProps: null as Record<string, unknown> | null,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));

vi.mock('@/features/events/logic/rruleHelpers', () => ({
  buildRRule: mocks.buildRRule,
  getRecurrenceDescription: mocks.getRecurrenceDescription,
}));

vi.mock('@/features/create/ui/inputs/DateTimeRangeInput', () => ({
  DateTimeRangeInput: (props: Record<string, unknown>) => {
    mocks.dateTimeProps = props;
    return (
      <button
        type="button"
        onClick={() =>
          (props.onChange as (field: 'startDate', value: string) => void)('startDate', 'next')
        }
      >
        date range
      </button>
    );
  },
}));

vi.mock('@/features/create/ui/inputs/RecurringPatternInput', () => ({
  RecurringPatternInput: (props: Record<string, unknown>) => {
    mocks.recurrenceProps = props;
    return (
      <button type="button" onClick={() => (props.onChange as (value: string) => void)('weekly')}>
        recurrence
      </button>
    );
  },
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  CreateInputField: ({
    id,
    label,
    onValueChange,
  }: {
    id: string;
    label: string;
    onValueChange: (value: string) => void;
  }) => (
    <button type="button" data-testid={id} onClick={() => onValueChange('changed')}>
      {label}
    </button>
  ),
}));

describe('EventTimeSeriesSection branch coverage', () => {
  const baseProps = {
    startDate: '',
    startTime: '',
    onDateTimeChange: vi.fn(),
    recurrencePattern: 'none' as const,
    onRecurrencePatternChange: vi.fn(),
    recurrenceEndDate: '',
    onRecurrenceEndDateChange: vi.fn(),
    recurrenceInterval: 1,
    onRecurrenceIntervalChange: vi.fn(),
    recurrenceWeekdays: [] as number[],
    onRecurrenceWeekdaysChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dateTimeProps = null;
    mocks.recurrenceProps = null;
  });

  afterEach(cleanup);

  it('uses defaults and the non-recurring fallback summaries', () => {
    render(<EventTimeSeriesSection {...baseProps} />);

    expect(screen.getByText('pages.create.event.timeSeriesSummary.notScheduled')).toBeTruthy();
    expect(screen.getByText('pages.create.event.timeSeriesSummary.openEnded')).toBeTruthy();
    expect(screen.getByText('pages.create.event.recurringPatterns.none')).toBeTruthy();
    expect(screen.queryByText('pages.create.event.timeSeriesSummary.deadlines')).toBeNull();
    expect(mocks.buildRRule).not.toHaveBeenCalled();
    expect(mocks.dateTimeProps).toMatchObject({ endDate: '', endTime: '' });
  });

  it('renders a described series, notices, dates, and editable deadlines', () => {
    const onDateTimeChange = vi.fn();
    const onPatternChange = vi.fn();
    const onDeadlineChange = vi.fn();
    mocks.buildRRule.mockReturnValue('RRULE:FREQ=WEEKLY');
    mocks.getRecurrenceDescription.mockReturnValue('Every week');

    render(
      <EventTimeSeriesSection
        {...baseProps}
        startDate="2026-08-10"
        startTime="09:30"
        endDate="2026-08-10"
        endTime=""
        onDateTimeChange={onDateTimeChange}
        recurrencePattern="weekly"
        onRecurrencePatternChange={onPatternChange}
        recurrenceEndDate="2026-12-31"
        recurrenceInterval={2}
        recurrenceWeekdays={[1, 3]}
        deadlines={[
          {
            id: 'registration',
            label: 'Registration',
            hint: 'Before kickoff',
            value: '2026-08-09T09:00',
            onChange: onDeadlineChange,
          },
        ]}
        schedulingWindowMessage="Inside window"
        validationMessage="Check dates"
        minDate="2026-08-01"
        minTime="08:00"
        maxDate="2026-12-31"
        maxTime="20:00"
      />
    );

    expect(screen.getByText('2026-08-10 · 09:30')).toBeTruthy();
    expect(screen.getByText('2026-08-10')).toBeTruthy();
    expect(screen.getByText('Every week')).toBeTruthy();
    expect(screen.getByText(/2026-12-31/)).toBeTruthy();
    expect(screen.getByText('Inside window').className).toContain(
      'theme-eventEventTimeSeriesSectionInfoBadge'
    );
    expect(screen.getByText('Check dates').className).toContain(
      'theme-eventEventTimeSeriesSectionWarningBadge'
    );

    fireEvent.click(screen.getByRole('button', { name: 'date range' }));
    fireEvent.click(screen.getByRole('button', { name: 'recurrence' }));
    fireEvent.click(screen.getByTestId('registration'));
    expect(onDateTimeChange).toHaveBeenCalledWith('startDate', 'next');
    expect(onPatternChange).toHaveBeenCalledWith('weekly');
    expect(onDeadlineChange).toHaveBeenCalledWith('changed');
    expect(mocks.buildRRule).toHaveBeenCalledWith({
      pattern: 'weekly',
      interval: 2,
      weekdays: [1, 3],
      endDate: '2026-12-31',
    });
    expect(mocks.dateTimeProps).toMatchObject({
      minDate: '2026-08-01',
      minTime: '08:00',
      maxDate: '2026-12-31',
      maxTime: '20:00',
    });
    expect(mocks.recurrenceProps).toMatchObject({ value: 'weekly', endDate: '2026-12-31' });
  });

  it('falls back to the recurring-pattern label when rule construction fails', () => {
    mocks.buildRRule.mockReturnValue('');

    render(
      <EventTimeSeriesSection
        {...baseProps}
        startDate="2026-08-10"
        startTime=""
        recurrencePattern="monthly"
      />
    );

    expect(screen.getByText('pages.create.event.recurringPatterns.monthly')).toBeTruthy();
    expect(mocks.buildRRule).toHaveBeenCalledWith(expect.objectContaining({ endDate: null }));
  });
});
