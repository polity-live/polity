import postgres, { type Sql } from 'postgres';

export type E2EDatabase = Sql<Record<string, unknown>>;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let sql: E2EDatabase | undefined;

export function e2eDatabaseUrl() {
  return process.env.E2E_DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function e2eBaseUrl() {
  return process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
}

export function db() {
  if (!sql) {
    const raw = postgres(e2eDatabaseUrl(), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => undefined,
      connection: {
        application_name: 'polity-e2e',
        statement_timeout: 10_000,
        lock_timeout: 3_000,
        idle_in_transaction_session_timeout: 10_000,
      },
    });
    sql = wrapSqlForCleanupScripts(raw) as E2EDatabase;
  }

  return sql;
}

function wrapSqlForCleanupScripts(raw: E2EDatabase) {
  return new Proxy(raw, {
    apply(target, thisArg, argArray) {
      const [strings, ...values] = argArray;
      if (isTemplateStringsArray(strings) && countSemicolons(strings.join('')) > 1) {
        return raw.unsafe(interpolateUnsafeSql(strings, values), [], { prepare: false });
      }

      return Reflect.apply(target, thisArg, argArray);
    },
  });
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as { raw?: unknown }).raw);
}

function countSemicolons(value: string) {
  return value.match(/;/g)?.length ?? 0;
}

function interpolateUnsafeSql(strings: TemplateStringsArray, values: unknown[]) {
  let query = '';
  for (let index = 0; index < strings.length; index += 1) {
    query += strings[index];
    if (index < values.length) {
      query += toSqlLiteral(values[index]);
    }
  }
  return query;
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return quoteSql(value.toISOString());
  if (typeof value === 'object') return quoteSql(JSON.stringify(value));
  return quoteSql(String(value));
}

function quoteSql(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function closeDb() {
  if (!sql) return;
  await sql.end({ timeout: 5 });
  sql = undefined;
}

export async function checkDatabase() {
  const result =
    await db()`select current_database() as database_name, current_schema() as schema_name`;
  if (!result[0]?.database_name) {
    throw new Error('E2E database preflight failed: no database was returned.');
  }
}

export async function runCleanupStep(name: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[e2e cleanup] skipped ${name}: ${message}`);
  }
}
