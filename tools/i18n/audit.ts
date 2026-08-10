import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parse } from '@babel/parser';

import deTranslation from '../../src/i18n/locales/de/deTranslation.ts';
import enTranslation from '../../src/i18n/locales/en/enTranslation.ts';
import { isAllowlistedAuditValue } from './audit-allowlist.ts';
import { auditGermanOrthography } from './german-orthography.ts';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

interface AstNode {
  type: string;
  loc?: { start: { line: number } } | null;
  [key: string]: unknown;
}

export type I18nAuditKind =
  | 'accessibility-copy'
  | 'copy-prop'
  | 'helper-return'
  | 'jsx-text'
  | 'manifest'
  | 'missing-key'
  | 'german-orthography'
  | 'service-worker'
  | 'toast-copy';

export interface I18nAuditFinding {
  file: string;
  line: number;
  kind: I18nAuditKind;
  value: string;
}

const TRANSLATABLE_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'placeholder',
  'title',
]);
const COPY_PROPERTIES = new Set([
  'actionLabel',
  'badges',
  'backLabel',
  'buttonLabel',
  'cancelLabel',
  'confirmLabel',
  'copy',
  'description',
  'emptyMessage',
  'entityLabel',
  'errorMessage',
  'helperText',
  'label',
  'message',
  'metadata',
  'progressLabel',
  'retryLabel',
  'secondaryLabel',
  'subtitle',
  'successMessage',
  'title',
  'tooltip',
]);
const SOURCE_EXTENSIONS = /\.[cm]?[jt]sx?$/;
const SKIPPED_DIRECTORIES = new Set([
  '__tests__',
  'fixtures',
  'generated',
  'locales',
  'node_modules',
]);
const SKIPPED_FILE_PATTERNS = [
  /\.d\.ts$/,
  /\.stories\.[cm]?[jt]sx?$/,
  /generated\.ts$/,
  /plate-editor\.tsx$/,
  /features\/docs\/content\//,
  /features\/docs\/logic\/docsRegistry\.ts$/,
  /features\/navigation\/NavigationDemoView\.tsx$/,
  /features\/app-tutorial\/amendment-fixture\.ts$/,
  /features\/shared\/ui\/ui-platejs\/code-block-node\.tsx$/,
  /server\/ai-(?:tools|update-tools)\.ts$/,
];
const NON_UI_COPY_PROPERTY_FILES = [/routes\/api\/ai\//, /server\//, /zero\/.*\/schema\.ts$/];
const NON_UI_HELPER_RETURN_FILES = [
  /features\/shared\/ui\/kit-platejs\/copilot-kit\.tsx$/,
  /lib\/ai\//,
  /server\//,
];
const TOAST_METHODS = new Set(['error', 'info', 'success', 'warning']);

export function flattenTranslationKeys(
  value: unknown,
  prefix = '',
  result = new Set<string>()
): Set<string> {
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string' || Array.isArray(child)) result.add(path);
    else flattenTranslationKeys(child, path, result);
  }
  return result;
}

const GERMAN_LOCALE_KEYS = flattenTranslationKeys(deTranslation);
const ENGLISH_LOCALE_KEYS = flattenTranslationKeys(enTranslation);

export function localeHasTranslationKey(keys: ReadonlySet<string>, key: string): boolean {
  return keys.has(key) || (keys.has(`${key}_one`) && keys.has(`${key}_other`));
}

export function allLocalesHaveTranslationKey(
  localeKeys: readonly ReadonlySet<string>[],
  key: string
): boolean {
  return localeKeys.every(keys => localeHasTranslationKey(keys, key));
}

function normalizeCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeCopy(value: string): boolean {
  const normalized = normalizeCopy(value);
  return (
    normalized.length > 0 &&
    /[A-Za-zÄÖÜäöüß]/.test(normalized) &&
    !isAllowlistedAuditValue(normalized)
  );
}

function looksLikeCssUtilityList(value: string): boolean {
  const normalized = normalizeCopy(value).replaceAll('${…}', 'dynamic');
  const tokens = normalized.split(' ');
  return (
    tokens.length > 1 &&
    tokens.every(token => /^!?[\w:[\]()./%-]+$/.test(token)) &&
    tokens.some(token => /[[\]:/!]/.test(token) || /(?:^|-)[\w[\].]+-[\w[\]./-]+/.test(token))
  );
}

function stringValue(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as AstNode;
  if (candidate.type === 'StringLiteral') return String(candidate.value);
  if (
    candidate.type === 'TemplateLiteral' &&
    Array.isArray(candidate.expressions) &&
    candidate.expressions.length === 0 &&
    Array.isArray(candidate.quasis)
  ) {
    return candidate.quasis
      .map(quasi => {
        const value = (quasi as AstNode).value as { cooked: unknown };
        return String(value.cooked);
      })
      .join('');
  }
  return null;
}

