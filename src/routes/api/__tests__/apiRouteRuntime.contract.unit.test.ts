import { describe, expect, it } from 'vitest';

import routeCatalog from '../../../../tools/testing/route-action-catalog.json';

interface ApiRouteModule {
  Route?: {
    options?: {
      server?: {
        handlers?: Record<string, unknown>;
      };
    };
  };
}

const routeModules = import.meta.glob<ApiRouteModule>(
  ['/src/routes/api/**/*.ts', '!/src/routes/api/**/__tests__/**'],
  { eager: true }
);
const apiRoutes = routeCatalog.routes.filter(route => route.file.startsWith('src/routes/api/'));

describe('API route runtime contracts', () => {
  it.each(apiRoutes)('$file exposes the catalogued HTTP handlers', route => {
    const module = routeModules[`/${route.file}`];
    expect(module, `Missing eager Vite module for ${route.file}`).toBeTypeOf('object');
    const handlers = module.Route?.options?.server?.handlers;
    expect(handlers, `${route.file} has no runtime handlers`).toBeTypeOf('object');

    const expectedMethods = route.actions
      .filter(action => action.kind === 'api-request')
      .map(action => action.id.replace(/-request$/u, '').toUpperCase())
      .sort();
    expect(Object.keys(handlers ?? {}).sort()).toEqual(expectedMethods);
    for (const method of expectedMethods) expect(handlers?.[method]).toBeTypeOf('function');
  });
});
