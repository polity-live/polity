import { describe, expect, it } from 'vitest';

import routeCatalog from '../../../tools/testing/route-action-catalog.json';

interface RuntimeRouteModule {
  Route?: {
    options?: {
      beforeLoad?: unknown;
      component?: unknown;
      loader?: unknown;
      notFoundComponent?: unknown;
      server?: unknown;
    };
  };
}

const routeModules = import.meta.glob<RuntimeRouteModule>(
  [
    '/src/routes/**/*.ts',
    '/src/routes/**/*.tsx',
    '!/src/routes/api/**',
    '!/src/routes/**/__tests__/**',
  ],
  { eager: true }
);
const uiRoutes = routeCatalog.routes.filter(route => !route.file.startsWith('src/routes/api/'));

describe('UI route runtime contracts', () => {
  it.each(uiRoutes)('$file is importable and exposes executable route behavior', route => {
    const module = routeModules[`/${route.file}`];
    expect(module, `Missing eager Vite module for ${route.file}`).toBeTypeOf('object');
    const options = module?.Route?.options;
    expect(options, `${route.file} has no runtime route options`).toBeTypeOf('object');
    expect(
      [
        options?.beforeLoad,
        options?.component,
        options?.loader,
        options?.notFoundComponent,
        options?.server,
      ].some(candidate => candidate !== undefined),
      `${route.file} has no executable route behavior`
    ).toBe(true);
  });

  it('routes authenticated pages through the central executable auth layout', () => {
    const authenticatedRoutes = uiRoutes.filter(route => route.access === 'authenticated');
    expect(authenticatedRoutes).not.toHaveLength(0);
    for (const route of authenticatedRoutes) {
      expect(
        route.file === 'src/routes/_authed.tsx' || route.file.startsWith('src/routes/_authed/')
      ).toBe(true);
    }

    const guardedLayout = routeModules['/src/routes/_authed.tsx'];
    expect(guardedLayout?.Route?.options?.component).toBeTypeOf('function');
  });
});
