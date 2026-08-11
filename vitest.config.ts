import { defineConfig } from 'vitest/config';
import path from 'node:path';

const staticAuditTests = [
  'tools/testing/__tests__/workflow-contract.test.ts',
  'src/features/pwa/__tests__/earlyInstallPromptCaptureScript.test.ts',
  'src/features/pwa/__tests__/manifestAssets.test.ts',
  'src/features/shared/ui/ui/__tests__/tooltip-audit.test.ts',
  'src/i18n/__tests__/amendment-event-route-i18n.test.ts',
  'src/i18n/__tests__/locale-quality.test.ts',
  'src/i18n/__tests__/source-ui-copy-guard.test.ts',
  'src/server/app-tutorial/__tests__/cleanup-order.test.ts',
  'src/zero/__tests__/mutateWithServerCheck.test.ts',
  'src/zero/notifications/__tests__/notificationReadSchema.test.ts',
  'src/zero/preloads/__tests__/route-audit.test.ts',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'katex/dist/katex.min.css': path.resolve(import.meta.dirname, './src/test/empty-style.ts'),
    },
  },
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    },
    setupFiles: ['./src/test/vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/__tests__/**/*.test.ts', 'tools/**/__tests__/**/*.test.ts'],
          exclude: [
            'src/**/__tests__/**/*.integration.test.ts',
            'src/zero/amendments/__tests__/processEngine.initialize.test.ts',
            ...staticAuditTests,
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['src/**/__tests__/**/*.test.tsx'],
          exclude: [
            'src/**/__tests__/**/*.integration.test.tsx',
            'src/**/__tests__/**/*.browser.test.tsx',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [
            'src/**/__tests__/**/*.integration.test.ts',
            'src/**/__tests__/**/*.integration.test.tsx',
            'src/zero/amendments/__tests__/processEngine.initialize.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'static-audit',
          include: staticAuditTests,
          testTimeout: 120_000,
        },
      },
    ],
    server: {
      deps: {
        inline: ['@platejs/math', 'katex', 'react-tweet'],
      },
    },
  },
});
