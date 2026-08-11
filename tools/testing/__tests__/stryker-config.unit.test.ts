import { describe, expect, it } from 'vitest';

import config from '../../../stryker.config.mjs';

describe('Stryker sandbox contract', () => {
  it('excludes mutable build and browser artifact directories', () => {
    expect(config.ignorePatterns).toEqual(
      expect.arrayContaining([
        '/.output',
        '/.stryker-tmp*',
        '/coverage',
        '/blob-report*',
        '/playwright-report*',
        '/test-results*',
        '/supabase/.temp',
      ])
    );
  });

  it('only mutates explicitly selected production source files', () => {
    expect(config.mutate).not.toHaveLength(0);
    for (const pattern of config.mutate) {
      expect(pattern).toMatch(/^src\//u);
    }
  });

  it('collects focused mutation regression tests in every critical domain', () => {
    expect(config.testFiles).toEqual(
      expect.arrayContaining([
        'src/features/amendments/logic/__tests__/amendmentPathHelpers*.test.ts',
        'src/features/events/logic/__tests__/eventTimeSeriesValidation*.test.ts',
        'src/features/vote-cast/logic/__tests__/computeVoteResults*.test.ts',
        'src/features/votes/logic/__tests__/computeVoteResult*.test.ts',
        'src/zero/rbac/__tests__/*.test.ts',
      ])
    );
  });
});
