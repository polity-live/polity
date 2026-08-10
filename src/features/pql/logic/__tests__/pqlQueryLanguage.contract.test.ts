import { describe, expect, it } from 'vitest';
import type { PqlFieldDefinition, PqlOperator } from '../applyPqlFilter';
import {
  applyPqlSuggestion,
  buildFieldLookup,
  buildPqlCodeFilter,
  coerceTokenValue,
  comparisonTokenToOperator,
  decodeQuotedString,
  filterByPartial,
  formatSuggestionValue,
  getCursorContext,
  getOperatorLabel,
  getPqlSuggestions,
  parsePqlExpression,
  stripPartialToken,
  tokenizePql,
  type PqlToken,
} from '../pqlQueryLanguage';

interface Row {
  text: string;
  count: number;
  date: number;
  enabled: boolean;
  status: string;
}

type FieldKey = keyof Row;

const FIELDS: readonly PqlFieldDefinition<Row, FieldKey>[] = [
  {
    key: 'text',
    label: 'Text',
    kind: 'text',
    operators: ['eq', 'neq', 'contains', 'in', 'gt', 'gte', 'lt', 'lte', 'is_set'],
    options: [
      { value: 'simple', label: 'simple' },
      { value: 'two words', label: 'Two words' },
    ],
    getValue: row => row.text,
  },
  {
    key: 'count',
    label: 'Count',
    kind: 'number',
    operators: ['eq', 'gt'],
    getValue: row => row.count,
  },
  {
    key: 'date',
    label: 'Date',
    kind: 'date',
    operators: ['eq', 'gte'],
    getValue: row => row.date,
  },
  {
    key: 'enabled',
    label: 'Enabled',
    kind: 'boolean',
    operators: ['eq'],
    getValue: row => row.enabled,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    operators: ['eq', 'in'],
    options: [
      { value: 'open', label: 'Open' },
      { value: 'in progress', label: 'In progress' },
    ],
    getValue: row => row.status,
  },
];

function token(type: PqlToken['type'], value: string): PqlToken {
  return { type, value, start: 0, end: value.length };
}

