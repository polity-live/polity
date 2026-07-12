/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalendarHeaderPresenterView } from '../CalendarHeaderPresenterView';

afterEach(cleanup);

function renderHeader(headingMode: 'visible' | 'sr-only' | 'none') {
  return render(
    <CalendarHeaderPresenterView
      viewMode="week"
      setViewMode={vi.fn()}
      currentViewTitle="Jul 12 – Jul 18, 2026"
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onToday={vi.fn()}
      title="Calendar"
      headingMode={headingMode}
      actions={<button type="button">Create Event</button>}
      resolvedViews={[
        { value: 'list', label: 'List' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      resolvedTodayLabel="Today"
      resolvedPreviousLabel="Previous period"
      resolvedNextLabel="Next period"
    />
  );
}

describe('CalendarHeaderPresenterView', () => {
  it('keeps an sr-only page heading and aligns actions with view controls', () => {
    const { container } = renderHeader('sr-only');

    expect(screen.getByRole('heading', { name: 'Calendar' }).className).toContain('sr-only');
    const controls = container.querySelector('[data-slot="calendar-controls"]');
    const actions = container.querySelector('[data-slot="calendar-actions"]');
    expect(actions?.closest('[data-slot="calendar-controls"]')).toBe(controls);
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Week' })).toBeTruthy();
  });

  it('supports visible and omitted headings', () => {
    const visible = renderHeader('visible');
    expect(screen.getByRole('heading', { name: 'Calendar' }).className).toContain('text-3xl');
    visible.unmount();

    renderHeader('none');
    expect(screen.queryByRole('heading', { name: 'Calendar' })).toBeNull();
  });
});
