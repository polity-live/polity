import { required } from './required';
import postgres from 'postgres';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Fixtures } from './fixtures';
import { loadCases, buildQuery, OWNER, OUTSIDER } from './catalog';
import { queryAST, expectedRootIDs } from './oracle';
import { actorUser, ensureE2EAuthUser } from '../../../e2e/fixtures/auth';
import { closeDb } from '../../../e2e/fixtures/db';
import { securityScenarios } from './security';
import assert from 'node:assert/strict';

const sql = postgres(required(process.env.E2E_DATABASE_URL), {
  max: 2,
  prepare: false,
  onnotice: () => undefined,
  connection: { statement_timeout: 10_000, lock_timeout: 3_000 },
});
const fixtures = new Fixtures(sql);
const failures: { name: string; error: string }[] = [];
const all = loadCases();
const selected: string[] | undefined = process.env.ZERO_PERFORMANCE_SELECTION
  ? JSON.parse(await readFile(process.env.ZERO_PERFORMANCE_SELECTION, 'utf8'))
  : undefined;
if (
  selected &&
  (!selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some(key => !all.some(entry => `${entry.name}/${entry.variant}` === key)))
)
  throw new Error('Invalid fixture preflight selection');
const entries = all.filter(
  entry => !selected || selected.includes(`${entry.name}/${entry.variant}`)
);
const completed: string[] = [];
try {
  for (const [name, context] of Object.entries({ owner: OWNER, outsider: OUTSIDER }))
    await ensureE2EAuthUser({
      ...actorUser(`zero-performance-${name}`),
      id: context.userID,
      email: context.email,
    });
  await fixtures.inspect();
  for (const entry of entries) {
    try {
      const ast = queryAST(buildQuery(entry));
      const anchor = await fixtures.seed(ast);
      const expected = await expectedRootIDs(sql, ast, fixtures.columns);
      if (
        entry.variant === 'next-page' &&
        !(await expectedRootIDs(sql, { ...ast, start: undefined }, fixtures.columns)).includes(
          anchor
        )
      )
        throw new Error('Cursor row is outside the allowed query result');
      if (entry.variant !== 'next-page' && !expected.includes(anchor))
        throw new Error(`Positive anchor ${anchor} absent; got ${expected}`);
    } catch (error) {
      failures.push({ name: `${entry.name}/${entry.variant}`, error: String(error) });
    } finally {
      await fixtures.cleanup();
      completed.push(`${entry.name}/${entry.variant}`);
    }
    await writeFile(
      path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'fixtures.json'),
      JSON.stringify(failures, null, 2)
    );
    console.info(
      `${entry.name}/${entry.variant}: ${failures.at(-1)?.name === `${entry.name}/${entry.variant}` ? 'failed' : 'fixture ready'}`
    );
  }
  if (!selected)
    await securityScenarios(sql, async (name, variant, args, actor, expected) => {
      const entry = required(
        loadCases().find(entry => entry.name === name && entry.variant === 'default')
      );
      const context =
        actor === 'owner' ? OWNER : actor === 'outsider' ? OUTSIDER : { userID: 'anon', email: '' };
      const actual = await expectedRootIDs(
        sql,
        queryAST(buildQuery({ ...entry, args }, context)),
        fixtures.columns
      );
      try {
        assert.deepEqual(actual, expected);
      } catch (error) {
        failures.push({ name: `${name}/security-${variant}/${actor}`, error: String(error) });
      }
    });
  await writeFile(
    path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'fixtures.json'),
    JSON.stringify(failures, null, 2)
  );
  console.table(failures);
  await writeFile(
    path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'preflight.json'),
    JSON.stringify(
      { expected: entries.map(entry => `${entry.name}/${entry.variant}`), completed, failures },
      null,
      2
    )
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
  await closeDb();
}
