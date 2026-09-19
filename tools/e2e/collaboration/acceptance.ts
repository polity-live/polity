import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import postgres from 'postgres';
import { projectDocument, stableJson } from '../../../src/features/collaboration/logic/codec';
import { reconcileProjection } from '../../../src/features/collaboration/logic/reconcile';
import type {
  CollaborationSession,
  DocumentKind,
} from '../../../src/features/collaboration/logic/types';

const database = new URL(process.env.ZERO_UPSTREAM_DB || '');
assert(['127.0.0.1', 'localhost'].includes(database.hostname));
assert.match(database.pathname, /^\/polity_collaboration_acceptance_\d+$/);
const demo = JSON.parse(readFileSync('output/local-stack/demo.json', 'utf8'));
const sql = postgres(database.toString(), { max: 1 });
const tokens = new Map<string, string>();
const results: { name: string; durationMs: number }[] = [];
let load:
  | {
      editors: number;
      confirmedEdits: number;
      commitSamples: number;
      commitP95Ms: number;
      reconnectMs: number;
    }
  | undefined;
const peers: { doc: Y.Doc; provider: HocuspocusProvider; socket: HocuspocusProviderWebsocket }[] =
  [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean | Promise<boolean>, label: string, timeout = 30_000) {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeout) throw new Error(`Timeout: ${label}`);
    await delay(50);
  }
}
async function token(actor: string) {
  if (!tokens.has(actor)) {
    const client = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await client.auth.signInWithPassword({
      email: demo.actors[actor].email,
      password: demo.password,
    });
    assert.ifError(error);
    assert(data.session);
    tokens.set(actor, data.session.access_token);
  }
  const saved = tokens.get(actor);
  assert(saved);
  return saved;
}
async function request<T>(
  actor: string,
  operation: string,
  data: object,
  status = 200
): Promise<T> {
  const response = await fetch('http://localhost:3000/api/collaboration', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token(actor)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...data }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await response.json();
  assert.equal(response.status, status, `${actor} ${operation}: ${JSON.stringify(body)}`);
  return body as T;
}
async function session(
  actor: string,
  name: string,
  kind: DocumentKind = 'document',
  branchId: string | null = null
) {
  const result = await request<{ phase: string; session: CollaborationSession }>(actor, 'session', {
    reference: { kind, entityId: demo.ids[name], branchId, workspaceId: null },
  });
  assert.equal(
    result.phase,
    'active',
    'The HTTP application must use the active acceptance database'
  );
  return result.session;
}
function address(s: CollaborationSession) {
  return { id: s.id, generation: s.generation };
}
function value(s: CollaborationSession) {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, Buffer.from(s.state, 'base64'));
    return projectDocument(s.reference.kind, doc);
  } finally {
    doc.destroy();
  }
}
async function change(actor: string, s: CollaborationSession, next: unknown) {
  const update = reconcileProjection(s.reference.kind, Buffer.from(s.state, 'base64'), next);
  return request<CollaborationSession>(actor, 'flush', {
    ...address(s),
    state: Buffer.from(update).toString('base64'),
  });
}
async function check(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  await fn();
  results.push({ name, durationMs: Date.now() - start });
  console.log(`PASS ${name}`);
}
try {
  await check('HTTP permissions and all six editor areas', async () => {
    for (const [name, kind] of [
      ['document', 'document'],
      ['personal', 'document'],
      ['groupDocument', 'document'],
      ['blog', 'blog'],
      ['city', 'city'],
      ['studio', 'studio'],
    ] as const) {
      const s = await session('owner', name, kind);
      assert(s.capabilities.edit, `${name}: owner edit`);
    }
    assert((await session('editor', 'document')).capabilities.edit);
    const proposer = await session('proposer', 'document');
    assert(proposer.capabilities.suggest);
    assert(!proposer.capabilities.edit);
    assert(!(await session('reader', 'document')).capabilities.edit);
    assert(!(await session('outsider', 'document')).capabilities.edit);
    await request(
      'outsider',
      'session',
      { reference: { kind: 'document', entityId: demo.ids.personal } },
      403
    );
    await request('proposer', 'flush', { ...address(proposer), state: proposer.state }, 403);
  });
  await check('Private proposal, immutable submission, authorized view and decision', async () => {
    const main = await session('proposer', 'document');
    const before = stableJson(value(main));
    const draft = await request<CollaborationSession>('proposer', 'workspace', {
      ...address(main),
      expectedRevision: main.revision,
      operationId: crypto.randomUUID(),
      type: 'proposal',
    });
    await request('reader', 'read', address(draft), 403);
    await request('editor', 'read', address(draft), 403);
    const next = structuredClone(value(draft)) as { children: Record<string, unknown>[] }[];
    const suggestion = crypto.randomUUID();
    assert(next.length > 0);
    next[next.length - 1].children.push({
      text: ' Gemeinsam beschlossen.',
      suggestion: true,
      [`suggestion_${suggestion}`]: {
        id: suggestion,
        type: 'insert',
        userId: demo.actors.proposer.id,
      },
    });
    const saved = await change('proposer', draft, next);
    assert.equal(stableJson(value(await session('owner', 'document'))), before);
    const operationId = crypto.randomUUID();
    const submitted = await request<{ ids: string[] }>('proposer', 'submit', {
      ...address(saved),
      expectedRevision: saved.revision,
      operationId,
    });
    assert.deepEqual(
      await request('proposer', 'submit', {
        ...address(saved),
        expectedRevision: saved.revision,
        operationId,
      }),
      submitted
    );
    assert(submitted.ids.length === 1);
    assert.equal(stableJson(value(await session('owner', 'document'))), before);
    const publicViews = await request<{ id: string }[]>(
      'outsider',
      'proposals',
      address(await session('outsider', 'document'))
    );
    assert(
      !publicViews.some(view => submitted.ids.includes(view.id)),
      'Internal proposal must remain hidden from public readers'
    );
    const owner = await session('owner', 'document');
    const views = await request<unknown[]>('owner', 'proposals', address(owner));
    assert(views.length >= 1);
    const decision = {
      ...address(owner),
      expectedRevision: owner.revision,
      changeRequestId: submitted.ids[0],
      result: 'accepted',
      operationId: crypto.randomUUID(),
    };
    const denied = await request<{ error: string }>('proposer', 'resolve', decision, 403);
    assert.equal(denied.error, 'decision_denied');
    const decided = await request('owner', 'resolve', decision);
    assert.deepEqual(await request('owner', 'resolve', decision), decided);
    const applied = await session('owner', 'document');
    assert(stableJson(value(applied)).includes('Gemeinsam beschlossen.'));
    assert(!stableJson(value(applied)).includes('suggestion_'));
  });
  await check(
    'Version restoration for every shared model creates a generation and binds retries to their inputs',
    async () => {
      for (const [name, kind] of [
        ['personal', 'document'],
        ['blog', 'blog'],
        ['city', 'city'],
        ['studio', 'studio'],
      ] as const) {
        const before = await session('owner', name, kind),
          original = value(before);
        const command = {
          ...address(before),
          expectedRevision: before.revision,
          operationId: crypto.randomUUID(),
          value: original,
        };
        const result = await request('owner', 'restore', command);
        assert.deepEqual(await request('owner', 'restore', command), result);
        await request(
          'owner',
          'restore',
          { ...command, expectedRevision: before.revision + 1 },
          409
        );
        await request('editor', 'restore', command, 409);
        const after = await session('owner', name, kind);
        assert.notEqual(after.generation, before.generation);
        assert.equal(after.revision, before.revision + 1);
        assert.equal(stableJson(value(after)), stableJson(original));
        await request('owner', 'flush', { ...address(before), state: before.state }, 409);
      }
    }
  );
  await check(
    'Revocation and phase changes prevent old offline writes; authorized recovery stays private',
    async () => {
      const before = await session('editor', 'personal');
      const offline = structuredClone(value(before)) as { children: { text: string }[] }[];
      offline[offline.length - 1].children[0].text += ' OFFLINE RECOVERY';
      await sql`update document_collaborator set status='removed' where document_id=${demo.ids.personal} and user_id=${demo.actors.editor.id}`;
      try {
        await request('editor', 'flush', { ...address(before), state: before.state }, 409);
        const revoked = await session('editor', 'personal');
        assert(!revoked.capabilities.edit);
        await request(
          'editor',
          'resume',
          {
            ...address(revoked),
            expectedRevision: revoked.revision,
            operationId: crypto.randomUUID(),
            value: offline,
          },
          403
        );
      } finally {
        await sql`update document_collaborator set status='active' where document_id=${demo.ids.personal} and user_id=${demo.actors.editor.id}`;
      }
      const current = await session('editor', 'personal');
      assert.notEqual(current.generation, before.generation);
      const command = {
        ...address(current),
        expectedRevision: current.revision,
        operationId: crypto.randomUUID(),
        value: offline,
      };
      const resumed = await request<{ workspaceId: string }>('editor', 'resume', command);
      assert.deepEqual(await request('editor', 'resume', command), resumed);
      await request('editor', 'resume', { ...command, value: value(current) }, 409);
      assert(!stableJson(value(await session('owner', 'personal'))).includes('OFFLINE RECOVERY'));
      const draft = await request<{ session: CollaborationSession }>('editor', 'session', {
        reference: { ...current.reference, workspaceId: resumed.workspaceId },
      });
      await request('owner', 'read', address(draft.session), 403);
      assert(stableJson(value(draft.session)).includes('OFFLINE RECOVERY'));
      await sql`update document set editing_mode='view' where id=${demo.ids.personal}`;
      try {
        await request('editor', 'flush', { ...address(current), state: current.state }, 409);
        const locked = await session('editor', 'personal');
        assert(!locked.capabilities.edit);
        assert(!locked.capabilities.suggest);
      } finally {
        await sql`update document set editing_mode='edit' where id=${demo.ids.personal}`;
      }
    }
  );
  await check(
    'Text and Streetdesign process branches keep independent committed states',
    async () => {
      const textA = await session('owner', 'branchDocA', 'document', demo.ids.branchA),
        textB = await session('owner', 'branchDocB', 'document', demo.ids.branchB);
      const before = stableJson(value(textB)),
        next = structuredClone(value(textA)) as { children: { text: string }[] }[];
      next[next.length - 1].children[0].text += ' NUR VARIANTE A';
      await change('owner', textA, next);
      assert.equal(
        stableJson(value(await session('owner', 'branchDocB', 'document', demo.ids.branchB))),
        before
      );
      const cityA = await session('owner', 'city', 'city', demo.ids.branchA),
        cityB = await session('owner', 'city', 'city', demo.ids.branchB),
        cityMain = await session('owner', 'city', 'city');
      assert.notEqual(cityA.id, cityB.id);
      assert.notEqual(cityA.id, cityMain.id);
      const variant = structuredClone(value(cityA)) as {
        objects: { properties: { height: number } }[];
      };
      variant.objects[0].properties.height = 31;
      await change('owner', cityA, variant);
      assert.equal(
        stableJson(value(await session('owner', 'city', 'city', demo.ids.branchB))),
        stableJson(value(cityB))
      );
      assert.equal(
        stableJson(value(await session('owner', 'city', 'city'))),
        stableJson(value(cityMain))
      );
    }
  );
  const latency: number[] = [];
  await check(
    'Granular comments preserve other authors and deleted anchors remain visible',
    async () => {
      let s = await session('owner', 'document');
      const next = structuredClone(value(s)) as { children: Record<string, unknown>[] }[],
        threadId = crypto.randomUUID();
      next[next.length - 1].children[0][`comment_${threadId}`] = true;
      s = await change('owner', s, next);
      const first = {
          id: crypto.randomUUID(),
          threadId,
          expectedRevision: 0,
          content: [{ type: 'p', children: [{ text: 'First author' }] }],
        },
        operationId = crypto.randomUUID();
      const saved = await request('owner', 'comment', {
        ...address(s),
        operationId,
        change: first,
      });
      assert.deepEqual(
        await request('owner', 'comment', { ...address(s), operationId, change: first }),
        saved
      );
      const second = {
        ...first,
        id: crypto.randomUUID(),
        content: [{ type: 'p', children: [{ text: 'Second author' }] }],
      };
      await request('editor', 'comment', {
        ...address(s),
        operationId: crypto.randomUUID(),
        change: second,
      });
      await request(
        'proposer',
        'comment',
        {
          ...address(s),
          operationId: crypto.randomUUID(),
          change: { ...first, expectedRevision: 1 },
        },
        403
      );
      let comments = await request<{ id: string; orphaned: boolean }[]>(
        'owner',
        'comments',
        address(s)
      );
      assert(comments.some(c => c.id === first.id && !c.orphaned));
      assert(comments.some(c => c.id === second.id));
      delete next[next.length - 1].children[0][`comment_${threadId}`];
      s = await change('owner', s, next);
      comments = await request('owner', 'comments', address(s));
      assert(comments.filter(c => c.id === first.id || c.id === second.id).every(c => c.orphaned));
      const privateComment = {
        ...first,
        id: crypto.randomUUID(),
        threadId: crypto.randomUUID(),
        visibility: 'collaborators',
        content: [{ type: 'p', children: [{ text: 'Internal thread' }] }],
      };
      await request('owner', 'comment', {
        ...address(s),
        operationId: crypto.randomUUID(),
        change: privateComment,
      });
      const reply = {
        ...privateComment,
        id: crypto.randomUUID(),
        content: [{ type: 'p', children: [{ text: 'Internal reply' }] }],
      };
      await request('editor', 'comment', {
        ...address(s),
        operationId: crypto.randomUUID(),
        change: reply,
      });
      await request('owner', 'comment', {
        ...address(s),
        operationId: crypto.randomUUID(),
        change: { ...privateComment, expectedRevision: 1, deleted: true },
      });
      await request(
        'owner',
        'comment',
        {
          ...address(s),
          operationId: crypto.randomUUID(),
          change: { ...reply, id: crypto.randomUUID(), visibility: 'document' },
        },
        409
      );
      const internal = await request<{ id: string }[]>('owner', 'comments', address(s));
      assert(internal.some(c => c.id === reply.id));
      const publicView = await request<{ id: string }[]>('outsider', 'comments', address(s));
      assert(!publicView.some(c => c.id === privateComment.id || c.id === reply.id));
    }
  );
  await check(
    'Integrity failure serves verified content, rejects writes and records repair',
    async () => {
      const s = await session('owner', 'personal'),
        before = stableJson(value(s));
      await sql`update collaboration_document set checksum='injected-local-test-corruption' where id=${s.id}`;
      const readable = await session('owner', 'personal');
      assert.equal(readable.integrityError, 'integrity_violation');
      assert.equal(stableJson(value(readable)), before);
      assert(!readable.capabilities.edit);
      await request('owner', 'flush', { ...address(s), state: s.state }, 503);
      const command = {
        ...address(readable),
        expectedRevision: readable.revision,
        operationId: crypto.randomUUID(),
      };
      const repaired = await request('owner', 'repair', command);
      assert.deepEqual(await request('owner', 'repair', command), repaired);
      const after = await session('owner', 'personal');
      assert.notEqual(after.generation, s.generation);
      assert.equal(stableJson(value(after)), before);
      assert(after.capabilities.edit);
    }
  );
  await check(
    'Ten concurrent editors, confirmed content and reconnect after process loss',
    async () => {
      for (let i = 1; i <= 10; i++) {
        const actor = `load${i}`,
          s = await session(actor, 'personal'),
          doc = new Y.Doc();
        Y.applyUpdate(doc, Buffer.from(s.state, 'base64'));
        const socket = new HocuspocusProviderWebsocket({
          url: s.websocket,
          WebSocketPolyfill: WebSocket,
          initialDelay: 100,
          maxDelay: 1000,
        });
        const provider = new HocuspocusProvider({
          websocketProvider: socket,
          name: s.room,
          document: doc,
          token: await token(actor),
          onStateless: ({ payload }) => {
            const data = JSON.parse(payload);
            if (typeof data.commitLatencyMs === 'number') latency.push(data.commitLatencyMs);
          },
        });
        provider.attach();
        peers.push({ doc, provider, socket });
      }
      await until(
        () => peers.every(p => p.provider.isSynced && !p.provider.hasUnsyncedChanges),
        'initial synchronization'
      );
      const run = crypto.randomUUID();
      for (let round = 0; round < 3; round++) {
        peers.forEach(({ doc }, i) => {
          const blocks = doc.get('content', Y.XmlText).toDelta();
          const text = blocks[blocks.length - 1].insert as Y.XmlText;
          text.insert(0, `[${run}:${round}:${i}]`);
        });
        await until(
          () => peers.every(p => !p.provider.hasUnsyncedChanges),
          'durable acknowledgements'
        );
      }
      await until(async () => {
        const text = stableJson(value(await session('owner', 'personal')));
        return Array.from(
          { length: 30 },
          (_, i) => `[${run}:${Math.floor(i / 10)}:${i % 10}]`
        ).every(marker => text.includes(marker));
      }, 'all thirty confirmed edits persisted');
      assert(latency.length >= 30, 'Commit timing must come from actual commits');
      const p95 = [...latency].sort((a, b) => a - b)[Math.ceil(latency.length * 0.95) - 1];
      assert(p95 < 1000, `Commit p95 ${p95.toFixed(1)} ms exceeds 1000 ms`);
      const control = JSON.parse(readFileSync('output/local-stack/stack.json', 'utf8'));
      const status = await (
        await fetch(`http://127.0.0.1:${control.controlPort}/status`, {
          headers: { Authorization: `Bearer ${control.token}` },
        })
      ).json();
      const service = status.services.find((s: { name: string }) => s.name === 'collaboration');
      assert(Number.isSafeInteger(service.pid));
      const restarted = Date.now();
      const killed = spawnSync('taskkill', ['/PID', String(service.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      assert.equal(killed.status, 0);
      await delay(1500);
      await until(
        () => peers.every(p => p.provider.isSynced && p.socket.status === 'connected'),
        'reconnect',
        28_000
      );
      assert(Date.now() - restarted < 30_000);
      const stored = stableJson(value(await session('owner', 'personal')));
      for (const peer of peers)
        await until(
          () => stableJson(projectDocument('document', peer.doc)) === stored,
          'restart state convergence'
        );
      load = {
        editors: peers.length,
        confirmedEdits: 30,
        commitSamples: latency.length,
        commitP95Ms: p95,
        reconnectMs: Date.now() - restarted,
      };
      console.log(JSON.stringify(load));
    }
  );
  writeFileSync(
    'output/collaboration-migration/api-acceptance.json',
    JSON.stringify(
      {
        passed: true,
        database: database.pathname,
        completedAt: new Date().toISOString(),
        results,
        load,
      },
      null,
      2
    )
  );
} finally {
  for (const peer of peers) {
    peer.provider.destroy();
    peer.socket.destroy();
    peer.doc.destroy();
  }
  await sql.end();
}
