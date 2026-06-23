import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// Load ALL env vars (not just VITE_*) into process.env for server-side access.
Object.assign(process.env, loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''));

export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
        routeFileIgnorePattern: '__tests__',
      },
    }),
    tailwindcss(),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssr: {
    noExternal: ['zustand', '@platejs/math', '@platejs/math/react', 'katex', 'react-tweet'],
  },
  css: {
    devSourcemap: true,
  },
  build: {
    cssCodeSplit: false,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
    ],
  },
});
