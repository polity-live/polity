import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const canonicalSuffix =
  /\.(?:unit|component|component-flow|browser-component|service-integration|database-integration|static-contract)\.test\.tsx?$|\.e2e\.spec\.ts$/;

const staticContractTests = new Set([
  'tools/testing/__tests__/workflow-contract.test.ts',
  'src/features/pwa/__tests__/earlyInstallPromptCaptureScript.test.ts',
  'src/features/pwa/__tests__/manifestAssets.test.ts',
  'src/features/shared/ui/ui/__tests__/tooltip-audit.test.ts',
  'src/i18n/__tests__/amendment-event-route-i18n.test.ts',
  'src/i18n/__tests__/locale-quality.test.ts',
  'src/i18n/__tests__/source-ui-copy-guard.test.ts',
  'src/server/app-tutorial/__tests__/cleanup-order.test.ts',
  'src/zero/__tests__/mutateWithServerCheck.test.ts',
  'src/zero/notifications/__tests__/notificationReadSchema.test.ts',
  'src/zero/preloads/__tests__/route-audit.test.ts',
]);

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function trackedFiles(...patterns) {
  return execFileSync('git', ['ls-files', '-z', '--', ...patterns], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function normalizeQualifier(fileName) {
  return fileName
    .replace(/\.(branch|lsf|accountability|mutation)\.([A-Z])(\d{2})(?=\.)/g, (_, family, letter, digits) =>
      `.${family}-${letter.toLowerCase()}${digits}`
    )
    .replace(/\.typefix\.branch\.([A-Z])(\d{2})(?=\.)/g, (_, letter, digits) =>
      `.typefix.branch-${letter.toLowerCase()}${digits}`
    );
}

function canonicalTestPath(file) {
  if (canonicalSuffix.test(file)) return file;

  const directory = path.posix.dirname(file);
  let fileName = normalizeQualifier(path.posix.basename(file));

  if (fileName.endsWith('.spec.ts')) {
    fileName = `${fileName.slice(0, -'.spec.ts'.length)}.e2e.spec.ts`;
  } else if (staticContractTests.has(file)) {
    fileName = fileName.replace(/\.test\.(ts|tsx)$/, '.static-contract.test.$1');
  } else if (fileName.endsWith('.browser.test.tsx')) {
    fileName = fileName.replace(/\.browser\.test\.tsx$/, '.browser-component.test.tsx');
  } else if (/\.integration\.test\.(ts|tsx)$/.test(fileName)) {
    fileName = fileName.replace(/\.integration\.test\.(ts|tsx)$/, '.service-integration.test.$1');
  } else if (fileName.endsWith('.test.tsx')) {
    fileName = fileName.replace(/\.test\.tsx$/, '.component.test.tsx');
  } else if (fileName.endsWith('.test.ts')) {
    fileName = fileName.replace(/\.test\.ts$/, '.unit.test.ts');
  } else {
    throw new Error(`Cannot classify test file: ${file}`);
  }

  return directory === '.' ? fileName : `${directory}/${fileName}`;
}

const testFiles = trackedFiles('*.test.ts', '*.test.tsx', '*.spec.ts');
const moves = testFiles
  .map(oldPath => [oldPath, canonicalTestPath(oldPath)])
  .filter(([oldPath, newPath]) => oldPath !== newPath);

const e2eMoves = new Map(moves.filter(([oldPath]) => oldPath.endsWith('.spec.ts')));
for (const snapshot of trackedFiles('e2e/*.spec.ts-snapshots/*', 'e2e/**/*.spec.ts-snapshots/*')) {
  for (const [oldTest, newTest] of e2eMoves) {
    const oldPrefix = `${oldTest}-snapshots/`;
    if (snapshot.startsWith(oldPrefix)) {
      moves.push([snapshot, `${newTest}-snapshots/${snapshot.slice(oldPrefix.length)}`]);
      break;
    }
  }
}

const targets = new Map();
for (const [oldPath, newPath] of moves) {
  const previous = targets.get(newPath);
  if (previous) throw new Error(`Rename collision: ${previous} and ${oldPath} -> ${newPath}`);
  targets.set(newPath, oldPath);
}

for (const [oldPath, newPath] of moves) {
  execFileSync('git', ['mv', '--', oldPath, newPath], { stdio: 'inherit' });
}

const stagedRenameFields = execFileSync(
  'git',
  ['diff', '--cached', '--name-status', '-z', '--diff-filter=R'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean);
const stagedRenames = [];
for (let index = 0; index < stagedRenameFields.length; index += 3) {
  if (!stagedRenameFields[index].startsWith('R')) continue;
  stagedRenames.push([stagedRenameFields[index + 1], stagedRenameFields[index + 2]]);
}
const referenceMoves = new Map([...stagedRenames, ...moves]);

const replacements = new Map();
for (const [oldPath, newPath] of referenceMoves) {
  replacements.set(oldPath, newPath);
  replacements.set(oldPath.replaceAll('/', '\\\\'), newPath.replaceAll('/', '\\\\'));
}

const byBaseName = new Map();
for (const [oldPath, newPath] of referenceMoves) {
  const oldBase = path.posix.basename(oldPath);
  const newBase = path.posix.basename(newPath);
  const existing = byBaseName.get(oldBase);
  byBaseName.set(oldBase, existing && existing !== newBase ? null : newBase);
}
for (const [oldBase, newBase] of byBaseName) {
  if (newBase) replacements.set(oldBase, newBase);
}

let changedReferences = 0;
for (const file of trackedFiles()) {
  if (!textExtensions.has(path.extname(file))) continue;
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  let updated = source;
  for (const [oldValue, newValue] of replacements) {
    if (updated.includes(oldValue)) updated = updated.replaceAll(oldValue, newValue);
  }
  if (updated !== source) {
    writeFileSync(file, updated);
    changedReferences += 1;
  }
}

function projectForCanonicalTest(file) {
  if (/\.e2e\.spec\.ts$/.test(file)) return 'playwright';
  if (/\.browser-component\.test\.tsx?$/.test(file)) return 'browser-component';
  if (/\.database-integration\.test\.tsx?$/.test(file)) return 'database-integration';
  if (/\.service-integration\.test\.tsx?$/.test(file)) return 'service-integration';
  if (/\.component-flow\.test\.tsx$/.test(file)) return 'component-flow';
  if (/\.static-contract\.test\.tsx?$/.test(file)) return 'static-contract';
  if (/\.component\.test\.tsx$/.test(file)) return 'component';
  if (/\.unit\.test\.ts$/.test(file)) return 'unit';
  return undefined;
}

function updateReferenceProjects(value) {
  if (Array.isArray(value)) {
    let changes = 0;
    for (const item of value) changes += updateReferenceProjects(item);
    return changes;
  }
  if (!value || typeof value !== 'object') return 0;
  let changes = 0;
  if (typeof value.file === 'string' && typeof value.project === 'string') {
    const expected = projectForCanonicalTest(value.file);
    if (expected && value.project !== expected) {
      value.project = expected;
      changes += 1;
    }
  }
  for (const child of Object.values(value)) changes += updateReferenceProjects(child);
  return changes;
}

let changedProjectFiles = 0;
let changedProjects = 0;
for (const file of trackedFiles('*.json')) {
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  const changes = updateReferenceProjects(value);
  if (changes > 0) {
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    changedProjectFiles += 1;
    changedProjects += changes;
  }
}

console.log(
  `Renamed ${moves.length} tracked paths, updated ${changedReferences} path-reference files, ` +
    `and reclassified ${changedProjects} references in ${changedProjectFiles} JSON files.`
);