describe('PQL lexer and scalar contracts', () => {
  it('tokenizes every lexical category, quote form, and comparison', () => {
    const tokens = tokenizePql(
      ` (a == "x\\"y", b != 'it\\'s') AND c <= -2.5 OR d >= 3 AND e ~= value AND f < 4 AND g > 1 IN CONTAINS IS SET TRUE false `
    );
    expect(tokens.map(entry => entry.type)).toEqual(
      expect.arrayContaining([
        'paren',
        'word',
        'comparison',
        'string',
        'comma',
        'logical',
        'number',
        'in',
        'contains',
        'is',
        'set',
        'boolean',
      ])
    );
    expect(tokens.filter(entry => entry.type === 'comparison').map(entry => entry.value)).toEqual([
      '==',
      '!=',
      '<=',
      '>=',
      '~=',
      '<',
      '>',
    ]);
    expect(tokenizePql('"unterminated')).toEqual([
      { type: 'string', value: '"unterminated', start: 0, end: 13 },
    ]);
    expect(tokenizePql('')).toEqual([]);
  });

  it('decodes strings and maps all operator spellings', () => {
    expect(decodeQuotedString('"hello\\\"world"')).toBe('hello"world');
    expect(decodeQuotedString("'hello\\'world'")).toBe("hello'world");
    expect(decodeQuotedString('"open')).toBe('open');
    const pairs: [string, PqlOperator | null][] = [
      ['==', 'eq'],
      ['!=', 'neq'],
      ['~=', 'contains'],
      ['>', 'gt'],
      ['>=', 'gte'],
      ['<', 'lt'],
      ['<=', 'lte'],
      ['?', null],
    ];
    for (const [source, expected] of pairs) {
      expect(comparisonTokenToOperator(source)).toBe(expected);
    }
    expect(
      ['eq', 'neq', 'contains', 'in', 'gt', 'gte', 'lt', 'lte', 'is_set'].map(operator =>
        getOperatorLabel(operator as PqlOperator)
      )
    ).toEqual(['==', '!=', 'CONTAINS', 'IN', '>', '>=', '<', '<=', 'IS SET']);
    expect(getOperatorLabel('invalid' as PqlOperator)).toBe('==');
  });

  it('coerces token values for every field kind and rejects invalid literals', () => {
    const byKey = buildFieldLookup(FIELDS);
    expect(byKey.get('text')).toBe(FIELDS[0]);
    expect(coerceTokenValue(token('number', '2.5'), byKey.get('count')!)).toBe(2.5);
    expect(coerceTokenValue(token('boolean', 'TRUE'), byKey.get('enabled')!)).toBe(true);
    expect(coerceTokenValue(token('word', '12'), byKey.get('count')!)).toBe(12);
    expect(coerceTokenValue(token('word', 'nope'), byKey.get('count')!)).toBeNull();
    expect(coerceTokenValue(token('word', 'true'), byKey.get('enabled')!)).toBe(true);
    expect(coerceTokenValue(token('word', 'FALSE'), byKey.get('enabled')!)).toBe(false);
    expect(coerceTokenValue(token('word', 'maybe'), byKey.get('enabled')!)).toBeNull();
    expect(coerceTokenValue(token('string', '"hello"'), byKey.get('text')!)).toBe('hello');
    expect(coerceTokenValue(token('word', '2026-08-03'), byKey.get('date')!)).toBeTypeOf('number');
    expect(coerceTokenValue(token('word', '2026-08-03T12:00:00Z'), byKey.get('date')!)).toBe(
      Date.parse('2026-08-03T12:00:00Z')
    );
    expect(coerceTokenValue(token('word', '2026-99-99'), byKey.get('date')!)).toBeNull();
    expect(coerceTokenValue(token('word', 'not-a-date'), byKey.get('date')!)).toBeNull();
  });

  it('formats suggestions and filters partial values', () => {
    expect(formatSuggestionValue('plain:value-1')).toBe('plain:value-1');
    expect(formatSuggestionValue('two words')).toBe('"two words"');
    expect(stripPartialToken(token('string', '"two words"'))).toBe('two words');
    expect(stripPartialToken(token('word', 'status'))).toBe('status');
    expect(filterByPartial(['Alpha', 'Beta'], value => value, '')).toEqual(['Alpha', 'Beta']);
    expect(filterByPartial(['Alpha', 'Beta'], value => value, '  PH ')).toEqual(['Alpha']);
  });
});

