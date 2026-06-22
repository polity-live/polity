import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'katex/dist/katex.min.css': path.resolve(__dirname, './src/test/empty-style.ts'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    setupFiles: ['./src/test/vitest.setup.ts'],
    server: {
      deps: {
        inline: ['@platejs/math', 'katex'],
      },
    },
  },
});
