import { Server } from '@hocuspocus/server';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as Y from 'yjs';
import { parseRoom } from '../../src/features/collaboration/logic/types';
import { committedState, readSession } from '../../src/server/collaboration/service';
import { commitBeforeSync } from '../../src/server/collaboration/protocol';
import {
  collaborationDiagnostics,
  recordCollaborationFailure,
} from '../../src/server/collaboration/diagnostics';
import {
  installDeliveryGuard,
  waitForDelivery,
  type CollaborationConnectionContext,
} from '../../src/server/collaboration/delivery';

const authUrl = process.env.SUPABASE_URL,
  authKey = process.env.SUPABASE_ANON_KEY;
if (!authUrl || !authKey) throw new Error('Supabase configuration is required');
const auth = createClient(authUrl, authKey);
let stopping = false;
const databaseUrl = process.env.ZERO_UPSTREAM_DB;
if (!databaseUrl) throw new Error('ZERO_UPSTREAM_DB is required');
const leader = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 0,
  onclose: () => {
    if (!stopping) {
      console.error('Collaboration leadership connection lost');
      process.exit(1);
    }
  },
});
const [lease] = await leader`select pg_try_advisory_lock(1886351982) as acquired`;
if (!lease.acquired) {
  stopping = true;
  await leader.end();
  throw new Error('A collaboration writer is already active');
}
installDeliveryGuard();
const server = new Server<CollaborationConnectionContext>({
  port: Number(process.env.PORT || 1236),
  address: '0.0.0.0',
  websocketOptions: { maxPayload: 12_000_000 },
  async onRequest({ request, response }) {
    if (request.url !== '/health') return;
    try {
      const control = await collaborationDiagnostics({
        query: async (statement, args) =>
          Array.from(await leader.unsafe(statement, args as postgres.ParameterOrJSON<never>[])),
      });
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ready: !stopping, leader: true, ...control }));
    } catch {
      response.writeHead(503);
      response.end();
    }
    // The pinned Hocuspocus request hook uses an empty rejection to stop its default response.
    throw null;
  },
  async onAuthenticate({ token, documentName, connectionConfig }) {
    const ref = parseRoom(documentName);
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) throw new Error('Unauthorized');
    const loaded = await readSession(data.user.id, ref.id, ref.generation);
    connectionConfig.readOnly = !loaded.capabilities.edit;
    return { userId: data.user.id, ...ref, expires: Date.now() + 5 * 60_000 };
  },
  async onLoadDocument({ context, document }) {
    const loaded = await committedState(context.userId, context.id, context.generation);
    Y.applyUpdate(document, loaded.bytes, 'committed');
    return document;
  },
  async beforeHandleMessage({ context, connection }) {
    if (context.expires < Date.now()) throw new Error('Session expired');
    const loaded = await readSession(context.userId, context.id, context.generation).catch(
      error => {
        recordCollaborationFailure(error);
        throw error;
      }
    );
    connection.readOnly = !loaded.capabilities.edit;
  },
  beforeSync: commitBeforeSync(),
  async onTokenSync({ token, context, connection }) {
    const { data, error } = await auth.auth.getUser(token);
    if (error || data.user?.id !== context.userId) throw new Error('Unauthorized');
    const loaded = await readSession(context.userId, context.id, context.generation);
    context.expires = Date.now() + 5 * 60_000;
    connection.readOnly = !loaded.capabilities.edit;
  },
  async beforeHandleAwareness({ context, states }) {
    for (const state of states.values()) {
      const user = state.user;
      const cursor = state.cursor;
      for (const key of Object.keys(state)) Reflect.deleteProperty(state, key);
      if (context && user)
        state.user = {
          id: context.userId,
          name: String(user.name || '').slice(0, 80),
          color: /^#[0-9a-f]{6}$/i.test(user.color) ? user.color : '#B88A3B',
        };
      if (cursor && typeof cursor === 'object') {
        const safe: Record<string, unknown> = {};
        if (typeof cursor.pageId === 'string' && /^[0-9a-f-]{36}$/i.test(cursor.pageId))
          safe.pageId = cursor.pageId;
        for (const key of ['anchor', 'focus'])
          if (typeof cursor[key] === 'string' && cursor[key].length <= 2048)
            safe[key] = cursor[key];
        for (const key of ['x', 'y'])
          if (typeof cursor[key] === 'number' && Number.isFinite(cursor[key]))
            safe[key] = cursor[key];
        if (Object.keys(safe).length) state.cursor = safe;
      }
    }
  },
});
await server.listen();
let draining = false;
let lastAuthorizationSweep = 0;
const timer = setInterval(() => {
  if (draining) return;
  draining = true;
  void (async () => {
    if (Date.now() - lastAuthorizationSweep >= 1000) {
      lastAuthorizationSweep = Date.now();
      for (const room of server.hocuspocus.documents.values())
        for (const connection of room.getConnections()) {
          const context = connection.context;
          try {
            if (context.expires < Date.now()) throw new Error('Session expired');
            const session = await readSession(context.userId, context.id, context.generation);
            connection.readOnly = !session.capabilities.edit;
          } catch {
            connection.close({ code: 4403, reason: 'Access or document generation changed' });
          }
        }
    }
    const events =
      await leader`select o.id,d.id as document_id,d.generation,d.state,d.revision,d.checksum from collaboration_outbox o
      join collaboration_document d on d.id=o.document_id where o.delivered_at is null order by o.id limit 100`;
    // An outbox batch can contain many revisions of the same document. Each
    // row above already joins the latest committed state; deliver that state
    // once and acknowledge exactly the captured outbox IDs after delivery.
    const grouped = new Map<string, { event: (typeof events)[number]; ids: number[] }>();
    for (const event of events) {
      const entry = grouped.get(event.document_id);
      if (entry) entry.ids.push(event.id);
      else grouped.set(event.document_id, { event, ids: [event.id] });
    }
    for (const { event, ids } of grouped.values()) {
      for (const room of server.hocuspocus.documents.values()) {
        const ref = parseRoom(room.name);
        if (ref.id !== event.document_id) continue;
        if (ref.generation !== event.generation) {
          for (const connection of room.getConnections())
            connection.close({ code: 4409, reason: 'Document generation changed' });
        } else {
          Y.applyUpdate(room, new Uint8Array(event.state), 'committed');
          room.flush();
          room.broadcastStateless(
            JSON.stringify({
              type: 'committed',
              revision: Number(event.revision),
              generation: event.generation,
              checksum: event.checksum,
            })
          );
          await Promise.all(room.getConnections().map(connection => waitForDelivery(connection)));
        }
      }
      await leader`update collaboration_outbox set delivered_at=${Date.now()} where id in ${leader(ids)}`;
    }
  })()
    .catch(error => {
      console.error('Collaboration delivery stopped', error);
      // Losing the leader connection must stop this process, never silently
      // reconnect and continue as a second writer.
      void server.destroy().finally(() => process.exit(1));
    })
    .finally(() => {
      draining = false;
    });
}, 250);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    stopping = true;
    clearInterval(timer);
    void server
      .destroy()
      .then(() => leader.end())
      .then(() => process.exit(0));
  });
