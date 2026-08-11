import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { buildCampaignAssignments, serializeCampaign } from './branch-campaign.mjs';

const root = process.cwd();
const coveragePath = path.resolve(root, 'coverage/coverage-final.json');
const manifestPath = path.resolve(root, 'tools/testing/coverage-manifest.json');
const targetPath = path.resolve(root, 'tools/testing/branch-campaign.assignments.json');

for (const required of [coveragePath, manifestPath]) {
  if (!fs.existsSync(required)) {
    console.error(`Missing ${path.relative(root, required)}.`);
    process.exit(1);
  }
}

const assignments = buildCampaignAssignments({
  coverage: JSON.parse(fs.readFileSync(coveragePath, 'utf8')),
  coverageSha256: createHash('sha256').update(fs.readFileSync(coveragePath)).digest('hex'),
  manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  root,
});
const serialized = serializeCampaign(assignments);

if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== serialized) {
    console.error('Branch campaign assignments are stale. Freeze writes and regenerate them.');
    process.exit(1);
  }
  console.info(
    `Branch campaign current: ${assignments.baseline.totals.branches} branches across ${assignments.baseline.debtFiles} debt files.`
  );
  process.exit(0);
}

fs.writeFileSync(targetPath, serialized);
console.info(
  `Generated branch campaign: ${assignments.baseline.totals.branches} branches across ${assignments.baseline.debtFiles} debt files.`
);
