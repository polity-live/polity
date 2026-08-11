import {
  createPqlCondition,
  type PqlExpression,
  type PqlFieldDefinition,
  type PqlFilter,
  type PqlOperator,
  type PqlScalar,
} from './applyPqlFilter';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { toLocalTimestamp } from '@/features/shared/logic/localDateTime';

type PqlTokenType =
  | 'word'
  | 'string'
  | 'number'
  | 'boolean'
  | 'comparison'
  | 'logical'
  | 'in'
  | 'contains'
  | 'is'
  | 'set'
  | 'paren'
  | 'comma';

export interface PqlToken {
  type: PqlTokenType;
  value: string;
  start: number;
  end: number;
}

type PqlCursorState =
  | 'EXPECT_FIELD'
  | 'EXPECT_OPERATOR'
  | 'EXPECT_SET'
  | 'EXPECT_VALUE'
  | 'EXPECT_IN_OPEN'
  | 'EXPECT_IN_VALUE'
  | 'EXPECT_IN_SEPARATOR'
  | 'EXPECT_LOGICAL_OR_END';

export interface PqlCursorContext<TItem, TFieldKey extends string> {
  state: PqlCursorState;
  partial: string;
  partialStart: number;
  lastField?: PqlFieldDefinition<TItem, TFieldKey>;
}

export type PqlSuggestionKind = 'field' | 'operator' | 'logical' | 'value' | 'paren' | 'separator';

export interface PqlSuggestion {
  label: string;
  insertText: string;
  kind: PqlSuggestionKind;
  detail?: string;
  replaceStart: number;
  replaceEnd: number;
}

export interface PqlQueryIssue {
  message: string;
  start: number;
  end: number;
}

export interface PqlParseResult<TFieldKey extends string> {
  expression: PqlExpression<TFieldKey> | null;
  issues: readonly PqlQueryIssue[];
}

const COMPARISON_OPERATORS = ['==', '!=', '<=', '>=', '~=', '<', '>'] as const;

