import { z } from 'zod';

/**
 * zero-virtual loads one look-ahead row. Its minimum window is 100, so every
 * virtual page query must accept at least 101 rows.
 */
export const VIRTUAL_PAGE_SIZE = 100;
export const VIRTUAL_PAGE_MAX = 200;
export const virtualPageLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(VIRTUAL_PAGE_MAX)
  .default(VIRTUAL_PAGE_SIZE);
