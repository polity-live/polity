import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '../../../src/features/communication-studio/logic/v3-adapter';

const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
);
if (
  !['127.0.0.1', 'localhost'].includes(new URL(local.DB_URL).hostname) ||
  new URL(local.DB_URL).port !== '54322'
)
  throw new Error('Local database required');
const sql = postgres(local.DB_URL, { max: 2 });
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const group = crypto.randomUUID(),
  projectId = crypto.randomUUID();
const projects = [projectId];
const users: { id: string; state: string }[] = [];
test.beforeAll(async () => {
  await mkdir('output/studio', { recursive: true });
  for (const name of [
    'Owner',
    'Member',
    ...Array.from({ length: 8 }, (_, i) => `Editor${i + 3}`),
  ]) {
    const email = `canvas-browser-${crypto.randomUUID()}@example.test`,
      password = crypto.randomUUID() + 'Aa1!';
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw result.error;
    const id = result.data.user.id;
    await sql`insert into "user"(id,first_name) values(${id},${name}) on conflict(id) do update set first_name=excluded.first_name`;
    const cookies: any[] = [];
    const auth = createServerClient(local.API_URL, local.ANON_KEY, {
      cookies: {
        getAll: () => [],
        setAll: items => {
          cookies.push(...items);
        },
      },
    });
    const signed = await auth.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    const state = `output/studio/canvas-${name}-state.json`;
    await writeFile(
      state,
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
    users.push({ id, state });
  }
  await sql`insert into "group"(id,name,owner_id) values(${group},'Canvas browser acceptance',${users[0].id})`;
  await sql`insert into group_membership(id,group_id,user_id,status) values(${crypto.randomUUID()},${group},${users[1].id},'admin')`;
  const doc = createDocument('whiteboard', 'Canvas acceptance');
  doc.pages[0].canvas = { version: 1, elements: [], files: {} };
  const persisted = legacyDocumentToV3(doc);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${users[0].id},${group},${doc.title},${doc.kind},3,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(persisted)))},0)`;
});
test.afterAll(async () => {
  for (const pid of projects) {
    await sql`delete from canvas_vote where proposal_id in(select id from canvas_proposal where project_id=${pid})`;
    for (const table of ['canvas_comment', 'canvas_receipt', 'canvas_library', 'canvas_proposal'])
      await sql.unsafe(`delete from ${table} where project_id=$1`, [pid]);
    await sql`delete from studio_project where id=${pid}`;
  }
  await sql`delete from group_membership where group_id=${group}`;
  await sql`delete from "group" where id=${group}`;
  for (const user of users) {
    await sql`delete from "user" where id=${user.id}`;
    await admin.auth.admin.deleteUser(user.id);
  }
  await sql.end();
});
async function open(page: Page, pid = projectId, loadTimeout = 20000) {
  await page.goto(`/group/${group}/whiteboards/${pid}`);
  const warning = page.getByRole('button', { name: 'I understand', exact: true });
  await warning.waitFor();
  await warning.click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Canvas acceptance',
    { timeout: loadTimeout }
  );
}
async function rectangle(page: Page, x: number, y: number) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.keyboard.press('Escape');
  const bounds = await page.locator('canvas.interactive').boundingBox();
  if (!bounds) throw new Error('Missing canvas');
  await page.mouse.move(bounds.x + x, bounds.y + y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + x + 130, bounds.y + y + 90, { steps: 8 });
  await page.mouse.up();
}
test('two accounts edit, propose, discuss, vote and apply without replacing canonical content', async ({
  browser,
}) => {
  const contexts = await Promise.all(
    users.slice(0, 2).map(u =>
      browser.newContext({
        storageState: u.state,
        viewport: { width: 1440, height: 1100 },
        baseURL: 'http://localhost:3000',
      })
    )
  );
  const [owner, member] = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  for (const page of [owner, member]) page.on('pageerror', e => errors.push(e.message));
  try {
    await Promise.all([open(owner), open(member)]);
    await rectangle(owner, 650, 300);
    await expect
      .poll(async () => {
        const [s] = await sql`select document from studio_state where project_id=${projectId}`;
        return s.document.nodes.filter((node: any) => node.excalidraw && node.visible).length;
      })
      .toBe(1);
    await rectangle(member, 850, 400);
    await expect
      .poll(async () => {
        const [s] = await sql`select document from studio_state where project_id=${projectId}`;
        return s.document.nodes.filter((node: any) => node.excalidraw && node.visible).length;
      })
      .toBe(2);
    await expect(member.getByRole('status')).toHaveText('Saved');
    await expect(owner.getByRole('status')).toHaveText('Saved');
    await owner.getByRole('combobox', { name: 'Editing mode' }).selectOption('suggest_internal');
    await expect(member.getByRole('combobox', { name: 'Editing mode' })).toHaveValue(
      'suggest_internal'
    );
    await member
      .getByRole('textbox', { name: 'Proposal title', exact: true })
      .fill('New board title');
    await member
      .getByRole('textbox', { name: 'Reason', exact: true })
      .fill('A clearer title for the group');
    await member.getByRole('button', { name: 'Start proposal', exact: true }).click();
    await expect(
      member.getByRole('button', { name: 'Canonical content', exact: true })
    ).toBeVisible();
    await member.getByRole('textbox', { name: 'Title', exact: true }).fill('Decided board title');
    await expect(member.getByRole('status')).toHaveText('Saved');
    const [unchanged] =
      await sql`select document->>'title' as title from studio_state where project_id=${projectId}`;
    expect(unchanged.title).toBe('Canvas acceptance');
    await expect(owner.getByText('New board title', { exact: true })).toHaveCount(0);
    await member.locator('summary').filter({ hasText: 'Discussion' }).click();
    await member
      .getByRole('textbox', { name: 'Comment', exact: true })
      .fill('Please review this title');
    await member.getByRole('button', { name: 'Comment', exact: true }).click();
    await member.getByRole('button', { name: 'Submit', exact: true }).click();
    await owner.locator('summary').filter({ hasText: 'Change requests' }).click();
    await expect(owner.getByText('New board title', { exact: true })).toBeVisible();
    await owner.getByRole('combobox', { name: 'Editing mode' }).selectOption('vote_internal');
    await owner.getByRole('button', { name: 'Start vote (5 min.)', exact: true }).click();
    await owner.getByRole('button', { name: 'Yes', exact: true }).click();
    await member.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(owner.getByText('Closed · Accepted · Applied')).toBeVisible();
    await expect(owner.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Decided board title'
    );
    await owner.reload();
    await expect(owner.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Decided board title'
    );
    expect(errors).toEqual([]);
    await owner.screenshot({ path: 'output/playwright/canvas-decision.png', fullPage: true });
    await writeFile(
      'output/studio/canvas-browser-acceptance.json',
      JSON.stringify(
        {
          status: 'passed',
          accounts: 2,
          flow: 'edit > suggest > discuss > vote > accept > apply > reload',
          projectId,
          errors,
        },
        null,
        2
      )
    );
  } finally {
    await Promise.all(contexts.map((c, i) => c.storageState({ path: users[i].state })));
    await Promise.all(contexts.map(c => c.close()));
  }
});

test('ten real accounts preserve concurrent drawings and undo only their own operation', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const id = crypto.randomUUID();
  projects.push(id);
  for (const u of users.slice(2))
    await sql`insert into group_membership(id,group_id,user_id,status) values(${crypto.randomUUID()},${group},${u.id},'admin')`;
  const doc = createDocument('whiteboard', 'Canvas acceptance');
  doc.pages[0].canvas = { version: 1, elements: [], files: {} };
  const persisted = legacyDocumentToV3(doc);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${id},${users[0].id},${group},${doc.title},${doc.kind},3,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${id},${sql.json(JSON.parse(JSON.stringify(persisted)))},0)`;
  const contexts = await Promise.all(
    users.map(u =>
      browser.newContext({
        storageState: u.state,
        viewport: { width: 1440, height: 1100 },
        baseURL: 'http://localhost:3000',
      })
    )
  );
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  const saved = async () => {
    const [s] = await sql`select document from studio_state where project_id=${id}`;
    return s.document.nodes.filter((node: any) => node.excalidraw && node.visible);
  };
  try {
    for (let i = 0; i < pages.length; i += 2)
      await Promise.all(pages.slice(i, i + 2).map(p => open(p, id, 60000)));
    await Promise.all(pages.map((p, i) => rectangle(p, 650 + i * 14, 300 + i * 12)));
    await expect.poll(async () => (await saved()).length, { timeout: 45000 }).toBe(10);
    await Promise.all(
      pages.map(p => expect(p.getByRole('status')).toHaveText('Saved', { timeout: 45000 }))
    );
    const before = await saved();
    await pages[0].getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await saved()).length).toBe(9);
    const after = await saved();
    expect(
      after.every((e: any) =>
        before.some((original: any) => JSON.stringify(original) === JSON.stringify(e))
      )
    ).toBe(true);
    await pages[0].getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(async () => (await saved()).length).toBe(10);
    await pages[9].reload();
    await expect(pages[9].getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Canvas acceptance'
    );
    expect(errors).toEqual([]);
    await writeFile(
      'output/studio/canvas-ten-editors.json',
      JSON.stringify(
        { status: 'passed', accounts: 10, confirmedElements: 10, ownUndo: true, errors },
        null,
        2
      )
    );
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
});
