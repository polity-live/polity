import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { listRepositoryFiles } from '../../../tools/testing/coverage-scope.mjs';
import {
  buildRouteActionCatalog,
  extractRouteContract,
  isRouteSource,
} from '../../../tools/testing/route-action-scope.mjs';

const root = path.resolve(import.meta.dirname, '../../..');

describe('route action catalog contracts', () => {
  it('recognizes route sources but not route tests', () => {
    expect(isRouteSource('src/routes/_authed/calendar.tsx')).toBe(true);
    expect(isRouteSource('src/routes/__tests__/calendar.test.ts')).toBe(false);
  });

  it('extracts access, states and API methods', () => {
    expect(
      extractRouteContract(
        'src/routes/api/example.ts',
        `export const Route = createFileRoute('/api/example')({ server: { handlers: { POST: fn }}});`
      )
    ).toMatchObject({
      routePath: '/api/example',
      access: 'public',
      actions: [{ id: 'post-request', kind: 'api-request' }],
    });
  });

  it('accounts for every route source with a unique file and path', () => {
    const routeFiles = listRepositoryFiles(root).filter(isRouteSource);
    const catalog = buildRouteActionCatalog(root, routeFiles);
    expect(catalog.routes).toHaveLength(routeFiles.length);
    expect(new Set(catalog.routes.map((route: { file: string }) => route.file)).size).toBe(
      routeFiles.length
    );
    expect(
      new Set(catalog.routes.map((route: { routePath: string }) => route.routePath)).size
    ).toBe(routeFiles.length);
    for (const route of catalog.routes) {
      expect(route.actions.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(root, route.file))).toBe(true);
    }
  });
});
