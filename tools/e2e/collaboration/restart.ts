import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { governanceManifest } from '../../../src/server/collaboration/migration';
import { stableJson } from '../../../src/features/collaboration/logic/codec';
import { lockAuthority } from '../../../src/server/collaboration/transaction';

const url = new URL(process.env.ZERO_UPSTREAM_DB || '');
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '54322');
const finalLocal = process.env.COLLABORATION_FINAL_LOCAL === '1';
if (finalLocal) assert.equal(url.pathname, '/postgres');
else assert.match(url.pathname, /^\/polity_collaboration_acceptance_\d+$/);
const digest = (value: unknown) => createHash('sha256').update(stableJson(value)).digest('hex');
async function snapshot() {
  const sql = postgres(url.toString(), { max: 1 });
  try {
    return await sql.begin(async tx => {
      const adapter = {
        query: async (statement: string, args: unknown[] = []) =>
          Array.from(await tx.unsafe(statement, args as postgres.ParameterOrJSON<never>[])),
      };
      await lockAuthority(adapter);
      const [control] =
        await tx`select phase,compatibility from collaboration_control where singleton`;
      assert.equal(control.phase, 'active');
      assert.equal(control.compatibility, false);
      return {
        database: url.pathname,
        documents: digest(
          await tx`select id,kind,entity_id,branch_id,workspace_id,generation,revision,checksum,projection from collaboration_document order by id`
        ),
        history: digest(await tx`select * from collaboration_revision order by id`),
        comments: digest(await tx`select * from collaboration_comment order by document_id,id`),
        commentHistory: digest(
          await tx`select * from collaboration_comment_history order by document_id,comment_id,revision`
        ),
        commands: digest(
          await tx`select * from collaboration_command order by document_id,operation_id`
        ),
        proposals: digest(
          await tx`select * from collaboration_proposal order by change_request_id`
        ),
        governance: await governanceManifest(adapter),
      };
    });
  } finally {
    await sql.end();
  }
}
const stack = JSON.parse(readFileSync('output/local-stack/stack.json', 'utf8'));
const response = await fetch(`http://127.0.0.1:${stack.controlPort}/status`, {
  headers: { Authorization: `Bearer ${stack.token}` },
});
const status = await response.json();
assert.equal(status.database.name, url.pathname.slice(1));
assert(status.services.every((service: { ready: boolean }) => service.ready));
const before = await snapshot();
console.log('Captured authoritative state; stopping all local services and Supabase');
execFileSync(process.execPath, ['tools/collaboration/local-stack.mjs', 'stop'], {
  windowsHide: true,
  stdio: 'inherit',
  timeout: 180_000,
});
execFileSync(process.execPath, ['tools/collaboration/local-stack.mjs', 'start'], {
  windowsHide: true,
  stdio: 'inherit',
  timeout: 300_000,
  env: { ...process.env, COLLABORATION_TEST_DATABASE: finalLocal ? '' : url.pathname.slice(1) },
});
assert.deepEqual(
  await snapshot(),
  before,
  'A full restart must preserve every acknowledged document, comment, command, decision and revision'
);
writeFileSync(
  'output/collaboration-migration/restart-proof.json',
  JSON.stringify({ passed: true, completedAt: new Date().toISOString(), ...before }, null, 2)
);
console.log(
  'PASS full stack restart retained documents, comments, commands, revisions, rights and decisions'
);
process.exit(0);
