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

export function isPqlScalar(value: PqlValue): value is PqlScalar {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function normalizePqlScalar(value: PqlValue): PqlScalar | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  return isPqlScalar(value) ? value : null;
}

export function normalizePqlFieldValues(value: PqlFieldValue): readonly PqlScalar[] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => {
      const normalizedEntry = normalizePqlScalar(entry);
      return normalizedEntry === null ? [] : [normalizedEntry];
    });
  }

  const normalizedValue = normalizePqlScalar(value as PqlValue);
  return normalizedValue === null ? [] : [normalizedValue];
}

export function normalizePqlRuleScalar<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey>,
  value: PqlScalar
): PqlScalar {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (field.kind === 'number') {
    const parsedValue = Number(trimmedValue);
    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  if (field.kind === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      const [year, month, day] = trimmedValue.split('-').map(Number);
      const localTimestamp = toLocalTimestamp(trimmedValue) as number;
      const localDate = new Date(localTimestamp);
      return localDate.getFullYear() === year &&
        localDate.getMonth() + 1 === month &&
        localDate.getDate() === day
        ? localTimestamp
        : value;
    }

    const parsedValue = Date.parse(trimmedValue);
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

export function normalizePqlRuleValues<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey>,
  value: PqlRule<TFieldKey>['value']
): readonly PqlScalar[] {
  const rawValues = Array.isArray(value) ? value : value === null ? [] : [value];

  return rawValues.map(entry => normalizePqlRuleScalar(field, entry));
}

export function toPqlSearchableString(value: PqlScalar): string {
  return String(value).trim().toLowerCase();
}

export function hasPqlValue(values: readonly PqlScalar[]): boolean {
  return values.length > 0;
}

export function matchesPqlEq(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[]
): boolean {
  if (!hasPqlValue(fieldValues) || !hasPqlValue(ruleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => ruleValues.some(ruleValue => fieldValue === ruleValue));
}

export function matchesPqlContains(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[]
): boolean {
  if (!hasPqlValue(fieldValues) || !hasPqlValue(ruleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => {
    const haystack = toPqlSearchableString(fieldValue);
    return ruleValues.some(ruleValue => haystack.includes(toPqlSearchableString(ruleValue)));
  });
}

export function matchesPqlIn(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[]
): boolean {
  if (!hasPqlValue(fieldValues) || !hasPqlValue(ruleValues)) {
    return false;
  }

  const allowedValues = new Set(ruleValues);
  return fieldValues.some(fieldValue => allowedValues.has(fieldValue));
}

export function matchesPqlComparable(
  fieldValues: readonly PqlScalar[],
  ruleValues: readonly PqlScalar[],
  compare: (left: number, right: number) => boolean
): boolean {
  if (!hasPqlValue(fieldValues) || !hasPqlValue(ruleValues)) {
    return false;
  }

  const comparableRuleValues = ruleValues.filter(
    (value): value is number => typeof value === 'number'
  );
  if (!hasPqlValue(comparableRuleValues)) {
    return false;
  }

  return fieldValues.some(fieldValue => {
    if (typeof fieldValue !== 'number') {
      return false;
    }

    return comparableRuleValues.some(ruleValue => compare(fieldValue, ruleValue));
  });
}

export function isPqlExpressionCondition<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>
): expression is PqlExpressionCondition<TFieldKey> {
  return expression.type === 'condition';
}

export function getPqlQueryOperatorToken(operator: PqlOperator): string {
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

export function needsQuotedPqlString(value: string): boolean {
  return !/^[A-Za-z0-9_.:-]+$/.test(value);
}

export function serializePqlExpressionWithParentheses<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>,
  parentCombinator?: PqlCombinator
): string {
  if (isPqlExpressionCondition(expression)) {
    return serializePqlRule(expression.rule);
  }

  const serializedChildren = expression.children.map(child =>
    serializePqlExpressionWithParentheses(child, expression.combinator)
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

  const fieldValues = normalizePqlFieldValues(field.getValue(item));
  const ruleValues = normalizePqlRuleValues(field, rule.value);

  switch (rule.operator) {
    case 'eq':
      return matchesPqlEq(fieldValues, ruleValues);
    case 'neq':
      return !matchesPqlEq(fieldValues, ruleValues);
    case 'contains':
      return matchesPqlContains(fieldValues, ruleValues);
    case 'in':
      return matchesPqlIn(fieldValues, ruleValues);
    case 'gt':
      return matchesPqlComparable(fieldValues, ruleValues, (left, right) => left > right);
    case 'gte':
      return matchesPqlComparable(fieldValues, ruleValues, (left, right) => left >= right);
    case 'lt':
      return matchesPqlComparable(fieldValues, ruleValues, (left, right) => left < right);
    case 'lte':
      return matchesPqlComparable(fieldValues, ruleValues, (left, right) => left <= right);
    case 'is_set':
      return hasPqlValue(fieldValues);
    default:
      return false;
  }
}

export function matchesPqlExpression<TItem, TFieldKey extends string>(
  item: TItem,
  expression: PqlExpression<TFieldKey>,
  fields: PqlFieldRegistry<TItem, TFieldKey>
): boolean {
  if (isPqlExpressionCondition(expression)) {
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

  if (isPqlExpressionCondition(expression)) {
    return 1;
  }

  return expression.children.reduce((count, child) => {
    if (isPqlExpressionCondition(child)) {
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
    return needsQuotedPqlString(value) ? JSON.stringify(value) : value;
  }

  return String(value);
}

export function serializePqlRule<TFieldKey extends string>(rule: PqlRule<TFieldKey>): string {
  if (rule.operator === 'is_set') {
    return `${rule.fieldKey} ${getPqlQueryOperatorToken(rule.operator)}`;
  }

  if (rule.operator === 'in') {
    const values = (Array.isArray(rule.value) ? rule.value : []).map(formatPqlScalar).join(', ');
    return `${rule.fieldKey} IN (${values})`;
  }

  const value = Array.isArray(rule.value) ? rule.value[0] : rule.value;
  return `${rule.fieldKey} ${getPqlQueryOperatorToken(rule.operator)} ${
    value === null ? 'null' : formatPqlScalar(value)
  }`;
}

export function serializePqlExpression<TFieldKey extends string>(
  expression: PqlExpression<TFieldKey>
): string {
  return serializePqlExpressionWithParentheses(expression);
}

export function serializePqlFilter<TFieldKey extends string>(filter: PqlFilter<TFieldKey>): string {
  if (filter.query?.trim()) {
    return filter.query.trim();
  }

  const expression = getPqlFilterExpression(filter);
  return expression ? serializePqlExpression(expression) : '';
}
