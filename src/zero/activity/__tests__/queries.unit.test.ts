import { describe, expect, it, vi } from 'vitest';

import {
  applyActivityCursor,
  activityCursorSchema,
  activityPageLimitSchema,
  activitySeverityFilterSchema,
} from '../queries';

describe('activity query input contracts', () => {
  it('defaults filters, cursor, and page size', () => {
    expect(activitySeverityFilterSchema.parse(undefined)).toBe('all');
    expect(activityCursorSchema.parse(undefined)).toBeNull();
    expect(activityPageLimitSchema.parse(undefined)).toBe(50);
  });

  it('accepts supported filters and rejects invalid filters, cursors, and limits', () => {
    expect(activitySeverityFilterSchema.parse('normal')).toBe('normal');
    expect(activitySeverityFilterSchema.parse('high')).toBe('high');
    expect(activityCursorSchema.parse({ id: 'activity-1', created_at: 123 })).toEqual({
      id: 'activity-1',
      created_at: 123,
    });
    expect(() => activitySeverityFilterSchema.parse('critical')).toThrow();
    expect(() => activityCursorSchema.parse({ id: 'activity-1' })).toThrow();
    expect(() => activityPageLimitSchema.parse(0)).toThrow();
    expect(() => activityPageLimitSchema.parse(101)).toThrow();
  });

  it('orders activity pages with and without a cursor', () => {
    const query = {
      orderBy: vi.fn(),
      start: vi.fn(),
    } as any;
    query.orderBy.mockReturnValue(query);
    query.start.mockReturnValue(query);

    expect(applyActivityCursor(query, null)).toBe(query);
    expect(query.start).not.toHaveBeenCalled();

    const cursor = { id: 'activity-1', created_at: 123 };
    expect(applyActivityCursor(query, cursor)).toBe(query);
    expect(query.start).toHaveBeenCalledWith(cursor, { inclusive: false });
  });
});
