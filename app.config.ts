import { defineConfig } from '@tanstack/react-start/config';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// Load ALL env vars (not just VITE_*) into process.env for server-side access
Object.assign(process.env, loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''));

export default defineConfig({
  tsr: {
    routesDirectory: './src/routes',
    generatedRouteTree: './src/routeTree.gen.ts',
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [tailwindcss()],
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
  },
});
