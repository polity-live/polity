import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { parse } from '@babel/parser';

import deTranslation from '../../src/i18n/locales/de/deTranslation.ts';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

interface AstNode {
  type: string;
  loc?: { start: { line: number } } | null;
  [key: string]: unknown;
}

export interface GermanOrthographyFinding {
  file: string;
  line: number;
  path?: string;
  value: string;
  words: string[];
}

const ASCII_GERMAN_FRAGMENTS = [
  'abhaeng',
  'aender',
  'aeusser',
  'angehaeng',
  'aufgeloes',
  'auftraeg',
  'ausgewaehl',
  'ausser',
  'auswaehl',
  'bestaet',
  'benoet',
  'beitraeg',
  'duerf',
  'einlaed',
  'einschraenk',
  'enthaelt',
  'erklaer',
  'erhoe',
  'faellig',
  'fuss',
  'fueg',
  'fuehrungskraeft',
  'fuer',
  'gaest',
  'gehoer',
  'gepruef',
  'geschaeft',
  'gewaehl',
  'gewaehr',
  'gezaehl',
  'gross',
  'groess',
  'gruss',
  'gruend',
  'gueltig',
  'haeufig',
  'heiss',
  'hoeh',
  'hoer',
  'klaer',
  'koenn',
  'loes',
  'maess',
  'maenn',
  'moech',
  'moeg',
  'muess',
  'naech',
  'oeff',
  'passwoert',
  'persoen',
  'praes',
  'pruef',
  'schliess',
  'schwaech',
  'spaet',
  'staerk',
  'standardmaess',
  'strass',
  'stuetz',
  'taetig',
  'traeg',
  'ueber',
  'unmoeg',
  'verfueg',
  'verknuepf',
  'veroeff',
  'vervollstaendig',
  'vollstaendig',
  'vorausgewaehl',
  'vorbefuell',
  'waehr',
  'waehl',
  'waer',
  'weiss',
  'wuerd',
  'zaehl',
  'zunaechst',
  'zurueck',
  'zusaetz',
  'zusammenfuehr',
  'zulaess',
  'zustaend',
] as const;

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const SKIPPED_DIRECTORIES = new Set(['__tests__', 'fixtures', 'generated', 'node_modules']);
const TECHNICAL_VALUE_PROPERTIES = new Set([
  'anchor',
  'clientId',
  'data-testid',
  'href',
  'id',
  'key',
  'namespace',
  'path',
  'route',
  'slug',
  'testId',
  'to',
  'url',
]);
const TRANSLATION_KEY =
  /^(?:auth|commandDialog|common|components|errors|features|generated\.inline|landing|media|mediaUpload|navigation|navigationDemo|onboarding|pages|plateJs)\.[A-Za-z0-9_.-]+$/;
const LOWERCASE_STABLE_IDENTIFIER = /^[a-z0-9]+(?:[-_.][a-z0-9]+)+$/;
const WORD = /[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;
const SOURCE_VALUE_ALLOWLIST = /^(?:euckenstrasse|gross domestic product|gross national product)$/;

export function findAsciiGermanOrthography(value: string): string[] {
  const matches = new Set<string>();
  for (const match of value.matchAll(WORD)) {
    const word = match[0];
    const normalized = word.toLocaleLowerCase('de-DE');
    if (ASCII_GERMAN_FRAGMENTS.some(fragment => normalized.includes(fragment))) {
      matches.add(word);
    }
  }
  return [...matches];
}

function propertyName(candidate: AstNode): string | null {
  if (candidate.type === 'Identifier' || candidate.type === 'JSXIdentifier') {
    return String(candidate.name);
  }
  if (candidate.type === 'StringLiteral') return String(candidate.value);
  return null;
}

function stringValue(node: AstNode): string | null {
  if (node.type === 'StringLiteral') return String(node.value);
  if (node.type !== 'TemplateElement') return null;
  const value = node.value as { cooked: unknown };
  return String(value.cooked ?? '');
}

function isTechnicalString(node: AstNode, parent: AstNode, value: string): boolean {
  if (
    TRANSLATION_KEY.test(value) ||
    LOWERCASE_STABLE_IDENTIFIER.test(value) ||
    /^(?:https?:|mailto:|tel:|\/)/.test(value)
  ) {
    return true;
  }
  if (
    [
      'ExportAllDeclaration',
      'ExportNamedDeclaration',
      'ImportDeclaration',
      'TSLiteralType',
    ].includes(parent.type)
  ) {
    return true;
  }
  if (parent.type === 'ObjectProperty') {
    if (parent.key === node) return true;
    return TECHNICAL_VALUE_PROPERTIES.has(propertyName(parent.key as AstNode) as string);
  }
  if (parent.type === 'JSXAttribute') {
    return TECHNICAL_VALUE_PROPERTIES.has(propertyName(parent.name as AstNode) as string);
  }
  return false;
}

function walk(
  node: unknown,
  parent: AstNode | null,
  visit: (node: AstNode, parent: AstNode | null) => void
) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, parent, visit);
    return;
  }
  const candidate = node as AstNode;
  if (typeof candidate.type !== 'string') return;
  visit(candidate, parent);
  for (const [key, child] of Object.entries(candidate)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    walk(child, candidate, visit);
  }
}

