import { readFileSync } from 'node:fs';
import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

const manifest = JSON.parse(readFileSync('tools/testing/coverage-manifest.json', 'utf8')) as {
  entries: { path: string; verification: string; testRefs: { project: string }[] }[];
};

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      provider: 'v8',
      enabled: true,
      reportOnFailure: true,
      reportsDirectory: './coverage-database',
      reporter: ['json', 'json-summary', 'text-summary'],
      include: manifest.entries
        .filter(
          entry =>
            entry.verification === 'instrument' &&
            entry.testRefs.some(ref => ref.project === 'database-integration')
        )
        .map(entry => entry.path),
    },
  },
});
