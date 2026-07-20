import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { toLocalTimestamp } from '@/features/shared/logic/localDateTime';
export type PqlScalar = string | number | boolean;

export type PqlValue = PqlScalar | Date | null | undefined;

export type PqlFieldValue = PqlValue | readonly PqlValue[];

export type PqlFieldKind = 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'entity';

export type PqlOperator = 'eq' | 'neq' | 'contains' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_set';

export type PqlCombinator = 'and' | 'or';

export interface PqlOption {
  value: string;
  label: string;
  keywords?: readonly string[];
}

export interface PqlFieldDefinition<TItem, TFieldKey extends string = string> {
  key: TFieldKey;
  label: string;
  kind: PqlFieldKind;
  operators: readonly PqlOperator[];
  getValue: (item: TItem) => PqlFieldValue;
  options?: readonly PqlOption[];
}

export interface PqlRule<TFieldKey extends string = string> {
  id: string;
  fieldKey: TFieldKey;
  operator: PqlOperator;
  value: PqlScalar | readonly PqlScalar[] | null;
}

export interface PqlExpressionCondition<TFieldKey extends string = string> {
  type: 'condition';
  rule: PqlRule<TFieldKey>;
}

export interface PqlExpressionGroup<TFieldKey extends string = string> {
  type: 'group';
  combinator: PqlCombinator;
  children: readonly PqlExpression<TFieldKey>[];
}

export type PqlExpression<TFieldKey extends string = string> =
  PqlExpressionCondition<TFieldKey> | PqlExpressionGroup<TFieldKey>;

export interface PqlFilter<TFieldKey extends string = string> {
  id: string;
  label: string;
  query?: string;
  expression?: PqlExpression<TFieldKey>;
}

export type PqlFieldRegistry<TItem, TFieldKey extends string = string> = ReadonlyMap<
  TFieldKey,
  PqlFieldDefinition<TItem, TFieldKey>
>;

function isScalar(value: PqlValue): value is PqlScalar {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function normalizeScalar(value: PqlValue): PqlScalar | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  return isScalar(value) ? value : null;
}

function normalizeValues(value: PqlFieldValue): readonly PqlScalar[] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => {
      const normalizedEntry = normalizeScalar(entry);
      return normalizedEntry === null ? [] : [normalizedEntry];
    });
  }

  const normalizedValue = normalizeScalar(value as PqlValue);
  return normalizedValue === null ? [] : [normalizedValue];
}

