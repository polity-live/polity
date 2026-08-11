import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

import { buildTestCaseIndex, projectForTestFile, serializeJson } from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const coverageFile = path.join(root, 'coverage/coverage-final.json');
if (!fs.existsSync(coverageFile)) {
  console.error('Missing coverage/coverage-final.json. Run npm run test:coverage first.');
  process.exit(1);
}

const files = listRepositoryFiles(root);
const codeFiles = files.filter(file => /\.[cm]?[jt]sx?$/.test(file));
const codeSet = new Set(codeFiles);
const testCases = buildTestCaseIndex(root, files);
const accountabilityPath = path.join(root, 'tools/testing/test-accountability.json');
const accountability = JSON.parse(fs.readFileSync(accountabilityPath, 'utf8'));
const fragmentDirectory = path.join(root, 'tools/testing/accountability');
const fragmentKeys = {
  sourceReferences: new Set(),
  actionReferences: new Set(),
  actionDeclarations: new Set(),
};
for (const name of fs.existsSync(fragmentDirectory)
  ? fs
      .readdirSync(fragmentDirectory)
      .filter(name => name.endsWith('.json'))
      .sort()
  : []) {
  const fragment = JSON.parse(fs.readFileSync(path.join(fragmentDirectory, name), 'utf8'));
  for (const section of Object.keys(fragmentKeys)) {
    accountability[section] ??= {};
    for (const [key, value] of Object.entries(fragment[section] ?? {})) {
      fragmentKeys[section].add(key);
      const duplicate = accountability[section][key];
      if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(value)) {
        throw new Error(`Conflicting accountability key in ${name}: ${section}.${key}`);
      }
    }
  }
}
for (const section of Object.keys(fragmentKeys)) {
  accountability[section] = Object.fromEntries(
    Object.entries(accountability[section] ?? {}).filter(([key]) => !fragmentKeys[section].has(key))
  );
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'tools/testing/coverage-manifest.json'), 'utf8')
);
const rawCoverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
const normalizedRoot = root.replaceAll('\\', '/');
const coverage = new Map(
  Object.entries(rawCoverage).map(([file, entry]) => [
    file.replaceAll('\\', '/').replace(`${normalizedRoot}/`, ''),
    entry,
  ])
);

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

function importSpecifiers(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['typescript', 'jsx', 'decorators', 'importAttributes'],
    });
  } catch {
    return [];
  }
  const specifiers = [];
  walk(ast, node => {
    if (
      ['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type) &&
      node.source?.type === 'StringLiteral'
    ) {
      specifiers.push(node.source.value);
    }
    if (
      node.type === 'CallExpression' &&
      (node.callee.type === 'Import' ||
        (node.callee.type === 'Identifier' && node.callee.name === 'require')) &&
      node.arguments[0]?.type === 'StringLiteral'
    ) {
      specifiers.push(node.arguments[0].value);
    }
    if (
      node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'URL' &&
      node.arguments[0]?.type === 'StringLiteral'
    ) {
      specifiers.push(node.arguments[0].value);
    }
  });
  return specifiers;
}

function isPublicModuleSurface(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['typescript', 'jsx', 'decorators', 'importAttributes'],
    });
  } catch {
    return false;
  }
  return (
    ast.program.body.length > 0 &&
    ast.program.body.every(node => {
      if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return true;
      if (node.type !== 'ExportNamedDeclaration') return false;
      return node.declaration === null && (node.source !== null || node.specifiers.length > 0);
    })
  );
}

function resolveImport(from, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  } else return undefined;
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map(extension => `${base}${extension}`),
    ...['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].map(extension => `${base}/index.${extension}`),
  ];
  return candidates.find(candidate => codeSet.has(candidate));
}

const graph = new Map();
for (const file of codeFiles) {
  graph.set(
    file,
    new Set(
      importSpecifiers(file)
        .map(specifier => resolveImport(file, specifier))
        .filter(Boolean)
    )
  );
}

