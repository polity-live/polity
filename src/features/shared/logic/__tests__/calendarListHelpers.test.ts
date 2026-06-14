import { describe, expect, it } from 'vitest';

import {
  getDateKey,
  getListAnchorDateKey,
  getMarkerInsertionIndex,
  getMarkerViewportState,
} from '@/features/shared/logic/calendarListHelpers';

describe('calendarListHelpers', () => {
  it('formats local date keys with stable zero padding', () => {
    expect(getDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('finds the first list anchor on or after the selected date', () => {
    expect(
      getListAnchorDateKey(['2026-06-10', '2026-06-15', '2026-06-20'], new Date(2026, 5, 14))
    ).toBe('2026-06-15');
  });

  it('places a marker before the first date greater than or equal to it', () => {
    expect(getMarkerInsertionIndex(['2026-06-10', '2026-06-20'], new Date(2026, 5, 14))).toBe(1);
  });

  it('reports marker viewport position', () => {
    expect(getMarkerViewportState({ top: 20, bottom: 30 }, { top: 0, bottom: 100 })).toBe(
      'visible'
    );
    expect(getMarkerViewportState({ top: -30, bottom: -1 }, { top: 0, bottom: 100 })).toBe('above');
    expect(getMarkerViewportState({ top: 101, bottom: 130 }, { top: 0, bottom: 100 })).toBe(
      'below'
    );
  });
});
