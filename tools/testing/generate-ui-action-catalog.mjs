import fs from 'node:fs';
import path from 'node:path';

import { listRepositoryFiles } from './coverage-scope.mjs';
import { buildUiActionCatalog, serializeUiActionCatalog } from './ui-action-scope.mjs';
import { loadAccountabilityManifest, loadResolutionLedger } from './accountability-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const target = path.join(import.meta.dirname, 'ui-action-catalog.json');
const debtTarget = path.join(import.meta.dirname, 'ui-action-debt-baseline.json');
const referenceTarget = path.join(import.meta.dirname, 'ui-action-reference-baseline.json');
const previous = fs.existsSync(target)
  ? JSON.parse(fs.readFileSync(target, 'utf8'))
  : { entries: [] };
const debt = fs.existsSync(debtTarget)
  ? JSON.parse(fs.readFileSync(debtTarget, 'utf8'))
  : { legacyGaps: [] };
const references = fs.existsSync(referenceTarget)
  ? JSON.parse(fs.readFileSync(referenceTarget, 'utf8'))
  : { legacyReferences: [] };
const catalog = buildUiActionCatalog(root, listRepositoryFiles(root), {
  accountability: loadAccountabilityManifest(root),
  resolutions: loadResolutionLedger(root),
  legacyDebt: debt.legacyGaps,
  historicalEntries: previous.entries,
  knownLegacyKeys: [
    ...(references.legacyReferences ?? []),
    ...previous.entries
      .filter(entry =>
        previous.version < 2
          ? entry.accountabilityStatus === 'accounted'
          : entry.accountabilityStatus === 'legacy-reference'
      )
      .map(entry => entry.debtKey ?? entry.key),
  ],
});
const serialized = serializeUiActionCatalog(catalog);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== serialized) {
    console.error('UI action catalog is stale. Run npm run test:ui-actions:update.');
    process.exit(1);
  }
  console.info(`UI action catalog is current (${catalog.entries.length} actions).`);
} else {
  fs.writeFileSync(target, serialized);
  if (process.argv.includes('--bootstrap-debt')) {
    const legacyGaps = catalog.entries
      .filter(entry => entry.accountabilityStatus === 'legacy-gap')
      .map(entry => entry.debtKey)
      .sort();
    fs.writeFileSync(debtTarget, `${JSON.stringify({ version: 1, legacyGaps }, null, 2)}\n`);
    console.info(`Bootstrapped ${legacyGaps.length} UI action gaps.`);
  }
  if (process.argv.includes('--bootstrap-references')) {
    const legacyReferences = catalog.entries
      .filter(entry => entry.accountabilityStatus === 'new-gap')
      .map(entry => entry.debtKey)
      .sort();
    fs.writeFileSync(
      referenceTarget,
      `${JSON.stringify({ version: 1, legacyReferences }, null, 2)}\n`
    );
    console.info(`Bootstrapped ${legacyReferences.length} legacy UI references.`);
  }
  console.info(`Wrote UI action catalog with ${catalog.entries.length} actions.`);
}
