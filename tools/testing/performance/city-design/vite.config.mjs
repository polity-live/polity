import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: { '@': resolve(import.meta.dirname, '../../../../src') } },
  build: {
    outDir: resolve(
      import.meta.dirname,
      '../../../../output/playwright/city-design-performance/build'
    ),
    emptyOutDir: true,
  },
  preview: { host: '127.0.0.1', port: 4321, strictPort: true },
});
