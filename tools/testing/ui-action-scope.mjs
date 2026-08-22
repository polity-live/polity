import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

import { classifyRepositoryFile, findTestReferences } from './coverage-scope.mjs';
import { scenariosCovered } from './accountability-scope.mjs';

const NATIVE_ACTIONS = new Set(['a', 'button', 'input', 'select', 'textarea']);
const INTERACTIVE_COMPONENT =
  /(?:Action|AccordionTrigger|AlertDialogTrigger|Button|Checkbox|CollapsibleTrigger|CommandItem|ContextMenuCheckboxItem|ContextMenuItem|ContextMenuRadioItem|ContextMenuSubTrigger|ContextMenuTrigger|DialogTrigger|DocsSearchTrigger|DropdownMenuCheckboxItem|DropdownMenuItem|DropdownMenuRadioItem|DropdownMenuSubTrigger|DropdownMenuTrigger|FileUploadTrigger|HoverCardTrigger|Link|MenubarCheckboxItem|MenubarItem|MenubarRadioItem|MenubarSubTrigger|MenubarTrigger|MenuItem|NavigationMenuLink|NavigationMenuTrigger|Option|Picker|PopoverTrigger|RadioGroupItem|Select|SelectItem|SelectTrigger|SettingItem|Switch|TabsTrigger|ToggleGroupItem|ToolbarToggleItem)$/;
const INTERACTIVE_QUALIFIED_COMPONENT =
  /(?:AccordionPrimitive\.Trigger|AlertDialogPrimitive\.Trigger|CommandPrimitive\.Item|ContextMenuPrimitive\.(?:CheckboxItem|Item|RadioItem|SubTrigger|Trigger)|DialogPrimitive\.Trigger|DropdownMenuPrimitive\.(?:CheckboxItem|Item|RadioItem|SubTrigger|Trigger)|MenubarPrimitive\.(?:CheckboxItem|Item|RadioItem|SubTrigger|Trigger)|NavigationMenuPrimitive\.Trigger|Popover(?:Primitive)?\.Trigger|RadioGroupPrimitive\.Item|SelectPrimitive\.(?:Item|Trigger)|TabsPrimitive\.Trigger|ToggleGroupPrimitive\.Item|ToolbarPrimitive\.ToggleItem)$/;
const TRANSPARENT_COMPONENTS = new Set(['TooltipTrigger', 'Slot']);
const NON_ACTION_SURFACES = new Set([
  'CarouselFormLayoutView',
  'DecisionVoteButton',
  'ExternalLink',
  'GeoAddressPicker',
  'GroupRelationshipTypeSelect',
  'NavigationAmendmentCommandItem',
  'NavigationCommandItem',
  'NavigationEventCommandItem',
  'NavigationGroupCommandItem',
  'OnePageFormLayoutView',
  'StreetAreaPicker',
  'TodoArchiveAction',
  'ChatComposer',
  'Layout',
  'UserProfileEditForm',
]);
const INTERACTION_ATTRIBUTES = new Set([
  'onCheckedChange',
  'onClick',
  'onKeyDown',
  'onSelect',
  'onSubmit',
  'onValueChange',
]);
const ACTION_OWNER_ATTRIBUTES = new Set(['onClick', 'onSubmit']);
const EXACT_INTERACTIVE_COMPONENTS = new Set(['Tab', 'Toggle']);

