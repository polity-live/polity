import { describe, expect, it } from 'vitest';
import {
  applyPqlFilter,
  countPqlRules,
  createPqlCondition,
  createPqlFieldRegistry,
  formatPqlScalar,
  getPqlFilterExpression,
  getPqlQueryOperatorToken,
  hasPqlValue,
  isPqlExpressionCondition,
  isPqlScalar,
  matchesPqlComparable,
  matchesPqlContains,
  matchesPqlEq,
  matchesPqlExpression,
  matchesPqlFilter,
  matchesPqlIn,
  matchesPqlRule,
  needsQuotedPqlString,
  normalizePqlFieldValues,
  normalizePqlRuleScalar,
  normalizePqlRuleValues,
  normalizePqlScalar,
  serializePqlExpression,
  serializePqlExpressionWithParentheses,
  serializePqlFilter,
  serializePqlRule,
  toPqlSearchableString,
  type PqlExpression,
  type PqlFieldDefinition,
  type PqlOperator,
  type PqlRule,
} from '../applyPqlFilter';

interface Row {
  text: unknown;
  count: unknown;
  date: unknown;
  enabled: unknown;
  status: unknown;
}

type Key = keyof Row;

const FIELDS: readonly PqlFieldDefinition<Row, Key>[] = [
  {
    key: 'text',
    label: 'Text',
    kind: 'text',
    operators: ['eq', 'neq', 'contains', 'in', 'is_set'],
    getValue: row => row.text as never,
  },
  {
    key: 'count',
    label: 'Count',
    kind: 'number',
    operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
    getValue: row => row.count as never,
  },
  {
    key: 'date',
    label: 'Date',
    kind: 'date',
    operators: ['eq'],
    getValue: row => row.date as never,
  },
  {
    key: 'enabled',
    label: 'Enabled',
    kind: 'boolean',
    operators: ['eq'],
    getValue: row => row.enabled as never,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    operators: ['eq', 'in'],
    options: [
      { value: 'open', label: 'Open', keywords: ['active'] },
      { value: 'closed', label: 'Closed' },
    ],
    getValue: row => row.status as never,
  },
];

const registry = createPqlFieldRegistry(FIELDS);
const fieldsByKey = Object.fromEntries(FIELDS.map(field => [field.key, field])) as Record<
  Key,
  PqlFieldDefinition<Row, Key>
>;

function rule(fieldKey: Key, operator: PqlOperator, value: PqlRule<Key>['value']): PqlRule<Key> {
  return { id: `${fieldKey}-${operator}`, fieldKey, operator, value };
}

describe('PQL normalization contracts', () => {
  it('normalizes every supported scalar and collection shape', () => {
    const date = new Date('2026-08-03T00:00:00Z');
    expect(isPqlScalar('text')).toBe(true);
    expect(isPqlScalar(1)).toBe(true);
    expect(isPqlScalar(false)).toBe(true);
    expect(isPqlScalar(date)).toBe(false);
    expect(isPqlScalar(null)).toBe(false);
    expect(normalizePqlScalar(date)).toBe(date.getTime());
    expect(normalizePqlScalar('text')).toBe('text');
    expect(normalizePqlScalar(undefined)).toBeNull();
    expect(normalizePqlFieldValues(['a', null, date, undefined, 2])).toEqual([
      'a',
      date.getTime(),
      2,
    ]);
    expect(normalizePqlFieldValues('single')).toEqual(['single']);
    expect(normalizePqlFieldValues(null)).toEqual([]);
  });

  it('normalizes rule literals by field kind and option vocabulary', () => {
    expect(normalizePqlRuleScalar(fieldsByKey.count, 2)).toBe(2);
    expect(normalizePqlRuleScalar(fieldsByKey.count, ' 2.5 ')).toBe(2.5);
    expect(normalizePqlRuleScalar(fieldsByKey.count, 'nope')).toBe('nope');
    expect(normalizePqlRuleScalar(fieldsByKey.date, '2026-08-03')).toBeTypeOf('number');
    expect(normalizePqlRuleScalar(fieldsByKey.date, '2026-99-99')).toBe('2026-99-99');
    expect(normalizePqlRuleScalar(fieldsByKey.date, '2026-08-03T12:00:00Z')).toBe(
      Date.parse('2026-08-03T12:00:00Z')
    );
    expect(normalizePqlRuleScalar(fieldsByKey.date, 'not-a-date')).toBe('not-a-date');
    expect(normalizePqlRuleScalar(fieldsByKey.enabled, ' TRUE ')).toBe(true);
    expect(normalizePqlRuleScalar(fieldsByKey.enabled, 'false')).toBe(false);
    expect(normalizePqlRuleScalar(fieldsByKey.enabled, 'other')).toBe('other');
    expect(normalizePqlRuleScalar(fieldsByKey.status, 'OPEN')).toBe('open');
    expect(normalizePqlRuleScalar(fieldsByKey.status, 'Active')).toBe('open');
    expect(normalizePqlRuleScalar(fieldsByKey.status, 'missing')).toBe('missing');
    expect(normalizePqlRuleValues(fieldsByKey.status, ['Open', 'Closed'])).toEqual([
      'open',
      'closed',
    ]);
    expect(normalizePqlRuleValues(fieldsByKey.status, null)).toEqual([]);
    expect(normalizePqlRuleValues(fieldsByKey.status, 'Open')).toEqual(['open']);
  });
});

