import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
import { legacyDocumentToV3 } from '../../../src/features/communication-studio/logic/v3-adapter';
import { render } from '../../studio/exporters';
import { unzipSync, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
);
assert(['127.0.0.1', 'localhost'].includes(new URL(local.DB_URL).hostname));
process.env.ZERO_UPSTREAM_DB = local.DB_URL;
const { createZeroContext, executeZeroTransaction } =
  await import('../../../src/server/zero-mutate');
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const dir = 'output/studio';
await mkdir(dir, { recursive: true });
if (process.argv.includes('--cleanup')) {
  const { actor, projectId } = JSON.parse(await readFile(dir + '/visual-fixture.json', 'utf8'));
  await executeZeroTransaction(createZeroContext(actor), async tx => {
    await tx.dbTransaction.query('delete from studio_project where id=$1', [projectId]);
    await tx.dbTransaction.query('delete from "user" where id=$1', [actor]);
  });
  await admin.auth.admin.deleteUser(actor);
  process.exit(0);
}
if (process.argv.includes('--refresh-browser')) {
  const { actor } = JSON.parse(await readFile(dir + '/visual-fixture.json', 'utf8'));
  const user = await admin.auth.admin.getUserById(actor);
  if (user.error || !user.data.user.email?.startsWith('studio-visual-'))
    throw new Error('Expected local Studio fixture user');
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.data.user.email,
  });
  if (link.error) throw link.error;
  const cookies: any[] = [];
  const client = createServerClient(local.API_URL, local.ANON_KEY, {
    cookies: {
      getAll: () => [],
      setAll: items => {
        cookies.push(...items);
      },
    },
  });
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: 'magiclink',
  });
  if (verified.error) throw verified.error;
  await writeFile(
    dir + '/browser-state.json',
    JSON.stringify({
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: -1,
      })),
      origins: [],
    })
  );
  process.exit(0);
}
const email = `studio-visual-${crypto.randomUUID()}@example.test`,
  password = crypto.randomUUID() + 'Aa1!';
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw created.error;
const actor = created.data.user.id,
  projectId = crypto.randomUUID(),
  document = createDocument('single', 'Studio · Präsentation');
const p = document.pages[0];
p.format = 'widescreen';
p.background = '#F7F5EF';
p.duration = 1;
p.transition = 'none';
p.elements = [
  element('text', {
    x: 80,
    y: 65,
    width: 1750,
    height: 150,
    font: 'Inter',
    fontSize: 64,
    text: 'Gemeinsam gestalten',
    fill: '#12362D',
    bold: false,
    richText: [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [
          { text: 'Gemeinsam ', bold: true },
          { text: 'gestalten', italic: true, color: '#B88A3B' },
        ],
      },
    ],
  }),
  element('table', { x: 80, y: 300, width: 820, height: 420, fontSize: 30 }),
  element('chart', { x: 990, y: 300, width: 820, height: 420, fontSize: 28 }),
  element('arrow', { x: 200, y: 810, width: 400, height: 100, stroke: '#B88A3B', strokeWidth: 8 }),
  element('rect', {
    x: 1040,
    y: 830,
    width: 400,
    height: 110,
    fill: '#12362D',
    rotation: 8,
    opacity: 0.7,
  }),
];
p.elements.forEach((e, i) => (e.order = i));
const table = p.elements[1].table;
if (!table) throw new Error('Fixture table missing');
table.rows.forEach((r, i) => {
  r.cells[0].text = ['Thema', 'Mobilität', 'Zusammenarbeit'][i];
  r.cells[1].text = ['Priorität', 'Hoch', 'Mittel'][i];
  r.cells.forEach(c => {
    c.fill = i === 0 ? '#12362D' : '#FFFFFF';
    c.color = i === 0 ? '#FFFFFF' : '#12362D';
    c.bold = i === 0;
  });
});
const persistedDocument = legacyDocumentToV3(document);
await executeZeroTransaction(createZeroContext(actor), async tx => {
  await tx.dbTransaction.query('insert into "user"(id) values($1) on conflict do nothing', [actor]);
  await tx.dbTransaction.query(
    'insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,$3,$4,5,0,0)',
    [projectId, actor, document.title, document.kind]
  );
  await tx.dbTransaction.query(
    'insert into studio_state(project_id,document,updated_at) values($1,$2::jsonb,0)',
    [projectId, persistedDocument]
  );
});
const cookies: any[] = [];
const client = createServerClient(local.API_URL, local.ANON_KEY, {
  cookies: {
    getAll: () => [],
    setAll: items => {
      cookies.push(...items);
    },
  },
});
const signed = await client.auth.signInWithPassword({ email, password });
if (signed.error) throw signed.error;
await writeFile(
  dir + '/browser-state.json',
  JSON.stringify({
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: -1,
    })),
    origins: [],
  })
);
await writeFile(
  dir + '/visual-fixture.json',
  JSON.stringify({ actor, projectId, document: persistedDocument })
);
console.log(JSON.stringify({ projectId, url: `http://localhost:3000/studio/${projectId}` }));
if (process.argv.includes('--browser-only')) process.exit(0);
const report = [];
for (const format of ['png', 'pdf', 'pptx', 'xlsx', 'canva', 'zip', 'mp4']) {
  try {
    const result = await render(
      document,
      {},
      format,
      [],
      dir + '/render',
      async () => {
        /* Progress is optional in the fixture. */
      },
      async () => false
    );
    await writeFile(dir + '/' + result.name, result.bytes);
    if (format === 'pptx') {
      const files = unzipSync(result.bytes),
        xml = Object.entries(files)
          .filter(([name]) => name.endsWith('.xml'))
          .map(([, b]) => strFromU8(b))
          .join('');
      assert(xml.includes('<a:tbl>'));
      assert(xml.includes('<c:chart'));
      assert(xml.includes('Gemeinsam'));
      assert(!xml.includes('data:image/png'));
    }
    report.push({ format, status: 'passed', file: result.name });
  } catch (e) {
    report.push({ format, status: 'failed', error: String(e) });
    process.exitCode = 1;
  }
}
await writeFile(dir + '/exports.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exit(process.exitCode ?? 0);
