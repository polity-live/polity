import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildUserInitializationData, generateRandomHandle } from '../user-initialization-helpers';

describe('user initialization helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses all three random selections to build a bounded handle', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0.5);

    expect(generateRandomHandle()).toBe('QuickPanda5500');
  });

  it('trims the name and preserves an explicitly supplied handle', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_786_184_220_000);

    expect(buildUserInitializationData('user-1', ' Ada ', ' Lovelace ', 'ada')).toEqual({
      id: 'user-1',
      handle: 'ada',
      name: 'Ada Lovelace',
      updated_at: 1_786_184_220_000,
      last_seen_at: 1_786_184_220_000,
    });
  });

  it('generates a handle when the supplied value is absent or empty', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(Date, 'now').mockReturnValue(42);

    expect(buildUserInitializationData('user-2', '', '', '').handle).toBe('QuickFox1000');
    expect(buildUserInitializationData('user-3', 'A', 'B').handle).toBe('QuickFox1000');
  });
});
