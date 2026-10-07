import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';
import { defaultBrand } from '../../../src/features/communication-studio/logic/document';
import { createStudioTemplateDocumentV5 } from '../../../src/features/communication-studio/logic/templates-v5';
import {
  richTextNodeSchema,
  shapeNodeSchema,
} from '../../../src/features/communication-studio/logic/document-v3';

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
const editorRole = crypto.randomUUID();
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
  await sql`insert into role(id,name,scope,group_id) values(${editorRole},'Canvas editor','group',${group})`;
  await sql`insert into action_right(resource,action,role_id,group_id) values('projects','manage',${editorRole},${group})`;
  const memberId = crypto.randomUUID();
  await sql`insert into group_membership(id,group_id,user_id,status) values(${memberId},${group},${users[1].id},'admin')`;
  await sql`insert into group_membership_role(group_membership_id,role_id) values(${memberId},${editorRole})`;
  const doc = createStudioTemplateDocumentV5('single', 'Canvas acceptance', defaultBrand);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${users[0].id},${group},${doc.title},${doc.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(doc)))},0)`;
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
  await page.goto(`/group/${group}/studio/${pid}`);
  const warning = page.getByRole('button', { name: 'I understand', exact: true });
  await warning.waitFor({ timeout: 5000 }).catch(() => undefined);
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Canvas acceptance',
    { timeout: loadTimeout }
  );
}
async function rectangle(page: Page, x: number, y: number) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await page.keyboard.press('Escape');
  const bounds = await page.locator('[data-testid="studio-canvas"] canvas').first().boundingBox();
  if (!bounds) throw new Error('Missing canvas');
  await page.mouse.move(bounds.x + x, bounds.y + y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + x + 130, bounds.y + y + 90, { steps: 8 });
  await page.mouse.up();
}

test('Layers order controls shape–text–shape coverage before and during inline editing', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const id = crypto.randomUUID();
  projects.push(id);
  const document = createStudioTemplateDocumentV5('single', 'Canvas acceptance', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame');
  if (!frame) throw new Error('Missing frame');
  frame.style.fill = '#FFFFFF';
  const shape = (name: string, color: string, zIndex: number) =>
    shapeNodeSchema.parse({
      id: crypto.randomUUID(),
      name,
      parentFrameId: frame.id,
      transform: { x: 280, y: 280, width: 260, height: 140, rotation: 0 },
      zIndex,
      style: { fill: color, stroke: null, strokeWidth: 0, opacity: 1 },
      type: 'shape',
      shape: 'rectangle',
    });
  const behind = shape('Behind text', '#0000FF', 0);
  const text = richTextNodeSchema.parse({
    id: crypto.randomUUID(),
    name: 'Editable layer',
    parentFrameId: frame.id,
    transform: { x: 250, y: 260, width: 400, height: 180, rotation: 0 },
    zIndex: 1,
    style: { fill: '#000000', stroke: null, strokeWidth: 0, opacity: 1 },
    type: 'richText',
    content: [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text: 'Editable text' }],
      },
    ],
    typography: {
      fontFamily: 'Manrope',
      fontSize: 64,
      lineHeight: 1.2,
      letterSpacing: 0,
      horizontalAlign: 'left',
      verticalAlign: 'top',
    },
  });
  const above = shape('Above text', '#FF0000', 2);
  document.nodes.push(behind, text, above);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${id},${users[0].id},${group},${document.title},${document.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${id},${sql.json(JSON.parse(JSON.stringify(document)))},0)`;
  const context = await browser.newContext({
    storageState: users[0].state,
    viewport: { width: 1440, height: 1100 },
    baseURL: 'http://localhost:3000',
  });
  const page = await context.newPage();
  try {
    await open(page, id);
    await expect
      .poll(() =>
        page
          .locator('[data-testid="studio-canvas"] canvas')
          .first()
          .evaluate((canvas: HTMLCanvasElement) => {
            const data = canvas
              .getContext('2d')!
              .getImageData(0, 0, canvas.width, canvas.height).data;
            let red = 0;
            for (let index = 0; index < data.length; index += 4)
              if (
                data[index] === 255 &&
                data[index + 1] === 0 &&
                data[index + 2] === 0 &&
                data[index + 3] === 255
              )
                red++;
            return red;
          })
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await page.locator(`[data-studio-layer-id="${text.id}"] button`).first().click();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const canvasBox = await page
      .locator('[data-testid="studio-canvas"] canvas')
      .first()
      .boundingBox();
    if (!canvasBox) throw new Error('Missing Studio canvas');
    const zoomLabel = await page
      .getByRole('button', { name: /^Zoom \d+%$/ })
      .getAttribute('aria-label');
    const zoom = Number(zoomLabel?.match(/\d+/)?.[0]) / 100;
    if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('Missing Studio zoom');
    await page.mouse.dblclick(
      canvasBox.x +
        (canvasBox.width - frame.transform.width * zoom) / 2 +
        (text.transform.x + 350) * zoom,
      canvasBox.y +
        (canvasBox.height - frame.transform.height * zoom) / 2 +
        (text.transform.y + 120) * zoom
    );
    const editor = page
      .locator('[data-testid="studio-inline-text-layer"]')
      .getByRole('textbox', { name: 'Text', exact: true });
    await expect(editor).toBeVisible();
    const overlapPoint = async () => {
      const box = await editor.boundingBox();
      if (!box) throw new Error('Missing inline editor');
      return {
        x: box.x + (180 * box.width) / text.transform.width,
        y: box.y + (70 * box.height) / text.transform.height,
      };
    };
    const upperPixel = async () => {
      const point = await overlapPoint();
      return page
        .locator('[data-testid="studio-canvas"] canvas')
        .nth(1)
        .evaluate((canvas: HTMLCanvasElement, point) => {
          const box = canvas.getBoundingClientRect();
          return [
            ...canvas
              .getContext('2d')!
              .getImageData(
                Math.floor(((point.x - box.x) * canvas.width) / box.width),
                Math.floor(((point.y - box.y) * canvas.height) / box.height),
                1,
                1
              ).data,
          ];
        }, point);
    };
    await expect.poll(upperPixel).toEqual([255, 0, 0, 255]);
    const layer = (nodeId: string) => page.locator(`[data-studio-layer-id="${nodeId}"]`);
    const move = async (targetPosition: 'before' | 'after') => {
      if (!(await layer(text.id).isVisible()))
        await page.getByRole('button', { name: 'Layers', exact: true }).click();
      const box = await layer(text.id).boundingBox();
      if (!box) throw new Error('Missing text layer');
      await page.dragAndDrop(
        `[data-studio-layer-id="${above.id}"]`,
        `[data-studio-layer-id="${text.id}"]`,
        {
          targetPosition: { x: 8, y: targetPosition === 'before' ? 1 : box.height - 1 },
        }
      );
    };
    await move('after');
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${id}`;
        const nodes = state.document.nodes;
        return (
          nodes.find((node: { id: string }) => node.id === above.id).zIndex <
          nodes.find((node: { id: string }) => node.id === text.id).zIndex
        );
      })
      .toBe(true);
    await expect.poll(async () => (await upperPixel())[3]).toBe(0);
    await expect(editor).toBeVisible();
    await move('before');
    await expect.poll(upperPixel).toEqual([255, 0, 0, 255]);
    const point = await overlapPoint();
    await editor.press('Escape');
    await expect(editor).not.toBeVisible();
    await expect
      .poll(async () =>
        page
          .locator('[data-testid="studio-canvas"] canvas')
          .first()
          .evaluate((canvas: HTMLCanvasElement, point) => {
            const box = canvas.getBoundingClientRect();
            return [
              ...canvas
                .getContext('2d')!
                .getImageData(
                  Math.floor(((point.x - box.x) * canvas.width) / box.width),
                  Math.floor(((point.y - box.y) * canvas.height) / box.height),
                  1,
                  1
                ).data,
            ];
          }, point)
      )
      .toEqual([255, 0, 0, 255]);
  } finally {
    await context.close().catch(() => undefined);
  }
});

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
        return s.document.nodes.filter((node: any) => node.type === 'shape' && node.visible).length;
      })
      .toBe(1);
    await rectangle(member, 850, 400);
    await expect
      .poll(async () => {
        const [s] = await sql`select document from studio_state where project_id=${projectId}`;
        return s.document.nodes.filter((node: any) => node.type === 'shape' && node.visible).length;
      })
      .toBe(2);
    await expect(member.getByRole('status')).toHaveText(/^(Saved|All changes saved)$/);
    await expect(owner.getByRole('status')).toHaveText(/^(Saved|All changes saved)$/);
    await owner.getByRole('button', { name: 'Collaboration', exact: true }).click();
    await member.getByRole('button', { name: 'Collaboration', exact: true }).click();
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
    await expect(member.getByRole('status')).toHaveText(/^(Saved|All changes saved)$/);
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
  for (const u of users.slice(2)) {
    const membershipId = crypto.randomUUID();
    await sql`insert into group_membership(id,group_id,user_id,status) values(${membershipId},${group},${u.id},'admin')`;
    await sql`insert into group_membership_role(group_membership_id,role_id) values(${membershipId},${editorRole})`;
  }
  const doc = createStudioTemplateDocumentV5('single', 'Canvas acceptance', defaultBrand);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${id},${users[0].id},${group},${doc.title},${doc.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${id},${sql.json(JSON.parse(JSON.stringify(doc)))},0)`;
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
    return s.document.nodes.filter((node: any) => node.type === 'shape' && node.visible);
  };
  try {
    for (let i = 0; i < pages.length; i += 2)
      await Promise.all(pages.slice(i, i + 2).map(p => open(p, id, 60000)));
    await Promise.all(pages.map((p, i) => rectangle(p, 650 + i * 14, 300 + i * 12)));
    await expect.poll(async () => (await saved()).length, { timeout: 45000 }).toBe(10);
    await Promise.all(
      pages.map(p =>
        expect(p.getByRole('status')).toHaveText(/^(Saved|All changes saved)$/, { timeout: 45000 })
      )
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
