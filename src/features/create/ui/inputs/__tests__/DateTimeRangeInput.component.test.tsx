/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateTimeRangeInput } from '../DateTimeRangeInput';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(cleanup);

describe('DateTimeRangeInput', () => {
  it('applies time boundaries when selected dates sit on the scheduling window boundaries', () => {
    render(
      <DateTimeRangeInput
        startDate="2026-06-19"
        startTime=""
        endDate="2026-06-19"
        endTime=""
        minDate="2026-06-19"
        minTime="10:31"
        maxDate="2026-06-19"
        maxTime="11:59"
        onChange={vi.fn()}
      />
    );

    const startTime = screen.getByLabelText('pages.create.event.startTime') as HTMLInputElement;
    const endTime = screen.getByLabelText('pages.create.event.endTime') as HTMLInputElement;

    expect(startTime.getAttribute('min')).toBe('10:31');
    expect(startTime.getAttribute('max')).toBe('11:59');
    expect(endTime.getAttribute('min')).toBe('10:31');
    expect(endTime.getAttribute('max')).toBe('11:59');
  });
});