function jsxName(node) {
  if (!node) return '';
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${jsxName(node.object)}.${jsxName(node.property)}`;
  }
  return '';
}

function findAttribute(attributes, name) {
  return attributes.find(
    candidate => candidate.type === 'JSXAttribute' && jsxName(candidate.name) === name
  );
}

function literalAttribute(attributes, name) {
  const attribute = findAttribute(attributes, name);
  if (!attribute?.value) return undefined;
  if (attribute.value.type === 'StringLiteral') return attribute.value.value;
  if (
    attribute.value.type === 'JSXExpressionContainer' &&
    ['StringLiteral', 'NumericLiteral'].includes(attribute.value.expression.type)
  ) {
    return String(attribute.value.expression.value);
  }
  return undefined;
}

function identifierAttribute(attributes, name) {
  const attribute = findAttribute(attributes, name);
  if (
    attribute?.value?.type === 'JSXExpressionContainer' &&
    attribute.value.expression.type === 'Identifier'
  ) {
    return attribute.value.expression.name;
  }
  return undefined;
}

function hasAttribute(attributes, name) {
  return Boolean(findAttribute(attributes, name));
}

function attributeNames(attributes) {
  return new Set(
    attributes
      .filter(attribute => attribute.type === 'JSXAttribute')
      .map(attribute => jsxName(attribute.name))
  );
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

const VOLATILE_AST_KEYS = new Set([
  'column',
  'comments',
  'end',
  'extra',
  'innerComments',
  'leadingComments',
  'loc',
  'start',
  'trailingComments',
]);

function canonicalAstValue(value) {
  if (Array.isArray(value)) return value.map(canonicalAstValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter(key => !VOLATILE_AST_KEYS.has(key))
      .sort()
      .map(key => [key, canonicalAstValue(value[key])])
  );
}

function staticChildText(children) {
  const values = [];
  for (const child of children ?? []) {
    if (child.type === 'JSXText') {
      const text = child.value.replace(/\s+/g, ' ').trim();
      if (text) values.push(text);
    } else if (child.type === 'JSXExpressionContainer') {
      if (child.expression.type === 'StringLiteral') values.push(child.expression.value);
      if (
        child.expression.type === 'CallExpression' &&
        child.expression.callee.type === 'Identifier' &&
        ['t', 'translate'].includes(child.expression.callee.name) &&
        child.expression.arguments[0]?.type === 'StringLiteral'
      ) {
        values.push(child.expression.arguments[0].value);
      }
    } else if (child.type === 'JSXElement') {
      const nested = staticChildText(child.children);
      if (nested) values.push(nested);
    }
  }
  return values.join(' ').trim() || undefined;
}

function memberName(node) {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    return memberName(node.property) ?? memberName(node.object);
  }
  if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
    return memberName(node.callee);
  }
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return memberName(node.body);
  }
  if (node.type === 'BlockStatement') {
    const call = node.body.find(statement => statement.type === 'ExpressionStatement');
    return memberName(call?.expression);
  }
  return undefined;
}

function isPropagationOnlyAttribute(attribute) {
  if (
    attribute.type !== 'JSXAttribute' ||
    !ACTION_OWNER_ATTRIBUTES.has(jsxName(attribute.name)) ||
    attribute.value?.type !== 'JSXExpressionContainer'
  ) {
    return false;
  }

  const propagationOnly = expression => {
    if (!expression) return false;
    if (expression.type === 'ArrowFunctionExpression' || expression.type === 'FunctionExpression') {
      return propagationOnly(expression.body);
    }
    if (expression.type === 'BlockStatement') {
      return (
        expression.body.length > 0 &&
        expression.body.every(
          statement =>
            statement.type === 'ExpressionStatement' && propagationOnly(statement.expression)
        )
      );
    }
    if (expression.type === 'CallExpression' || expression.type === 'OptionalCallExpression') {
      return ['preventDefault', 'stopPropagation'].includes(memberName(expression.callee));
    }
    return (
      expression.type === 'Identifier' &&
      ['preventDefault', 'stopPropagation'].includes(expression.name)
    );
  };

  return propagationOnly(attribute.value.expression);
}

function handlerSemantic(attributes) {
  for (const attribute of attributes) {
    if (
      attribute.type !== 'JSXAttribute' ||
      !INTERACTION_ATTRIBUTES.has(jsxName(attribute.name)) ||
      attribute.value?.type !== 'JSXExpressionContainer'
    ) {
      continue;
    }
    const name = memberName(attribute.value.expression);
    if (name && !['preventDefault', 'stopPropagation', 'undefined'].includes(name)) return name;
  }
  return undefined;
}

function slug(value, fallback = 'action') {
  const result = String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-{2,}/g, '-');
  return result || fallback;
}

function actionPrefix(file) {
  const parts = file.split('/');
  const domain =
    parts[0] === 'src' && parts[1] === 'features'
      ? slug(parts[2], 'root')
      : parts[0] === 'src' && parts[1] === 'routes'
        ? 'routes'
        : slug(parts[1] ?? parts[0], 'root');
  const surface = slug(
    path.posix
      .basename(file)
      .replace(/\.[^.]+$/, '')
      .replace(/(?:View|Page|Container)$/, ''),
    'surface'
  );
  return `${domain}.${surface}`;
}

function explicitActionId(file, value) {
  const normalized = String(value).trim().toLowerCase();
  if (/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(normalized) && normalized.split('.').length >= 3) {
    return normalized;
  }
  return `${actionPrefix(file)}.${slug(normalized)}`;
}

function isHiddenInput(shortTag, attributes) {
  return shortTag === 'input' && literalAttribute(attributes, 'type') === 'hidden';
}

function isExplicitlyHidden(attributes) {
  if (hasAttribute(attributes, 'hidden')) return true;
  if (literalAttribute(attributes, 'aria-hidden') === 'true') return true;
  const className = literalAttribute(attributes, 'className');
  const style = literalAttribute(attributes, 'style');
  return className?.trim() === 'hidden' || /display\s*:\s*none/i.test(style ?? '');
}

function isActionableOpening(opening) {
  const tag = jsxName(opening.name);
  const shortTag = tag.split('.').at(-1);
  const names = attributeNames(opening.attributes);
  const ownsAction = opening.attributes.some(
    attribute =>
      attribute.type === 'JSXAttribute' &&
      ACTION_OWNER_ATTRIBUTES.has(jsxName(attribute.name)) &&
      !isPropagationOnlyAttribute(attribute)
  );
  if (literalAttribute(opening.attributes, 'data-action-scope') === 'presentation') return false;
  if (isHiddenInput(shortTag, opening.attributes)) return false;
  if (isExplicitlyHidden(opening.attributes)) return false;
  if (NON_ACTION_SURFACES.has(shortTag) && !hasAttribute(opening.attributes, 'data-action-id')) {
    return false;
  }
  if (shortTag === 'form') return names.has('onSubmit');
  if (NATIVE_ACTIONS.has(shortTag)) return true;
  if (TRANSPARENT_COMPONENTS.has(shortTag) && !ownsAction) return false;
  return (
    INTERACTIVE_COMPONENT.test(shortTag) ||
    INTERACTIVE_QUALIFIED_COMPONENT.test(tag) ||
    EXACT_INTERACTIVE_COMPONENTS.has(shortTag) ||
    ownsAction
  );
}

function directActionableChild(element) {
  for (const child of element.children ?? []) {
    if (child.type === 'JSXElement' && isActionableOpening(child.openingElement)) return child;
  }
  return undefined;
}

function actionKind(shortTag, attributes) {
  const declaredKind = literalAttribute(attributes, 'data-action-kind');
  if (['navigation', 'selection', 'async-action', 'interaction'].includes(declaredKind)) {
    return declaredKind;
  }

  const names = attributeNames(attributes);
  if (
    ['a', 'Link', 'SmartLink', 'NavigationMenuLink'].includes(shortTag) ||
    hasAttribute(attributes, 'to') ||
    hasAttribute(attributes, 'href')
  ) {
    return 'navigation';
  }
  if (
    [
      'input',
      'select',
      'Checkbox',
      'Option',
      'RadioGroupItem',
      'Select',
      'SelectItem',
      'Switch',
      'Tab',
      'TabsTrigger',
      'Toggle',
      'ToggleGroupItem',
    ].includes(shortTag) ||
    names.has('onCheckedChange') ||
    names.has('onSelect') ||
    names.has('onValueChange')
  ) {
    return 'selection';
  }
  if (shortTag === 'form' || names.has('onSubmit')) return 'async-action';
  if (/Button$/.test(shortTag) && (names.has('disabled') || names.has('isLoading'))) {
    return 'async-action';
  }
  return 'interaction';
}

function scenariosForKind(kind, attributes) {
  const canBeDisabled =
    hasAttribute(attributes, 'disabled') || hasAttribute(attributes, 'isLoading');
  if (kind === 'navigation') return ['authorized', 'redirect', 'deep-link', 'loading', 'error'];
  if (kind === 'selection') {
    return ['selected', 'unselected', ...(canBeDisabled ? ['disabled'] : []), 'keyboard', 'focus'];
  }
  if (kind === 'async-action') {
    return ['idle', 'loading', 'success', 'error', 'unauthorized', 'disabled'];
  }
  return ['idle', 'success', ...(canBeDisabled ? ['disabled'] : []), 'keyboard', 'focus'];
}

function accessibilityIssues(shortTag, attributes, tag = shortTag) {
  const names = attributeNames(attributes);
  const native = NATIVE_ACTIONS.has(shortTag) || shortTag === 'form';
  if (native || !names.has('onClick')) return [];
  if (/^[A-Z]/.test(shortTag)) return [];
  if (
    INTERACTIVE_COMPONENT.test(shortTag) ||
    INTERACTIVE_QUALIFIED_COMPONENT.test(tag) ||
    EXACT_INTERACTIVE_COMPONENTS.has(shortTag)
  )
    return [];
  const issues = [];
  if (!names.has('role')) issues.push('click-target-missing-role');
  if (!names.has('tabIndex')) issues.push('click-target-missing-tab-index');
  if (!names.has('onKeyDown')) issues.push('click-target-missing-keyboard-handler');
  return issues;
}

export function parseActions(file, source) {
  const ast = parse(source, {
    sourceType: 'module',
    errorRecovery: true,
    plugins: ['typescript', ...(file.endsWith('.tsx') ? ['jsx'] : []), 'decorators'],
  });
  const actions = [];
  const legacyDuplicateIds = new Map();

  walk(ast, node => {
    if (node.type !== 'JSXElement' || !isActionableOpening(node.openingElement)) return;
    const opening = node.openingElement;
    const tag = jsxName(opening.name);
    const shortTag = tag.split('.').at(-1);
    const explicit = literalAttribute(opening.attributes, 'data-action-id');
    const forwardedActionId = !explicit
      ? identifierAttribute(opening.attributes, 'data-action-id')
      : undefined;
    const accessibleProp =
      literalAttribute(opening.attributes, 'aria-label') ??
      literalAttribute(opening.attributes, 'name') ??
      literalAttribute(opening.attributes, 'title');
    const destination =
      literalAttribute(opening.attributes, 'to') ?? literalAttribute(opening.attributes, 'href');
    const accessibleText = staticChildText(node.children);
    const handler = handlerSemantic(opening.attributes);

    // Keep the historical fingerprint stable while a semantic action id is adopted.
    // Otherwise adding the accountability attribute would make the original debt
    // disappear instead of allowing the resolver to attach evidence to it.
    const openingWithoutActionId = {
      ...opening,
      attributes: opening.attributes.filter(
        attribute =>
          attribute.type !== 'JSXAttribute' || jsxName(attribute.name) !== 'data-action-id'
      ),
    };
    const fingerprint = createHash('sha1')
      .update(JSON.stringify(canonicalAstValue(openingWithoutActionId)))
      .digest('hex')
      .slice(0, 10);
    const legacyBaseId = accessibleProp ?? destination ?? `${shortTag}-${fingerprint}`;
    const legacySeen = legacyDuplicateIds.get(legacyBaseId) ?? 0;
    legacyDuplicateIds.set(legacyBaseId, legacySeen + 1);
    const legacyActionId = legacySeen ? `${legacyBaseId}-${legacySeen + 1}` : legacyBaseId;

    const child = directActionableChild(node);
    const transparentWrapper =
      (hasAttribute(opening.attributes, 'asChild') && Boolean(child)) ||
      (Boolean(forwardedActionId) && !destination);
    const semantic = explicit ?? accessibleProp ?? accessibleText ?? destination ?? handler;
    const identifierSource = explicit
      ? 'data-action-id'
      : forwardedActionId
        ? 'action-id-prop'
        : accessibleProp
          ? 'accessible-prop'
          : accessibleText
            ? 'accessible-text'
            : destination
              ? 'destination'
              : handler
                ? 'handler'
                : 'unidentified';
    const candidateActionId = semantic
      ? explicit
        ? explicitActionId(file, semantic)
        : `${actionPrefix(file)}.${slug(semantic)}`
      : undefined;
    const kind = actionKind(shortTag, opening.attributes);

    actions.push({
      candidateActionId,
      identifierSource,
      tag,
      line: opening.loc?.start.line ?? 0,
      column: opening.loc?.start.column ?? 0,
      kind,
      scenarios: scenariosForKind(kind, opening.attributes),
      classification: transparentWrapper ? 'transparent-wrapper' : 'canonical-action',
      aliasOfLegacyFingerprint: transparentWrapper
        ? child
          ? createHash('sha1')
              .update(JSON.stringify(canonicalAstValue(child.openingElement)))
              .digest('hex')
              .slice(0, 10)
          : forwardedActionId
        : undefined,
      accessibilityIssues: accessibilityIssues(shortTag, opening.attributes, tag),
      handler,
      legacyActionId,
    });
  });

  const candidateCounts = new Map();
  for (const action of actions) {
    if (!action.candidateActionId) continue;
    candidateCounts.set(
      action.candidateActionId,
      (candidateCounts.get(action.candidateActionId) ?? 0) + 1
    );
  }
  const explicitCanonicalIds = new Set();
  return actions.map(action => {
    if (
      action.candidateActionId &&
      candidateCounts.get(action.candidateActionId) > 1 &&
      action.identifierSource !== 'data-action-id'
    ) {
      return { ...action, actionId: undefined, identifierSource: 'ambiguous' };
    }
    if (action.candidateActionId && action.identifierSource === 'data-action-id') {
      if (action.classification === 'transparent-wrapper') {
        return { ...action, actionId: action.candidateActionId };
      }
      if (explicitCanonicalIds.has(action.candidateActionId)) {
        return {
          ...action,
          classification: 'transparent-wrapper',
          aliasOfLegacyFingerprint: action.candidateActionId,
          actionId: action.candidateActionId,
        };
      }
      explicitCanonicalIds.add(action.candidateActionId);
    }
    return { ...action, actionId: action.candidateActionId };
  });
}

function isRegisteredLegacyKey(key, legacyDebt, knownLegacyKeys, resolutions) {
  return legacyDebt.has(key) || knownLegacyKeys.has(key) || Boolean(resolutions[key]);
}

export function resolveHistoricalDebtKey({
  file,
  action,
  computedDebtKey,
  actionKey,
  legacyDebt,
  knownLegacyKeys,
  resolutions,
  previousDebtByActionKey,
  previousDebtByHandler,
  claimedDebtKeys,
}) {
  const compatibleResolution = debtKey => {
    const record = resolutions[debtKey];
    if (!record || record.status !== 'resolved') return true;
    if (record.resolution === 'alias-of-action') {
      return action.classification === 'transparent-wrapper';
    }
    if (['tested', 'explicit-ref'].includes(record.resolution)) {
      return action.classification === 'canonical-action';
    }
    return false;
  };
  const computedIsRegistered = isRegisteredLegacyKey(
    computedDebtKey,
    legacyDebt,
    knownLegacyKeys,
    resolutions
  );
  const fallbackDebtKey =
    claimedDebtKeys.has(computedDebtKey) ||
    (computedIsRegistered && !compatibleResolution(computedDebtKey))
      ? `${computedDebtKey}@${action.actionId ?? `${action.line}:${action.column}`}`
      : computedDebtKey;

  if (
    !claimedDebtKeys.has(computedDebtKey) &&
    computedIsRegistered &&
    compatibleResolution(computedDebtKey)
  ) {
    return computedDebtKey;
  }

  const previousDebtKey = previousDebtByActionKey.get(
    `${actionKey}\u0000${action.tag}\u0000${action.classification}`
  );
  if (
    previousDebtKey &&
    !claimedDebtKeys.has(previousDebtKey) &&
    compatibleResolution(previousDebtKey) &&
    isRegisteredLegacyKey(previousDebtKey, legacyDebt, knownLegacyKeys, resolutions)
  ) {
    return previousDebtKey;
  }

  const previousHandlerDebtKey = action.handler
    ? previousDebtByHandler.get(
        `${file}\u0000${action.handler}\u0000${action.tag}\u0000${action.classification}`
      )
    : undefined;
  if (
    previousHandlerDebtKey &&
    !claimedDebtKeys.has(previousHandlerDebtKey) &&
    compatibleResolution(previousHandlerDebtKey) &&
    isRegisteredLegacyKey(previousHandlerDebtKey, legacyDebt, knownLegacyKeys, resolutions)
  ) {
    return previousHandlerDebtKey;
  }

  if (!['data-action-id', 'action-id-prop'].includes(action.identifierSource)) {
    return fallbackDebtKey;
  }

  const candidates = Object.entries(resolutions)
    .filter(
      ([, record]) =>
        record?.status === 'pending' ||
        (record?.status === 'resolved' && record?.resolution === 'alias-of-action')
    )
    .filter(([key]) => compatibleResolution(key))
    .filter(([, record]) => record?.source?.file === file && record?.source?.tag === action.tag)
    .filter(([key]) => !claimedDebtKeys.has(key))
    .map(([key, record]) => ({
      key,
      distance: Math.abs((record.source.line ?? action.line) - action.line),
    }))
    .filter(candidate => candidate.distance <= 40)
    .sort((left, right) => left.distance - right.distance || left.key.localeCompare(right.key));

  if (candidates.length === 0) return fallbackDebtKey;
  if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) {
    return fallbackDebtKey;
  }
  return candidates[0].key;
}

export function buildUiActionCatalog(root, files, options = {}) {
  const sourceFiles = files.filter(
    file =>
      file.startsWith('src/') &&
      file.endsWith('.tsx') &&
      !file.includes('/__tests__/') &&
      file !== 'src/routeTree.gen.ts'
  );
  const actionReferences = options.accountability?.actionReferences ?? {};
  const actionDeclarations = options.accountability?.actionDeclarations ?? {};
  const resolutions = options.resolutions?.uiActions ?? {};
  const legacyDebt = new Set(options.legacyDebt ?? []);
  const knownLegacyKeys = new Set(options.knownLegacyKeys ?? []);
  const previousDebtByActionKey = new Map(
    (options.historicalEntries ?? [])
      .filter(entry => entry.key && entry.debtKey && entry.classification === 'canonical-action')
      .map(entry => [`${entry.key}\u0000${entry.tag}\u0000${entry.classification}`, entry.debtKey])
  );
  const previousDebtByHandler = new Map(
    (options.historicalEntries ?? [])
      .filter(
        entry =>
          entry.file &&
          entry.handler &&
          entry.debtKey &&
          entry.classification === 'canonical-action'
      )
      .map(entry => [
        `${entry.file}\u0000${entry.handler}\u0000${entry.tag}\u0000${entry.classification}`,
        entry.debtKey,
      ])
  );
  const claimedDebtKeys = new Set();
  const entries = [];

  for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const suggestedTestRefs = findTestReferences(classifyRepositoryFile(file, root), files);
    for (const action of parseActions(file, source)) {
      const computedDebtKey = `${file}#${action.legacyActionId}`;
      const historicalActionKey = action.actionId ? `${file}#${action.actionId}` : computedDebtKey;
      const debtKey = resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey,
        actionKey: historicalActionKey,
        legacyDebt,
        knownLegacyKeys,
        resolutions,
        previousDebtByActionKey,
        previousDebtByHandler,
        claimedDebtKeys,
      });
      claimedDebtKeys.add(debtKey);
      const declarationKey = Object.hasOwn(actionDeclarations, debtKey)
        ? debtKey
        : Object.hasOwn(actionDeclarations, computedDebtKey)
          ? computedDebtKey
          : undefined;
      const declaration = declarationKey ? actionDeclarations[declarationKey] : undefined;
      const declaredActionId =
        typeof declaration === 'string' ? declaration : declaration?.actionId;
      const actionId = declaredActionId ?? action.actionId;
      const actionKey = actionId ? `${file}#${actionId}` : computedDebtKey;
      const key = actionId ? actionKey : debtKey;
      const testRefs = actionReferences[key] ?? actionReferences[debtKey] ?? [];
      const exactCanonicalAccountability =
        action.classification === 'canonical-action' &&
        Boolean(actionId) &&
        testRefs.length > 0 &&
        scenariosCovered(action.scenarios, testRefs);
      const mergedTransparentAlias =
        action.classification === 'transparent-wrapper' && Boolean(actionId) && testRefs.length > 0;
      const resolvedRecord = resolutions[debtKey];
      const resolvedNonCanonical =
        resolvedRecord?.status === 'resolved' &&
        ['alias-of-action', 'reclassified', 'removed-dead-code'].includes(
          resolvedRecord.resolution
        );
      const accountabilityStatus = exactCanonicalAccountability
        ? 'accounted'
        : mergedTransparentAlias
          ? 'merged-alias'
          : resolvedNonCanonical
            ? 'resolved-non-canonical'
            : legacyDebt.has(debtKey)
              ? 'legacy-gap'
              : knownLegacyKeys.has(debtKey)
                ? 'legacy-reference'
                : 'new-gap';
      entries.push({
        key,
        debtKey,
        file,
        actionId,
        identifierSource: declaredActionId ? 'manifest-declaration' : action.identifierSource,
        declarationKey,
        tag: action.tag,
        line: action.line,
        column: action.column,
        kind: action.kind,
        classification: action.classification,
        aliasOfLegacyFingerprint: action.aliasOfLegacyFingerprint,
        accessibilityIssues: action.accessibilityIssues,
        handler: action.handler,
        scenarios: action.scenarios,
        roles: file.startsWith('src/routes/_authed')
          ? ['authenticated']
          : ['anonymous', 'authenticated'],
        testRefs,
        suggestedTestRefs,
        accountabilityStatus,
        resolution: resolvedNonCanonical ? resolvedRecord : undefined,
      });
    }
  }
  return {
    version: 2,
    description: 'Generated inventory of canonical user intents and migration aliases.',
    entries: entries.sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function serializeUiActionCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}
