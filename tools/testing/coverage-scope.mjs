import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

const CODE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);
const CONFIG_EXTENSIONS = new Set(['.json', '.toml', '.yaml', '.yml']);
const ASSET_EXTENSIONS = new Set([
  '.avif',
  '.csv',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.map',
  '.mp3',
  '.pdf',
  '.png',
  '.svg',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
]);

const GENERATED_PATTERNS = [
  /^app\.config\.timestamp_\d+\.js$/,
  /^src\/routeTree\.gen\.ts$/,
  /^public\/(?:sw|worker|workbox-[^/]+)\.js(?:\.map)?$/,
  /^supabase\/tests\/database_coverage\.json$/,
  /^tools\/testing\/(?:coverage-manifest|route-action-catalog|ui-action-catalog)\.json$/,
];

export function normalizeRepositoryPath(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function listRepositoryFiles(root) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }
  );

  return [...new Set(output.split('\0').filter(Boolean).map(normalizeRepositoryPath))]
    .filter(file => fs.existsSync(path.join(root, file)))
    .sort();
}

function isTestFile(file) {
  return (
    file.startsWith('e2e/') ||
    file.startsWith('tools/e2e/') ||
    file.startsWith('tools/testing/') ||
    file.startsWith('supabase/tests/') ||
    file.includes('/__tests__/') ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
  );
}

function domainFor(file) {
  const parts = file.split('/');
  if (parts[0] === 'src' && ['features', 'server', 'zero'].includes(parts[1])) {
    return `${parts[1]}:${parts[2] ?? 'root'}`;
  }
  if (parts[0] === 'src' && parts[1] === 'routes') {
    return parts[2] === 'api' ? 'routes:api' : 'routes:ui';
  }
  if (parts[0] === 'src') return `src:${parts[1] ?? 'root'}`;
  if (parts[0] === 'tools') return `tools:${parts[1] ?? 'root'}`;
  if (parts[0] === 'supabase') return 'database';
  if (parts[0] === 'emails') return 'emails';
  if (parts[0] === 'public') return 'pwa';
  if (parts[0] === 'e2e') return 'e2e';
  return 'platform';
}

function typeOnlyDeclaration(node) {
  if (!node) return true;
  if (
    [
      'TSInterfaceDeclaration',
      'TSTypeAliasDeclaration',
      'TSDeclareFunction',
      'DeclareVariable',
      'DeclareFunction',
    ].includes(node.type)
  ) {
    return true;
  }
  if (node.type === 'TSModuleDeclaration') return node.declare === true;
  if (node.type === 'ImportDeclaration') {
    return (
      node.importKind === 'type' ||
      (node.specifiers.length > 0 &&
        node.specifiers.every(specifier => specifier.importKind === 'type'))
    );
  }
  if (node.type === 'ExportAllDeclaration') return node.exportKind === 'type';
  if (node.type === 'ExportNamedDeclaration') {
    if (node.declaration) return typeOnlyDeclaration(node.declaration);
    return (
      node.exportKind === 'type' ||
      (node.specifiers.length > 0 &&
        node.specifiers.every(specifier => specifier.exportKind === 'type'))
    );
  }
  return false;
}

function isTypeOnlySource(file, root) {
  if (!root || !/\.[cm]?tsx?$/.test(file)) return false;
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) return false;
  try {
    const ast = parse(fs.readFileSync(absolute, 'utf8'), {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['typescript', 'jsx', 'decorators', 'importAttributes'],
    });
    return ast.program.body.every(typeOnlyDeclaration);
  } catch {
    return false;
  }
}

