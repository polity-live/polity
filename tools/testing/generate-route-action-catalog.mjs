import fs from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';

import { listRepositoryFiles } from './coverage-scope.mjs';
import { buildRouteActionCatalog, serializeRouteActionCatalog } from './route-action-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const target = path.join(import.meta.dirname, 'route-action-catalog.json');
const serialized = await format(
  serializeRouteActionCatalog(buildRouteActionCatalog(root, listRepositoryFiles(root))),
  {
    ...(await resolveConfig(target)),
    filepath: target,
  }
);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== serialized) {
    console.error('Route action catalog is stale. Run pnpm run test:routes:update.');
    process.exit(1);
  }
  const count = JSON.parse(serialized).routes.length;
  console.info(`Route action catalog is current (${count} routes).`);
} else {
  fs.writeFileSync(target, serialized);
  console.info(`Wrote route action catalog.`);
}
