// Run against an already running LOCAL app, Supabase, collaboration server and worker.
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import {
  readDocument,
  patchElement,
} from '../../../src/features/communication-studio/logic/collaboration';
const inherited = { ...process.env };
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local'])
  config({ path: file, override: true, quiet: true });
Object.assign(process.env, inherited);
const base = 'http://localhost:3000';
const url = process.env.SUPABASE_URL || '';
const database = new URL(process.env.STUDIO_DATABASE_URL || process.env.ZERO_UPSTREAM_DB || '');
if (!/^polity_collaboration_acceptance_\d+$/.test(process.env.COLLABORATION_TEST_DATABASE || ''))
  throw new Error('Studio service acceptance requires a dedicated local acceptance database');
database.pathname = `/${process.env.COLLABORATION_TEST_DATABASE}`;
const db = database.toString();
if (![url, db].every(u => ['localhost', '127.0.0.1'].includes(new URL(u).hostname)))
  throw new Error('Local services only');
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const sql = postgres(db, { max: 2 });
const actors: { id: string; token: string }[] = [],
  projects: string[] = [],
  providers: HocuspocusProvider[] = [];
const groupId = crypto.randomUUID(),
  statementId = crypto.randomUUID();
async function request(
  actor: number,
  operation: string,
  body: Record<string, unknown> = {},
  status = 200
) {
  const response = await fetch(base + '/api/studio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(actors[actor] ? { Authorization: 'Bearer ' + actors[actor].token } : {}),
    },
    body: JSON.stringify({ operation, ...body }),
  });
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function until(check: () => boolean | Promise<boolean>, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Acceptance condition timed out');
}
async function connect(id: string, actor: number) {
  const loaded = await request(actor, 'load', { id });
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(loaded.state, 'base64'));
  const provider = new HocuspocusProvider({
    url: loaded.websocket,
    name: loaded.room,
    document,
    token: actors[actor].token,
  });
  providers.push(provider);
  await until(() => provider.synced);
  return { provider, document };
}
try {
  for (let i = 0; i < 2; i++) {
    const email = `studio-${crypto.randomUUID()}@polity.test`,
      password = crypto.randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error || new Error('No user');
    await sql`insert into "user"(id,email,first_name) values(${data.user.id},${email},'Studio QA') on conflict(id) do nothing`;
    const client = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw signed.error || new Error('No session');
    actors.push({ id: data.user.id, token: signed.data.session.access_token });
  }
  await request(-1, 'config', {}, 401);
  const doc = createDocument('single', 'Service acceptance');
  const privateProject = await request(0, 'create', { groupId: null, document: doc });
  projects.push(privateProject.id);
  await request(1, 'load', { id: privateProject.id }, 403);
  const fixture = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64'
  );
  const uploader = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const firstUpload = await request(0, 'beginUpload', {
    projectId: privateProject.id,
    name: 'fixture.png',
    mime: 'image/png',
    size: fixture.length,
  });
  await request(1, 'finishUpload', { id: firstUpload.id }, 403);
  await request(0, 'finishUpload', { id: firstUpload.id }, 400);
  assert.equal(
    (
      await uploader.storage
        .from('studio')
        .uploadToSignedUrl(firstUpload.path, firstUpload.token, fixture, {
          contentType: 'image/png',
        })
    ).error,
    null
  );
  const originalAsset = await request(0, 'finishUpload', { id: firstUpload.id });
  const large = new Uint8Array(6 * 1024 * 1024);
  large.set(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64'
    )
  );
  const intent = await request(0, 'beginUpload', {
    projectId: privateProject.id,
    name: 'large.png',
    mime: 'image/png',
    size: large.byteLength,
  });
  const direct = await uploader.storage
    .from('studio')
    .uploadToSignedUrl(intent.path, intent.token, large, { contentType: 'image/png' });
  assert.equal(direct.error, null);
  assert.equal((await request(0, 'assets', { id: privateProject.id })).length, 1);
  await request(0, 'finishUpload', { id: intent.id });
  const wrongMime = await request(0, 'beginUpload', {
    projectId: privateProject.id,
    name: 'wrong.jpg',
    mime: 'image/jpeg',
    size: fixture.length,
  });
  assert.equal(
    (
      await uploader.storage
        .from('studio')
        .uploadToSignedUrl(wrongMime.path, wrongMime.token, fixture, { contentType: 'image/jpeg' })
    ).error,
    null
  );
  await request(0, 'finishUpload', { id: wrongMime.id }, 400);
  await request(0, 'cancelUpload', { id: wrongMime.id });
  const [reservation] = await sql`select ready from studio_asset where id=${wrongMime.id}`;
  assert.equal(reservation.ready, false);
  assert.equal((await request(0, 'assets', { id: privateProject.id })).length, 2);
  const copied = await request(0, 'duplicate', { id: privateProject.id });
  projects.push(copied.id);
  const copiedAssets = await request(0, 'assets', { id: copied.id });
  assert.equal(copiedAssets.length, 2);
  assert.notEqual(copiedAssets[0].id, originalAsset.id);
  await request(1, 'assets', { id: copied.id }, 403);
  await sql`insert into "group"(id,name,owner_id) values(${groupId},'Studio test group',${actors[0].id})`;
  await sql`insert into group_membership(group_id,user_id,status) values(${groupId},${actors[1].id},'member')`;
  const groupProject = await request(0, 'create', { groupId, document: doc });
  projects.push(groupProject.id);
  assert.equal((await request(1, 'load', { id: groupProject.id })).canEdit, false);
  await request(1, 'template', { id: groupProject.id, value: true }, 403);
  await sql`update group_membership set status='admin' where group_id=${groupId} and user_id=${actors[1].id}`;
  const a = await connect(groupProject.id, 0),
    b = await connect(groupProject.id, 1);
  const page = doc.pages[0],
    element = page.elements[1];
  patchElement(a.document, page.id, element.id, { x: 180 }, 'test');
  patchElement(b.document, page.id, element.id, { text: 'Shared decision' }, 'test');
  await until(
    () =>
      readDocument(a.document).pages[0].elements[1].text === 'Shared decision' &&
      readDocument(b.document).pages[0].elements[1].x === 180
  );
  b.provider.disconnect();
  await until(() => b.provider.configuration.websocketProvider.status === 'disconnected');
  patchElement(b.document, page.id, element.id, { y: 310 }, 'test');
  await b.provider.connect();
  await until(() => readDocument(a.document).pages[0].elements[1].y === 310);
  // A malformed update must not poison the other collaborator or durable document.
  let rejected = false;
  b.provider.on('close', () => {
    rejected = true;
    b.provider.disconnect();
  });
  b.document.getMap('meta').set('version', 999);
  await until(() => rejected);
  b.provider.destroy();
  assert.equal(readDocument(a.document).version, 1);
  const state = Buffer.from(Y.encodeStateAsUpdate(a.document)).toString('base64');
  const job = await request(0, 'export', {
    projectId: groupProject.id,
    format: 'png',
    pageIds: [],
    state,
  });
  await until(async () => {
    const [row] = await sql`select status,error from studio_export where id=${job.id}`;
    if (row.status === 'failed') throw new Error(row.error);
    return row.status === 'completed';
  }, 60000);
  const handoff = await request(0, 'handoff', { id: job.id });
  await sql`delete from group_membership where group_id=${groupId} and user_id=${actors[1].id}`;
  await request(1, 'load', { id: groupProject.id }, 403);
  assert.equal((await fetch(base + handoff.imageUrl)).status, 404);
  assert.equal(
    (
      await fetch(base + handoff.imageUrl, {
        headers: { Authorization: 'Bearer ' + actors[1].token },
      })
    ).status,
    404
  );
  await sql`insert into statement(id,user_id,title,image_url,media_type,visibility) values(${statementId},${actors[0].id},'Studio acceptance',${handoff.imageUrl},'image','public')`;
  assert.equal((await fetch(base + handoff.imageUrl)).status, 200);
  const range = await fetch(base + handoff.imageUrl, { headers: { Range: 'bytes=0-15' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 16);
  assert.equal(
    (await fetch(base + handoff.imageUrl, { headers: { Range: 'bytes=999999999-' } })).status,
    416
  );
  await request(0, 'delete', { id: groupProject.id }, 400);
  await sql`update statement set visibility='private' where id=${statementId}`;
  assert.equal((await fetch(base + handoff.imageUrl)).status, 404);
  const download = await request(0, 'download', { id: job.id });
  assert.equal((await fetch(download.url)).status, 200);
  console.log(
    'Verified: authentication, group roles, signed 6 MB upload, pending upload isolation, MIME verification, live merge, offline reconnect, invalid-update rejection, worker export, private/public media visibility, durable handoff, ranged download.'
  );
} catch (error) {
  console.error('Studio acceptance failed', error);
  throw error;
} finally {
  providers.forEach(p => {
    p.destroy();
    p.document.destroy();
  });
  await sql`delete from statement where id=${statementId}`;
  for (const id of projects) {
    const rows =
      await sql`select storage_path from studio_export where project_id=${id} and storage_path is not null union all select storage_path from studio_asset where project_id=${id}`;
    if (rows.length) await admin.storage.from('studio').remove(rows.map(r => r.storage_path));
    await sql`delete from studio_project where id=${id}`;
  }
  await sql`delete from "group" where id=${groupId}`;
  for (const actor of actors) {
    // The disposable database keeps actor IDs referenced by immutable revisions.
    // Remove only the temporary login from the local auth service.
    await admin.auth.admin.deleteUser(actor.id);
  }
  await sql.end();
}
// This disposable acceptance process owns all of its connections and timers.
process.exit(0);
