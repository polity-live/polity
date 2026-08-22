import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { extractTestCases } from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'tools/testing/flow-test-campaign.json'), 'utf8')
);
const failures = [];

function failUnless(condition, message) {
  if (!condition) failures.push(message);
}

function readCases(file) {
  const absolute = path.join(root, file);
  failUnless(fs.existsSync(absolute), `missing campaign suite: ${file}`);
  if (!fs.existsSync(absolute)) return [];
  const result = extractTestCases(fs.readFileSync(absolute, 'utf8'), file);
  if (result.parseError) failures.push(result.parseError);
  return result.cases;
}

function verifySuites(suites, suffix, expectedTotal) {
  let total = 0;
  for (const [file, expectedCases] of Object.entries(suites)) {
    failUnless(file.endsWith(suffix), `${file}: expected suffix ${suffix}`);
    const cases = readCases(file);
    failUnless(
      cases.length === expectedCases,
      `${file}: expected ${expectedCases} cases, found ${cases.length}`
    );
    total += cases.length;
  }
  failUnless(total === expectedTotal, `${suffix}: expected ${expectedTotal} cases, found ${total}`);
}

verifySuites(manifest.componentFlow, '.component-flow.test.tsx', 87);
verifySuites(manifest.serviceIntegration, '.service-integration.test.ts', 13);
verifySuites(manifest.databaseIntegration, '.database-integration.test.ts', 9);

let prCount = 0;
let nightlyCount = 0;
for (const [file, tier] of Object.entries(manifest.e2e)) {
  failUnless(file.endsWith('.e2e.spec.ts'), `${file}: invalid E2E suffix`);
  const cases = readCases(file);
  failUnless(
    cases.length === 1,
    `${file}: expected exactly one E2E scenario, found ${cases.length}`
  );
  const title = cases[0]?.caseId ?? '';
  const expectedTag = tier === 'pr' ? '@pr' : '@nightly';
  const oppositeTag = tier === 'pr' ? '@nightly' : '@pr';
  failUnless(title.includes(expectedTag), `${file}: missing ${expectedTag}`);
  failUnless(
    !title.includes(oppositeTag),
    `${file}: campaign flow must not contain ${oppositeTag}`
  );
  if (tier === 'pr') prCount += 1;
  else if (tier === 'nightly') nightlyCount += 1;
  else failures.push(`${file}: unknown E2E tier ${tier}`);

  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [pattern, label] of [
    [/waitForTimeout\s*\(/u, 'waitForTimeout'],
    [/waitUntil\s*:\s*['"]networkidle['"]/u, 'networkidle'],
    [/Math\.random\s*\(/u, 'Math.random'],
    [/randomUUID\s*\(/u, 'randomUUID'],
  ]) {
    failUnless(!pattern.test(source), `${file}: forbidden flaky primitive ${label}`);
  }
}
failUnless(Object.keys(manifest.e2e).length === 30, 'campaign must contain 30 E2E files');
failUnless(prCount === 20, `expected 20 PR E2E scenarios, found ${prCount}`);
failUnless(nightlyCount === 10, `expected 10 nightly E2E scenarios, found ${nightlyCount}`);

const allE2E = listRepositoryFiles(root).filter(file => file.endsWith('.e2e.spec.ts'));
const acceptanceFiles = [];
let acceptanceCases = 0;
for (const file of allE2E) {
  const cases = readCases(file).filter(testCase => testCase.caseId.includes('@acceptance'));
  if (cases.length > 0) acceptanceFiles.push(file);
  acceptanceCases += cases.length;
}
failUnless(acceptanceCases === 10, `expected 10 acceptance flows, found ${acceptanceCases}`);
failUnless(
  JSON.stringify(acceptanceFiles.sort()) === JSON.stringify([...manifest.acceptance].sort()),
  'acceptance flow file set differs from the canonical campaign manifest'
);

const playwrightConfig = fs.readFileSync(path.join(root, 'playwright.config.ts'), 'utf8');
failUnless(/retries:\s*0/u.test(playwrightConfig), 'Playwright retries must remain 0');
failUnless(/workers:\s*1/u.test(playwrightConfig), 'Playwright workers must remain 1');

if (failures.length > 0) {
  console.error('Flow-test campaign audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  'Flow-test campaign audit passed: 87 component flow, 13 service integration, 9 database integration, 20 PR E2E, 10 nightly E2E, and 10 acceptance flows (139 total).'
);