export function classifyRepositoryFile(rawFile, root) {
  const file = normalizeRepositoryPath(rawFile);
  const extension = path.posix.extname(file).toLowerCase();
  const domain = domainFor(file);
  const common = { path: file, domain, owner: `polity/${domain}` };

  if (GENERATED_PATTERNS.some(pattern => pattern.test(file))) {
    return { ...common, kind: 'generated', verification: 'regenerate' };
  }

  if (isTestFile(file) || file.startsWith('src/test/')) {
    return { ...common, kind: 'test-infrastructure', verification: 'self-test' };
  }

  if (file.endsWith('.sql') && file.startsWith('supabase/')) {
    return { ...common, kind: 'declarative', verification: 'database-contract' };
  }

  if (file.endsWith('.d.ts')) {
    return { ...common, kind: 'declarative', verification: 'static-contract' };
  }

  if (
    file.startsWith('.github/') ||
    file.startsWith('.husky/') ||
    /(?:^|\/)\.?[^/]+rc\.[cm]?[jt]s$/.test(file) ||
    CONFIG_EXTENSIONS.has(extension) ||
    /(?:^|\/)(?:Dockerfile|Makefile)$/.test(file) ||
    /(?:^|\/)[^/]+\.config\.[cm]?[jt]s$/.test(file)
  ) {
    return { ...common, kind: 'configuration', verification: 'static-contract' };
  }

  if (DOCUMENT_EXTENSIONS.has(extension) || file === 'LICENSE') {
    return { ...common, kind: 'documentation', verification: 'static-contract' };
  }

  if (ASSET_EXTENSIONS.has(extension)) {
    return { ...common, kind: 'asset', verification: 'asset-contract' };
  }

  if (['.css', '.html', '.scss'].includes(extension)) {
    return { ...common, kind: 'declarative', verification: 'render-contract' };
  }

  if (CODE_EXTENSIONS.has(extension)) {
    if (isTypeOnlySource(file, root)) {
      return { ...common, kind: 'declarative', verification: 'static-contract' };
    }
    const operational = file.startsWith('tools/') || file.startsWith('emails/');
    return {
      ...common,
      kind: operational ? 'operational-code' : 'production-code',
      verification: 'instrument',
    };
  }

  return { ...common, kind: 'asset', verification: 'static-contract' };
}

function comparableStem(file) {
  return path.posix
    .basename(file)
    .replace(/\.(?:spec|test)?\.[cm]?[jt]sx?$/, '')
    .replace(/\.[cm]?[jt]sx?$/, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function findTestReferences(entry, files) {
  if (entry.verification !== 'instrument') return [];
  if (entry.path.startsWith('src/routes/')) {
    return ['src/routes/__tests__/routeCatalog.contract.test.ts'];
  }

  const tests = files.filter(isTestFile);
  const stem = comparableStem(entry.path);
  const directory = path.posix.dirname(entry.path);
  const domainRoot = entry.path.split('/').slice(0, 3).join('/');

  return tests
    .filter(test => {
      const testStem = comparableStem(test);
      if (stem.length >= 5 && testStem.includes(stem)) return true;
      return test.startsWith(`${directory}/__tests__/`) && test.startsWith(domainRoot);
    })
    .slice(0, 12)
    .sort();
}

export function buildCoverageManifest(files, options = {}) {
  const root = options.root;
  const sourceReferences = options.accountability?.sourceReferences ?? {};
  const legacyDebt = new Set(options.legacyDebt ?? []);
  const knownLegacyPaths = new Set(options.knownLegacyPaths ?? []);
  const entries = files
    .map(file => classifyRepositoryFile(file, root))
    .map(entry => {
      const suggestedTestRefs = findTestReferences(entry, files);
      const testRefs = sourceReferences[entry.path] ?? [];
      const coverageStatus =
        entry.verification === 'instrument'
          ? testRefs.length > 0
            ? 'referenced'
            : legacyDebt.has(entry.path)
              ? 'legacy-gap'
              : knownLegacyPaths.has(entry.path) && suggestedTestRefs.length > 0
                ? 'legacy-reference'
                : 'new-gap'
          : 'not-instrumented';
      return { ...entry, coverageStatus, testRefs, suggestedTestRefs };
    });

  return {
    version: 2,
    policy: {
      lines: 100,
      statements: 100,
      functions: 100,
      branches: 95,
      criticalBranches: 100,
      rule: 'No tracked file may be absent; no new legacy-gap entry is allowed.',
    },
    entries,
  };
}

export function serializeCoverageManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
