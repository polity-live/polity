import { defineConfig } from 'vitest/config';
import path from 'node:path';

const staticAuditTests = [
  'tools/testing/__tests__/workflow-contract.static-contract.test.ts',
  'src/features/pwa/__tests__/earlyInstallPromptCaptureScript.static-contract.test.ts',
  'src/features/pwa/__tests__/manifestAssets.static-contract.test.ts',
  'src/features/shared/ui/ui/__tests__/tooltip-audit.static-contract.test.ts',
  'src/i18n/__tests__/amendment-event-route-i18n.static-contract.test.ts',
  'src/i18n/__tests__/locale-quality.static-contract.test.ts',
  'src/i18n/__tests__/source-ui-copy-guard.static-contract.test.ts',
  'src/server/app-tutorial/__tests__/cleanup-order.static-contract.test.ts',
  'src/zero/__tests__/mutateWithServerCheck.static-contract.test.ts',
  'src/zero/notifications/__tests__/notificationReadSchema.static-contract.test.ts',
  'src/zero/preloads/__tests__/route-audit.static-contract.test.ts',
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
          include: ['src/**/__tests__/**/*.unit.test.ts', 'tools/**/__tests__/**/*.unit.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['src/**/__tests__/**/*.component.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component-flow',
          include: ['src/**/__tests__/**/*.component-flow.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'service-integration',
          include: [
            'src/**/__tests__/**/*.service-integration.test.ts',
            'src/**/__tests__/**/*.service-integration.test.tsx',
            'tools/**/__tests__/**/*.service-integration.test.ts',
            'tools/**/__tests__/**/*.service-integration.test.tsx',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'database-integration',
          include: [
            'src/**/__tests__/**/*.database-integration.test.ts',
            'tools/**/__tests__/**/*.database-integration.test.ts',
          ],
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'static-contract',
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
