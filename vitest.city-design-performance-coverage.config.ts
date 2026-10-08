import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

// Benchmark tooling is excluded from production coverage. Keep an explicit gate
// so its browser isolation, measurements and failure handling stay accountable.
export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      provider: 'v8',
      enabled: true,
      reportsDirectory: './coverage-city-design-performance',
      reporter: ['text', 'json', 'json-summary'],
      include: ['tools/testing/performance/city-design/{environment.mjs,run.mjs,main.js}'],
      thresholds: { perFile: true, lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
});