export function getOperatorLabel(operator: PqlOperator): string {
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

export function formatSuggestionValue(value: string): string {
  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : JSON.stringify(value);
}

export function tokenizePql(input: string): PqlToken[] {
  const tokens: PqlToken[] = [];
  let index = 0;

  while (index < input.length) {
    const currentCharacter = input[index];

    if (/\s/.test(currentCharacter)) {
      index += 1;
      continue;
    }

    if (currentCharacter === '(' || currentCharacter === ')') {
      tokens.push({ type: 'paren', value: currentCharacter, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (currentCharacter === ',') {
      tokens.push({ type: 'comma', value: currentCharacter, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    const matchingComparisonOperator = COMPARISON_OPERATORS.find(operator =>
      input.startsWith(operator, index)
    );

    if (matchingComparisonOperator) {
      tokens.push({
        type: 'comparison',
        value: matchingComparisonOperator,
        start: index,
        end: index + matchingComparisonOperator.length,
      });
      index += matchingComparisonOperator.length;
      continue;
    }

    if (currentCharacter === '"' || currentCharacter === "'") {
      const quote = currentCharacter;
      let endIndex = index + 1;

      while (endIndex < input.length) {
        if (input[endIndex] === '\\') {
          endIndex += 2;
          continue;
        }

        if (input[endIndex] === quote) {
          endIndex += 1;
          break;
        }

        endIndex += 1;
      }

      tokens.push({
        type: 'string',
        value: input.slice(index, endIndex),
        start: index,
        end: endIndex,
      });
      index = endIndex;
      continue;
    }

    let endIndex = index;
    while (
      endIndex < input.length &&
      !/\s/.test(input[endIndex]) &&
      input[endIndex] !== '(' &&
      input[endIndex] !== ')' &&
      input[endIndex] !== ',' &&
      !COMPARISON_OPERATORS.some(operator => input.startsWith(operator, endIndex))
    ) {
      endIndex += 1;
    }

    const tokenValue = input.slice(index, endIndex);
    const upperValue = tokenValue.toUpperCase();

    let tokenType: PqlTokenType = 'word';
    if (upperValue === 'AND' || upperValue === 'OR') {
      tokenType = 'logical';
    } else if (upperValue === 'IN') {
      tokenType = 'in';
    } else if (upperValue === 'CONTAINS') {
      tokenType = 'contains';
    } else if (upperValue === 'IS') {
      tokenType = 'is';
    } else if (upperValue === 'SET') {
      tokenType = 'set';
    } else if (upperValue === 'TRUE' || upperValue === 'FALSE') {
      tokenType = 'boolean';
    } else if (/^-?\d+(\.\d+)?$/.test(tokenValue)) {
      tokenType = 'number';
    }

    tokens.push({ type: tokenType, value: tokenValue, start: index, end: endIndex });
    index = endIndex;
  }

  return tokens;
}

export function decodeQuotedString(value: string): string {
  const quote = value[0];
  const unwrappedValue = value.endsWith(quote) ? value.slice(1, -1) : value.slice(1);
  return unwrappedValue.replace(/\\([\\"'])/g, '$1');
}

export function comparisonTokenToOperator(tokenValue: string): PqlOperator | null {
  switch (tokenValue) {
    case '==':
      return 'eq';
    case '!=':
      return 'neq';
    case '~=':
      return 'contains';
    case '>':
      return 'gt';
    case '>=':
      return 'gte';
    case '<':
      return 'lt';
    case '<=':
      return 'lte';
    default:
      return null;
  }
}

export function coerceTokenValue<TItem, TFieldKey extends string>(
  token: PqlToken,
  field: PqlFieldDefinition<TItem, TFieldKey>
): PqlScalar | null {
  const rawValue =
    token.type === 'string'
      ? decodeQuotedString(token.value)
      : token.type === 'boolean'
        ? token.value.toLowerCase() === 'true'
        : token.type === 'number'
          ? Number(token.value)
          : token.value;

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (field.kind === 'number') {
    const parsedValue = Number(rawValue);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  if (field.kind === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      const [year, month, day] = rawValue.split('-').map(Number);
      const localTimestamp = toLocalTimestamp(rawValue) as number;
      const localDate = new Date(localTimestamp);
      return localDate.getFullYear() === year &&
        localDate.getMonth() + 1 === month &&
        localDate.getDate() === day
        ? localTimestamp
        : null;
    }

    const parsedValue = Date.parse(rawValue);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  if (field.kind === 'boolean') {
    if (rawValue.toLowerCase() === 'true') {
      return true;
    }

    if (rawValue.toLowerCase() === 'false') {
      return false;
    }

    return null;
  }

  return rawValue;
}

export function buildFieldLookup<TItem, TFieldKey extends string>(
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): ReadonlyMap<string, PqlFieldDefinition<TItem, TFieldKey>> {
  return new Map(fields.map(field => [field.key.toLowerCase(), field]));
}

class PqlParser<TItem, TFieldKey extends string> {
  private readonly fieldsByKey: ReadonlyMap<string, PqlFieldDefinition<TItem, TFieldKey>>;
  private readonly tokens: readonly PqlToken[];
  private readonly issues: PqlQueryIssue[] = [];
  private tokenIndex = 0;

  constructor(
    tokens: readonly PqlToken[],
    fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
  ) {
    this.tokens = tokens;
    this.fieldsByKey = buildFieldLookup(fields);
  }

  parse(): PqlParseResult<TFieldKey> {
    const expression = this.parseOrExpression();

    const unexpectedToken = this.peek();
    if (unexpectedToken) {
      this.pushIssue('Unexpected token', unexpectedToken.start, unexpectedToken.end);
    }

    return {
      expression,
      issues: this.issues,
    };
  }

  private parseOrExpression(): PqlExpression<TFieldKey> | null {
    const firstExpression = this.parseAndExpression();
    if (!firstExpression) {
      return null;
    }

    const children: PqlExpression<TFieldKey>[] = [firstExpression];
    while (this.matchLogical('OR')) {
      const nextExpression = this.parseAndExpression();
      if (!nextExpression) {
        return firstExpression;
      }

      children.push(nextExpression);
    }

    if (children.length === 1) {
      return firstExpression;
    }

    return {
      type: 'group',
      combinator: 'or',
      children,
    };
  }

  private parseAndExpression(): PqlExpression<TFieldKey> | null {
    const firstExpression = this.parsePrimaryExpression();
    if (!firstExpression) {
      return null;
    }

    const children: PqlExpression<TFieldKey>[] = [firstExpression];
    while (this.matchLogical('AND')) {
      const nextExpression = this.parsePrimaryExpression();
      if (!nextExpression) {
        return firstExpression;
      }

      children.push(nextExpression);
    }

    if (children.length === 1) {
      return firstExpression;
    }

    return {
      type: 'group',
      combinator: 'and',
      children,
    };
  }

  private parsePrimaryExpression(): PqlExpression<TFieldKey> | null {
    if (this.matchParen('(')) {
      const expression = this.parseOrExpression();
      const closingParen = this.consumeParen(')', 'Expected ")" to close the group');
      if (!expression || !closingParen) {
        return expression;
      }

      return expression;
    }

    return this.parseConditionExpression();
  }

  private parseConditionExpression(): PqlExpression<TFieldKey> | null {
    const fieldToken = this.consumeWord('Expected a field name');
    if (!fieldToken) {
      return null;
    }

    const field = this.fieldsByKey.get(fieldToken.value.toLowerCase());
    if (!field) {
      this.pushIssue(`Unknown field "${fieldToken.value}"`, fieldToken.start, fieldToken.end);
    }

    const fieldKey = (field?.key ?? fieldToken.value) as TFieldKey;

    if (this.matchType('comparison')) {
      const comparisonToken = this.previous();
      // Comparison tokens are produced exclusively from COMPARISON_OPERATORS.
      const operator = comparisonTokenToOperator(comparisonToken.value) as PqlOperator;

      if (field && !field.operators.includes(operator)) {
        this.pushIssue(
          `${field.label} does not support ${getOperatorLabel(operator)}`,
          comparisonToken.start,
          comparisonToken.end
        );
      }

      const value = this.parseValue(field, 'Expected a value after the operator');
      if (value === null) {
        return null;
      }

      return createPqlCondition({
        id: crypto.randomUUID(),
        fieldKey,
        operator,
        value,
      });
    }

    if (this.matchType('contains')) {
      const operatorToken = this.previous();
      if (field && !field.operators.includes('contains')) {
        this.pushIssue(
          `${field.label} does not support CONTAINS`,
          operatorToken.start,
          operatorToken.end
        );
      }

      const value = this.parseValue(field, 'Expected a value after CONTAINS');
      if (value === null) {
        return null;
      }

      return createPqlCondition({
        id: crypto.randomUUID(),
        fieldKey,
        operator: 'contains',
        value,
      });
    }

    if (this.matchType('in')) {
      const operatorToken = this.previous();
      if (field && !field.operators.includes('in')) {
        this.pushIssue(
          `${field.label} does not support IN`,
          operatorToken.start,
          operatorToken.end
        );
      }

      this.consumeParen('(', 'Expected "(" after IN');

      const values: PqlScalar[] = [];
      while (!this.checkParen(')') && this.peek()) {
        const value = this.parseValue(field, 'Expected a value inside the IN list');
        if (value === null) {
          break;
        }

        values.push(value);

        if (!this.matchType('comma')) {
          break;
        }
      }

      this.consumeParen(')', 'Expected ")" to close the IN list');

      return createPqlCondition({
        id: crypto.randomUUID(),
        fieldKey,
        operator: 'in',
        value: values,
      });
    }

    if (this.matchType('is')) {
      const isToken = this.previous();
      this.consumeType('set', 'Expected SET after IS');
      if (field && !field.operators.includes('is_set')) {
        this.pushIssue(
          `${field.label} does not support IS SET`,
          isToken.start,
          this.previous().end
        );
      }

      return createPqlCondition({
        id: crypto.randomUUID(),
        fieldKey,
        operator: 'is_set',
        value: null,
      });
    }

    const token = this.peek();
    this.pushIssue(
      `Expected an operator after ${field?.label ?? fieldToken.value}`,
      token?.start ?? fieldToken.end,
      token?.end ?? fieldToken.end
    );
    return null;
  }

  private parseValue(
    field: PqlFieldDefinition<TItem, TFieldKey> | undefined,
    message: string
  ): PqlScalar | null {
    const token = this.advance();
    if (!token) {
      const previousEnd = this.previous().end;
      this.pushIssue(message, previousEnd, previousEnd);
      return null;
    }

    if (!field) {
      if (token.type === 'string') {
        return decodeQuotedString(token.value);
      }

      if (token.type === 'boolean') {
        return token.value.toLowerCase() === 'true';
      }

      if (token.type === 'number') {
        return Number(token.value);
      }

      return token.value;
    }

    const value = coerceTokenValue(token, field);
    if (value === null) {
      this.pushIssue(message, token.start, token.end);
    }

    return value;
  }

  private matchLogical(expected: 'AND' | 'OR'): boolean {
    const token = this.peek();
    if (!token || token.type !== 'logical' || token.value.toUpperCase() !== expected) {
      return false;
    }

    this.tokenIndex += 1;
    return true;
  }

  private matchParen(expected: '(' | ')'): boolean {
    const token = this.peek();
    if (!token || token.type !== 'paren' || token.value !== expected) {
      return false;
    }

    this.tokenIndex += 1;
    return true;
  }

  private consumeParen(expected: '(' | ')', message: string): PqlToken | null {
    const token = this.peek();
    if (!token || token.type !== 'paren' || token.value !== expected) {
      this.pushIssue(message, token?.start ?? 0, token?.end ?? 0);
      return null;
    }

    this.tokenIndex += 1;
    return token;
  }

  private matchType(expectedType: PqlTokenType): boolean {
    const token = this.peek();
    if (!token || token.type !== expectedType) {
      return false;
    }

    this.tokenIndex += 1;
    return true;
  }

  private consumeType(expectedType: PqlTokenType, message: string): PqlToken | null {
    const token = this.peek();
    if (!token || token.type !== expectedType) {
      this.pushIssue(message, token?.start ?? 0, token?.end ?? 0);
      return null;
    }

    this.tokenIndex += 1;
    return token;
  }

  private consumeWord(message: string): PqlToken | null {
    const token = this.peek();
    if (!token || token.type !== 'word') {
      this.pushIssue(message, token?.start ?? 0, token?.end ?? 0);
      return null;
    }

    this.tokenIndex += 1;
    return token;
  }

  private checkParen(expected: ')' | '('): boolean {
    const token = this.peek();
    return Boolean(token && token.type === 'paren' && token.value === expected);
  }

  private advance(): PqlToken | null {
    const token = this.peek();
    if (!token) {
      return null;
    }

    this.tokenIndex += 1;
    return token;
  }

  private peek(): PqlToken | null {
    return this.tokens[this.tokenIndex] ?? null;
  }

  private previous(): PqlToken {
    // Every call follows a successful match/consume, or a missing value after
    // an already consumed operator.
    return this.tokens[this.tokenIndex - 1] as PqlToken;
  }

  private pushIssue(message: string, start: number, end: number) {
    this.issues.push({
      message,
      start,
      end,
    });
  }
}

export function stripPartialToken(token: PqlToken): string {
  if (token.type === 'string') {
    return decodeQuotedString(token.value);
  }

  return token.value;
}

export function getCursorContext<TItem, TFieldKey extends string>(
  input: string,
  cursor: number,
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): PqlCursorContext<TItem, TFieldKey> {
  const beforeCursor = input.slice(0, cursor);
  const tokens = tokenizePql(beforeCursor);
  const fieldsByKey = buildFieldLookup(fields);

  const lastToken = tokens[tokens.length - 1];
  const hasTrailingWhitespace = /\s$/.test(beforeCursor);

  let partial = '';
  let partialStart = cursor;
  let tokensForState = tokens;

  if (lastToken && lastToken.end === beforeCursor.length && !hasTrailingWhitespace) {
    if (lastToken.type === 'comparison') {
      partial = lastToken.value;
      partialStart = lastToken.start;
      tokensForState = tokens.slice(0, -1);
    } else if (
      lastToken.type === 'word' ||
      lastToken.type === 'string' ||
      lastToken.type === 'number' ||
      lastToken.type === 'boolean'
    ) {
      partial = stripPartialToken(lastToken);
      partialStart = lastToken.start;
      tokensForState = tokens.slice(0, -1);
    }
  }

  let state: PqlCursorState = 'EXPECT_FIELD';
  let lastField: PqlFieldDefinition<TItem, TFieldKey> | undefined;

  for (const token of tokensForState) {
    switch (token.type) {
      case 'word':
        if (state === 'EXPECT_FIELD') {
          lastField = fieldsByKey.get(token.value.toLowerCase());
          state = 'EXPECT_OPERATOR';
        } else if (state === 'EXPECT_VALUE') {
          state = 'EXPECT_LOGICAL_OR_END';
        } else if (state === 'EXPECT_IN_VALUE') {
          state = 'EXPECT_IN_SEPARATOR';
        }
        break;
      case 'string':
      case 'number':
      case 'boolean':
        if (state === 'EXPECT_VALUE') {
          state = 'EXPECT_LOGICAL_OR_END';
        } else if (state === 'EXPECT_IN_VALUE') {
          state = 'EXPECT_IN_SEPARATOR';
        }
        break;
      case 'comparison':
      case 'contains':
        if (state === 'EXPECT_OPERATOR') {
          state = 'EXPECT_VALUE';
        }
        break;
      case 'in':
        if (state === 'EXPECT_OPERATOR') {
          state = 'EXPECT_IN_OPEN';
        }
        break;
      case 'is':
        if (state === 'EXPECT_OPERATOR') {
          state = 'EXPECT_SET';
        }
        break;
      case 'set':
        if (state === 'EXPECT_SET') {
          state = 'EXPECT_LOGICAL_OR_END';
        }
        break;
      case 'paren':
        if (token.value === '(') {
          state = state === 'EXPECT_IN_OPEN' ? 'EXPECT_IN_VALUE' : 'EXPECT_FIELD';
        } else {
          state = 'EXPECT_LOGICAL_OR_END';
        }
        break;
      case 'comma':
        if (state === 'EXPECT_IN_SEPARATOR') {
          state = 'EXPECT_IN_VALUE';
        }
        break;
      case 'logical':
        if (state === 'EXPECT_LOGICAL_OR_END') {
          state = 'EXPECT_FIELD';
          lastField = undefined;
        }
        break;
    }
  }

  return {
    state,
    partial,
    partialStart,
    lastField,
  };
}

export function filterByPartial<T>(
  items: readonly T[],
  getLabel: (item: T) => string,
  partial: string
): T[] {
  const normalizedPartial = partial.trim().toLowerCase();
  if (!normalizedPartial) {
    return [...items];
  }

  return items.filter(item => getLabel(item).toLowerCase().includes(normalizedPartial));
}

export function parsePqlExpression<TItem, TFieldKey extends string>(
  query: string,
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): PqlParseResult<TFieldKey> {
  const parser = new PqlParser(tokenizePql(query), fields);
  return parser.parse();
}

export function buildPqlCodeFilter<TItem, TFieldKey extends string>(args: {
  id?: string;
  label: string;
  query: string;
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
}): { filter: PqlFilter<TFieldKey> | null; issues: readonly PqlQueryIssue[] } {
  const parseResult = parsePqlExpression(args.query, args.fields);
  if (
    !args.label.trim() ||
    !args.query.trim() ||
    !parseResult.expression ||
    parseResult.issues.length > 0
  ) {
    return {
      filter: null,
      issues: parseResult.issues,
    };
  }

  return {
    filter: {
      id: args.id ?? crypto.randomUUID(),
      label: args.label.trim(),
      query: args.query.trim(),
      expression: parseResult.expression,
    },
    issues: [],
  };
}

export function getPqlSuggestions<TItem, TFieldKey extends string>(
  query: string,
  cursor: number,
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): PqlSuggestion[] {
  const context = getCursorContext(query, cursor, fields);
  const replacementEnd = cursor;
  const suggestions: PqlSuggestion[] = [];
  const field = context.lastField;

  if (context.state === 'EXPECT_FIELD') {
    const matchingFields = filterByPartial(fields, entry => entry.key, context.partial);
    for (const matchingField of matchingFields) {
      suggestions.push({
        label: matchingField.key,
        insertText: `${matchingField.key} `,
        kind: 'field',
        detail: matchingField.kind,
        replaceStart: context.partialStart,
        replaceEnd: replacementEnd,
      });
    }

    if (!context.partial || '('.includes(context.partial)) {
      suggestions.push({
        label: '(',
        insertText: '(',
        kind: 'paren',
        replaceStart: context.partialStart,
        replaceEnd: replacementEnd,
      });
    }
  }

  if (context.state === 'EXPECT_OPERATOR' && field) {
    const operatorSuggestions = field.operators.map(operator => {
      const token = getOperatorLabel(operator);
      const insertText =
        operator === translateText('generated.inline.0137_in_af10ef20')
          ? translateText('generated.inline.0138_in_d9850243')
          : operator === 'is_set'
            ? translateText('generated.inline.0139_is_set_20c41b90')
            : `${token} `;

      return {
        label: token,
        insertText,
        kind: 'operator' as const,
        detail: field.label,
      };
    });

    for (const suggestion of filterByPartial(
      operatorSuggestions,
      entry => entry.label,
      context.partial
    )) {
      suggestions.push({
        ...suggestion,
        replaceStart: context.partialStart,
        replaceEnd: replacementEnd,
      });
    }
  }

  if (context.state === 'EXPECT_SET') {
    suggestions.push({
      label: translateText('generated.inline.0140_set_55c5d810'),
      insertText: 'SET ',
      kind: 'operator',
      replaceStart: context.partialStart,
      replaceEnd: replacementEnd,
    });
  }

  if ((context.state === 'EXPECT_VALUE' || context.state === 'EXPECT_IN_VALUE') && field) {
    if (field.kind === 'boolean') {
      for (const value of filterByPartial(['true', 'false'], entry => entry, context.partial)) {
        suggestions.push({
          label: value,
          insertText: context.state === 'EXPECT_VALUE' ? `${value} ` : value,
          kind: 'value',
          detail: 'boolean',
          replaceStart: context.partialStart,
          replaceEnd: replacementEnd,
        });
      }
    }

    if (field.options?.length) {
      for (const option of filterByPartial(
        field.options,
        entry => `${entry.label} ${entry.value}`,
        context.partial
      )) {
        const literal = formatSuggestionValue(option.label);
        suggestions.push({
          label: option.label,
          insertText: context.state === 'EXPECT_VALUE' ? `${literal} ` : literal,
          kind: 'value',
          detail: option.value === option.label ? field.kind : option.value,
          replaceStart: context.partialStart,
          replaceEnd: replacementEnd,
        });
      }
    }
  }

  if (context.state === 'EXPECT_IN_OPEN') {
    suggestions.push({
      label: '(',
      insertText: '(',
      kind: 'paren',
      replaceStart: context.partialStart,
      replaceEnd: replacementEnd,
    });
  }

  if (context.state === 'EXPECT_IN_SEPARATOR') {
    suggestions.push({
      label: ',',
      insertText: ', ',
      kind: 'separator',
      replaceStart: context.partialStart,
      replaceEnd: replacementEnd,
    });
    suggestions.push({
      label: ')',
      insertText: ') ',
      kind: 'paren',
      replaceStart: context.partialStart,
      replaceEnd: replacementEnd,
    });
  }

  if (context.state === 'EXPECT_LOGICAL_OR_END') {
    for (const logicalOperator of filterByPartial(['AND', 'OR'], entry => entry, context.partial)) {
      suggestions.push({
        label: logicalOperator,
        insertText: `${logicalOperator} `,
        kind: 'logical',
        replaceStart: context.partialStart,
        replaceEnd: replacementEnd,
      });
    }

    suggestions.push({
      label: ')',
      insertText: ')',
      kind: 'paren',
      replaceStart: context.partialStart,
      replaceEnd: replacementEnd,
    });
  }

  return suggestions;
}

export function applyPqlSuggestion(
  value: string,
  cursor: number,
  suggestion: PqlSuggestion
): { value: string; caretPosition: number } {
  const nextValue = `${value.slice(0, suggestion.replaceStart)}${suggestion.insertText}${value.slice(suggestion.replaceEnd)}`;
  return {
    value: nextValue,
    caretPosition: suggestion.replaceStart + suggestion.insertText.length,
  };
}
