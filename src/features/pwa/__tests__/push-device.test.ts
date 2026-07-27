/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';

import { getPushDeviceId } from '../push-device';

describe('push device identity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a stable device id across calls', () => {
    const first = getPushDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(getPushDeviceId()).toBe(first);
  });
});