const tests = codeFiles.filter(
  file =>
    file.startsWith('e2e/') ||
    file.includes('/__tests__/') ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
);
const candidatesBySource = new Map();
for (const test of tests) {
  const direct = graph.get(test) ?? new Set();
  const seen = new Set();
  const stack = [...direct];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const dependency of graph.get(file) ?? []) stack.push(dependency);
  }
  for (const source of seen) {
    const candidates = candidatesBySource.get(source) ?? [];
    candidates.push({ test, relation: direct.has(source) ? 'direct' : 'transitive' });
    candidatesBySource.set(source, candidates);
  }
}

function words(value) {
  return new Set(
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length >= 3 && !['test', 'view', 'page', 'index'].includes(word))
  );
}

function overlap(left, right) {
  const rightWords = words(right);
  return [...words(left)].filter(word => rightWords.has(word)).length;
}

function chooseCandidate(source, candidates) {
  const domainRoot = source.split('/').slice(0, 3).join('/');
  return [...candidates]
    .filter(candidate => testCases.index.get(candidate.test)?.cases.size > 0)
    .sort((left, right) => {
      const score = candidate =>
        (candidate.relation === 'direct' ? 100 : 0) +
        (candidate.test.startsWith(domainRoot) ? 30 : 0) +
        overlap(source, candidate.test) * 10 -
        (candidate.test === 'src/__tests__/router.test.ts' ? 20 : 0) -
        (candidate.test.startsWith('e2e/') ? 10 : 0);
      return score(right) - score(left) || left.test.localeCompare(right.test);
    })[0];
}

function chooseCase(source, test) {
  const indexed = testCases.index.get(test);
  return [...(indexed?.cases.keys() ?? [])].sort(
    (left, right) => overlap(source, right) - overlap(source, left) || left.localeCompare(right)
  )[0];
}

const adopted = [];
const skipped = [];
const knownSourceReferences = new Set([
  ...Object.keys(accountability.sourceReferences ?? {}),
  ...fragmentKeys.sourceReferences,
]);
for (const entry of manifest.entries.filter(item =>
  ['legacy-gap', 'legacy-reference'].includes(item.coverageStatus)
)) {
  if (knownSourceReferences.has(entry.path)) continue;
  const fileCoverage = coverage.get(entry.path);
  const statementHits = fileCoverage ? Object.values(fileCoverage.s) : [];
  const coveredStatements = statementHits.filter(hits => hits > 0).length;
  if (statementHits.length === 0 && isPublicModuleSurface(entry.path)) {
    accountability.sourceReferences[entry.path] = [
      {
        file: 'src/__tests__/publicModuleSurfaces.test.ts',
        project: 'unit',
        caseId: 'loads every re-export-only production module through the application module graph',
        evidence: {
          kind: 'module-surface-contract',
          relation: 'dynamic-direct',
          report: 'coverage/coverage-final.json',
        },
      },
    ];
    knownSourceReferences.add(entry.path);
    adopted.push(entry.path);
    continue;
  }
  if (coveredStatements === 0) continue;
  const candidate = chooseCandidate(entry.path, candidatesBySource.get(entry.path) ?? []);
  if (!candidate) {
    skipped.push(entry.path);
    continue;
  }
  const caseId = chooseCase(entry.path, candidate.test);
  if (!caseId) {
    skipped.push(entry.path);
    continue;
  }
  accountability.sourceReferences[entry.path] = [
    {
      file: candidate.test,
      project: projectForTestFile(candidate.test),
      caseId,
      evidence: {
        kind: 'instrumented-full-suite',
        relation: candidate.relation,
        report: 'coverage/coverage-final.json',
        coveredStatements,
        totalStatements: statementHits.length,
      },
    },
  ];
  knownSourceReferences.add(entry.path);
  adopted.push(entry.path);
}

fs.writeFileSync(accountabilityPath, serializeJson(accountability));
console.info(`Adopted ${adopted.length} covered source references.`);
if (skipped.length) {
  console.warn(`Skipped ${skipped.length} covered sources without a concrete reachable test:`);
  for (const file of skipped) console.warn(`- ${file}`);
}
