import path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  optimizeDeps: {
    entries: ['./src/**/*.browser-component.test.tsx'],
    include: [
      '@platejs/ai/react',
      '@platejs/selection/react',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-toggle',
      '@xyflow/react',
      'date-fns/locale',
      'leaflet',
      'react-leaflet',
      'polygon-clipping',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@tanstack/react-start/server': path.resolve(
        import.meta.dirname,
        './src/test/browser-server-boundary.ts'
      ),
      'katex/dist/katex.min.css': path.resolve(import.meta.dirname, './src/test/empty-style.ts'),
    },
  },
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    },
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
