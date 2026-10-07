import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

export default mergeConfig(baseConfig, {
  test: {
    maxWorkers: 4,
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      reportsDirectory: 'coverage-studio',
      reporter: ['text', 'json', 'json-summary'],
      include: [
        'src/server/after-commit.ts',
        'src/server/studio/{context,storage,cleanup,command-receipts,project-commands}.ts',
        'src/zero/communication-studio/{commands,projections,observe,useStudioClient,shared-mutators,server-mutators,queries}.ts',
        'src/features/communication-studio/logic/studio-realtime-presence.ts',
        'src/features/shared/ui/kit-platejs/ai-editor-context.ts',
      ],
      thresholds: { perFile: true, statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
