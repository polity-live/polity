import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stableJson } from '../../src/features/collaboration/logic/codec';
import { rows, type SqlTransaction } from '../../src/server/collaboration/transaction';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function sourceFingerprint() {
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean);
  const selected = [...new Set(files)].filter(
    f =>
      /^(src\/|tools\/|supabase\/|package\.json$|pnpm-|vite|vitest|playwright|tsconfig|oxlint|\.prettier)/.test(
        f
      ) &&
      !f.endsWith('release-readiness.json') &&
      !f.endsWith('IMPLEMENTATION.md')
  );
  return hash(
    selected
      .sort()
      .map(f => {
        try {
          return `${f}:${hash(readFileSync(f))}`;
        } catch {
          return `${f}:deleted`;
        }
      })
      .join('\n')
  );
}
export async function schemaFingerprint(sql: SqlTransaction) {
  const definitions = [];
  for (const query of [
    "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    "select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname",
    "select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname",
    "select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname,pg_get_function_identity_arguments(p.oid)",
    "select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname",
    "select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname",
  ])
    definitions.push(await rows(sql, query));
  return hash(stableJson(definitions));
}
export const acceptanceGates = [
  'format',
  'lint',
  'types',
  'static',
  'coverage',
  'changed-coverage',
  'browser-components',
  'security',
  'build',
  'database',
  'multiuser',
  'migration',
  'exports',
  'restart',
] as const;
export async function assertAcceptance(sql: SqlTransaction, local: boolean) {
  const file =
    process.env.COLLABORATION_ACCEPTANCE_REPORT || 'output/collaboration-migration/acceptance.json';
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (
    report.status !== 'passed' ||
    report.source !== sourceFingerprint() ||
    report.lockfile !== hash(readFileSync('pnpm-lock.yaml')) ||
    report.schema !== (await schemaFingerprint(sql)) ||
    acceptanceGates.some(g => report.gates?.[g]?.status !== 'passed')
  )
    throw new Error(
      'Acceptance evidence is missing, incomplete or belongs to a different working tree/schema'
    );
  if (!local) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() ||
      report.releaseCommit !== commit ||
      process.env.COLLABORATION_PRODUCTION_APPROVAL !== commit
    )
      throw new Error(
        'Production needs a clean release commit and separate explicit release approval'
      );
  }
  return report;
}
