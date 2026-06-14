import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import deTranslation from '../src/i18n/locales/de/deTranslation.ts';
import { generatedTranslations as existingDeGeneratedTranslations } from '../src/i18n/locales/de/generated.ts';
import enTranslation from '../src/i18n/locales/en/enTranslation.ts';
import { generatedTranslations as existingEnGeneratedTranslations } from '../src/i18n/locales/en/generated.ts';

interface Replacement {
  start: number;
  end: number;
  text: string;
}

type TranslationTree = Record<string, unknown>;

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const extensions = new Set(['.ts', '.tsx']);

const skipPathParts = [
  `${path.sep}i18n${path.sep}locales${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}tests${path.sep}`,
  `${path.sep}test${path.sep}`,
  `${path.sep}@types${path.sep}`,
];

const skipFilePatterns = [/\.test\./, /\.spec\./, /\.stories\./, /routeTree\.gen\.ts$/];

const visibleJsxAttributes = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'badge',
  'cancelLabel',
  'caption',
  'clearLabel',
  'closeLabel',
  'compositionLabel',
  'confirmLabel',
  'description',
  'dialogDescription',
  'dialogTitle',
  'emptyDescription',
  'emptyLabel',
  'emptyMessage',
  'emptyRolesLabel',
  'emptyTitle',
  'errorLabel',
  'fallbackRoleLabel',
  'guestsLabel',
  'heading',
  'helperText',
  'hint',
  'imageDescription',
  'imageLabel',
  'label',
  'loadingLabel',
  'manageDialogDescription',
  'manageDialogTitle',
  'membershipsByRoleLabel',
  'membershipsByUserLabel',
  'message',
  'noResultsLabel',
  'openAssignmentsLabel',
  'openLabel',
  'placeholder',
  'rightsAlignmentLabel',
  'roleSectionDescription',
  'rolesLabel',
  'searchPlaceholder',
  'submitLabel',
  'subtitle',
  'title',
  'tooltip',
  'triggerLabel',
  'videoDescription',
  'videoLabel',
]);

const visibleObjectProperties = new Set([
  'caption',
  'description',
  'emptyLabel',
  'emptyMessage',
  'emptyTitle',
  'heading',
  'helperText',
  'hint',
  'label',
  'message',
  'note',
  'placeholder',
  'subtitle',
  'title',
  'tooltip',
]);

const structuralObjectProperties = new Set([
  'action',
  'aliases',
  'apiKey',
  'body',
  'className',
  'color',
  'colorClass',
  'entityType',
  'fallback',
  'field',
  'group',
  'href',
  'id',
  'key',
  'kind',
  'method',
  'mode',
  'pattern',
  'resource',
  'route',
  'scope',
  'source',
  'status',
  'systemPrompt',
  'to',
  'toolName',
  'type',
  'unit',
  'url',
  'value',
  'variant',
]);

const structuralJsxAttributes = new Set([
  'accept',
  'action',
  'align',
  'allow',
  'aria-controls',
  'aria-current',
  'aria-disabled',
  'aria-expanded',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-selected',
  'asChild',
  'autoComplete',
  'checked',
  'className',
  'clipRule',
  'color',
  'column',
  'containerClassName',
  'cx',
  'cy',
  'd',
  'data-side',
  'data-slot',
  'data-state',
  'data-test-id',
  'data-testid',
  'dateFormat',
  'defaultChecked',
  'defaultValue',
  'dir',
  'disabled',
  'entityType',
  'field',
  'fill',
  'fillRule',
  'filterRight',
  'format',
  'height',
  'href',
  'htmlFor',
  'id',
  'inputMode',
  'key',
  'lang',
  'locale',
  'method',
  'mode',
  'multiple',
  'name',
  'order',
  'pattern',
  'priority',
  'rel',
  'role',
  'rx',
  'ry',
  'scope',
  'side',
  'sideOffset',
  'size',
  'showHint',
  'showTooltip',
  'sort',
  'src',
  'status',
  'stroke',
  'strokeWidth',
  'style',
  'table',
  'target',
  'timeFormat',
  'to',
  'transform',
  'type',
  'value',
  'variant',
  'viewBox',
  'visibility',
  'width',
  'xmlns',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
]);

