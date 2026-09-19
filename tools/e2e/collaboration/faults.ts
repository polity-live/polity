import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import postgres from 'postgres';
import { dbProvider } from '../../../src/zero/db-provider';
import { loadStored, commitState } from '../../../src/server/collaboration/store';
import { lockAuthority, rows } from '../../../src/server/collaboration/transaction';
import { reconcileProjection } from '../../../src/features/collaboration/logic/reconcile';
import type { Value } from 'platejs';

const url = new URL(process.env.ZERO_UPSTREAM_DB || '');
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '54322');
assert.match(url.pathname, /^\/polity_collaboration_acceptance_\d+$/);
const demo = JSON.parse(readFileSync('output/local-stack/demo.json', 'utf8'));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 30_000;
  while (!(await predicate())) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await delay(100);
  }
}
const mode = process.argv[3];
if (mode === 'before-commit' || mode === 'after-commit') {
  await dbProvider.transaction(async tx => {
    const sql = tx.dbTransaction;
    await lockAuthority(sql);
    const [source] = await rows<{ id: string }>(
      sql,
      "select id from collaboration_document where kind='document' and entity_id=$1 and workspace_id is null",
      [demo.ids.personal]
    );
    const doc = await loadStored(sql, source.id);
    const content = [
      ...(doc.projection as Value),
      { id: crypto.randomUUID(), type: 'p', children: [{ text: `Fault acceptance ${mode}` }] },
    ];
    await commitState(
      sql,
      doc,
      reconcileProjection('document', doc.state, content),
      demo.actors.owner.id,
      `fault:${crypto.randomUUID()}`
    );
    if (mode === 'before-commit') {
      console.log('FAULT_PREPARED');
      await new Promise(() => undefined);
    }
  });
  console.log('FAULT_COMMITTED');
  setInterval(() => undefined, 1000);
} else {
  const sql = postgres(url.toString(), { max: 1 }),
    leader = postgres(url.toString(), { max: 1, idle_timeout: 0 });
  const children: ChildProcess[] = [];
  let held = false;
  const stack = JSON.parse(readFileSync('output/local-stack/stack.json', 'utf8'));
  async function status() {
    const response = await fetch(`http://127.0.0.1:${stack.controlPort}/status`, {
      headers: { Authorization: `Bearer ${stack.token}` },
    });
    assert(response.ok);
    return response.json();
  }
  function kill(pid: number) {
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      assert.equal(result.status, 0);
    } else process.kill(pid, 'SIGKILL');
  }
  async function worker(args: string[], marker: string) {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'tools/collaboration/launch.ts', ...args],
      { env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    children.push(child);
    let output = '';
    assert(child.stdout && child.stderr);
    child.stdout.on('data', chunk => {
      output = (output + chunk).slice(-12_000);
    });
    child.stderr.on('data', chunk => {
      output = (output + chunk).slice(-12_000);
    });
    await until(async () => {
      if (output.includes(marker)) return true;
      assert(child.exitCode === null, `Worker exited: ${output}`);
      return false;
    }, marker);
    return child;
  }
  async function snapshot() {
    const [doc] =
      await sql`select id,generation,revision,checksum,projection from collaboration_document where kind='document' and entity_id=${demo.ids.personal} and workspace_id is null`;
    const [counts] =
      await sql`select (select count(*) from collaboration_revision where document_id=${doc.id})::int as history,(select count(*) from collaboration_outbox where document_id=${doc.id})::int as outbox`;
    return { ...doc, ...counts };
  }
  try {
    const current = await status();
    assert.equal(current.database.name, url.pathname.slice(1));
    assert.equal(current.database.phase, 'active');
    assert(current.services.every((service: { ready: boolean }) => service.ready));
    const before = await snapshot();
    const prepared = await worker(['faults', 'before-commit'], 'FAULT_PREPARED');
    assert(prepared.pid);
    kill(prepared.pid);
    await until(
      async () => prepared.exitCode !== null || prepared.signalCode !== null,
      'worker exit'
    );
    assert.deepEqual(
      await snapshot(),
      before,
      'Process death before commit must leave no content, history or outbox'
    );
    console.log('PASS process death before commit rolled back content, history and delivery');

    // Hold the writer lease after stopping the real service. The supervisor's
    // replacement must fail closed until this lease is released.
    kill(
      current.services.find((service: { name: string }) => service.name === 'collaboration').pid
    );
    const [lease] = await leader`select pg_try_advisory_lock(1886351982) as acquired`;
    assert(lease.acquired);
    held = true;
    const committed = await worker(['faults', 'after-commit'], 'FAULT_COMMITTED');
    assert(committed.pid);
    kill(committed.pid);
    const saved = await snapshot();
    assert.equal(Number(saved.revision), Number(before.revision) + 1);
    assert.equal(saved.history, before.history + 1);
    assert.equal(saved.outbox, before.outbox + 1);
    const [pending] =
      await sql`select count(*)::int as count from collaboration_outbox where document_id=${saved.id} and delivered_at is null`;
    assert(pending.count > 0, 'Committed state must retain its durable delivery obligation');
    // A real competing process must reject the lease, not bind another writer.
    const standby = await worker(['server'], 'A collaboration writer is already active');
    await until(async () => standby.exitCode !== null, 'standby rejection');
    assert.notEqual(standby.exitCode, 0);
    const restarted = Date.now();
    await leader`select pg_advisory_unlock(1886351982)`;
    held = false;
    await until(async () => {
      const state = await status();
      return (
        state.services.find((service: { name: string }) => service.name === 'collaboration')
          ?.ready && state.database.pending_deliveries === 0
      );
    }, 'committed outbox replay after leader restart');
    assert(Date.now() - restarted < 30_000);
    assert.deepEqual(
      await snapshot(),
      saved,
      'Restart and replay may not apply a confirmed change twice'
    );
    console.log(
      'PASS process death after commit retained and replayed one revision; competing writer rejected'
    );
    writeFileSync(
      'output/collaboration-migration/faults.json',
      JSON.stringify(
        {
          passed: true,
          database: url.pathname,
          completedAt: new Date().toISOString(),
          reconnectMs: Date.now() - restarted,
          revisionBefore: before.revision,
          revisionAfter: saved.revision,
          checks: [
            'death-before-commit',
            'death-after-commit-before-delivery',
            'competing-writer-rejected',
            'outbox-replayed-once',
          ],
        },
        null,
        2
      )
    );
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null && child.pid) kill(child.pid);
    if (held) await leader`select pg_advisory_unlock(1886351982)`;
    await leader.end();
    await sql.end();
  }
  process.exit(0);
}
