import fs from 'node:fs';
import path from 'node:path';

import { loadAccountabilityManifest } from './accountability-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const coverageFile = path.join(root, 'coverage/coverage-final.json');
if (!fs.existsSync(coverageFile)) {
  console.error('Missing coverage/coverage-final.json. Run pnpm run test:coverage first.');
  process.exit(1);
}
const accountability = loadAccountabilityManifest(root);
const rawCoverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
const normalizedRoot = root.replaceAll('\\', '/');
const coverage = new Map(
  Object.entries(rawCoverage).map(([file, entry]) => [
    file.replaceAll('\\', '/').replace(`${normalizedRoot}/`, ''),
    entry,
  ])
);
const failures = [];
let verified = 0;

for (const [source, references] of Object.entries(accountability.sourceReferences ?? {})) {
  if (!references.length) continue;
  const entry = coverage.get(source);
  if (!entry) {
    failures.push(`${source}: missing from instrumented coverage`);
    continue;
  }
  const statementHits = Object.values(entry.s);
  const functionHits = Object.values(entry.f);
  const branchHits = Object.values(entry.b).flat();
  if (
    statementHits.length > 0 &&
    !statementHits.some(hits => hits > 0) &&
    !functionHits.some(hits => hits > 0) &&
    !branchHits.some(hits => hits > 0)
  ) {
    failures.push(`${source}: exact references exist, but the full suite never executes it`);
    continue;
  }
  verified += 1;
}

if (failures.length) {
  console.error(`Accountability coverage evidence failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.info(`Coverage evidence valid for ${verified} explicitly referenced source files.`);
