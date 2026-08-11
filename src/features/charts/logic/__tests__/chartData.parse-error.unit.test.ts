import { describe, expect, it, vi } from 'vitest';

vi.mock('csv-parse/browser/esm/sync', () => ({
  parse: vi.fn(() => {
    throw 'raw parser failure';
  }),
}));

import { parseChartCsv } from '../chartData';

describe('chart CSV non-Error boundary', () => {
  it('uses a stable fallback for non-Error parser failures', () => {
    expect(() => parseChartCsv('x,value')).toThrow('CSV_PARSE_FAILED');
  });
});
