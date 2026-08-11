/** @type {import('@stryker-mutator/api/core').StrykerOptions} */
export default {
  testRunner: 'vitest',
  // TypeScript 7's native package no longer exposes the JavaScript config parser.
  // Vitest handles TS transpilation; pointing Stryker at an absent config skips only
  // its sandbox path rewrite while preserving the repository's normal tsconfig.
  tsconfigFile: '.stryker-no-tsconfig.json',
  vitest: {
    configFile: 'vitest.config.ts',
    related: true,
  },
  coverageAnalysis: 'perTest',
  concurrency: 4,
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  // Build and browser artifacts can be rewritten concurrently by independent CI jobs.
  // They are not inputs for the critical-domain mutation suite and must never enter
  // Stryker's sandbox snapshot.
  ignorePatterns: [
    '/.output',
    '/.stryker-tmp*',
    '/coverage',
    '/blob-report*',
    '/playwright-report*',
    '/test-results*',
    '/supabase/.temp',
  ],
  testFiles: [
    'src/features/amendments/logic/__tests__/amendmentPathHelpers*.test.ts',
    'src/features/events/logic/__tests__/eventTimeSeriesValidation*.test.ts',
    'src/features/vote-cast/logic/__tests__/computeVoteResults*.test.ts',
    'src/features/votes/logic/__tests__/computeEligibleVoters*.test.ts',
    'src/features/votes/logic/__tests__/computeVoteResult*.test.ts',
    'src/zero/rbac/__tests__/*.test.ts',
    'src/zero/__tests__/allQueries.contract.unit.test.ts',
  ],
  mutate: [
    'src/features/amendments/logic/amendmentPathHelpers.ts',
    'src/features/events/logic/eventTimeSeriesValidation.ts',
    'src/features/vote-cast/logic/computeVoteResults.ts',
    'src/features/votes/logic/computeEligibleVoters.ts',
    'src/features/votes/logic/computeVoteResult.ts',
    'src/zero/rbac/{amendment-access,authorize,can,check,query-access}.ts',
  ],
  thresholds: { high: 90, low: 80, break: 80 },
  reporters: ['clear-text', 'html', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: '.stryker-tmp',
};