const userVisibleCallees = new Set([
  'alert',
  'confirm',
  'prompt',
  'sonner.toast',
  'toast',
  'toast.error',
  'toast.info',
  'toast.message',
  'toast.success',
  'toast.warning',
]);

const translationCalleeNames = new Set([
  'getLocalizedText',
  't',
  'tArray',
  'translate',
  'translateText',
]);

const enGenerated: TranslationTree = structuredClone(existingEnGeneratedTranslations);
const deGenerated: TranslationTree = structuredClone(existingDeGeneratedTranslations);
const replacementsByFile = new Map<string, Replacement[]>();
const filesNeedingTranslateImport = new Set<string>();
const generatedKeyByText = new Map<string, string>();
let generatedTextCount = 0;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walk(entryPath, files);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;
    const relativePath = path.relative(root, entryPath);
    if (skipPathParts.some(part => entryPath.includes(part))) continue;
    if (skipFilePatterns.some(pattern => pattern.test(relativePath))) continue;
    files.push(entryPath);
  }
  return files;
}

function nameText(node: ts.Node | undefined): string {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${nameText(node.expression)}.${node.name.text}`;
  if (ts.isJsxNamespacedName(node)) return `${node.namespace.text}:${node.name.text}`;
  return node.getText();
}

function isTranslationCallee(callee: string): boolean {
  const lastSegment = callee.split('.').at(-1) ?? callee;
  return translationCalleeNames.has(callee) || translationCalleeNames.has(lastSegment);
}

function isHumanText(
  value: string,
  options: { allowAcronym?: boolean; allowPlainLowercase?: boolean } = {}
): boolean {
  const text = normalizeText(value);
  if (text.length < 2) return false;
  if (/^&(?:quot|apos|amp|lt|gt|nbsp);$/.test(text)) return false;
  if (/^[a-z]{2}-[A-Z]{2}$/.test(text)) return false;
  if (!/[A-Za-zÄÖÜäöüß]/.test(text)) return false;
  if (/^[A-Za-z0-9_.:/?#&=%{}[\]@+,-]+$/.test(text) && !/\s/.test(text)) {
    if (options.allowPlainLowercase && /^[a-z]+$/.test(text)) return true;
    if (options.allowAcronym && /^[A-Z]{2,}$/.test(text)) return true;
    return false;
  }
  if (!options.allowPlainLowercase && /^[-_a-z0-9]+$/.test(text) && !/[A-Z]/.test(text)) {
    return false;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^https?:\/\//.test(text)) return false;
  if (/^\/[a-z0-9_.$/*:-]*$/i.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false;
  if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(text)) return false;
  return true;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeJsxText(value: string): string {
  return normalizeText(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getNestedValue(obj: unknown, key: string): unknown {
  let current = obj;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: TranslationTree, key: string, value: string) {
  const parts = key.split('.');
  let current = obj;

  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as TranslationTree;
  }

  const leafKey = parts[parts.length - 1];
  if (!leafKey) return;
  current[leafKey] = value;
}

function addGeneratedTranslation(key: string, english: string, german = english) {
  setNestedValue(enGenerated, key, english);
  setNestedValue(deGenerated, key, german);
}

function humanizeKey(key: string): string {
  const last = key.split('.').at(-1) ?? key;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45);
  return slug || 'text';
}

function hash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function generatedKeyForText(text: string): string {
  const normalized = decodeJsxText(text);
  const existing = generatedKeyByText.get(normalized);
  if (existing) return existing;

  generatedTextCount += 1;
  const key = `generated.inline.${String(generatedTextCount).padStart(4, '0')}_${slugify(
    normalized
  )}_${hash(normalized)}`;
  generatedKeyByText.set(normalized, key);
  addGeneratedTranslation(key, normalized);
  return key;
}

function addReplacement(file: string, replacement: Replacement) {
  const replacements = replacementsByFile.get(file) ?? [];
  replacements.push(replacement);
  replacementsByFile.set(file, replacements);
}

function jsxAttributeName(node: ts.Node): string {
  const parent = node.parent;
  if (ts.isJsxAttribute(parent) && parent.initializer === node) return nameText(parent.name);
  if (
    ts.isJsxExpression(parent) &&
    parent.expression === node &&
    ts.isJsxAttribute(parent.parent)
  ) {
    return nameText(parent.parent.name);
  }
  return '';
}

function objectPropertyName(node: ts.Node): string {
  const parent = node.parent;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) return nameText(parent.name);
  return '';
}

function isLikelyVisibleAttributeName(name: string): boolean {
  if (structuralJsxAttributes.has(name)) return false;
  return (
    visibleJsxAttributes.has(name) ||
    /(Label|Title|Description|Message|Text|Tooltip|Hint|Caption|Heading|Fallback)$/.test(name)
  );
}

function isLikelyVisibleObjectPropertyName(name: string): boolean {
  if (structuralObjectProperties.has(name)) return false;
  return visibleObjectProperties.has(name);
}

function isLikelyVisibleBindingName(name: string): boolean {
  if (/^[A-Z]/.test(name) || /^(show|hide|enable|disable|is|has|can|should)[A-Z]/.test(name)) {
    return false;
  }

  return (
    visibleObjectProperties.has(name) ||
    visibleJsxAttributes.has(name) ||
    /(Label|Title|Description|Message|Text|Tooltip|Hint|Caption|Heading|Fallback|Placeholder)$/.test(
      name
    )
  );
}

function isTechnicalCatalogLiteral(node: ts.Node): boolean {
  const rel = path.relative(root, node.getSourceFile().fileName).replaceAll(path.sep, '/');
  return (
    rel === 'src/features/shared/ui/ui-platejs/code-block-node.tsx' ||
    rel === 'src/features/shared/ui/ui-platejs/table-icons.tsx'
  );
}

function hasStructuralValueShape(value: string): boolean {
  const text = normalizeText(value);
  return (
    /^([a-z]+\/[a-z0-9.+-]+|[a-z]+:[a-z0-9.+-]+)$/i.test(text) ||
    /^([A-Za-z0-9]+[-_/.])*[A-Za-z0-9]+$/.test(text) ||
    /^[A-Z0-9_]+$/.test(text) ||
    /^https?:\/\//.test(text) ||
    /^\/[a-z0-9_.$/*:-]*$/i.test(text)
  );
}

function enclosingJsxAttributeName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isJsxAttribute(current)) return nameText(current.name);
    if (ts.isJsxExpression(current)) {
      return ts.isJsxAttribute(current.parent) ? nameText(current.parent.name) : null;
    }
    if (ts.isStatement(current) || ts.isSourceFile(current)) return null;
    current = current.parent;
  }

  return null;
}

function enclosingJsxExpression(node: ts.Node): ts.JsxExpression | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isJsxExpression(current)) return current;
    if (ts.isStatement(current) || ts.isSourceFile(current)) return null;
    current = current.parent;
  }

  return null;
}

function enclosingVisibleInitializerName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (
      ts.isBindingElement(current) &&
      current.initializer &&
      node.getStart(node.getSourceFile()) >= current.initializer.getStart(node.getSourceFile()) &&
      node.end <= current.initializer.end
    ) {
      const name = nameText(current.propertyName ?? current.name);
      return isLikelyVisibleBindingName(name) ? name : null;
    }

    if (
      ts.isVariableDeclaration(current) &&
      current.initializer &&
      node.getStart(node.getSourceFile()) >= current.initializer.getStart(node.getSourceFile()) &&
      node.end <= current.initializer.end &&
      ts.isIdentifier(current.name)
    ) {
      const name = current.name.text;
      return isLikelyVisibleBindingName(name) ? name : null;
    }

    if (
      ts.isPropertyDeclaration(current) &&
      current.initializer &&
      node.getStart(node.getSourceFile()) >= current.initializer.getStart(node.getSourceFile())
    ) {
      const name = nameText(current.name);
      return isLikelyVisibleBindingName(name) ? name : null;
    }

    if (ts.isStatement(current) || ts.isSourceFile(current)) return null;
    current = current.parent;
  }

  return null;
}

function isRenderedJsxExpressionLiteral(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral
): boolean {
  if (!enclosingJsxExpression(node)) return false;
  if (enclosingJsxAttributeName(node) !== null) return false;

  const parent = node.parent;
  if (ts.isConditionalExpression(parent)) {
    return parent.whenTrue === node || parent.whenFalse === node;
  }

  if (ts.isParenthesizedExpression(parent)) return true;

  if (ts.isBinaryExpression(parent)) {
    return [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.PlusToken,
      ts.SyntaxKind.QuestionQuestionToken,
    ].includes(parent.operatorToken.kind);
  }

  return false;
}

function isRenderedJsxExpressionTemplate(node: ts.TemplateExpression): boolean {
  if (!enclosingJsxExpression(node)) return false;
  if (enclosingJsxAttributeName(node) !== null) return false;

  const parent = node.parent;
  if (ts.isConditionalExpression(parent)) {
    return parent.whenTrue === node || parent.whenFalse === node;
  }

  if (ts.isParenthesizedExpression(parent)) return true;

  if (ts.isBinaryExpression(parent)) {
    return [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.PlusToken,
      ts.SyntaxKind.QuestionQuestionToken,
    ].includes(parent.operatorToken.kind);
  }

  return false;
}

function isStructuralLiteral(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const parent = node.parent;
  const attrName = jsxAttributeName(node);
  const propName = objectPropertyName(node);
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isTypeReferenceNode(parent)) return true;
  if (isTechnicalCatalogLiteral(node)) return true;
  if (attrName && structuralJsxAttributes.has(attrName) && !visibleJsxAttributes.has(attrName)) {
    return true;
  }
  if (
    propName &&
    structuralObjectProperties.has(propName) &&
    !visibleObjectProperties.has(propName)
  ) {
    return true;
  }
  if (
    propName &&
    !isLikelyVisibleObjectPropertyName(propName) &&
    hasStructuralValueShape(node.text)
  )
    return true;
  return false;
}

function getTranslationKeyFromFirstArg(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function interpolationName(expression: ts.Expression): string {
  const text = expression.getText();
  const match = text.match(/(?:^|\.)\s*([A-Za-z_$][\w$]*)$/);
  return match?.[1] ?? `value${hash(text).slice(0, 4)}`;
}

function translationTemplateForTemplateExpression(node: ts.TemplateExpression) {
  const params: { name: string; expression: string }[] = [];
  const text = `${node.head.text}${node.templateSpans
    .map(span => {
      const name = interpolationName(span.expression);
      params.push({ name, expression: span.expression.getText(node.getSourceFile()) });
      return `{{${name}}}${span.literal.text}`;
    })
    .join('')}`;

  return { text: normalizeText(text), params };
}

function templateExpressionStaticText(node: ts.TemplateExpression): string {
  return normalizeText(
    `${node.head.text}${node.templateSpans.map(span => span.literal.text).join('')}`
  );
}

function translateCallForText(text: string): string {
  return `translateText('${generatedKeyForText(text)}')`;
}

function translateCallForTemplate(node: ts.TemplateExpression): string {
  const template = translationTemplateForTemplateExpression(node);
  const key = generatedKeyForText(template.text);
  const params = template.params
    .map(param => `${JSON.stringify(param.name)}: ${param.expression}`)
    .join(', ');
  return `translateText('${key}', { ${params} })`;
}

function translationCallWithoutFallback(
  sourceFile: ts.SourceFile,
  node: ts.CallExpression
): string | null {
  let removedFallback = false;
  const keptArgs = node.arguments.filter((arg, index) => {
    if (index === 0) return true;
    if (
      (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
      isHumanText(arg.text)
    ) {
      removedFallback = true;
      return false;
    }
    return true;
  });

  if (!removedFallback) return null;
  return `${node.expression.getText(sourceFile)}(${keptArgs.map(arg => arg.getText(sourceFile)).join(', ')})`;
}

function scanFile(file: string) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = decodeJsxText(node.getText());
      if (isHumanText(text, { allowAcronym: true, allowPlainLowercase: true })) {
        const key = generatedKeyForText(text);
        addReplacement(file, {
          start: node.pos,
          end: node.end,
          text: `{translateText('${key}')}`,
        });
        filesNeedingTranslateImport.add(file);
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = nameText(node.expression);
      const key = getTranslationKeyFromFirstArg(node.arguments[0]);

      if (isTranslationCallee(callee) && key) {
        let fallback: string | undefined;
        for (const arg of node.arguments.slice(1)) {
          if (
            (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
            isHumanText(arg.text)
          ) {
            fallback = arg.text;
            break;
          }
        }

        if (getNestedValue(enTranslation, key) === undefined) {
          addGeneratedTranslation(key, fallback ?? humanizeKey(key));
        }
        if (getNestedValue(deTranslation, key) === undefined) {
          setNestedValue(deGenerated, key, fallback ?? humanizeKey(key));
        }

        const nextCall = translationCallWithoutFallback(sourceFile, node);
        if (nextCall) {
          addReplacement(file, { start: node.getStart(sourceFile), end: node.end, text: nextCall });
        }
      }

      if (userVisibleCallees.has(callee)) {
        const firstArg = node.arguments[0];
        if (
          firstArg &&
          (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) &&
          isHumanText(firstArg.text)
        ) {
          const key = generatedKeyForText(firstArg.text);
          addReplacement(file, {
            start: firstArg.getStart(sourceFile),
            end: firstArg.end,
            text: `translateText('${key}')`,
          });
          filesNeedingTranslateImport.add(file);
        }
      }
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isHumanText(node.text, { allowAcronym: true, allowPlainLowercase: true }) &&
      !isStructuralLiteral(node)
    ) {
      const attrName = jsxAttributeName(node);
      const propName = objectPropertyName(node);
      const visibleInitializerName = enclosingVisibleInitializerName(node);
      if (attrName && isLikelyVisibleAttributeName(attrName)) {
        const key = generatedKeyForText(node.text);
        addReplacement(file, {
          start: node.getStart(sourceFile),
          end: node.end,
          text: `{translateText('${key}')}`,
        });
        filesNeedingTranslateImport.add(file);
      } else if (propName && isLikelyVisibleObjectPropertyName(propName)) {
        addReplacement(file, {
          start: node.getStart(sourceFile),
          end: node.end,
          text: translateCallForText(node.text),
        });
        filesNeedingTranslateImport.add(file);
      } else if (visibleInitializerName) {
        addReplacement(file, {
          start: node.getStart(sourceFile),
          end: node.end,
          text: translateCallForText(node.text),
        });
        filesNeedingTranslateImport.add(file);
      } else if (isRenderedJsxExpressionLiteral(node)) {
        const key = generatedKeyForText(node.text);
        addReplacement(file, {
          start: node.getStart(sourceFile),
          end: node.end,
          text: `translateText('${key}')`,
        });
        filesNeedingTranslateImport.add(file);
      }
    }

    if (ts.isTemplateExpression(node)) {
      const propName = ts.isPropertyAssignment(node.parent) ? nameText(node.parent.name) : '';
      const staticText = templateExpressionStaticText(node);
      const visibleInitializerName = enclosingVisibleInitializerName(node);
      const isVisibleTemplate =
        (propName && isLikelyVisibleObjectPropertyName(propName)) ||
        Boolean(visibleInitializerName) ||
        isRenderedJsxExpressionTemplate(node);

      if (
        isVisibleTemplate &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        addReplacement(file, {
          start: node.getStart(sourceFile),
          end: node.end,
          text: translateCallForTemplate(node),
        });
        filesNeedingTranslateImport.add(file);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function applyReplacements(source: string, replacements: Replacement[]): string {
  const nonOverlapping: Replacement[] = [];
  const ascending = replacements
    .slice()
    .sort((left, right) => left.start - right.start || right.end - left.end);
  let coveredUntil = -1;

  for (const replacement of ascending) {
    if (replacement.start < coveredUntil) continue;
    nonOverlapping.push(replacement);
    coveredUntil = replacement.end;
  }

  const sorted = nonOverlapping.sort(
    (left, right) => right.start - left.start || right.end - left.end
  );
  let nextSource = source;

  for (const replacement of sorted) {
    nextSource =
      nextSource.slice(0, replacement.start) + replacement.text + nextSource.slice(replacement.end);
  }

  return nextSource;
}

function ensureTranslateImport(source: string): string {
  const importPattern =
    /import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]@\/features\/shared\/hooks\/use-translation(?:\.ts)?['"];?/m;
  const existingImport = source.match(importPattern);

  if (existingImport) {
    const namedImports = existingImport[1];
    if (/\btranslate\s+as\s+translateText\b/.test(namedImports)) return source;
    const nextImport = existingImport[0].replace(
      `{${namedImports}}`,
      `{${namedImports.trim()}, translate as translateText}`
    );
    return source.replace(existingImport[0], nextImport);
  }

  const importLine =
    "import { translate as translateText } from '@/features/shared/hooks/use-translation';\n";
  const importMatches = [...source.matchAll(/^import[\s\S]*?;$/gm)];
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    if (lastImport) {
      const insertAt = (lastImport.index ?? 0) + lastImport[0].length;
      return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
    }
  }

  const directiveMatch = source.match(/^(['"]use client['"];?\s*)/);
  if (directiveMatch) {
    const insertAt = directiveMatch[0].length;
    return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  }

  return `${importLine}${source}`;
}

function sortTree(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const sorted: TranslationTree = {};
  for (const key of Object.keys(value as TranslationTree).sort()) {
    sorted[key] = sortTree((value as TranslationTree)[key]);
  }
  return sorted;
}

function writeGeneratedLocale(locale: 'en' | 'de', tree: TranslationTree) {
  const file = path.join(root, 'src', 'i18n', 'locales', locale, 'generated.ts');
  const sortedTree = sortTree(tree) as TranslationTree;
  const generated = (sortedTree.generated ?? {}) as TranslationTree;
  const inline = (generated.inline ?? {}) as TranslationTree;
  const treeWithoutInline = structuredClone(sortedTree);

  if (
    treeWithoutInline.generated &&
    typeof treeWithoutInline.generated === 'object' &&
    !Array.isArray(treeWithoutInline.generated)
  ) {
    delete (treeWithoutInline.generated as TranslationTree).inline;
  }

  const content = `const generatedInlineTranslations: Record<string, string> = ${JSON.stringify(
    sortTree(inline),
    null,
    2
  )};

export const generatedTranslations = {
  ...${JSON.stringify(sortTree(treeWithoutInline), null, 2)},
  generated: {
    ...${JSON.stringify(sortTree((treeWithoutInline.generated ?? {}) as TranslationTree), null, 2)},
    inline: generatedInlineTranslations,
  },
} as const;
`;
  fs.writeFileSync(file, content);
}

for (const file of walk(sourceRoot)) {
  scanFile(file);
}

for (const [file, replacements] of replacementsByFile.entries()) {
  let source = fs.readFileSync(file, 'utf8');
  source = applyReplacements(source, replacements);
  if (filesNeedingTranslateImport.has(file)) {
    source = ensureTranslateImport(source);
  }
  fs.writeFileSync(file, source);
}

writeGeneratedLocale('en', enGenerated);
writeGeneratedLocale('de', deGenerated);

console.log(
  JSON.stringify(
    {
      changedFiles: replacementsByFile.size,
      filesWithTranslateImport: filesNeedingTranslateImport.size,
      generatedInlineKeys: generatedKeyByText.size,
    },
    null,
    2
  )
);
