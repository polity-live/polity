import { describe, expect, it } from 'vitest';

import { getCalendarEventRoute } from '../calendarEventNavigation';

describe('getCalendarEventRoute', () => {
  it('opens tutorial events directly on the agenda route expected by the orchestrator', () => {
    expect(getCalendarEventRoute('tutorial-run-1')).toBe('/event/$id/agenda');
  });

  it('keeps the regular event overview route outside the tutorial', () => {
    expect(getCalendarEventRoute(null)).toBe('/event/$id');
  });
});
