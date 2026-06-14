import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import deTranslation from '../src/i18n/locales/de/deTranslation.ts';
import enTranslation from '../src/i18n/locales/en/enTranslation.ts';

type FindingKind =
  | 'direct-jsx-text'
  | 'direct-jsx-attribute'
  | 'direct-jsx-expression'
  | 'direct-visible-helper-return'
  | 'direct-visible-initializer'
  | 'direct-visible-object-property'
  | 'direct-toast'
  | 'missing-translation-helper-import'
  | 'translation-fallback'
  | 'missing-key';

interface Finding {
  file: string;
  loc: string;
  kind: FindingKind;
  text?: string;
  key?: string;
  detail?: string;
}

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
  'content',
  'description',
  'emptyLabel',
  'emptyMessage',
  'emptyTitle',
  'errorMessage',
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
  'fillRule',
  'filterRight',
  'entityType',
  'field',
  'fill',
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

function relative(file: string): string {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function lineCol(sourceFile: ts.SourceFile, position: number): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
  return `${line + 1}:${character + 1}`;
}

function nameText(node: ts.Node | undefined): string {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${nameText(node.expression)}.${node.name.text}`;
  if (ts.isJsxNamespacedName(node)) return `${node.namespace.text}:${node.name.text}`;
  return node.getText();
}

function getNestedValue(obj: unknown, key: string): unknown {
  let current = obj;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isTranslationCallee(callee: string): boolean {
  const lastSegment = callee.split('.').at(-1) ?? callee;
  return translationCalleeNames.has(callee) || translationCalleeNames.has(lastSegment);
}

function isHumanText(
  value: string,
  options: { allowAcronym?: boolean; allowPlainLowercase?: boolean } = {}
): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
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

function literalText(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.JsxText
): string {
  const text = ts.isJsxText(node) ? node.getText() : node.text;
  return text.replace(/\s+/g, ' ').trim();
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

function isLikelyVisibleHelperName(name: string): boolean {
  if (!name) return false;
  if (/(ClassName|ClassNames|Classes|Style|Styles|Color|Colors|Icon|Variant)$/.test(name)) {
    return false;
  }
  return /(Label|Title|Tooltip|Message|Text|Description|Placeholder)$/.test(name);
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
  const rel = relative(node.getSourceFile().fileName);
  return (
    rel === 'src/features/shared/ui/ui-platejs/code-block-node.tsx' ||
    rel === 'src/features/shared/ui/ui-platejs/table-icons.tsx'
  );
}

function hasStructuralValueShape(value: string): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
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

function enclosingVisibleJsxAttributeName(node: ts.Node): string | null {
  const attrName = enclosingJsxAttributeName(node);
  return attrName && isLikelyVisibleAttributeName(attrName) ? attrName : null;
}

function enclosingVisibleObjectPropertyName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (
      ts.isPropertyAssignment(current) &&
      current.initializer &&
      node.getStart(node.getSourceFile()) >= current.initializer.getStart(node.getSourceFile()) &&
      node.end <= current.initializer.end
    ) {
      const name = nameText(current.name);
      return isLikelyVisibleObjectPropertyName(name) ? name : null;
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

function isWithinNode(node: ts.Node, container: ts.Node | undefined): boolean {
  if (!container) return false;
  const sourceFile = node.getSourceFile();
  return node.getStart(sourceFile) >= container.getStart(sourceFile) && node.end <= container.end;
}

function isReturnValueLiteral(node: ts.Node): boolean {
  let current: ts.Node = node;

  while (current.parent) {
    const parent = current.parent;

    if (ts.isReturnStatement(parent)) {
      return isWithinNode(node, parent.expression);
    }

    if (ts.isConditionalExpression(parent)) {
      if (isWithinNode(node, parent.condition)) return false;
      if (isWithinNode(node, parent.whenTrue) || isWithinNode(node, parent.whenFalse)) {
        current = parent;
        continue;
      }
      return false;
    }

    if (ts.isBinaryExpression(parent)) {
      if (
        ![
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(parent.operatorToken.kind)
      ) {
        return false;
      }
      current = parent;
      continue;
    }

    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isTemplateExpression(parent) ||
      ts.isTemplateSpan(parent)
    ) {
      current = parent;
      continue;
    }

    return false;
  }

  return false;
}

function enclosingVisibleHelperName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      const name = current.name.text;
      return isLikelyVisibleHelperName(name) ? name : null;
    }

    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      const name = current.parent.name.text;
      return isLikelyVisibleHelperName(name) ? name : null;
    }

    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      ts.isPropertyAssignment(current.parent)
    ) {
      const name = nameText(current.parent.name);
      return isLikelyVisibleHelperName(name) ? name : null;
    }

    if (ts.isMethodDeclaration(current)) {
      const name = nameText(current.name);
      return isLikelyVisibleHelperName(name) ? name : null;
    }

    if (ts.isSourceFile(current)) return null;
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

function templateExpressionText(node: ts.TemplateExpression): string {
  return `${node.head.text}${node.templateSpans
    .map(span => `{{${span.expression.getText(node.getSourceFile())}}}${span.literal.text}`)
    .join('')}`;
}

function templateExpressionStaticText(node: ts.TemplateExpression): string {
  return `${node.head.text}${node.templateSpans.map(span => span.literal.text).join('')}`;
}

function scanFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const rel = relative(file);

  function add(node: ts.Node, finding: Omit<Finding, 'file' | 'loc'>) {
    findings.push({ file: rel, loc: lineCol(sourceFile, node.getStart(sourceFile)), ...finding });
  }

  if (
    /\btranslateText\s*\(/.test(source) &&
    !/translate\s+as\s+translateText/.test(source) &&
    !/\b(const|function)\s+translateText\b|\btranslateText\s*=/.test(source)
  ) {
    findings.push({
      file: rel,
      loc: '1:1',
      kind: 'missing-translation-helper-import',
      detail: 'translateText is used but translate as translateText is not imported or defined',
    });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = literalText(node);
      if (isHumanText(text, { allowAcronym: true, allowPlainLowercase: true }))
        add(node, { kind: 'direct-jsx-text', text });
    }

    if (ts.isCallExpression(node)) {
      const callee = nameText(node.expression);
      const key = getTranslationKeyFromFirstArg(node.arguments[0]);

      if (isTranslationCallee(callee) && key) {
        const missingEn = getNestedValue(enTranslation, key) === undefined;
        const missingDe = getNestedValue(deTranslation, key) === undefined;
        if (missingEn || missingDe) {
          add(node, {
            kind: 'missing-key',
            key,
            detail: [missingEn ? 'en' : null, missingDe ? 'de' : null].filter(Boolean).join(', '),
          });
        }

        for (const fallbackArg of node.arguments.slice(1)) {
          if (
            (ts.isStringLiteral(fallbackArg) || ts.isNoSubstitutionTemplateLiteral(fallbackArg)) &&
            isHumanText(fallbackArg.text)
          ) {
            add(fallbackArg, { kind: 'translation-fallback', key, text: fallbackArg.text });
          }
        }
      }

      if (userVisibleCallees.has(callee)) {
        const firstArg = node.arguments[0];
        if (
          firstArg &&
          (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) &&
          isHumanText(firstArg.text)
        ) {
          add(firstArg, { kind: 'direct-toast', text: firstArg.text });
        }
      }
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isHumanText(node.text, { allowAcronym: true, allowPlainLowercase: true }) &&
      !isStructuralLiteral(node)
    ) {
      const attrName = jsxAttributeName(node);
      const visibleAttrName = enclosingVisibleJsxAttributeName(node);
      const propName = objectPropertyName(node);
      const visiblePropName = enclosingVisibleObjectPropertyName(node);
      const visibleInitializerName = enclosingVisibleInitializerName(node);
      const visibleHelperName = isReturnValueLiteral(node)
        ? enclosingVisibleHelperName(node)
        : null;
      if (attrName && isLikelyVisibleAttributeName(attrName)) {
        add(node, { kind: 'direct-jsx-attribute', text: node.text });
      } else if (visibleAttrName) {
        add(node, { kind: 'direct-jsx-attribute', text: node.text, detail: visibleAttrName });
      } else if (propName && isLikelyVisibleObjectPropertyName(propName)) {
        add(node, { kind: 'direct-visible-object-property', text: node.text, detail: propName });
      } else if (visiblePropName) {
        add(node, {
          kind: 'direct-visible-object-property',
          text: node.text,
          detail: visiblePropName,
        });
      } else if (visibleInitializerName) {
        add(node, {
          kind: 'direct-visible-initializer',
          text: node.text,
          detail: visibleInitializerName,
        });
      } else if (visibleHelperName) {
        add(node, {
          kind: 'direct-visible-helper-return',
          text: node.text,
          detail: visibleHelperName,
        });
      } else if (isRenderedJsxExpressionLiteral(node)) {
        add(node, { kind: 'direct-jsx-expression', text: node.text });
      }
    }

    if (ts.isTemplateExpression(node) && ts.isPropertyAssignment(node.parent)) {
      const propName = nameText(node.parent.name);
      const text = templateExpressionText(node);
      const staticText = templateExpressionStaticText(node);
      if (
        isLikelyVisibleObjectPropertyName(propName) &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, { kind: 'direct-visible-object-property', text, detail: propName });
      }
    }

    if (ts.isTemplateExpression(node) && !ts.isPropertyAssignment(node.parent)) {
      const text = templateExpressionText(node);
      const staticText = templateExpressionStaticText(node);
      const visibleAttrName = enclosingVisibleJsxAttributeName(node);
      const visiblePropName = enclosingVisibleObjectPropertyName(node);
      const visibleInitializerName = enclosingVisibleInitializerName(node);
      const visibleHelperName = isReturnValueLiteral(node)
        ? enclosingVisibleHelperName(node)
        : null;

      if (
        visibleAttrName &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, { kind: 'direct-jsx-attribute', text, detail: visibleAttrName });
      } else if (
        visiblePropName &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, {
          kind: 'direct-visible-object-property',
          text,
          detail: visiblePropName,
        });
      } else if (
        visibleInitializerName &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, {
          kind: 'direct-visible-initializer',
          text,
          detail: visibleInitializerName,
        });
      } else if (
        visibleHelperName &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, {
          kind: 'direct-visible-helper-return',
          text,
          detail: visibleHelperName,
        });
      } else if (
        isRenderedJsxExpressionTemplate(node) &&
        isHumanText(staticText, { allowAcronym: true, allowPlainLowercase: true })
      ) {
        add(node, { kind: 'direct-jsx-expression', text });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

const findings = walk(sourceRoot).flatMap(scanFile);
const byKind = findings.reduce<Record<string, number>>((acc, finding) => {
  acc[finding.kind] = (acc[finding.kind] ?? 0) + 1;
  return acc;
}, {});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: findings.length, byKind, findings }, null, 2));
} else if (findings.length > 0) {
  console.error(`Localization audit failed with ${findings.length} finding(s).`);
  console.error(JSON.stringify({ byKind, examples: findings.slice(0, 50) }, null, 2));
} else {
  console.log('Localization audit passed.');
}

process.exitCode = findings.length > 0 ? 1 : 0;
