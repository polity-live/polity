import { describe, expect, it } from 'vitest';

import {
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
});
