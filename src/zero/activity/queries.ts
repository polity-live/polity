import { z } from 'zod';

export const activitySeverityFilterSchema = z.enum(['all', 'normal', 'high']).default('all');
export const activityCursorSchema = z
  .object({ id: z.string(), created_at: z.number() })
  .nullable()
  .default(null);
export const activityPageLimitSchema = z.number().int().min(1).max(100).default(50);

export function applyActivityCursor<T>(q: T, cursor: { id: string; created_at: number } | null): T {
  const query: any = (q as any).orderBy('created_at', 'desc').orderBy('id', 'desc');
  return (cursor ? query.start(cursor, { inclusive: false }) : query) as T;
}