describe('PQL parser decision table', () => {
  it.each([
    ['text == hello', 'eq'],
    ['text != hello', 'neq'],
    ['text ~= hello', 'contains'],
    ['text CONTAINS "two words"', 'contains'],
    ['text > a', 'gt'],
    ['text >= a', 'gte'],
    ['text < z', 'lt'],
    ['text <= z', 'lte'],
    ['text IN (simple, "two words")', 'in'],
    ['text IS SET', 'is_set'],
  ])('parses %s', (query, operator) => {
    const result = parsePqlExpression(query, FIELDS);
    expect(result.expression).toMatchObject({ type: 'condition', rule: { operator } });
    expect(result.issues).toEqual([]);
  });

  it('builds AND/OR groups with the expected precedence', () => {
    expect(
      parsePqlExpression('text == a AND count > 1 OR enabled == true', FIELDS).expression
    ).toMatchObject({
      type: 'group',
      combinator: 'or',
      children: [{ type: 'group', combinator: 'and' }, { type: 'condition' }],
    });
    expect(parsePqlExpression('(text == a)', FIELDS).expression).toMatchObject({
      type: 'condition',
    });
  });

  it.each([
    ['', 'Expected a field name'],
    [')', 'Expected a field name'],
    ['unknown == "value"', 'Unknown field'],
    ['unknown == TRUE', 'Unknown field'],
    ['unknown == 2', 'Unknown field'],
    ['unknown == bare', 'Unknown field'],
    ['unknown', 'Expected an operator'],
    ['text', 'Expected an operator'],
    ['count CONTAINS x', 'does not support CONTAINS'],
    ['count IN (1)', 'does not support IN'],
    ['count IS SET', 'does not support IS SET'],
    ['enabled > true', 'does not support >'],
    ['count == nope', 'Expected a value'],
    ['enabled == maybe', 'Expected a value'],
    ['date == not-a-date', 'Expected a value'],
    ['text ==', 'Expected a value'],
    ['text IN simple)', 'Expected "(" after IN'],
    ['text IN (simple', 'Expected ")" to close the IN list'],
    ['text IN () trailing', 'Unexpected token'],
    ['count IN (nope)', 'Expected a value inside the IN list'],
    ['text IS value', 'Expected SET after IS'],
    ['text IS', 'Expected SET after IS'],
    ['(text == a', 'Expected ")" to close the group'],
    ['text == a AND', 'Expected a field name'],
    ['text == a OR', 'Expected a field name'],
  ])('reports %s', (query, expectedIssue) => {
    const result = parsePqlExpression(query, FIELDS);
    expect(result.issues.some(issue => issue.message.includes(expectedIssue))).toBe(true);
  });

  it('validates labels, query text, generated IDs, and parse issues', () => {
    expect(
      buildPqlCodeFilter({ label: ' ', query: 'text == a', fields: FIELDS }).filter
    ).toBeNull();
    expect(buildPqlCodeFilter({ label: 'Valid', query: ' ', fields: FIELDS }).filter).toBeNull();
    expect(buildPqlCodeFilter({ label: 'Valid', query: 'text', fields: FIELDS }).filter).toBeNull();
    const result = buildPqlCodeFilter({ label: '  Valid  ', query: ' text == a ', fields: FIELDS });
    expect(result.filter).toMatchObject({ label: 'Valid', query: 'text == a' });
    expect(result.filter?.id).toBeTypeOf('string');
  });
});

