import fs from 'node:fs';
import path from 'node:path';

import {
  buildBranchDebtInventory,
  collectBranchAlternatives,
  readJson,
} from './coverage-branch-accountability.mjs';

const root = process.cwd();
const coveragePath = path.resolve(root, 'coverage/coverage-final.json');
const manifestPath = path.resolve(root, 'tools/testing/coverage-manifest.json');
const exceptionsPath = path.resolve(root, 'tools/testing/coverage-branch-exceptions.json');
const targetPath = path.resolve(root, 'tools/testing/coverage-branch-debt.json');

for (const required of [coveragePath, manifestPath, exceptionsPath]) {
  if (!fs.existsSync(required)) {
    console.error(`Missing ${path.relative(root, required)}.`);
    process.exit(1);
  }
}

const alternatives = collectBranchAlternatives({
  coverage: readJson(coveragePath),
  manifest: readJson(manifestPath),
  root,
});
const inventory = buildBranchDebtInventory(alternatives, readJson(exceptionsPath).exceptions ?? []);
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== serialized) {
    console.error(
      'Branch debt inventory is stale. Resolve verified reductions with pnpm run test:coverage:branches:resolve.'
    );
    process.exit(1);
  }
  console.info(
    `Branch debt inventory is current: ${inventory.baseline.uncoveredAlternatives} uncovered accountable alternatives.`
  );
  process.exit(0);
}

const migrateFormat = process.argv.includes('--migrate-format');
if (migrateFormat && fs.existsSync(targetPath)) {
  const previous = readJson(targetPath);
  if (previous.version !== 1 || !Array.isArray(previous.debts)) {
    console.error('Refusing branch inventory migration from an unknown format.');
    process.exit(1);
  }
}
if (fs.existsSync(targetPath) && !process.argv.includes('--bootstrap') && !migrateFormat) {
  console.error('Refusing to rewrite branch debt outside the verified resolver.');
  process.exit(1);
}
fs.writeFileSync(targetPath, serialized);
console.info(
  `Bootstrapped branch debt inventory with ${inventory.baseline.uncoveredAlternatives} alternatives.`
);
