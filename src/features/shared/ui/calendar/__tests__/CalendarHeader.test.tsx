/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarHeader } from '../CalendarHeader';

const mocks = vi.hoisted(() => ({ presenterProps: [] as any[] }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? `translated:${key}`,
  }),
}));

vi.mock('../CalendarHeaderPresenterView', () => ({
  CalendarHeaderPresenterView: (props: any) => {
    mocks.presenterProps.push(props);
    return <div data-testid="calendar-header" />;
  },
}));

beforeEach(() => {
  mocks.presenterProps.length = 0;
});

afterEach(() => cleanup());

const callbacks = {
  setViewMode: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onToday: vi.fn(),
};

describe('CalendarHeader', () => {
  it('resolves the default view catalog, heading mode, and navigation labels', () => {
    render(<CalendarHeader viewMode="list" currentViewTitle="August 2026" {...callbacks} />);
    const props = mocks.presenterProps.at(-1);

    expect(props.headingMode).toBe('visible');
    expect(props.resolvedViews.map((view: any) => [view.value, view.label])).toEqual([
      ['list', 'translated:features.calendar.views.list'],
      ['week', 'translated:features.calendar.views.week'],
      ['month', 'translated:features.calendar.views.month'],
    ]);
    expect(props.resolvedTodayLabel).toBe('translated:features.calendar.today');
    expect(props.resolvedPreviousLabel).toBe('Previous period');
    expect(props.resolvedNextLabel).toBe('Next period');
  });

  it('forwards custom views, labels, heading mode, title, and actions', () => {
    const views = [{ value: 'agenda', label: 'Agenda' }];
    render(
      <CalendarHeader
        viewMode="agenda"
        currentViewTitle="Today"
        {...callbacks}
        headingMode="sr-only"
        views={views}
        todayLabel="Now"
        previousLabel="Back"
        nextLabel="Forward"
        title={<span>Calendar</span>}
        actions={<button>Export</button>}
      />
    );
    const props = mocks.presenterProps.at(-1);

    expect(props).toMatchObject({
      headingMode: 'sr-only',
      resolvedViews: views,
      resolvedTodayLabel: 'Now',
      resolvedPreviousLabel: 'Back',
      resolvedNextLabel: 'Forward',
    });
    expect(props.title.props.children).toBe('Calendar');
    expect(props.actions.props.children).toBe('Export');
  });
});