function copyValue(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as AstNode;
  if (candidate.type === 'JSXExpressionContainer') return copyValue(candidate.expression);
  const plainValue = stringValue(candidate);
  if (plainValue !== null) return plainValue;
  if (candidate.type !== 'TemplateLiteral' || !Array.isArray(candidate.quasis)) return null;
  const quasis = candidate.quasis;

  return quasis
    .map((quasi, index) => {
      const value = (quasi as AstNode).value as { cooked: unknown };
      const cooked = String(value.cooked);
      return `${cooked}${index < quasis.length - 1 ? '${…}' : ''}`;
    })
    .join('');
}

function nestedCopyValues(node: unknown): { node: AstNode; value: string }[] {
  if (!node || typeof node !== 'object') return [];
  const candidate = node as AstNode;
  if (candidate.type === 'JSXExpressionContainer') {
    return nestedCopyValues(candidate.expression);
  }

  const directValue = copyValue(candidate);
  if (directValue !== null) return [{ node: candidate, value: directValue }];

  if (
    candidate.type === 'TSAsExpression' ||
    candidate.type === 'TSNonNullExpression' ||
    candidate.type === 'TSSatisfiesExpression' ||
    candidate.type === 'ParenthesizedExpression'
  ) {
    return nestedCopyValues(candidate.expression);
  }

  if (candidate.type === 'ConditionalExpression') {
    return [...nestedCopyValues(candidate.consequent), ...nestedCopyValues(candidate.alternate)];
  }

  if (candidate.type === 'LogicalExpression') {
    return [...nestedCopyValues(candidate.left), ...nestedCopyValues(candidate.right)];
  }

  // Comparisons and arithmetic produce booleans/numbers, not visible copy. Template
  // literals are handled above before reaching this branch.
  if (candidate.type === 'BinaryExpression') {
    return [];
  }

  if (candidate.type === 'ArrayExpression' && Array.isArray(candidate.elements)) {
    return candidate.elements.flatMap(nestedCopyValues);
  }

  if (
    candidate.type === 'CallExpression' &&
    candidate.callee &&
    typeof candidate.callee === 'object'
  ) {
    const callee = candidate.callee as AstNode;
    if (callee.type === 'MemberExpression') {
      const method = propertyName(callee.property as AstNode);
      if (method && ['includes', 'some', 'every', 'find', 'findIndex'].includes(method)) {
        return [];
      }
      return nestedCopyValues(callee.object);
    }
  }

  return [];
}

function propertyName(candidate: AstNode): string | null {
  if (candidate.type === 'Identifier' || candidate.type === 'JSXIdentifier') {
    return String(candidate.name);
  }
  return stringValue(candidate);
}

function memberCall(node: AstNode): { object: string | null; property: string | null } {
  const callee = node.callee as AstNode;
  if (callee.type === 'Identifier') {
    return { object: null, property: String(callee.name) };
  }
  if (callee.type !== 'MemberExpression') return { object: null, property: null };
  return {
    object: propertyName(callee.object as AstNode),
    property: propertyName(callee.property as AstNode),
  };
}

function walk(node: unknown, visit: (node: AstNode, parent: AstNode | null) => void) {
  const seen = new Set<object>();
  const descend = (value: unknown, parent: AstNode | null) => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const child of value) descend(child, parent);
      return;
    }
    const candidate = value as AstNode;
    if (typeof candidate.type !== 'string') return;
    visit(candidate, parent);
    for (const [key, child] of Object.entries(candidate)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      descend(child, candidate);
    }
  };
  descend(node, null);
}

function finding(
  file: string,
  node: AstNode,
  kind: I18nAuditKind,
  value: string
): I18nAuditFinding {
  return {
    file,
    line: (node.loc as NonNullable<AstNode['loc']>).start.line,
    kind,
    value: normalizeCopy(value),
  };
}

