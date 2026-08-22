import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

export const ACCOUNTABILITY_FILE = 'tools/testing/test-accountability.json';
export const ACCOUNTABILITY_FRAGMENT_DIR = 'tools/testing/accountability';
export const RESOLUTION_LEDGER_FILE = 'tools/testing/debt-resolution-ledger.json';

const TEST_CALLS = new Set(['it', 'test']);

export function emptyAccountabilityManifest() {
  return {
    version: 1,
    sourceReferences: {},
    actionReferences: {},
    actionDeclarations: {},
  };
}

export function emptyResolutionLedger() {
  return {
    version: 1,
    uiActions: {},
    sourceReferences: {},
  };
}

export function readJsonIfPresent(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

export function loadAccountabilityManifest(root) {
  const manifest = readJsonIfPresent(
    path.join(root, ACCOUNTABILITY_FILE),
    emptyAccountabilityManifest()
  );
  const fragmentDirectory = path.join(root, ACCOUNTABILITY_FRAGMENT_DIR);
  if (!fs.existsSync(fragmentDirectory)) return manifest;

  for (const name of fs
    .readdirSync(fragmentDirectory)
    .filter(name => name.endsWith('.json'))
    .sort()) {
    const fragment = readJsonIfPresent(
      path.join(fragmentDirectory, name),
      emptyAccountabilityManifest()
    );
    for (const section of ['sourceReferences', 'actionReferences', 'actionDeclarations']) {
      manifest[section] ??= {};
      for (const [key, references] of Object.entries(fragment[section] ?? {})) {
        if (manifest[section][key]) {
          throw new Error(`Duplicate accountability key in ${name}: ${section}.${key}`);
        }
        manifest[section][key] = references;
      }
    }
    for (const [key, references] of Object.entries(fragment.sourceReferenceAdditions ?? {})) {
      manifest.sourceReferences ??= {};
      manifest.sourceReferences[key] ??= [];
      const existing = new Set(
        manifest.sourceReferences[key].map(reference =>
          JSON.stringify([reference.file, reference.project, reference.caseId])
        )
      );
      for (const reference of references) {
        const identity = JSON.stringify([reference.file, reference.project, reference.caseId]);
        if (existing.has(identity)) {
          throw new Error(`Duplicate source reference addition in ${name}: ${key} ${identity}`);
        }
        existing.add(identity);
        manifest.sourceReferences[key].push(reference);
      }
    }
  }

  return manifest;
}

export function loadResolutionLedger(root) {
  return readJsonIfPresent(path.join(root, RESOLUTION_LEDGER_FILE), emptyResolutionLedger());
}

export function projectForTestFile(file) {
  const normalized = file.replaceAll('\\', '/');
  if (/\.e2e\.spec\.ts$/.test(normalized)) return 'playwright';
  if (normalized.startsWith('supabase/tests/')) return 'database';
  if (/\.browser-component\.test\.tsx?$/.test(normalized)) return 'browser-component';
  if (/\.database-integration\.test\.tsx?$/.test(normalized)) return 'database-integration';
  if (/\.service-integration\.test\.tsx?$/.test(normalized)) return 'service-integration';
  if (/\.component-flow\.test\.tsx$/.test(normalized)) return 'component-flow';
  if (/\.static-contract\.test\.tsx?$/.test(normalized)) return 'static-contract';
  if (/\.component\.test\.tsx$/.test(normalized)) return 'component';
  if (/\.unit\.test\.ts$/.test(normalized)) return 'unit';
  return 'contract';
}

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitor);
    } else {
      walk(value, visitor);
    }
  }
}

function rootCallName(callee) {
  if (!callee) return undefined;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') return rootCallName(callee.object);
  if (callee.type === 'CallExpression') return rootCallName(callee.callee);
  return undefined;
}

function staticString(node) {
  if (!node) return undefined;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map(part => part.value.cooked ?? part.value.raw).join('');
  }
  return undefined;
}

export function extractTestCases(source, file = 'fixture.test.ts') {
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['typescript', ...(file.endsWith('.tsx') ? ['jsx'] : []), 'decorators'],
    });
  } catch (error) {
    return { cases: [], parseError: `${file}: ${error.message}` };
  }

  const cases = [];
  walk(ast, node => {
    if (node.type !== 'CallExpression' || !TEST_CALLS.has(rootCallName(node.callee))) return;
    const caseId = staticString(node.arguments[0]);
    if (!caseId) return;
    cases.push({ caseId, line: node.loc?.start.line ?? 0 });
  });
  return { cases, parseError: undefined };
}

export function buildTestCaseIndex(root, files) {
  const index = new Map();
  const failures = [];
  for (const file of files.filter(candidate => /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(candidate))) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue;
    const result = extractTestCases(fs.readFileSync(absolute, 'utf8'), file);
    if (result.parseError) failures.push(result.parseError);
    const cases = new Map();
    for (const testCase of result.cases) {
      const locations = cases.get(testCase.caseId) ?? [];
      locations.push(testCase.line);
      cases.set(testCase.caseId, locations);
    }
    index.set(file, {
      project: projectForTestFile(file),
      cases,
    });
  }
  return { index, failures };
}

export function validateTestReference(reference, testIndex) {
  const failures = [];
  if (!reference || typeof reference !== 'object') {
    return ['test reference must be an object'];
  }
  if (!reference.file) failures.push('test reference is missing file');
  if (!reference.project) failures.push(`${reference.file ?? 'unknown'}: missing project`);
  if (!reference.caseId) failures.push(`${reference.file ?? 'unknown'}: missing caseId`);
  if (failures.length) return failures;

  const indexed = testIndex.get(reference.file);
  if (!indexed) return [`${reference.file}: test file is not collected by the test index`];
  if (indexed.project !== reference.project) {
    failures.push(
      `${reference.file}: project mismatch (${reference.project} != ${indexed.project})`
    );
  }
  const locations = indexed.cases.get(reference.caseId) ?? [];
  if (locations.length === 0) {
    failures.push(`${reference.file}: missing test case ${JSON.stringify(reference.caseId)}`);
  } else if (locations.length > 1) {
    failures.push(`${reference.file}: test case ${JSON.stringify(reference.caseId)} is not unique`);
  }
  return failures;
}

export function scenariosCovered(requiredScenarios, references) {
  const covered = new Set(
    references.flatMap(reference => (Array.isArray(reference.scenarios) ? reference.scenarios : []))
  );
  return requiredScenarios.every(scenario => covered.has(scenario));
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
