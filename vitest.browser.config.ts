import path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'katex/dist/katex.min.css': path.resolve(import.meta.dirname, './src/test/empty-style.ts'),
    },
  },
  test: {
    include: ['src/**/*.browser-component.test.tsx'],
    setupFiles: ['./src/test/browser.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
