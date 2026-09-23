import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import {
  createFrameNode,
  studioDocumentV3Schema,
} from '../../../src/features/communication-studio/logic/document-v3';
import { legacyDocumentToV3 } from '../../../src/features/communication-studio/logic/v3-adapter';
import { element } from '../../../src/features/communication-studio/logic/document';
import { createStudioNodeFromElement } from '../../../src/features/communication-studio/logic/create-studio-node';

const fixture = JSON.parse(await readFile('output/studio/visual-fixture.json', 'utf8'));
const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(database).hostname))
  throw new Error('Local database required');
const sql = postgres(database, { max: 1 });
test.afterAll(() => sql.end());

test('selects mixed Studio objects, distributes and groups root objects across frames', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const projectId = crypto.randomUUID();
  const seed = createDocument('single', 'Mixed selection');
  const text = seed.pages[0].elements.find(element => element.type === 'text');
  if (!text) throw new Error('Missing semantic text fixture');
  seed.pages[0].elements = [text];
  const document = legacyDocumentToV3(seed);
  const firstFrame = document.nodes.find(node => node.type === 'frame' && !node.parentFrameId);
  if (!firstFrame) throw new Error('Missing first frame');
  const rootShape = createStudioNodeFromElement(
    element('rect', {
      x: 4500,
      y: 260,
      width: 100,
      height: 100,
      fill: '#e03131',
      stroke: '#1b1b1f',
      strokeWidth: 2,
    }),
    firstFrame.id,
    1
  );
  rootShape.parentFrameId = null;
  document.nodes.push(rootShape);
  firstFrame.transform.x = 0;
  firstFrame.transform.y = 0;
  const secondFrame = createFrameNode('custom', {
    name: 'Second frame',
    zIndex: 2,
    transform: { x: 1400, y: 0, width: 1080, height: 1350, rotation: 0 },
  });
  const thirdFrame = createFrameNode('custom', {
    name: 'Third frame',
    zIndex: 3,
    transform: { x: 2800, y: 0, width: 1080, height: 1350, rotation: 0 },
  });
  document.nodes.push(secondFrame, thirdFrame);
  const textNode = document.nodes.find(node => node.id === text.id);
  if (!textNode) throw new Error('Missing semantic text node');
  textNode.parentFrameId = secondFrame.id;
  textNode.transform = {
    ...textNode.transform,
    x: 200,
    y: 200,
    width: 500,
    height: 100,
  };
  const rootIds = document.nodes.filter(node => !node.parentFrameId).map(node => node.id);
  studioDocumentV3Schema.parse(document);
  const readNodes = async () => {
    const [row] = await sql`select document from studio_state where project_id=${projectId}`;
    return row.document.nodes as typeof document.nodes;
  };
  await sql`insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${fixture.actor},${document.title},${document.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},0)`;
  try {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`/studio/${projectId}`);
    await page.getByRole('button', { name: 'I understand', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(seed.title);
    const canvas = page.locator('[data-testid="studio-canvas"] canvas').first();
    await expect(canvas).toBeVisible();
    const context = page.getByRole('toolbar', { name: 'Context tools' });
    const projectStatus = page.locator('header[aria-label="Project status"]');
    const zoom = page.getByRole('button', { name: /^Zoom \d+%$/ });
    const initialZoom = await zoom.getAttribute('aria-label');
    if (!initialZoom) throw new Error('Missing initial zoom label');
    await page.mouse.click(600, 405);
    await expect(context).toContainText('1 selected');
    await expect(projectStatus).toContainText('Mixed selection');
    await expect(zoom).toHaveAttribute('aria-label', initialZoom);
    await page.keyboard.down('Shift');
    await page.mouse.click(1395, 430);
    await expect(context).toContainText('2 selected', { timeout: 5000 });
    await page.mouse.click(1395, 430);
    await page.keyboard.up('Shift');
    await expect(context).toContainText('1 selected');
    await expect(projectStatus).toContainText('Mixed selection');
    await expect(zoom).toHaveAttribute('aria-label', initialZoom);
    await page.mouse.click(600, 650);
    await expect(context).toContainText('1 selected');
    await expect(projectStatus).toContainText('Second frame');
    await page.keyboard.down('Shift');
    await page.mouse.click(1000, 650);
    await expect(context).toContainText('2 selected');
    await expect(projectStatus).toContainText('Second frame');
    await expect(zoom).toHaveAttribute('aria-label', initialZoom);
    await page.mouse.click(600, 650);
    await page.keyboard.up('Shift');
    await expect(context).toContainText('1 selected');
    await page.keyboard.press('Escape');
    await expect(context).not.toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(context).toBeVisible();
    await expect(context).toContainText('5 selected');
    await page.keyboard.press('Escape');
    await expect(context).not.toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(context).toContainText('5 selected');
    const selectionMode = context.getByRole('button', { name: 'Selection mode' });
    await selectionMode.click();
    await expect(selectionMode).toHaveAttribute('aria-pressed', 'true');
    await context.getByRole('button', { name: 'Finish selection' }).click();
    await expect(selectionMode).toHaveAttribute('aria-pressed', 'false');
    await context.getByRole('button', { name: 'Distribute horizontally' }).click();
    const rootPositions = async () =>
      (await readNodes())
        .filter(node => rootIds.includes(node.id))
        .sort((a, b) => a.transform.x - b.transform.x)
        .map(node => ({ x: node.transform.x, width: node.transform.width }));
    await expect
      .poll(async () => {
        const positions = await rootPositions();
        const gaps = positions
          .slice(1)
          .map((item, index) => item.x - positions[index].x - positions[index].width);
        return Math.max(...gaps) - Math.min(...gaps);
      })
      .toBeLessThan(0.01);
    await context.getByRole('button', { name: 'Group', exact: true }).click();
    await expect
      .poll(async () => {
        const roots = (await readNodes()).filter(node => rootIds.includes(node.id));
        const ids = roots.map(node => node.groupIds[0]);
        return ids.every(Boolean) && new Set(ids).size === 1;
      })
      .toBe(true);
    expect((await readNodes()).find(node => node.id === text.id)?.groupIds).toEqual([]);
    const beforeMove = new Map(
      (await readNodes())
        .filter(node => rootIds.includes(node.id))
        .map(node => [node.id, node.transform.x])
    );
    await page.mouse.move(600, 650);
    await page.mouse.down();
    await page.mouse.move(630, 670, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => {
        const deltas = (await readNodes())
          .filter(node => rootIds.includes(node.id))
          .map(node => node.transform.x - (beforeMove.get(node.id) ?? 0));
        return (
          deltas.length === rootIds.length &&
          Math.abs(deltas[0]) > 0 &&
          deltas.every(delta => Math.abs(delta - deltas[0]) < 0.01)
        );
      })
      .toBe(true);
    await context.getByRole('button', { name: 'Select inside group' }).click();
    await expect(context).toContainText('1 selected');
    await context.getByRole('button', { name: 'Leave group' }).click();
    await expect(context).toContainText('4 selected');
    await context.getByRole('button', { name: 'Ungroup', exact: true }).click();
    await expect
      .poll(async () =>
        (await readNodes())
          .filter(node => rootIds.includes(node.id))
          .every(node => !node.groupIds.length)
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () =>
        (await readNodes())
          .filter(node => rootIds.includes(node.id))
          .every(node => !!node.groupIds[0])
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect
      .poll(async () =>
        (await readNodes())
          .filter(node => rootIds.includes(node.id))
          .every(node => !node.groupIds.length)
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(seed.title);
    expect((await rootPositions()).map(position => position.x)).not.toEqual([0, 1400, 2800, 4500]);
    expect(pageErrors).toEqual([]);
  } finally {
    if (!page.isClosed())
      await page
        .goto('/studio', { waitUntil: 'domcontentloaded', timeout: 5_000 })
        .catch(() => undefined);
    await sql`delete from studio_project where id=${projectId}`;
  }
});

test('touch long press enters selection mode and movement cancels it', async ({ page }) => {
  const projectId = crypto.randomUUID();
  await sql`insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${fixture.actor},${fixture.document.title},${fixture.document.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(fixture.document)},0)`;
  try {
    await page.goto(`/studio/${projectId}`);
    await page.getByRole('button', { name: 'I understand', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      fixture.document.title
    );
    const canvas = page.locator('[data-testid="studio-canvas"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Missing Studio canvas');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    const toolbar = page.getByRole('toolbar', { name: 'Context tools' });
    await expect(toolbar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toolbar).not.toBeVisible();
    const pointer = (type: string, atX = x, atY = y) =>
      canvas.dispatchEvent(type, {
        pointerType: 'touch',
        clientX: atX,
        clientY: atY,
        bubbles: true,
      });
    await pointer('pointerdown');
    await pointer('pointermove', x + 24, y);
    await page.waitForTimeout(550);
    await expect(toolbar.getByRole('button', { name: 'Finish selection' })).not.toBeVisible();
    await pointer('pointerup', x + 24, y);
    await pointer('pointerdown');
    await expect(toolbar.getByRole('button', { name: 'Finish selection' })).toBeVisible();
    await pointer('pointerup');
    await expect(toolbar.getByRole('button', { name: 'Selection mode' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await pointer('pointerdown');
    await pointer('pointerup');
    await expect(toolbar).toContainText('0 selected');
    await pointer('pointerdown');
    await pointer('pointerup');
    await expect(toolbar).toContainText('1 selected');
    await toolbar.getByRole('button', { name: 'Finish selection' }).click();
    const mode = toolbar.getByRole('button', { name: 'Selection mode' });
    await expect(mode).toHaveAttribute('aria-pressed', 'false');
    await mode.click();
    await page.keyboard.press('Escape');
    await expect(mode).toHaveAttribute('aria-pressed', 'false');
  } finally {
    if (!page.isClosed())
      await page
        .goto('/studio', { waitUntil: 'domcontentloaded', timeout: 5_000 })
        .catch(() => undefined);
    await sql`delete from studio_project where id=${projectId}`;
  }
});

test('locked frames are skipped on the canvas and can be unlocked from layers', async ({
  page,
}) => {
  const projectId = crypto.randomUUID();
  const document = structuredClone(fixture.document) as typeof fixture.document;
  const frame = document.nodes.find((node: { type: string }) => node.type === 'frame');
  if (!frame) throw new Error('Missing frame fixture');
  frame.locked = true;
  await sql`insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${fixture.actor},${document.title},${document.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(document)},0)`;
  try {
    await page.goto(`/studio/${projectId}`);
    await page.getByRole('button', { name: 'I understand', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      document.title
    );
    const canvas = page.locator('[data-testid="studio-canvas"] canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 25, y: 25 } });
    await page.keyboard.press('ControlOrMeta+a');
    const context = page.getByRole('toolbar', { name: 'Context tools' });
    await expect(context).toContainText('5 selected');
    await page.getByRole('button', { name: 'Pages', exact: true }).click();
    const frameLayer = page.getByRole('treeitem').filter({
      has: page.getByRole('button', { name: frame.name, exact: true }),
    });
    await frameLayer.getByRole('button', { name: 'Unlock' }).click();
    await expect
      .poll(async () => {
        const [row] = await sql`select document from studio_state where project_id=${projectId}`;
        return row.document.nodes.find((node: { id: string }) => node.id === frame.id)?.locked;
      })
      .toBe(false);
    await page.mouse.click(500, 900);
    await page.keyboard.press('ControlOrMeta+a');
    await expect(context).toContainText('6 selected');
  } finally {
    if (!page.isClosed())
      await page
        .goto('/studio', { waitUntil: 'domcontentloaded', timeout: 5_000 })
        .catch(() => undefined);
    await sql`delete from studio_project where id=${projectId}`;
  }
});
