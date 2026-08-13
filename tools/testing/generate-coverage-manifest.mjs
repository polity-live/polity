import fs from 'node:fs';
import path from 'node:path';

import {
  buildCoverageManifest,
  listRepositoryFiles,
  serializeCoverageManifest,
} from './coverage-scope.mjs';
import { loadAccountabilityManifest } from './accountability-scope.mjs';
import { formatGeneratedJson } from './format-generated-json.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const target = path.join(import.meta.dirname, 'coverage-manifest.json');
const debtTarget = path.join(import.meta.dirname, 'coverage-debt-baseline.json');
const files = listRepositoryFiles(root);
if (!files.includes('tools/testing/coverage-manifest.json')) {
  files.push('tools/testing/coverage-manifest.json');
  files.sort();
}

const accountability = loadAccountabilityManifest(root);
const previous = fs.existsSync(target)
  ? JSON.parse(fs.readFileSync(target, 'utf8'))
  : { entries: [] };
const debt = fs.existsSync(debtTarget)
  ? JSON.parse(fs.readFileSync(debtTarget, 'utf8'))
  : { legacyGaps: [] };
const serialized = await formatGeneratedJson(
  serializeCoverageManifest(
    buildCoverageManifest(files, {
      root,
      accountability,
      legacyDebt: debt.legacyGaps,
      knownLegacyPaths: previous.entries
        .filter(entry =>
          !Object.hasOwn(entry, 'suggestedTestRefs')
            ? true
            : ['legacy-reference', 'legacy-gap'].includes(entry.coverageStatus)
        )
        .map(entry => entry.path),
    })
  ),
  target
);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== serialized) {
    console.error('Coverage manifest is stale. Run npm run test:coverage:manifest:update.');
    process.exit(1);
  }
  console.info(`Coverage manifest is current (${files.length} tracked files).`);
} else {
  fs.writeFileSync(target, serialized);
  console.info(`Wrote ${path.relative(root, target)} with ${files.length} tracked files.`);
}
