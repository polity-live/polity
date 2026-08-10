import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'coverage-manifest.json'), 'utf8')
);
const legacyGaps = manifest.entries
  .filter(entry => entry.coverageStatus === 'legacy-gap')
  .map(entry => entry.path)
  .sort();

fs.writeFileSync(
  path.join(import.meta.dirname, 'coverage-debt-baseline.json'),
  `${JSON.stringify({ version: 1, legacyGaps }, null, 2)}\n`
);
console.info(`Wrote coverage debt baseline with ${legacyGaps.length} legacy gaps.`);
