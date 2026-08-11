import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const relative = 'tools/testing/coverage-debt-baseline.json';
const current = JSON.parse(fs.readFileSync(path.resolve(relative), 'utf8')).legacyGaps ?? [];
const baseBranch = process.env.GITHUB_BASE_REF;
const explicit = process.env.COVERAGE_BASE_REF;
const base = explicit ?? (baseBranch ? `origin/${baseBranch}` : undefined);

if (!base) {
  console.info(`Coverage debt ratchet: ${current.length} bootstrapped gaps; no base ref supplied.`);
  process.exit(0);
}

let previous;
try {
  previous = JSON.parse(
    execFileSync('git', ['show', `${base}:${relative}`], { encoding: 'utf8' })
  ).legacyGaps;
} catch {
  console.info('Coverage debt ratchet bootstrap accepted because the base has no baseline yet.');
  process.exit(0);
}

const previousSet = new Set(previous);
const additions = current.filter(file => !previousSet.has(file));
if (additions.length) {
  console.error(`Coverage debt may not grow (${additions.length} additions):`);
  for (const file of additions) console.error(`- ${file}`);
  process.exit(1);
}
console.info(`Coverage debt ratchet valid: ${current.length} gaps, previously ${previous.length}.`);
