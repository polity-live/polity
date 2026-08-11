import { mergeConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

import baseConfig from './vitest.config.ts';

const includeLcov = process.env.COVERAGE_WITH_LCOV === '1';

const manifest = JSON.parse(readFileSync('tools/testing/coverage-manifest.json', 'utf8')) as {
  entries: { path: string; verification: string }[];
};
const manifestExclusions = manifest.entries
  .filter(entry => entry.verification !== 'instrument')
  .map(entry => entry.path);

export default mergeConfig(baseConfig, {
  test: {
    maxWorkers: 8,
    coverage: {
      provider: 'v8',
      enabled: true,
      clean: true,
      reportOnFailure: true,
      reportsDirectory: './coverage',
      reporter: includeLcov
        ? ['text-summary', 'json', 'json-summary', 'lcov']
        : ['text-summary', 'json', 'json-summary'],
      include: [
        'app/**/*.{js,jsx,mjs,cjs,ts,tsx}',
        'src/**/*.{js,jsx,mjs,cjs,ts,tsx}',
        'emails/**/*.{ts,tsx}',
        'tools/**/*.{js,mjs,ts,tsx}',
        'public/custom-sw.js',
      ],
      exclude: manifestExclusions,
    },
  },
});