describe('PQL primitive matcher contracts', () => {
  it('covers empty, matching, and nonmatching values', () => {
    expect(hasPqlValue([])).toBe(false);
    expect(hasPqlValue([0])).toBe(true);
    expect(matchesPqlEq([], [1])).toBe(false);
    expect(matchesPqlEq([1], [])).toBe(false);
    expect(matchesPqlEq([1, 2], [2])).toBe(true);
    expect(matchesPqlEq([1], [2])).toBe(false);
    expect(matchesPqlContains([], ['a'])).toBe(false);
    expect(matchesPqlContains([' Alpha '], ['PH'])).toBe(true);
    expect(matchesPqlContains(['Alpha'], ['z'])).toBe(false);
    expect(matchesPqlIn([], ['a'])).toBe(false);
    expect(matchesPqlIn(['a'], [])).toBe(false);
    expect(matchesPqlIn(['a', 'b'], ['b'])).toBe(true);
    expect(matchesPqlIn(['a'], ['b'])).toBe(false);
    expect(toPqlSearchableString(' Alpha ')).toBe('alpha');
  });

  it('compares only numeric field and rule values', () => {
    const greater = (left: number, right: number) => left > right;
    expect(matchesPqlComparable([], [1], greater)).toBe(false);
    expect(matchesPqlComparable([1], [], greater)).toBe(false);
    expect(matchesPqlComparable([1], ['1'], greater)).toBe(false);
    expect(matchesPqlComparable(['text', 3], [2], greater)).toBe(true);
    expect(matchesPqlComparable(['text', 1], [2], greater)).toBe(false);
  });
});

describe('PQL rule and expression evaluation', () => {
  const row: Row = {
    text: ['Alpha', null],
    count: 5,
    date: new Date('2026-08-03T00:00:00Z'),
    enabled: true,
    status: 'open',
  };

  it.each([
    [rule('text', 'eq', 'Alpha'), true],
    [rule('text', 'neq', 'Beta'), true],
    [rule('text', 'contains', 'ph'), true],
    [rule('text', 'in', ['Alpha']), true],
    [rule('count', 'gt', 4), true],
    [rule('count', 'gte', 5), true],
    [rule('count', 'lt', 6), true],
    [rule('count', 'lte', 5), true],
    [rule('text', 'is_set', null), true],
  ])('evaluates %#', (candidate, expected) => {
    expect(matchesPqlRule(row, candidate as PqlRule<Key>, registry)).toBe(expected);
  });

  it('rejects unknown fields, unsupported operators, and defensive operator values', () => {
    expect(matchesPqlRule(row, rule('enabled', 'contains', 'true'), registry)).toBe(false);
    expect(
      matchesPqlRule(row, { ...rule('text', 'eq', 'Alpha'), fieldKey: 'missing' as Key }, registry)
    ).toBe(false);
    expect(matchesPqlRule(row, rule('text', 'invalid' as PqlOperator, 'Alpha'), registry)).toBe(
      false
    );
    const invalidRegistry = createPqlFieldRegistry([
      { ...fieldsByKey.text, operators: ['invalid' as PqlOperator] },
    ]);
    expect(
      matchesPqlRule(row, rule('text', 'invalid' as PqlOperator, 'Alpha'), invalidRegistry)
    ).toBe(false);
  });

  it('evaluates condition, empty, OR, and AND expressions', () => {
    const yes = createPqlCondition(rule('status', 'eq', 'open'));
    const no = createPqlCondition(rule('status', 'eq', 'closed'));
    expect(isPqlExpressionCondition(yes)).toBe(true);
    expect(isPqlExpressionCondition({ type: 'group', combinator: 'and', children: [] })).toBe(
      false
    );
    expect(matchesPqlExpression(row, yes, registry)).toBe(true);
    expect(
      matchesPqlExpression(row, { type: 'group', combinator: 'and', children: [] }, registry)
    ).toBe(true);
    expect(
      matchesPqlExpression(row, { type: 'group', combinator: 'or', children: [no, yes] }, registry)
    ).toBe(true);
    expect(
      matchesPqlExpression(row, { type: 'group', combinator: 'or', children: [no] }, registry)
    ).toBe(false);
    expect(
      matchesPqlExpression(row, { type: 'group', combinator: 'and', children: [yes, no] }, registry)
    ).toBe(false);
    expect(
      matchesPqlExpression(row, { type: 'group', combinator: 'and', children: [yes] }, registry)
    ).toBe(true);
  });

  it('applies optional filters and expressions', () => {
    const filter = {
      id: 'filter',
      label: 'Open',
      expression: createPqlCondition(rule('status', 'eq', 'open')),
    };
    expect(getPqlFilterExpression({ id: 'empty', label: 'Empty' })).toBeNull();
    expect(matchesPqlFilter(row, { id: 'empty', label: 'Empty' }, registry)).toBe(true);
    expect(matchesPqlFilter(row, filter, registry)).toBe(true);
    expect(applyPqlFilter([row], null, registry)).toEqual([row]);
    expect(applyPqlFilter([row, { ...row, status: 'closed' }], filter, registry)).toEqual([row]);
  });
});

