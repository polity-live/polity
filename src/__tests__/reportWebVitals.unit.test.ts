import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportCallback } from 'web-vitals';

const metrics = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

vi.mock('web-vitals', () => metrics);

import reportWebVitals from '../reportWebVitals';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportWebVitals', () => {
  it('does not load reporters without a callable consumer', () => {
    reportWebVitals();
    reportWebVitals({} as ReportCallback);

    expect(metrics.onCLS).not.toHaveBeenCalled();
  });

  it('registers the same consumer for every supported metric', async () => {
    const consumer = vi.fn();

    reportWebVitals(consumer);
    await vi.waitFor(() => expect(metrics.onCLS).toHaveBeenCalledWith(consumer));

    for (const reporter of Object.values(metrics)) {
      expect(reporter).toHaveBeenCalledWith(consumer);
    }
  });
});