export function auditSourceText(source: string, file = 'fixture.tsx'): I18nAuditFinding[] {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: false,
  });
  const findings: I18nAuditFinding[] = [];

  walk(ast, (node, parent) => {
    if (node.type === 'JSXText') {
      const value = String(node.value);
      if (looksLikeCopy(value)) findings.push(finding(file, node, 'jsx-text', value));
      return;
    }

    if (node.type === 'JSXExpressionContainer' && parent?.type === 'JSXElement') {
      const value = copyValue(node);
      if (value !== null && looksLikeCopy(value)) {
        findings.push(finding(file, node, 'jsx-text', value));
      }
      return;
    }

    if (node.type === 'JSXAttribute') {
      const name = propertyName(node.name as AstNode) as string;
      for (const item of nestedCopyValues(node.value)) {
        if (!looksLikeCopy(item.value)) continue;
        if (TRANSLATABLE_ATTRIBUTES.has(name)) {
          findings.push(finding(file, item.node, 'accessibility-copy', item.value));
        } else if (COPY_PROPERTIES.has(name)) {
          findings.push(finding(file, item.node, 'copy-prop', item.value));
        }
      }
      return;
    }

    if (node.type === 'ObjectProperty') {
      const name = propertyName(node.key as AstNode);
      if (
        !name ||
        !COPY_PROPERTIES.has(name) ||
        NON_UI_COPY_PROPERTY_FILES.some(pattern => pattern.test(file.replaceAll('\\', '/')))
      ) {
        return;
      }
      for (const item of nestedCopyValues(node.value)) {
        if (looksLikeCopy(item.value) && !looksLikeCssUtilityList(item.value)) {
          findings.push(finding(file, item.node, 'copy-prop', item.value));
        }
      }
      return;
    }

    if (node.type === 'ReturnStatement') {
      if (NON_UI_HELPER_RETURN_FILES.some(pattern => pattern.test(file.replaceAll('\\', '/')))) {
        return;
      }
      for (const item of nestedCopyValues(node.argument)) {
        if (
          /\s/.test(item.value) &&
          looksLikeCopy(item.value) &&
          !looksLikeCssUtilityList(item.value)
        ) {
          findings.push(finding(file, item.node, 'helper-return', item.value));
        }
      }
      return;
    }

    if (node.type !== 'CallExpression') return;
    const { object, property } = memberCall(node);
    const firstArgument = (node.arguments as unknown[])[0];
    const value = copyValue(firstArgument);
    const translationKey = stringValue(firstArgument);

    if (object === 'toast' && property && TOAST_METHODS.has(property)) {
      if (value !== null && looksLikeCopy(value)) {
        findings.push(finding(file, node, 'toast-copy', value));
      }
      return;
    }

    if (!property || !['t', 'translate', 'translateText'].includes(property)) return;
    if (
      !translationKey ||
      !/^(?:common|components|features|pages|plateJs)\./.test(translationKey)
    ) {
      return;
    }
    if (!allLocalesHaveTranslationKey([GERMAN_LOCALE_KEYS, ENGLISH_LOCALE_KEYS], translationKey)) {
      findings.push(finding(file, node, 'missing-key', translationKey));
    }
  });

  return findings;
}

function auditServiceWorker(root: string): I18nAuditFinding[] {
  const file = join(root, 'public', 'custom-sw.js');
  const source = readFileSync(file, 'utf8');
  const requiredLanguageFeatures = [
    ['language message protocol', 'polity:set-language:v1'],
    ['persisted language cache', '/__polity/settings/language'],
    ['English notification fallback', "notificationTitle: 'New notification'"],
    ['German notification fallback', "notificationTitle: 'Neue Benachrichtigung'"],
    ['English offline fallback', "offline: 'Polity is currently offline.'"],
    ['German offline fallback', "offline: 'Polity ist derzeit offline.'"],
  ] as const;

  return requiredLanguageFeatures.flatMap(([label, marker]) =>
    source.includes(marker)
      ? []
      : [
          {
            file: relative(root, file),
            line: 1,
            kind: 'service-worker' as const,
            value: `missing ${label}`,
          },
        ]
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    }
    if (
      !SOURCE_EXTENSIONS.test(entry.name) ||
      SKIPPED_FILE_PATTERNS.some(pattern => pattern.test(path.replaceAll('\\', '/')))
    ) {
      return [];
    }
    return [path];
  });
}

function auditManifests(root: string): I18nAuditFinding[] {
  const findings: I18nAuditFinding[] = [];
  for (const language of ['de', 'en'] as const) {
    const file = join(root, 'public', `manifest.${language}.json`);
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
      lang?: string;
      name?: string;
      description?: string;
      screenshots?: { label?: string }[];
    };
    if (
      manifest.lang !== language ||
      !manifest.name ||
      !manifest.description ||
      manifest.screenshots?.some(screenshot => !screenshot.label)
    ) {
      findings.push({
        file: relative(root, file),
        line: 1,
        kind: 'manifest',
        value: `incomplete ${language} manifest`,
      });
    }
  }
  return findings;
}

export function auditRepository(root = process.cwd()): I18nAuditFinding[] {
  const findings = sourceFiles(join(root, 'src')).flatMap(file =>
    auditSourceText(readFileSync(file, 'utf8'), relative(root, file))
  );
  findings.push(
    ...auditGermanOrthography(root).map(item => ({
      file: item.file,
      line: item.line,
      kind: 'german-orthography' as const,
      value: item.path ? `${item.path}: ${item.value}` : item.value,
    }))
  );
  findings.push(...auditManifests(root));
  findings.push(...auditServiceWorker(root));
  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.kind.localeCompare(right.kind)
  );
}

export function runI18nAuditCli(
  options: {
    audit?: () => I18nAuditFinding[];
    logger?: Pick<Console, 'error' | 'log'>;
    processState?: { exitCode?: number };
  } = {}
) {
  const audit = options.audit ?? auditRepository;
  const logger = options.logger ?? console;
  const processState = options.processState ?? process;
  const findings = audit();
  if (findings.length > 0) {
    for (const item of findings) {
      logger.error(`${item.file}:${item.line} [${item.kind}] ${JSON.stringify(item.value)}`);
    }
    logger.error(`\n${findings.length} unexplained i18n finding(s).`);
    processState.exitCode = 1;
  } else {
    logger.log('i18n audit passed with zero unexplained findings.');
  }
  return findings;
}

await runCliIfMain(import.meta.url, runI18nAuditCli);