function normalizeRuleScalar<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey>,
  value: PqlScalar
): PqlScalar | null {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (field.kind === 'number') {
    const parsedValue = Number(trimmedValue);
    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  if (field.kind === 'date') {
    const parsedValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
      ? toLocalTimestamp(trimmedValue)
      : Date.parse(trimmedValue);
    if (parsedValue === null) return value;
    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  if (field.kind === 'boolean') {
    if (trimmedValue.toLowerCase() === 'true') {
      return true;
    }

    if (trimmedValue.toLowerCase() === 'false') {
      return false;
    }
  }

  const normalizedValue = trimmedValue.toLowerCase();
  const matchingOption = field.options?.find(option => {
    const optionTerms = [option.value, option.label, ...(option.keywords ?? [])].map(entry =>
      entry.toLowerCase()
    );

    return optionTerms.includes(normalizedValue);
  });

  return matchingOption?.value ?? trimmedValue;
}

function normalizeRuleValues<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey>,
  value: PqlRule<TFieldKey>['value']
): readonly PqlScalar[] {
  const rawValues = Array.isArray(value) ? value : value === null ? [] : [value];

  return rawValues.flatMap(entry => {
    const normalizedEntry = normalizeRuleScalar(field, entry);
    return normalizedEntry === null ? [] : [normalizedEntry];
  });
}

function toSearchableString(value: PqlScalar): string {
  return String(value).trim().toLowerCase();
}

function hasValue(values: readonly PqlScalar[]): boolean {
  return values.length > 0;
}

function matchesEq(fieldValues: readonly PqlScalar[], ruleValues: readonly PqlScalar[]): boolean {
  if (!hasValue(fieldValues) || !hasValue(ruleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => ruleValues.some(ruleValue => fieldValue === ruleValue));
}

function matchesContains(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[]
): boolean {
  if (!hasValue(fieldValues) || !hasValue(ruleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => {
    const haystack = toSearchableString(fieldValue);
    return ruleValues.some(ruleValue => haystack.includes(toSearchableString(ruleValue)));
  });
}

function matchesIn(fieldValues: readonly PqlScalar[], ruleValues: readonly PqlScalar[]): boolean {
  if (!hasValue(fieldValues) || !hasValue(ruleValues)) {
    return false;
  }

  const allowedValues = new Set(ruleValues);
  return fieldValues.some(fieldValue => allowedValues.has(fieldValue));
}

function matchesComparable(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[],
  compare: (left: number, right: number) => boolean
): boolean {
  if (!hasValue(fieldValues) || !hasValue(ruleValues)) {
    return false;
  }

  const comparableRuleValues = ruleValues.filter(
    (value): value is number => typeof value === 'number'
  );
  if (!hasValue(comparableRuleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => {
    if (typeof fieldValue !== 'number') {
      return false;
    }

    return comparableRuleValues.some(ruleValue => compare(fieldValue, ruleValue));
  });
}

function isExpressionCondition<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>
): expression is PqlExpressionCondition<TFieldKey> {
  return expression.type === 'condition';
}

function getQueryOperatorToken(operator: PqlOperator): string {
  switch (operator) {
    case 'eq':
      return '==';
    case 'neq':
      return '!=';
    case 'contains':
      return 'CONTAINS';
    case 'in':
      return 'IN';
    case 'gt':
      return '>';
    case 'gte':
      return '>=';
    case 'lt':
      return '<';
    case 'lte':
      return '<=';
    case 'is_set':
      return 'IS SET';
    default:
      return '==';
  }
}

function needsQuotedString(value: string): boolean {
  return !/^[A-Za-z0-9_.:-]+$/.test(value);
}

function serializeExpressionWithParentheses<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>,
  parentCombinator?: PqlCombinator
): string {
  if (isExpressionCondition(expression)) {
    return serializePqlRule(expression.rule);
  }

  const serializedChildren = expression.children.map(child =>
    serializeExpressionWithParentheses(child, expression.combinator)
  );

  const serializedExpression = serializedChildren.join(` ${expression.combinator.toUpperCase()} `);

  if (!parentCombinator || parentCombinator === expression.combinator) {
    return serializedExpression;
  }

  return `(${serializedExpression})`;
}

export function createPqlFieldRegistry<TItem, TFieldKey extends string>(
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): PqlFieldRegistry<TItem, TFieldKey> {
  return new Map(fields.map(field => [field.key, field]));
}

export function createPqlCondition<TFieldKey extends string>(
  rule: PqlRule<TFieldKey>
): PqlExpressionCondition<TFieldKey> {
  return {
    type: 'condition',
    rule,
  };
}

export function getPqlFilterExpression<TFieldKey extends string>(
  filter: PqlFilter<TFieldKey>
): PqlExpression<TFieldKey> | null {
  return filter.expression ?? null;
}

export function matchesPqlRule<TItem, TFieldKey extends string>(
  item: TItem,
  rule: PqlRule<TFieldKey>,
  fields: PqlFieldRegistry<TItem, TFieldKey>
): boolean {
  const field = fields.get(rule.fieldKey);

  if (!field || !field.operators.includes(rule.operator)) {
    return false;
  }

  const fieldValues = normalizeValues(field.getValue(item));
  const ruleValues = normalizeRuleValues(field, rule.value);

  switch (rule.operator) {
    case 'eq':
      return matchesEq(fieldValues, ruleValues);
    case 'neq':
      return !matchesEq(fieldValues, ruleValues);
    case 'contains':
      return matchesContains(fieldValues, ruleValues);
    case 'in':
      return matchesIn(fieldValues, ruleValues);
    case 'gt':
      return matchesComparable(fieldValues, ruleValues, (left, right) => left > right);
    case 'gte':
      return matchesComparable(fieldValues, ruleValues, (left, right) => left >= right);
    case 'lt':
      return matchesComparable(fieldValues, ruleValues, (left, right) => left < right);
    case 'lte':
      return matchesComparable(fieldValues, ruleValues, (left, right) => left <= right);
    case 'is_set':
      return hasValue(fieldValues);
    default:
      return false;
  }
}

export function matchesPqlExpression<TItem, TFieldKey extends string>(
  item: TItem,
  expression: PqlExpression<TFieldKey>,
  fields: PqlFieldRegistry<TItem, TFieldKey>
): boolean {
  if (isExpressionCondition(expression)) {
    return matchesPqlRule(item, expression.rule, fields);
  }

  if (expression.children.length === 0) {
    return true;
  }

  if (expression.combinator === 'or') {
    return expression.children.some(child => matchesPqlExpression(item, child, fields));
  }

  return expression.children.every(child => matchesPqlExpression(item, child, fields));
}

export function matchesPqlFilter<TItem, TFieldKey extends string>(
  item: TItem,
  filter: PqlFilter<TFieldKey>,
  fields: PqlFieldRegistry<TItem, TFieldKey>
): boolean {
  const expression = getPqlFilterExpression(filter);

  if (!expression) {
    return true;
  }

  return matchesPqlExpression(item, expression, fields);
}

export function applyPqlFilter<TItem, TFieldKey extends string>(
  items: readonly TItem[],
  filter: PqlFilter<TFieldKey> | null,
  fields: PqlFieldRegistry<TItem, TFieldKey>
): TItem[] {
  if (!filter) {
    return [...items];
  }

  return items.filter(item => matchesPqlFilter(item, filter, fields));
}

export function countPqlRules<TFieldKey extends string>(
  filter: PqlFilter<TFieldKey> | null
): number {
  if (!filter) {
    return 0;
  }

  const expression = getPqlFilterExpression(filter);
  if (!expression) {
    return 0;
  }

  if (isExpressionCondition(expression)) {
    return 1;
  }

  return expression.children.reduce((count, child) => {
    if (isExpressionCondition(child)) {
      return count + 1;
    }

    return (
      count +
      countPqlRules({
        id: 'nested',
        label: translateText('generated.inline.0136_nested_b4b3e0a2'),
        expression: child,
      })
    );
  }, 0);
}

export function formatPqlScalar(value: PqlScalar): string {
  if (typeof value === 'string') {
    return needsQuotedString(value) ? JSON.stringify(value) : value;
  }

  return String(value);
}

export function serializePqlRule<TFieldKey extends string>(rule: PqlRule<TFieldKey>): string {
  if (rule.operator === 'is_set') {
    return `${rule.fieldKey} ${getQueryOperatorToken(rule.operator)}`;
  }

  if (rule.operator === 'in') {
    const values = (Array.isArray(rule.value) ? rule.value : []).map(formatPqlScalar).join(', ');
    return `${rule.fieldKey} IN (${values})`;
  }

  const value = Array.isArray(rule.value) ? rule.value[0] : rule.value;
  return `${rule.fieldKey} ${getQueryOperatorToken(rule.operator)} ${
    value === null ? 'null' : formatPqlScalar(value)
  }`;
}

export function serializePqlExpression<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>
): string {
  return serializeExpressionWithParentheses(expression);
}

export function serializePqlFilter<TFieldKey extends string>(filter: PqlFilter<TFieldKey>): string {
  if (filter.query?.trim()) {
    return filter.query.trim();
  }

  const expression = getPqlFilterExpression(filter);
  return expression ? serializePqlExpression(expression) : '';
}