describe('PQL cursor and suggestion state machine', () => {
  it.each([
    ['', 'EXPECT_FIELD'],
    ['text ', 'EXPECT_OPERATOR'],
    ['text == ', 'EXPECT_VALUE'],
    ['text == value ', 'EXPECT_LOGICAL_OR_END'],
    ['text IN ', 'EXPECT_IN_OPEN'],
    ['text IN (', 'EXPECT_IN_VALUE'],
    ['text IN (value ', 'EXPECT_IN_SEPARATOR'],
    ['text IN (value, ', 'EXPECT_IN_VALUE'],
    ['text IN (value) ', 'EXPECT_LOGICAL_OR_END'],
    ['text IS ', 'EXPECT_SET'],
    ['text IS SET ', 'EXPECT_LOGICAL_OR_END'],
    ['text == value AND ', 'EXPECT_FIELD'],
    ['text == value OR ', 'EXPECT_FIELD'],
    ['(text == value) ', 'EXPECT_LOGICAL_OR_END'],
    ['text == "value" ', 'EXPECT_LOGICAL_OR_END'],
    ['count == 1 ', 'EXPECT_LOGICAL_OR_END'],
    ['enabled == true ', 'EXPECT_LOGICAL_OR_END'],
  ])('derives %s as %s', (query, state) => {
    expect(getCursorContext(query, query.length, FIELDS).state).toBe(state);
  });

  it('tracks active partial tokens and their replacement ranges', () => {
    expect(getCursorContext('te', 2, FIELDS)).toMatchObject({
      state: 'EXPECT_FIELD',
      partial: 'te',
      partialStart: 0,
    });
    expect(getCursorContext('text ==', 7, FIELDS)).toMatchObject({
      state: 'EXPECT_OPERATOR',
      partial: '==',
      partialStart: 5,
    });
    expect(getCursorContext('text == "two', 12, FIELDS)).toMatchObject({
      state: 'EXPECT_VALUE',
      partial: 'two',
    });
    expect(getCursorContext('text extra ', 11, FIELDS).state).toBe('EXPECT_OPERATOR');
    expect(getCursorContext('== ', 3, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext('IN ', 3, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext('IS ', 3, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext('SET ', 4, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext(', ', 2, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext('AND ', 4, FIELDS).state).toBe('EXPECT_FIELD');
    expect(getCursorContext('text "wrong" ', 13, FIELDS).state).toBe('EXPECT_OPERATOR');
    expect(getCursorContext('enabled IN (true ', 17, FIELDS).state).toBe('EXPECT_IN_SEPARATOR');
  });

  it('offers every suggestion category and value formatting variant', () => {
    expect(getPqlSuggestions('', 0, FIELDS).map(entry => entry.label)).toContain('(');
    expect(getPqlSuggestions('zzz', 3, FIELDS)).toEqual([]);
    expect(getPqlSuggestions('text ', 5, FIELDS).map(entry => entry.label)).toEqual(
      expect.arrayContaining(['==', 'IN', 'IS SET'])
    );
    expect(getPqlSuggestions('text C', 6, FIELDS).map(entry => entry.label)).toEqual(['CONTAINS']);
    expect(getPqlSuggestions('text IS ', 8, FIELDS)).toEqual([
      expect.objectContaining({ label: expect.any(String), insertText: 'SET ' }),
    ]);
    expect(getPqlSuggestions('enabled == ', 11, FIELDS).map(entry => entry.label)).toEqual([
      'true',
      'false',
    ]);
    expect(getPqlSuggestions('enabled == tr', 13, FIELDS).map(entry => entry.label)).toEqual([
      'true',
    ]);
    expect(getPqlSuggestions('enabled IN (', 12, FIELDS).map(entry => entry.insertText)).toEqual([
      'true',
      'false',
    ]);
    expect(getPqlSuggestions('text == ', 8, FIELDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'simple', detail: 'text' }),
        expect.objectContaining({ label: 'Two words', detail: 'two words' }),
      ])
    );
    expect(getPqlSuggestions('status == ', 10, FIELDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open', insertText: 'Open ', detail: 'open' }),
        expect.objectContaining({ label: 'In progress', insertText: '"In progress" ' }),
      ])
    );
    expect(getPqlSuggestions('status == Op', 12, FIELDS).map(entry => entry.label)).toEqual([
      'Open',
    ]);
    expect(getPqlSuggestions('status IN ', 10, FIELDS)).toEqual([
      expect.objectContaining({ label: '(', kind: 'paren' }),
    ]);
    expect(getPqlSuggestions('status IN (', 11, FIELDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open', insertText: 'Open' }),
        expect.objectContaining({ label: 'In progress', insertText: '"In progress"' }),
      ])
    );
    expect(getPqlSuggestions('status IN (Open ', 16, FIELDS).map(entry => entry.label)).toEqual([
      ',',
      ')',
    ]);
    expect(getPqlSuggestions('status == Open ', 15, FIELDS).map(entry => entry.label)).toEqual([
      'AND',
      'OR',
      ')',
    ]);
    expect(getPqlSuggestions('status == Open A', 16, FIELDS).map(entry => entry.label)).toEqual([
      'AND',
      ')',
    ]);
  });

  it('applies replacements in the middle of an existing query', () => {
    expect(
      applyPqlSuggestion('before xx after', 9, {
        label: 'value',
        insertText: 'replacement',
        kind: 'value',
        replaceStart: 7,
        replaceEnd: 9,
      })
    ).toEqual({ value: 'before replacement after', caretPosition: 18 });
  });
});
