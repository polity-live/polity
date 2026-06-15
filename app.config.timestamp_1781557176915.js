// app.config.ts
import { defineConfig } from '@tanstack/react-start/config';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
Object.assign(process.env, loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''));
var app_config_default = defineConfig({
  tsr: {
    routesDirectory: './src/routes',
    generatedRouteTree: './src/routeTree.gen.ts',
  },
  vite: {
    plugins: [tsConfigPaths(), tailwindcss()],
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
export { app_config_default as default };
