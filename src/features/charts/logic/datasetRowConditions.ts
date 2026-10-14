import { z } from 'zod';
import { parseDatasetNumber } from './datasetNumbers';

const column = z.string().min(1).max(200);
const value = z.string().max(300);
export const datasetRowConditionsSchema = z
  .array(
    z.discriminatedUnion('operator', [
      z.object({ column, operator: z.literal('in'), values: z.array(value).min(1).max(100) }),
      z.object({ column, operator: z.literal('contains'), value: value.min(1) }),
      z
        .object({
          column,
          operator: z.literal('range'),
          min: value.optional(),
          max: value.optional(),
          numeric: z.boolean().optional(),
        })
        .refine(
          filter =>
            Boolean(filter.min || filter.max) &&
            (!filter.numeric ||
              [filter.min, filter.max].every(
                value => !value || Number.isFinite(parseDatasetNumber(value))
              )) &&
            (!filter.min ||
              !filter.max ||
              (filter.numeric
                ? parseDatasetNumber(filter.min) <= parseDatasetNumber(filter.max)
                : filter.min <= filter.max))
        ),
      z.object({ column, operator: z.literal('empty') }),
    ])
  )
  .max(50);
