import { test, expect, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { spawnSync } from 'node:child_process';
import * as decoding from 'lib0/decoding';

const demo = JSON.parse(readFileSync('output/local-stack/demo.json', 'utf8'));
const finalLocal = process.env.COLLABORATION_FINAL_LOCAL === '1';
const database = finalLocal
  ? 'postgres'
  : JSON.parse(readFileSync('output/local-stack/test-database.json', 'utf8')).name;
if (!finalLocal) assert.match(database, /^polity_collaboration_acceptance_\d+$/);
const url = new URL(process.env.ZERO_UPSTREAM_DB || '');
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '54322');
url.pathname = `/${database}`;
const sql = postgres(url.toString(), { max: 1 });
// A leading space in an empty Plate paragraph intentionally opens the AI menu.
// Begin document input with text so this helper exercises ordinary typing.
const marker = (area: string) => `Browser ${area} ${crypto.randomUUID().slice(0, 8)}.`;
const editor = (page: Page) => page.locator('[data-slate-editor="true"][contenteditable="true"]');
async function savedValue(entity: string, kind = 'document') {
  const [doc] =
    await sql`select projection from collaboration_document where entity_id=${entity} and kind=${kind} and workspace_id is null and branch_id is null`;
  return JSON.stringify(doc?.projection);
}
async function signIn(page: Page, role: string) {
  await page.route('**/api/ai/copilot', route => route.fulfill({ status: 200, body: '' }));
  await page.goto('/auth/sign-in');
  await page.locator('#email').fill(demo.actors[role].email);
  await page.locator('#password').fill(demo.password);
  await page.locator('button[data-action-id="auth.sign-in.submit.password"]').click();
  await expect(page).not.toHaveURL(/auth\/sign-in/);
  const dismiss = page.getByRole('button', { name: 'I understand', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
}
async function typeAtEnd(page: Page, text: string) {
  await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
  await expect(editor(page)).toBeVisible();
  // The editor includes a large empty canvas and drag handles. Establish an
  // actual text caret before sending document navigation or typing keys.
  await editor(page).locator('[data-slate-string]').last().click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('Control+End');
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await expect(editor(page)).toContainText(text.trim());
  await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
}
test.beforeAll(async () => {
  const stack = JSON.parse(readFileSync('output/local-stack/stack.json', 'utf8'));
  const response = await fetch(`http://127.0.0.1:${stack.controlPort}/status`, {
    headers: { Authorization: `Bearer ${stack.token}` },
  });
  const state = await response.json();
  assert.equal(state.database.name, database);
  assert.equal(state.database.phase, 'active');
  assert(state.services.every((service: { ready: boolean }) => service.ready));
});
test.afterAll(() => sql.end());

test('keyboard entry opens the group Studio and preserves the unfinished statement', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await page.goto(`/create/statement?groupId=${demo.ids.group}`);
  await page
    .getByRole('textbox', { name: 'Statement', exact: true })
    .fill('Keep this unfinished statement');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Additional details', { exact: true }).click();
  const entry = page.getByRole('button', { name: 'Communication studio', exact: true });
  await expect(entry).toBeVisible();
  await entry.focus();
  await expect(entry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/group/${demo.ids.group}/studio`));
  const preserved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('studio:statement-return') || 'null')
  );
  expect(preserved).toMatchObject({ groupId: demo.ids.group });
  expect(preserved.text).toBe('Keep this unfinished statement');
});

test('all four text editor areas save browser input through confirmed shared revisions', async ({
  page,
}) => {
  await signIn(page, 'owner');
  for (const [area, path, entity, kind] of [
    ['amendment', `/amendment/${demo.ids.amendment}/text`, demo.ids.document, 'document'],
    ['blog', `/group/${demo.ids.group}/blog/${demo.ids.blog}/editor`, demo.ids.blog, 'blog'],
    [
      'personal',
      `/user/${demo.actors.owner.id}/editor/${demo.ids.personal}`,
      demo.ids.personal,
      'document',
    ],
    [
      'group',
      `/group/${demo.ids.group}/editor/${demo.ids.groupDocument}`,
      demo.ids.groupDocument,
      'document',
    ],
  ]) {
    console.log(`Browser acceptance: ${area}`);
    await page.goto(path);
    const value = marker(area);
    await typeAtEnd(page, value);
    await expect.poll(() => savedValue(entity, kind)).toContain(value.trim());
    await page.reload();
    await expect(editor(page)).toContainText(value.trim());
  }
});

test('typing during a rejected delta reopens the document channel and confirms the complete text', async ({
  page,
}) => {
  let dropped = false;
  let connections = 0;
  let armed = false;
  await page.routeWebSocket('ws://localhost:1236/**', route => {
    connections++;
    const server = route.connectToServer();
    route.onMessage(message => {
      const data = decoding.createDecoder(new Uint8Array(message as Buffer));
      decoding.readVarString(data);
      if (
        decoding.readVarUint(data) === 0 &&
        decoding.readVarUint(data) === 2 &&
        armed &&
        !dropped
      ) {
        dropped = true;
        return;
      }
      server.send(message);
    });
  });
  await signIn(page, 'owner');
  await page.goto(`/amendment/${demo.ids.amendment}/text`);
  await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
  const original = (await editor(page).innerText()).trim();
  const initialConnections = connections;
  armed = true;
  const first = marker('During channel recovery');
  await typeAtEnd(page, first);
  expect(dropped).toBe(true);
  // The reset transport must reopen even if its close overtakes the optional
  // stateless HTTP-resync request. The fresh handshake commits complete state.
  await expect.poll(() => connections).toBeGreaterThan(initialConnections);
  await expect.poll(() => savedValue(demo.ids.document)).toContain(first.trim());
  const next = marker('After channel recovery');
  await typeAtEnd(page, next);
  await expect.poll(() => savedValue(demo.ids.document)).toContain(next.trim());
  await page.reload();
  await expect(editor(page)).toContainText(first.trim());
  await expect(editor(page)).toContainText(next.trim());
  expect((await editor(page).innerText()).replace(first, '').replace(next, '').trim()).toBe(
    original
  );
});

test('a separate proposing account submits a private draft and an authorized owner applies the immutable proposal', async ({
  browser,
}) => {
  const proposer = await browser.newContext(),
    owner = await browser.newContext();
  try {
    const draftPage = await proposer.newPage(),
      mainPage = await owner.newPage();
    await signIn(draftPage, 'proposer');
    await signIn(mainPage, 'owner');
    await draftPage.goto(`/amendment/${demo.ids.amendment}/text`);
    await expect(
      draftPage.getByRole('button', { name: 'Create a separate follow-up draft' })
    ).toBeVisible();
    await expect(editor(draftPage)).toHaveCount(0);
    const before = await savedValue(demo.ids.document),
      text = marker('Vorschlag');
    await draftPage.getByRole('button', { name: 'Create a separate follow-up draft' }).click();
    await typeAtEnd(draftPage, text);
    expect(await savedValue(demo.ids.document)).toBe(before);
    await draftPage.getByRole('button', { name: 'Submit change request' }).click();
    await expect(
      draftPage.getByRole('button', { name: 'Create a separate follow-up draft' })
    ).toBeVisible();
    const [cr] =
      await sql`select cr.id,cr.title from change_request cr join collaboration_proposal p on p.change_request_id=cr.id where cr.user_id=${demo.actors.proposer.id} and p.submitted_content::text like ${'%' + text.trim() + '%'} order by p.created_at desc limit 1`;
    expect(cr).toBeTruthy();
    expect(await savedValue(demo.ids.document)).toBe(before);
    // Exercise management independently from direct text editing. This guarded
    // acceptance fixture changes the phase, which also retires old sessions.
    await sql`update document set editing_mode='suggest_internal' where id=${demo.ids.document}`;
    await mainPage.goto(`/amendment/${demo.ids.amendment}/text`);
    await expect(editor(mainPage)).toHaveCount(0);
    const proposal = mainPage.locator('details').filter({
      has: mainPage.locator('summary').filter({ hasText: `${cr.title} · Submitted` }),
    });
    await proposal.locator('summary').click();
    await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect.poll(() => savedValue(demo.ids.document)).toContain(text.trim());
    const [decision] =
      await sql`select decision_result,application_status from collaboration_proposal where change_request_id=${cr.id}`;
    expect(decision).toEqual({ decision_result: 'passed', application_status: 'applied' });
    await draftPage.reload();
    await expect(editor(draftPage)).toHaveCount(0);
  } finally {
    await sql`update document set editing_mode='edit' where id=${demo.ids.document}`;
    await proposer.close();
    await owner.close();
  }
});

test('Streetdesign and Studio save object fields and captions and download a real revision-bound PPTX', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await page.goto(`/amendment/${demo.ids.amendment}/citydesign`);
  await page.getByRole('button', { name: 'Objects', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Deciduous tree/ }).click();
  const height = page.getByRole('spinbutton', { name: 'Height (m)', exact: true });
  const initialHeight = await height.inputValue();
  const next = String(Number(initialHeight) === 7 ? 8 : 7);
  await height.fill(next);
  await height.press('Tab');
  await expect
    .poll(async () => {
      const data = JSON.parse(await savedValue(demo.ids.city, 'city'));
      return data.objects.some(
        (object: { properties: { height?: number } }) => object.properties.height === Number(next)
      );
    })
    .toBe(true);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await undo.focus();
  await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(height).toHaveValue(initialHeight);
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await redo.focus();
  await expect(redo).toBeFocused();
  await page.keyboard.press('Space');
  await expect(height).toHaveValue(next);
  await page.goto(`/group/${demo.ids.group}/studio?project=${demo.ids.studio}`);
  const text = marker('Studio');
  await page.getByRole('textbox', { name: 'Instagram', exact: true }).fill(text);
  await expect.poll(() => savedValue(demo.ids.studio, 'studio')).toContain(text.trim());
  await page.getByRole('combobox', { name: 'Format', exact: true }).last().selectOption('pptx');
  const previous = await sql`select id from studio_export where project_id=${demo.ids.studio}`;
  await page.getByRole('button', { name: 'Create export', exact: true }).click();
  await expect
    .poll(
      async () => {
        const jobs =
          await sql`select id,status from studio_export where project_id=${demo.ids.studio} order by created_at desc limit 1`;
        return jobs[0]?.status === 'completed' && !previous.some(job => job.id === jobs[0].id);
      },
      { timeout: 90_000 }
    )
    .toBe(true);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).first().click();
  const file = await download;
  const path = await file.path();
  assert(path);
  expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK');
  expect(file.suggestedFilename()).toMatch(/\.pptx$/);
  await page.goto(`/studio?project=${demo.ids.studio}`);
  await expect(page.getByRole('textbox', { name: 'Instagram', exact: true })).toHaveValue(text);
});

test('an offline browser draft survives a phase change and resumes privately without replaying into main', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const text = marker('Offline recovery');
  try {
    await signIn(page, 'owner');
    await page.goto(`/amendment/${demo.ids.amendment}/text`);
    await expect(editor(page)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    const before = await savedValue(demo.ids.document);
    await context.setOffline(true);
    // Close the existing WebSocket as well: Chromium offline emulation alone
    // can retain an already-established socket. Only the guarded local daemon
    // is restarted, and its supervisor brings it back automatically.
    const stack = JSON.parse(readFileSync('output/local-stack/stack.json', 'utf8'));
    const response = await fetch(`http://127.0.0.1:${stack.controlPort}/status`, {
      headers: { Authorization: `Bearer ${stack.token}` },
    });
    const status = await response.json();
    assert.equal(status.database.name, database);
    const service = status.services.find((s: { name: string }) => s.name === 'collaboration');
    assert(Number.isSafeInteger(service.pid));
    const killed = spawnSync('taskkill', ['/PID', String(service.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    expect(killed.status).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
    await editor(page).locator('[data-slate-string]').last().click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type(text);
    await page.keyboard.press('Escape');
    await expect(editor(page)).toContainText(text.trim());
    expect(await savedValue(demo.ids.document)).toBe(before);
    await sql`update document set editing_mode='vote_internal' where id=${demo.ids.document}`;
    await context.setOffline(false);
    await expect(
      page.getByRole('status').filter({ hasText: 'Your local draft has been retained' })
    ).toBeVisible();
    await expect(editor(page)).toHaveCount(0);
    expect(await savedValue(demo.ids.document)).toBe(before);
    await sql`update document set editing_mode='edit' where id=${demo.ids.document}`;
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Compare local draft 1', exact: true }).click();
    await expect(page.getByText('Resume as a new private draft', { exact: true })).toBeVisible();
    await expect(page.locator('pre').filter({ hasText: text.trim() })).toHaveCount(1);
    await page.getByRole('button', { name: 'Resume as a new draft', exact: true }).click();
    await expect(editor(page)).toContainText(text.trim());
    await expect(
      page.getByRole('button', { name: 'Submit change request', exact: true })
    ).toBeVisible();
    expect(await savedValue(demo.ids.document)).toBe(before);
    const drafts =
      await sql`select owner_id,shared,workspace_type from collaboration_document where base_document_id=(select id from collaboration_document where entity_id=${demo.ids.document} and workspace_id is null and branch_id is null) and projection::text like ${'%' + text.trim() + '%'}`;
    expect(drafts).toEqual([
      expect.objectContaining({
        owner_id: demo.actors.owner.id,
        shared: false,
        workspace_type: 'followup',
      }),
    ]);
  } finally {
    await context.setOffline(false);
    await sql`update document set editing_mode='edit' where id=${demo.ids.document}`;
    await context.close();
  }
});

test('public readers cannot edit or receive internal proposal previews', async ({ browser }) => {
  for (const role of ['reader', 'outsider']) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, role);
      const previews = page.waitForResponse(
        async response =>
          response.url().endsWith('/api/collaboration') &&
          response.request().postDataJSON()?.operation === 'proposals' &&
          response.ok()
      );
      await page.goto(`/amendment/${demo.ids.amendment}/text`);
      const proposals = await (await previews).json();
      await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
      await expect(editor(page)).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Create a separate follow-up draft' })
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
      if (role === 'outsider') {
        expect(
          proposals.some((proposal: { id: string }) => proposal.id === demo.ids.internalProposal)
        ).toBe(false);
        expect(JSON.stringify(proposals)).not.toContain('Mehr Bäume vor der Schule');
        await expect(
          page.locator('summary').filter({ hasText: 'Mehr Bäume vor der Schule' })
        ).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  }
});

test('revoking current editor membership retires the browser session before further writes', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const actor = demo.actors.editor.id;
  try {
    await signIn(page, 'editor');
    await page.goto(`/amendment/${demo.ids.amendment}/text`);
    const text = marker('Before revocation');
    await typeAtEnd(page, text);
    await expect.poll(() => savedValue(demo.ids.document)).toContain(text.trim());
    const before = await savedValue(demo.ids.document);
    await sql.begin(async tx => {
      await tx`update amendment_collaborator set status='invited' where amendment_id=${demo.ids.amendment} and user_id=${actor}`;
      await tx`update group_membership set status='invited' where group_id=${demo.ids.group} and user_id=${actor}`;
    });
    await expect(
      page.getByRole('status').filter({ hasText: 'Your local draft has been retained' })
    ).toBeVisible();
    await expect(editor(page)).toHaveCount(0);
    expect(await savedValue(demo.ids.document)).toBe(before);
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    await expect(editor(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Create a separate follow-up draft' })
    ).toHaveCount(0);
  } finally {
    await sql.begin(async tx => {
      await tx`update amendment_collaborator set status='active' where amendment_id=${demo.ids.amendment} and user_id=${actor}`;
      await tx`update group_membership set status='active' where group_id=${demo.ids.group} and user_id=${actor}`;
    });
    await context.close();
  }
});

test('browser controls follow current internal and terminal phases for owners and proposers', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    await signIn(pages[0], 'owner');
    await signIn(pages[1], 'proposer');
    for (const mode of ['suggest_internal', 'vote_internal', 'view', 'passed', 'rejected']) {
      await sql`update document set editing_mode=${mode} where id=${demo.ids.document}`;
      for (const page of pages) {
        await page.goto(`/amendment/${demo.ids.amendment}/text`);
        await expect(page.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
        await expect(editor(page)).toHaveCount(0);
        const draft = page.getByRole('button', { name: 'Create a separate follow-up draft' });
        await expect(draft).toHaveCount(
          ['suggest_internal', 'vote_internal'].includes(mode) ? 1 : 0
        );
        // A proposing account never receives management controls. Terminal and
        // voting phases also prohibit an owner from directly deciding proposals.
        if (page === pages[1] || mode !== 'suggest_internal')
          await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
      }
    }
  } finally {
    await sql`update document set editing_mode='edit' where id=${demo.ids.document}`;
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('text and Streetdesign browser edits remain in the selected process branch', async ({
  page,
}) => {
  const [amendment] =
    await sql`select current_process_run_id from amendment where id=${demo.ids.amendment}`;
  const branchValue = async (kind: string, branch: string) => {
    const [row] =
      await sql`select projection from collaboration_document where kind=${kind} and branch_id=${branch} and workspace_id is null`;
    return JSON.stringify(row.projection);
  };
  const main = await savedValue(demo.ids.document),
    otherText = await branchValue('document', demo.ids.branchB),
    otherCity = await branchValue('city', demo.ids.branchB),
    mainCity = await savedValue(demo.ids.city, 'city');
  try {
    await sql`update amendment set current_process_run_id=${demo.ids.run} where id=${demo.ids.amendment}`;
    await signIn(page, 'owner');
    await page.goto(`/amendment/${demo.ids.amendment}/text?branch=${demo.ids.branchA}`);
    const text = marker('Branch A');
    await typeAtEnd(page, text);
    await expect.poll(() => branchValue('document', demo.ids.branchA)).toContain(text.trim());
    expect(await savedValue(demo.ids.document)).toBe(main);
    expect(await branchValue('document', demo.ids.branchB)).toBe(otherText);
    await page.goto(`/amendment/${demo.ids.amendment}/citydesign?branch=${demo.ids.branchA}`);
    await page.getByRole('button', { name: 'Objects', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Deciduous tree/ }).click();
    const height = page.getByRole('spinbutton', { name: 'Height (m)', exact: true });
    const next = Number(await height.inputValue()) === 9 ? '10' : '9';
    await height.fill(next);
    await height.press('Tab');
    await expect
      .poll(
        async () =>
          JSON.parse(await branchValue('city', demo.ids.branchA)).objects[0].properties.height
      )
      .toBe(Number(next));
    expect(await branchValue('city', demo.ids.branchB)).toBe(otherCity);
    expect(await savedValue(demo.ids.city, 'city')).toBe(mainCity);
    await page.goto(`/amendment/${demo.ids.amendment}/text?branch=${demo.ids.branchB}`);
    await expect(editor(page)).toBeVisible();
    await expect(editor(page)).not.toContainText(text.trim());
  } finally {
    await sql`update amendment set current_process_run_id=${amendment.current_process_run_id} where id=${demo.ids.amendment}`;
  }
});

test('conflicting browser decisions retain their result and retry only the original proposal after version recovery', async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    proposer = await browser.newContext();
  try {
    const mainPage = await owner.newPage(),
      draftPage = await proposer.newPage();
    await signIn(mainPage, 'owner');
    await signIn(draftPage, 'proposer');
    const [initial] =
      await sql`select id,revision,generation,projection from collaboration_document where entity_id=${demo.ids.document} and branch_id is null and workspace_id is null`;
    await draftPage.goto(`/amendment/${demo.ids.amendment}/text`);
    await draftPage.getByRole('button', { name: 'Create a separate follow-up draft' }).click();
    const text = `Proposed heading ${crypto.randomUUID().slice(0, 8)}.`;
    await expect(
      draftPage.getByRole('button', { name: 'Submit change request', exact: true })
    ).toBeEnabled();
    await expect(
      draftPage.getByRole('status').filter({ hasText: 'Confirmed saved' })
    ).toBeVisible();
    // Both sides replace the same base text. Appending at different caret
    // positions is legitimately mergeable and does not establish a conflict.
    const originalHeading = initial.projection[0].children
      .map((leaf: { text: string }) => leaf.text)
      .join('');
    const selectHeading = async (page: Page) => {
      await editor(page).locator('[data-slate-string]').first().click();
      await expect(editor(page)).toBeFocused();
      await page.keyboard.press('Control+Home');
      // Select the entire logical heading, including wrapped visual lines.
      // Native keyboard events exercise the editor's selection synchronization.
      await page.keyboard.down('Shift');
      for (const _character of originalHeading) await page.keyboard.press('ArrowRight');
      await page.keyboard.up('Shift');
      await expect
        .poll(() => page.evaluate(() => window.getSelection()?.toString()))
        .toBe(originalHeading);
    };
    await selectHeading(draftPage);
    await draftPage.keyboard.type(text, { delay: 40 });
    // Proposal mode deliberately keeps tracked deletions visible inline.
    await expect(editor(draftPage)).toContainText(text);
    await expect(
      draftPage.getByRole('status').filter({ hasText: 'Confirmed saved' })
    ).toBeVisible();
    await draftPage.getByRole('button', { name: 'Submit change request', exact: true }).click();
    await expect(
      draftPage.getByRole('button', { name: 'Create a separate follow-up draft' })
    ).toBeVisible();
    const [cr] =
      await sql`select cr.id,cr.title,p.checksum,p.submitted_content from change_request cr join collaboration_proposal p on p.change_request_id=cr.id where p.submitted_content::text like ${'%' + text.trim() + '%'} order by p.created_at desc limit 1`;
    expect(cr.submitted_content).toMatchObject({
      change_type: 'replace',
      original_text: originalHeading,
      new_text: text,
    });
    await mainPage.goto(`/amendment/${demo.ids.amendment}/text`);
    await expect(editor(mainPage)).toBeVisible();
    await expect(mainPage.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    const competing = `Alternative heading ${crypto.randomUUID().slice(0, 8)}.`;
    await selectHeading(mainPage);
    await mainPage.keyboard.type(competing, { delay: 40 });
    await expect(editor(mainPage).getByRole('heading').first()).toHaveText(competing);
    await expect(mainPage.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    await expect.poll(() => savedValue(demo.ids.document)).not.toContain(text.trim());
    await expect.poll(() => savedValue(demo.ids.document)).toContain(competing.trim());
    const divergent = await savedValue(demo.ids.document);
    expect(
      JSON.parse(divergent)[0]
        .children.map((leaf: { text: string }) => leaf.text)
        .join('')
    ).toBe(competing);
    const proposal = mainPage
      .locator('details')
      .filter({ has: mainPage.locator('summary').filter({ hasText: cr.title }) });
    await proposal.locator('summary').click();
    await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(proposal.locator('summary')).toContainText('passed · conflict');
    await proposal.locator('summary').click();
    await expect(proposal.getByRole('alert')).toContainText('The decision remains unchanged');
    await Promise.all([
      mainPage.waitForResponse(
        response =>
          response.url().endsWith('/api/collaboration') &&
          response.request().postDataJSON()?.operation === 'session' &&
          response.ok()
      ),
      proposal.getByRole('button', { name: 'Retry applying the decision', exact: true }).click(),
    ]);
    await expect(mainPage.getByRole('status').filter({ hasText: 'Confirmed saved' })).toBeVisible();
    await expect(proposal.locator('summary')).toContainText('passed · conflict');
    expect(await savedValue(demo.ids.document)).toBe(divergent);
    const history = mainPage
      .locator('details')
      .filter({ has: mainPage.locator('summary').filter({ hasText: 'Saved versions' }) });
    await history.locator('summary').click();
    await history.getByRole('button', { name: 'Load versions', exact: true }).click();
    const saved = history.locator('div').filter({
      has: mainPage
        .locator('span')
        .filter({ hasText: new RegExp(`^Revision ${initial.revision} ·`) }),
    });
    await saved.getByRole('button', { name: 'Restore as a new generation', exact: true }).click();
    await expect.poll(() => savedValue(demo.ids.document)).toBe(JSON.stringify(initial.projection));
    const [restored] =
      await sql`select generation from collaboration_document where id=${initial.id}`;
    expect(restored.generation).not.toBe(initial.generation);
    await proposal.locator('summary').click();
    await proposal
      .getByRole('button', { name: 'Retry applying the decision', exact: true })
      .click();
    await expect.poll(() => savedValue(demo.ids.document)).toContain(text.trim());
    const [proof] =
      await sql`select decision_result,application_status,checksum from collaboration_proposal where change_request_id=${cr.id}`;
    expect(proof).toEqual({
      decision_result: 'passed',
      application_status: 'applied',
      checksum: cr.checksum,
    });
  } finally {
    await owner.close();
    await proposer.close();
  }
});