export function auditGermanSource(
  source: string,
  file = 'fixture.tsx'
): GermanOrthographyFinding[] {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: false,
  });
  const findings: GermanOrthographyFinding[] = [];

  walk(ast, null, (node, parent) => {
    const value = stringValue(node);
    if (
      value === null ||
      SOURCE_VALUE_ALLOWLIST.test(value) ||
      isTechnicalString(node, parent as AstNode, value)
    ) {
      return;
    }
    const words = findAsciiGermanOrthography(value);
    if (words.length === 0) return;
    findings.push({
      file,
      line: (node.loc as NonNullable<AstNode['loc']>).start.line,
      value: value.replace(/\s+/g, ' ').trim(),
      words,
    });
  });

  return findings;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) return [];
      if (path.replaceAll('\\', '/').endsWith('/src/i18n/locales')) return [];
      return sourceFiles(path);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

export function auditGermanValues(
  value: unknown,
  file: string,
  initialPath = ''
): GermanOrthographyFinding[] {
  const findings: GermanOrthographyFinding[] = [];
  const walkValue = (current: unknown, path: string) => {
    if (typeof current === 'string') {
      const words = findAsciiGermanOrthography(current);
      if (words.length > 0) {
        findings.push({
          file,
          line: 1,
          path,
          value: current.replace(/\s+/g, ' ').trim(),
          words,
        });
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((child, index) =>
        walkValue(child, path ? `${path}.${index}` : String(index))
      );
      return;
    }
    if (!current || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      walkValue(child, path ? `${path}.${key}` : key);
    }
  };
  walkValue(value, initialPath);
  return findings;
}

function auditRuntimeLocale(): GermanOrthographyFinding[] {
  return auditGermanValues(deTranslation, 'src/i18n/locales/de');
}

function auditGermanManifest(root: string): GermanOrthographyFinding[] {
  const file = join(root, 'public', 'manifest.de.json');
  return auditGermanValues(JSON.parse(readFileSync(file, 'utf8')), relative(root, file));
}

export function auditGermanOrthography(root = process.cwd()): GermanOrthographyFinding[] {
  const roots = [join(root, 'src'), join(root, 'emails')];
  const findings = roots.flatMap(directory =>
    sourceFiles(directory).flatMap(file =>
      auditGermanSource(readFileSync(file, 'utf8'), relative(root, file))
    )
  );
  const serviceWorker = join(root, 'public', 'custom-sw.js');
  findings.push(
    ...auditGermanSource(readFileSync(serviceWorker, 'utf8'), relative(root, serviceWorker)),
    ...auditGermanManifest(root),
    ...auditRuntimeLocale()
  );
  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      (left.path ?? '').localeCompare(right.path ?? '')
  );
}

export function runGermanOrthographyCli(
  options: {
    audit?: () => GermanOrthographyFinding[];
    logger?: Pick<Console, 'error' | 'log'>;
    processState?: { exitCode?: number };
  } = {}
) {
  const audit = options.audit ?? auditGermanOrthography;
  const logger = options.logger ?? console;
  const processState = options.processState ?? process;
  const findings = audit();
  if (findings.length > 0) {
    for (const item of findings) {
      const location = item.path ? `${item.file} (${item.path})` : `${item.file}:${item.line}`;
      logger.error(
        `${location} [german-orthography] ${JSON.stringify(item.words)} in ${JSON.stringify(item.value)}`
      );
    }
    logger.error(`\n${findings.length} German orthography finding(s).`);
    processState.exitCode = 1;
  } else {
    logger.log('German orthography audit passed with zero findings.');
  }
  return findings;
}

await runCliIfMain(import.meta.url, runGermanOrthographyCli);
