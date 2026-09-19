import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import * as Y from 'yjs';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
import { insertElement } from '../../../src/features/communication-studio/logic/collaboration';
import type { CollaborationSession } from '../../../src/features/collaboration/logic/types';
import { ffmpeg } from '../../studio/exporters';

const database = new URL(process.env.ZERO_UPSTREAM_DB || '');
assert(['localhost', '127.0.0.1'].includes(database.hostname));
assert.match(database.pathname, /^\/polity_collaboration_acceptance_\d+$/);
const demo = JSON.parse(readFileSync('output/local-stack/demo.json', 'utf8'));
const auth = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await auth.auth.signInWithPassword({
  email: demo.actors.owner.email,
  password: demo.password,
});
assert.ifError(error);
assert(data.session);
const accessToken = data.session.access_token;
const sql = postgres(database.toString(), { max: 1 }),
  folder = path.resolve('output/studio-acceptance');
mkdirSync(folder, { recursive: true });
async function api<T>(endpoint: string, operation: string, body: object): Promise<T> {
  const response = await fetch(`http://localhost:3000/api/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...body }),
    signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result as T;
}
try {
  const document = createDocument('video', 'Gemeinsam geprüft');
  document.pages.forEach(p => (p.duration = 1));
  const created = await api<{ id: string }>('studio', 'create', {
    groupId: demo.ids.group,
    document,
  });
  const [canonical] =
    await sql`select id from collaboration_document where kind='studio' and entity_id=${created.id} and workspace_id is null`;
  assert(canonical, 'Creation and canonical Yjs state must commit together');
  const session = (
    await api<{ session: CollaborationSession }>('collaboration', 'session', {
      reference: { kind: 'studio', entityId: created.id },
    })
  ).session;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(session.state, 'base64'));
  for (const [name, mime, args] of [
    [
      'sample.png',
      'image/png',
      ['-y', '-f', 'lavfi', '-i', 'color=c=0x12362D:s=320x240', '-frames:v', '1'],
    ],
    [
      'sample.mp4',
      'video/mp4',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=320x240:rate=30',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
      ],
    ],
  ] as const) {
    const file = path.join(folder, name);
    await ffmpeg([...args, file]);
    const bytes = readFileSync(file);
    const upload = await api<{ id: string; path: string; token: string }>('studio', 'beginUpload', {
      projectId: created.id,
      name,
      mime,
      size: bytes.length,
    });
    const result = await auth.storage
      .from('studio')
      .uploadToSignedUrl(upload.path, upload.token, bytes, { contentType: mime });
    assert.ifError(result.error);
    await api('studio', 'finishUpload', { id: upload.id });
    insertElement(
      doc,
      document.pages[mime === 'video/mp4' ? 0 : 1].id,
      element(mime === 'video/mp4' ? 'video' : 'image', {
        assetId: upload.id,
        x: 85,
        y: 1200,
        width: 600,
        height: 320,
        order: 5,
      })
    );
  }
  const saved = await api<CollaborationSession>('collaboration', 'flush', {
    id: session.id,
    generation: session.generation,
    state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),
  });
  doc.destroy();
  const results = [];
  for (const format of ['png', 'pdf', 'pptx', 'canva', 'xlsx', 'mp4', 'zip']) {
    const queued = await api<{ id: string; revision: number }>('studio', 'export', {
      projectId: created.id,
      format,
      pageIds: ['png', 'mp4'].includes(format) ? [document.pages[0].id] : [],
      state: saved.state,
    });
    assert.equal(queued.revision, saved.revision);
    const start = Date.now();
    for (;;) {
      const [job] = await sql`select status,error from studio_export where id=${queued.id}`;
      assert.notEqual(job.status, 'failed', job.error);
      if (job.status === 'completed') break;
      assert(Date.now() - start < 180_000, `Export timed out: ${format}`);
      await new Promise(r => setTimeout(r, 500));
    }
    const download = await api<{ url: string; name: string }>('studio', 'download', {
      id: queued.id,
    });
    const target = new URL(download.url);
    assert(['localhost', '127.0.0.1'].includes(target.hostname));
    const response = await fetch(target);
    assert(response.ok);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert(bytes.length > 100);
    writeFileSync(path.join(folder, `${format}-${path.basename(download.name)}`), bytes);
    if (format === 'pdf')
      assert.equal((await PDFDocument.load(bytes)).getPageCount(), document.pages.length);
    if (format === 'pptx') {
      const archive = unzipSync(bytes);
      assert(strFromU8(archive['ppt/slides/slide1.xml']).includes('Gemeinsam geprüft'));
      assert(Object.keys(archive).some(name => name.startsWith('ppt/media/')));
    }
    if (format === 'xlsx') assert(unzipSync(bytes)['xl/workbook.xml']);
    if (format === 'mp4') {
      assert(Buffer.from(bytes.subarray(0, 32)).includes(Buffer.from('ftyp')));
      await ffmpeg([
        '-v',
        'error',
        '-i',
        path.join(folder, `${format}-${path.basename(download.name)}`),
        '-f',
        'null',
        '-',
      ]);
    }
    const [proof] =
      await sql`select r.collaboration_revision_id from studio_export e join studio_revision r on r.id=e.revision_id where e.id=${queued.id}`;
    assert(proof.collaboration_revision_id);
    results.push({
      format,
      bytes: bytes.length,
      durationMs: Date.now() - start,
      revision: saved.revision,
    });
    console.log(`PASS Studio ${format}`);
  }
  writeFileSync(
    'output/collaboration-migration/studio-acceptance.json',
    JSON.stringify({ passed: true, projectId: created.id, results }, null, 2)
  );
} finally {
  await sql.end();
}
