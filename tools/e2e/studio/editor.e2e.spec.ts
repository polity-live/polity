import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
import { legacyDocumentToV3 } from '../../../src/features/communication-studio/logic/v3-adapter';
const fixture = JSON.parse(await readFile('output/studio/visual-fixture.json', 'utf8'));
const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(database).hostname))
  throw new Error('Local database required');
const sql = postgres(database, { max: 1 });
const path = '/studio/' + fixture.projectId;
test.afterAll(() => sql.end());
test('persists partial text formatting, restores an offline draft and confirms the second client and editor bridge', async ({
  page,
  browser,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
  await sql`update studio_state set document=${sql.json(fixture.document)},content_revision=content_revision+1 where project_id=${fixture.projectId}`;
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    fixture.document.title
  );
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  const firstFrame = fixture.document.nodes.find((node: any) => node.type === 'frame');
  const select = page.getByRole('button', { name: `1. ${firstFrame.name}`, exact: true });
  await select.focus();
  await select.press('Enter');
  await page.getByRole('button', { name: 'Gemeinsam gestalten', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(pageErrors).toEqual([]);
  await page.getByRole('button', { name: 'Edit text', exact: true }).click();
  const text = page.getByRole('textbox', { name: 'Text', exact: true });
  await expect(text).toBeFocused();
  // Select a real DOM text range. Toolbar handling must preserve this selection
  // through its pointer/focus transition and persist only these two characters.
  await text.evaluate(element => {
    const node = element.querySelector('[data-slate-string]')!.firstChild!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 2);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Ge');
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  await expect
    .poll(async () => {
      const [s] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return s.document.nodes.find((node: any) => node.type === 'richText')?.content[0].children[0];
    })
    .toMatchObject({ text: 'Ge', italic: true });
  await page.context().setOffline(true);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Offline recovered');
  await expect(page.getByRole('status')).toHaveText('Offline · changes remain on this device');
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
  } catch {
    /* Browser cannot fetch Vite while offline; the draft is kept locally. */
  }
  await page.context().setOffline(false);
  await page.goto(path);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Offline recovered'
  );
  await expect
    .poll(async () => {
      const [s] =
        await sql`select document->>'title' as title from studio_state where project_id=${fixture.projectId}`;
      return s.title;
    })
    .toBe('Offline recovered');
  const second = await browser.newContext({
    storageState: 'output/studio/browser-state.json',
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const other = await second.newPage();
    await other.goto('http://localhost:3000' + path);
    await other.getByRole('button', { name: 'I understand', exact: true }).click();
    await expect(other.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Offline recovered'
    );
    await other.getByRole('textbox', { name: 'Title', exact: true }).fill(fixture.document.title);
    await expect(other.getByRole('status')).toHaveText('Saved', { timeout: 30000 });
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      fixture.document.title
    );
    const id = crypto.randomUUID();
    await sql`insert into studio_editor_action(id,project_id,actor_id,request_id,name,input,created_at) values(${id},${fixture.projectId},${fixture.actor},${id},'studio_guides','{"visible":false}',${Date.now()})`;
    await expect
      .poll(async () => {
        const [a] = await sql`select result from studio_editor_action where id=${id}`;
        return a.result?.status;
      })
      .toBe('completed');
    const [action] =
      await sql`select id,name,result,claimed_by from studio_editor_action where id=${id}`;
    expect(action.claimed_by).toBeTruthy();
    await mkdir('output/studio', { recursive: true });
    await writeFile(
      'output/studio/browser-acceptance.json',
      JSON.stringify(
        {
          partialFormatting: 'passed',
          offlineReload: 'passed',
          secondClient: 'passed',
          editorAction: action,
        },
        null,
        2
      )
    );
  } finally {
    await second.close();
  }
});
test('keeps the canvas and scrollable panels within 390, 768 and 1440 pixel light and dark viewports', async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Tools', exact: true })).toHaveCount(1);
  await expect(page.locator('.polity-canvas .App-menu_top')).toBeHidden();
  await expect(page.locator('.polity-canvas .App-menu_bottom')).toBeHidden();
  await expect(page.locator('.polity-canvas .layer-ui__wrapper')).toBeHidden();
  await expect(page.locator('.polity-canvas .App-toolbar-container')).toBeHidden();
  await expect(page.locator('.polity-canvas .mobile-misc-tools-container')).toBeHidden();
  await expect(page.getByPlaceholder('Find text')).toHaveCount(0);
  await mkdir('output/playwright', { recursive: true });
  for (const width of [390, 768, 1440])
    for (const mode of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        dark => document.documentElement.classList.toggle('dark', dark),
        mode === 'dark'
      );
      await expect(page.getByRole('status')).toHaveText('Saved');
      await page.screenshot({
        path: `output/playwright/studio-${width}-${mode}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('button', { name: 'Pages', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.evaluate(async el => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map(a => a.finished.catch(() => undefined))
        );
      });
      const bounds = await dialog.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.height).toBeLessThanOrEqual(1000);
      await page.screenshot({
        path: `output/playwright/studio-${width}-${mode}-pages.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
});

test('adapts the fixed toolbar to compact, labeled and collapsed desktop navigation', async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  const toolbar = page.getByRole('toolbar', { name: 'Tools', exact: true });
  await expect.poll(async () => Math.round((await toolbar.boundingBox())!.x)).toBe(0);
  await page.locator('[data-action-id="navigation.overlay.open"]').first().hover();
  await page.getByRole('button', { name: 'Button list view', exact: true }).click();
  await expect.poll(async () => Math.round((await toolbar.boundingBox())!.x)).toBe(64);
  await page.getByRole('button', { name: 'More navigation options', exact: true }).click();
  await page.getByRole('button', { name: 'Labeled button list view', exact: true }).click();
  await expect.poll(async () => Math.round((await toolbar.boundingBox())!.x)).toBe(256);
  await page.mouse.move(900, 900);
  for (const mode of ['light', 'dark']) {
    await page.evaluate(
      dark => document.documentElement.classList.toggle('dark', dark),
      mode === 'dark'
    );
    await page.screenshot({
      path: `output/playwright/studio-1440-${mode}-wide-navigation.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: 'Button view', exact: true }).click();
  await expect.poll(async () => Math.round((await toolbar.boundingBox())!.x)).toBe(0);
  await page.screenshot({
    path: 'output/playwright/studio-1440-dark-collapsed-navigation.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('creates a frame preset directly in the V3 document', async ({ page }) => {
  await sql`update studio_state set document=${sql.json(fixture.document)},content_revision=content_revision+1 where project_id=${fixture.projectId}`;
  const initialFrames = fixture.document.nodes.filter((node: any) => node.type === 'frame').length;
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.getByRole('button', { name: 'portrait · 1080 × 1350', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 30000 });
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return state.document.nodes.filter((node: any) => node.type === 'frame').length;
    })
    .toBe(initialFrames + 1);
  await expect(page.getByText('invalid_union', { exact: false })).toHaveCount(0);
});

test('persists a new frame background through save and reload', async ({ page }) => {
  await sql`update studio_state set document=${sql.json(fixture.document)},content_revision=content_revision+1 where project_id=${fixture.projectId}`;
  const existingFrameIds = new Set(
    fixture.document.nodes.filter((node: any) => node.type === 'frame').map((node: any) => node.id)
  );
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.getByRole('button', { name: 'portrait · 1080 × 1350', exact: true }).click();
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return state.document.nodes.some(
        (node: any) => node.type === 'frame' && !existingFrameIds.has(node.id)
      );
    })
    .toBe(true);
  const [savedState] =
    await sql`select document from studio_state where project_id=${fixture.projectId}`;
  const newFrame = savedState.document.nodes.find(
    (node: any) => node.type === 'frame' && !existingFrameIds.has(node.id)
  );
  if (!newFrame) throw new Error('New frame was not persisted');
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await page
    .locator(`[data-studio-layer-id="${newFrame.id}"]`)
    .getByRole('button', { name: newFrame.name, exact: true })
    .click();
  const properties = page.getByRole('complementary', { name: 'Element properties' });
  await properties.getByLabel('Fill – custom', { exact: true }).fill('#e03131');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 30000 });
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return state.document.nodes.find((node: any) => node.id === newFrame.id)?.style.fill;
    })
    .toBe('#e03131');

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await page
    .locator(`[data-studio-layer-id="${newFrame.id}"]`)
    .getByRole('button', { name: newFrame.name, exact: true })
    .click();
  await expect(
    page
      .getByRole('complementary', { name: 'Element properties' })
      .getByLabel('Fill – custom', { exact: true })
  ).toHaveValue('#e03131');
});

test('copies, pastes and cuts a complete frame hierarchy with keyboard shortcuts', async ({
  page,
}) => {
  await sql`update studio_state set document=${sql.json(fixture.document)},content_revision=content_revision+1 where project_id=${fixture.projectId}`;
  const source = fixture.document.nodes.find(
    (node: any) => node.type === 'frame' && !node.parentFrameId
  );
  if (!source) throw new Error('Missing root frame fixture');
  const sourceHierarchy = new Set([source.id]);
  let hierarchyChanged = true;
  while (hierarchyChanged) {
    hierarchyChanged = false;
    for (const node of fixture.document.nodes)
      if (
        node.parentFrameId &&
        sourceHierarchy.has(node.parentFrameId) &&
        !sourceHierarchy.has(node.id)
      ) {
        sourceHierarchy.add(node.id);
        hierarchyChanged = true;
      }
  }
  const sourceDescendantCount = sourceHierarchy.size - 1;
  const initialNodeCount = fixture.document.nodes.length;
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await page
    .locator(`[data-studio-layer-id="${source.id}"]`)
    .getByRole('button', { name: source.name, exact: true })
    .click();
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');
  let copiedFrameId = '';
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      const copy = state.document.nodes.find(
        (node: any) =>
          node.type === 'frame' &&
          !node.parentFrameId &&
          node.id !== source.id &&
          node.name === source.name
      );
      copiedFrameId = copy?.id ?? '';
      const descendants = state.document.nodes.filter(
        (node: any) => node.parentFrameId === copiedFrameId
      ).length;
      return {
        nodes: state.document.nodes.length,
        descendants,
        deliverableContainsCopy: state.document.deliverables.some((deliverable: any) =>
          deliverable.frameIds.includes(copiedFrameId)
        ),
      };
    })
    .toEqual({
      nodes: initialNodeCount + sourceDescendantCount + 1,
      descendants: sourceDescendantCount,
      deliverableContainsCopy: true,
    });
  await page.keyboard.press('ControlOrMeta+x');
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return {
        nodes: state.document.nodes.length,
        copyExists: state.document.nodes.some((node: any) => node.id === copiedFrameId),
      };
    })
    .toEqual({ nodes: initialNodeCount, copyExists: false });
});

test('creates a carousel as five independent frames next to each other', async ({ page }) => {
  await sql`update studio_state set document=${sql.json(fixture.document)},content_revision=content_revision+1 where project_id=${fixture.projectId}`;
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.getByRole('button', { name: 'Carousel', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 30000 });
  await expect
    .poll(async () => {
      const [state] =
        await sql`select document from studio_state where project_id=${fixture.projectId}`;
      return state.document.nodes
        .filter((node: any) => node.type === 'frame' && /^Karussell \d$/.test(node.name))
        .sort((a: any, b: any) => a.transform.x - b.transform.x)
        .map((node: any) => ({
          name: node.name,
          x: node.transform.x,
          width: node.transform.width,
        }));
    })
    .toEqual([
      expect.objectContaining({ name: 'Karussell 1', width: 1080 }),
      expect.objectContaining({ name: 'Karussell 2', width: 1080 }),
      expect.objectContaining({ name: 'Karussell 3', width: 1080 }),
      expect.objectContaining({ name: 'Karussell 4', width: 1080 }),
      expect.objectContaining({ name: 'Karussell 5', width: 1080 }),
    ]);
  const [state] =
    await sql`select document from studio_state where project_id=${fixture.projectId}`;
  const frames = state.document.nodes
    .filter((node: any) => node.type === 'frame' && /^Karussell \d$/.test(node.name))
    .sort((a: any, b: any) => a.transform.x - b.transform.x);
  expect(
    frames.slice(1).map((frame: any, index: number) => {
      const previous = frames[index];
      return frame.transform.x - previous.transform.x - previous.transform.width;
    })
  ).toEqual([160, 160, 160, 160]);
});

test('persists context-menu copy, paste, cut and flip actions without validation errors', async ({
  page,
}) => {
  test.setTimeout(180000);
  const projectId = crypto.randomUUID();
  const seed = createDocument('whiteboard', 'Layer actions');
  seed.pages[0].elements = [
    element('text', {
      x: 600,
      y: 650,
      width: 400,
      height: 120,
      text: 'Flip →',
      fontSize: 72,
      fill: '#B88A3B',
    }),
  ];
  seed.pages[0].canvas = {
    version: 1,
    elements: [860, 1145].map((x, index) => ({
      id: `native-rectangle-${index}`,
      type: 'rectangle' as const,
      x,
      y: 311,
      width: 171,
      height: 129,
      angle: 0,
      isDeleted: false,
      strokeColor: '#1b1b1f',
      backgroundColor: '#e03131',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      customData: { polityOrder: index },
    })),
    files: {},
  };
  const seeded = legacyDocumentToV3(seed);
  const semanticBefore = seeded.nodes.find(
    (node: any) => node.type !== 'frame' && !node.excalidraw
  );
  if (!semanticBefore) throw new Error('Missing semantic text');
  await sql`insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${fixture.actor},${seed.title},${seed.kind},3,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(seeded)))},0)`;
  try {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/studio/' + projectId);
    await page.getByRole('button', { name: 'I understand', exact: true }).click();
    const saveStatus = page.getByRole('status').first();
    await expect(saveStatus).toHaveText('Saved', { timeout: 30000 });
    const bounds = await page.locator('canvas.interactive').boundingBox();
    if (!bounds) throw new Error('Missing Studio canvas');
    const semanticPoint = { x: bounds.x + 600, y: bounds.y + 580 };
    const rectanglePoint = { x: bounds.x + 720, y: bounds.y + 330 };
    const pastedRectanglePoint = { x: bounds.x + 740, y: bounds.y + 348 };
    await page.mouse.click(semanticPoint.x, semanticPoint.y, { button: 'right' });
    await page.getByText('Flip horizontal', { exact: true }).click();
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${projectId}`;
        return state.document.nodes.find((node: any) => node.id === semanticBefore.id)?.transform;
      })
      .toMatchObject({ flipX: true, flipY: false });
    await page.mouse.click(semanticPoint.x, semanticPoint.y, { button: 'right' });
    await page.getByText('Flip vertical', { exact: true }).click();
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${projectId}`;
        return state.document.nodes.find((node: any) => node.id === semanticBefore.id)?.transform;
      })
      .toMatchObject({ flipX: true, flipY: true });
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${projectId}`;
        return state.document.nodes.find((node: any) => node.id === semanticBefore.id)?.transform;
      })
      .toMatchObject({ flipX: true, flipY: false });
    await page.keyboard.press('Control+Shift+z');
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${projectId}`;
        return state.document.nodes.find((node: any) => node.id === semanticBefore.id)?.transform;
      })
      .toMatchObject({ flipX: true, flipY: true });
    await page.mouse.click(rectanglePoint.x, rectanglePoint.y, { button: 'right' });
    await page.getByText('Copy', { exact: true }).click();
    await page.mouse.click(rectanglePoint.x, rectanglePoint.y, { button: 'right' });
    await page.getByText('Paste', { exact: true }).click();
    const nativeRectangleCount = async () => {
      const [state] = await sql`select document from studio_state where project_id=${projectId}`;
      return state.document.nodes.filter((node: any) => node.excalidraw?.type === 'rectangle')
        .length;
    };
    await expect.poll(nativeRectangleCount).toBe(3);
    await page.mouse.click(pastedRectanglePoint.x, pastedRectanglePoint.y, { button: 'right' });
    await page.getByText('Cut', { exact: true }).click();
    await expect.poll(nativeRectangleCount).toBe(2);
    await page.mouse.click(rectanglePoint.x, rectanglePoint.y, { button: 'right' });
    await page.getByText('Paste', { exact: true }).click();
    await expect.poll(nativeRectangleCount).toBe(3);
    await page.reload();
    await expect(saveStatus).toHaveText('Saved', { timeout: 30000 });
    await expect
      .poll(async () => {
        const [state] = await sql`select document from studio_state where project_id=${projectId}`;
        return state.document.nodes.find((node: any) => node.id === semanticBefore.id)?.transform;
      })
      .toMatchObject({ flipX: true, flipY: true });
    await expect.poll(nativeRectangleCount).toBe(3);
    await expect(page.getByText('invalid_union', { exact: false })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  } finally {
    await sql`delete from studio_project where id=${projectId}`;
  }
});
