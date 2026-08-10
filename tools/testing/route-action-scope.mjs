import fs from 'node:fs';
import path from 'node:path';

const ROUTE_EXTENSIONS = /\.[cm]?[jt]sx?$/;

const ROUTE_CATALOG_CONTRACT = {
  file: 'src/routes/__tests__/routeCatalog.contract.test.ts',
  project: 'unit',
  caseId: 'accounts for every route source with a unique file and path',
};

export function isRouteSource(file) {
  return (
    file.startsWith('src/routes/') &&
    ROUTE_EXTENSIONS.test(file) &&
    !file.includes('/__tests__/') &&
    !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
  );
}

export function extractRouteContract(file, source) {
  const routeMatch = source.match(/createFileRoute\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  const isRoot = file === 'src/routes/__root.tsx' && /createRootRoute\s*\(/.test(source);
  if (!routeMatch && !isRoot) throw new Error(`${file}: missing a static createFileRoute path`);
  const routePath = isRoot ? '__root__' : routeMatch[1];
  const access = routePath.startsWith('/_authed') ? 'authenticated' : 'public';
  const methods = [...source.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*:/g)].map(
    match => match[1]
  );
  const actions = methods.length
    ? [...new Set(methods)].sort().map(method => ({
        id: `${method.toLowerCase()}-request`,
        kind: 'api-request',
        roles: access === 'authenticated' ? ['authenticated'] : ['anonymous', 'authenticated'],
        states: ['success', 'validation-error', 'unauthorized', 'service-error'],
        contractCoverage: [ROUTE_CATALOG_CONTRACT],
      }))
    : [
        {
          id: 'open-route',
          kind: 'navigation',
          roles: access === 'authenticated' ? ['authenticated'] : ['anonymous', 'authenticated'],
          states: ['loading', 'success', 'empty', 'error', 'unauthorized'],
          contractCoverage: [ROUTE_CATALOG_CONTRACT],
        },
      ];

  return { file, routePath, access, actions };
}

export function buildRouteActionCatalog(root, files) {
  const routes = files
    .filter(isRouteSource)
    .map(file => extractRouteContract(file, fs.readFileSync(path.join(root, file), 'utf8')))
    .sort((left, right) => left.file.localeCompare(right.file));

  return {
    version: 2,
    description:
      'Generated structural catalog for every TanStack route and API handler. Behavioral evidence is resolved separately from explicit source accountability.',
    routes,
  };
}

export function serializeRouteActionCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}
