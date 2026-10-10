import { writeFileSync } from 'node:fs';
import { rootSQL } from '../tools/e2e/zero-performance/oracle.ts';

const cases = [
  ['asc-value', 'asc', 'A', 'c', true, ['d', 'e', 'f']],
  ['asc-null', 'asc', null, 'a', true, ['b', 'c', 'd', 'e', 'f']],
  ['desc-value', 'desc', 'A', 'c', true, ['d', 'a', 'b']],
  ['desc-null', 'desc', null, 'a', true, ['b']],
  ['desc-null-inclusive', 'desc', null, 'a', false, ['a', 'b']],
];
const literal = value => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const statements = cases.map(([name, direction, first_name, id, exclusive, expected]) => {
  const query = rootSQL({ table: 'user', orderBy: [['first_name', direction]], start: { row: { first_name, id }, exclusive } }, new Map());
  const text = query.text.replaceAll('public."user"', 'fixture')
    .replace(/\$(\d+)/g, (_, n) => literal(query.values[Number(n) - 1]));
  return `WITH fixture(id, first_name) AS (VALUES ('a', NULL::text), ('b', NULL::text), ('c', 'A'), ('d', 'A'), ('e', 'B'), ('f', 'C')), actual AS (${text}) SELECT ${literal(name)} AS scenario, array_agg(key0) = ARRAY[${expected.map(literal).join(', ')}] AS passed FROM actual;`;
});
writeFileSync('work/oracle-cursors.sql', statements.join('\n'));
