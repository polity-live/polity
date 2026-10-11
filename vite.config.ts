import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// Load ALL env vars (not just VITE_*) into process.env for server-side access.
Object.assign(process.env, loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''));

export default defineConfig({
  cacheDir: process.env.POLITY_VITE_CACHE_DIR,
  nitro: {
    ...(process.env.POLITY_NITRO_BUILD_DIR
      ? {
          buildDir: process.env.POLITY_NITRO_BUILD_DIR,
          typescript: {
            generatedTypesDir: `${process.env.POLITY_NITRO_BUILD_DIR}/types`,
          },
        }
      : {}),
    inlineDynamicImports: true,
    traceDeps: ['web-push*'],
  },
  plugins: [
    ...(process.env.ZERO_PERFORMANCE_DIAGNOSTICS === '1'
      ? [
          {
            name: 'benchmark-public-zero-react-observation',
            enforce: 'pre' as const,
            resolveId(source: string, importer?: string) {
              // Observe public hooks called by zero-virtual as well as app code.
              // The boundary itself continues to import the unchanged public API.
              if (
                source !== '@rocicorp/zero/react' ||
                importer
                  ?.replaceAll('\\', '/')
                  .split('?')[0]
                  .endsWith('/src/zero/observed-query.ts')
              )
                return;
              return fileURLToPath(new URL('./src/zero/observed-query.ts', import.meta.url));
            },
          },
        ]
      : []),
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
    external: ['web-push'],
    noExternal: ['zustand', '@platejs/math', '@platejs/math/react', 'katex', 'react-tweet'],
  },
  css: {
    devSourcemap: true,
  },
  server: {
    watch: {
      // Export artifacts and test sandboxes can contain entire copies of the app.
      // Watching them stalls local startup and triggers unrelated hot reloads.
      ignored: [
        '**/.stryker-tmp*/**',
        '**/coverage*/**',
        '**/.coverage*/**',
        '**/.a04-coverage/**',
        '**/test-results*/**',
        '**/playwright-report*/**',
        '**/.playwright-cli/**',
        '**/output/**',
        '**/.output/**',
        '**/.next/**',
        '**/.vercel/**',
        '**/reports/**',
      ],
    },
  },
  build: {
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        // Keep the initial React/router runtime together instead of fetching
        // many small shared modules. Application routes retain lazy splitting.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'react-runtime',
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'router-runtime',
              test: /node_modules[\\/]@tanstack[\\/](?:react-router|router-core|history)[\\/]/,
            },
            {
              name: 'ui-icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
            },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
      // The city-design route is lazy-loaded; prepare its geometry dependency at startup.
      'polygon-clipping',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
      '@rocicorp/zero/react',
      '@rocicorp/zero-virtual/react',
    ],
  },
});
