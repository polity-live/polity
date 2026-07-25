import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
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
    nitro(),
    tailwindcss(),
    viteReact(),
  ],
  resolve: {
    dedupe: ['@rocicorp/zero', 'react', 'react-dom'],
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: /^buffer$/,
        replacement: fileURLToPath(new URL('./node_modules/buffer/index.js', import.meta.url)),
      },
      {
        find: /^events$/,
        replacement: fileURLToPath(new URL('./node_modules/events/events.js', import.meta.url)),
      },
      {
        find: /^path$/,
        replacement: fileURLToPath(
          new URL('./node_modules/path-browserify/index.js', import.meta.url)
        ),
      },
      {
        find: /^konva$/,
        replacement: fileURLToPath(new URL('./node_modules/konva/lib/index.js', import.meta.url)),
      },
    ],
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
      '@rocicorp/zero/react',
      '@rocicorp/zero-virtual/react',
    ],
  },
});