describe('PQL counting and serialization', () => {
  const a = createPqlCondition(rule('text', 'eq', 'plain'));
  const b = createPqlCondition(rule('count', 'gt', 1));
  const nested: PqlExpression<Key> = {
    type: 'group',
    combinator: 'and',
    children: [a, { type: 'group', combinator: 'or', children: [a, b] }],
  };

  it('counts null, missing, condition, and nested rules', () => {
    expect(countPqlRules(null)).toBe(0);
    expect(countPqlRules({ id: 'empty', label: 'Empty' })).toBe(0);
    expect(countPqlRules({ id: 'one', label: 'One', expression: a })).toBe(1);
    expect(countPqlRules({ id: 'nested', label: 'Nested', expression: nested })).toBe(3);
  });

  it('formats all scalar and operator forms', () => {
    expect(formatPqlScalar('plain')).toBe('plain');
    expect(formatPqlScalar('two words')).toBe('"two words"');
    expect(formatPqlScalar(2)).toBe('2');
    expect(formatPqlScalar(false)).toBe('false');
    expect(needsQuotedPqlString('plain:value')).toBe(false);
    expect(needsQuotedPqlString('two words')).toBe(true);
    expect(
      ['eq', 'neq', 'contains', 'in', 'gt', 'gte', 'lt', 'lte', 'is_set'].map(operator =>
        getPqlQueryOperatorToken(operator as PqlOperator)
      )
    ).toEqual(['==', '!=', 'CONTAINS', 'IN', '>', '>=', '<', '<=', 'IS SET']);
    expect(getPqlQueryOperatorToken('invalid' as PqlOperator)).toBe('==');
  });

  it('serializes rules, precedence, and query-preserving filters', () => {
    expect(serializePqlRule(rule('text', 'is_set', null))).toBe('text IS SET');
    expect(serializePqlRule(rule('status', 'in', ['open', 'two words']))).toBe(
      'status IN (open, "two words")'
    );
    expect(serializePqlRule(rule('status', 'in', 'open'))).toBe('status IN ()');
    expect(serializePqlRule(rule('text', 'eq', ['first', 'second']))).toBe('text == first');
    expect(serializePqlRule(rule('text', 'eq', null))).toBe('text == null');
    expect(serializePqlRule(rule('count', 'gt', 1))).toBe('count > 1');
    expect(serializePqlExpression(a)).toBe('text == plain');
    expect(serializePqlExpression(nested)).toBe('text == plain AND (text == plain OR count > 1)');
    expect(serializePqlExpressionWithParentheses(nested, 'and')).not.toContain(
      '(text == plain AND'
    );
    expect(
      serializePqlFilter({ id: 'query', label: 'Query', query: ' text == direct ', expression: a })
    ).toBe('text == direct');
    expect(
      serializePqlFilter({ id: 'expression', label: 'Expression', query: ' ', expression: a })
    ).toBe('text == plain');
    expect(serializePqlFilter({ id: 'empty', label: 'Empty' })).toBe('');
  });
});
