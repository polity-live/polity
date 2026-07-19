import { z } from 'zod';

/**
 * zero-virtual 0.6.3 defaults to a 50-row minimum page and loads one look-ahead
 * row, so virtual page queries must accept at least 51 rows. Polity keeps 100 as
 * the fallback when a caller omits `limit`; the virtualizer supplies its own
 * viewport-derived limit.
 */
export const VIRTUAL_PAGE_SIZE = 100;
export const VIRTUAL_PAGE_MAX = 200;
export const virtualPageLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(VIRTUAL_PAGE_MAX)
  .default(VIRTUAL_PAGE_SIZE);
