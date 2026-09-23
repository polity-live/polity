import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
const broadcasts = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    channel: (topic: string) => ({
      httpSend: async () => {
        broadcasts.push(topic);
        return { success: true };
      },
    }),
    removeChannel: async () => undefined,
  }),
}));
import postgres from 'postgres';
import { canvasCommand } from '../governance';
import { studioSql } from '../db';
import { applyStudioOperation } from '../operations';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { diffStudio } from '@/features/communication-studio/logic/operations';
import { element } from '@/features/communication-studio/logic/document';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '@/features/communication-studio/logic/v3-adapter';
import { assertCanvasWorkspace } from '../workspace-access';
import { assetUrls } from '../service';
import { canvasPresence } from '../presence';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname) ||
  new URL(database).port !== '54322'
)
  throw new Error('Canvas tests require the explicit local development database');
process.env.STUDIO_DATABASE_URL = database;
const sql = postgres(database, { max: 12 });
const owner = crypto.randomUUID(),
  member = crypto.randomUUID(),
  outsider = crypto.randomUUID(),
  group = crypto.randomUUID();
const memberRole = crypto.randomUUID();
const projects: string[] = [];
const concurrentEditors = Array.from({ length: 10 }, () => crypto.randomUUID());
beforeAll(async () => {
  for (const id of [owner, member, outsider, ...concurrentEditors])
    await sql`insert into "user"(id) values(${id})`;
  await sql`insert into "group"(id,name,owner_id) values(${group},'Canvas integration fixture',${owner})`;
  const membershipId = crypto.randomUUID();
  await sql`insert into group_membership(id,group_id,user_id,status) values(${membershipId},${group},${member},'active')`;
  await sql`insert into role(id,name,scope,group_id) values(${memberRole},'Canvas editor','group',${group})`;
  await sql`insert into action_right(resource,action,role_id,group_id) values('projects','manage',${memberRole},${group})`;
  await sql`insert into group_membership_role(group_membership_id,role_id) values(${membershipId},${memberRole})`;
});

it('creates signed upload tokens from the provisioned private Studio bucket', async () => {
  const local = JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
  );
  if (!['localhost', '127.0.0.1'].includes(new URL(local.API_URL).hostname))
    throw new Error('Studio storage tests require the local Supabase instance');
  const { data, error } = await createSupabaseClient(local.API_URL, local.SERVICE_ROLE_KEY)
    .storage.from('studio')
    .createSignedUploadUrl(`integration/${crypto.randomUUID()}`);
  expect(error).toBeNull();
  expect(data?.token).toBeTruthy();
});

it('does not send new presence data to an already joined user after membership revocation', async () => {
  const { id, doc } = await fixture();
  const frame = doc.nodes.find(node => node.type === 'frame' && node.parentFrameId === null);
  if (!frame) throw new Error('Missing root frame');
  await canvasPresence(member, {
    projectId: id,
    cursor: { pageId: frame.id, x: 10, y: 20 },
  });
  await canvasPresence(owner, { projectId: id });
  expect(broadcasts).toContain(`canvas-user:${id}:main:${member}`);
  await sql`update group_membership set status='requested' where group_id=${group} and user_id=${member}`;
  try {
    broadcasts.length = 0;
    await canvasPresence(owner, { projectId: id });
    expect(broadcasts).toEqual([`canvas-user:${id}:main:${owner}`]);
    await expect(canvasPresence(member, { projectId: id })).rejects.toThrow();
  } finally {
    await sql`update group_membership set status='active' where group_id=${group} and user_id=${member}`;
  }
});
afterAll(async () => {
  for (const id of projects) {
    await sql`delete from canvas_vote where proposal_id in (select id from canvas_proposal where project_id=${id})`;
    await sql`delete from canvas_comment where project_id=${id}`;
    await sql`delete from canvas_receipt where project_id=${id}`;
    await sql`delete from canvas_library where project_id=${id}`;
    await sql`delete from studio_asset where project_id=${id}`;
    await sql`delete from canvas_proposal where project_id=${id}`;
    await sql`delete from studio_project where id=${id}`;
  }
  await sql`delete from group_membership where group_id=${group}`;
  await sql`delete from "group" where id=${group}`;
  for (const id of [owner, member, outsider, ...concurrentEditors])
    await sql`delete from "user" where id=${id}`;
  await sql.end();
  await studioSql().end();
});

it('isolates proposal media from the canonical library and promotes only media in an applied decision', async () => {
  const { id, doc, command, session } = await fixture('suggest_internal');
  const { workspaceId } = await command(member, 'createDraft', {
    revision: 0,
    title: 'Private image',
  });
  const asset = crypto.randomUUID();
  await sql`insert into studio_asset(id,project_id,workspace_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${asset},${id},${workspaceId},'Private image','image/png',16,${`${id}/assets/${asset}`},true,0)`;
  expect(await assetUrls(owner, id)).toEqual([]);
  await expect(assetUrls(owner, id, workspaceId)).rejects.toThrow();
  expect(await assetUrls(member, id, workspaceId)).toContainEqual(
    expect.objectContaining({ id: asset, url: `/api/studio/media/${asset}` })
  );
  await expect(assertCanvasWorkspace(owner, id, workspaceId, false, sql)).rejects.toThrow();
  const legacy = v3DocumentToLegacy(doc);
  legacy.pages[0].elements.push(element('image', { assetId: asset }));
  const next = legacyDocumentToV3(legacy, doc);
  await sql`update canvas_control set phase='edit' where project_id=${id}`;
  await expect(
    sql.begin(tx =>
      applyStudioOperation(
        {
          location: 'server',
          dbTransaction: { query: (q: string, p: unknown[]) => tx.unsafe(q, p as never[]) },
        } as never,
        owner,
        {
          projectId: id,
          operationId: crypto.randomUUID(),
          generation: session.generation,
          expectedRevision: 0,
          changes: diffStudio(doc, next),
        }
      )
    )
  ).rejects.toThrow('invalid_asset');
  await sql`update canvas_control set phase='suggest_internal' where project_id=${id}`;
  await command(member, 'saveDraft', { workspaceId, revision: 0, changes: diffStudio(doc, next) });
  await command(member, 'submit', { workspaceId, revision: 1 });
  await command(owner, 'phase', { revision: 0, phase: 'vote_internal' });
  await command(owner, 'startVote', { workspaceId });
  await command(owner, 'vote', { workspaceId, choice: 'accept' });
  await command(member, 'vote', { workspaceId, choice: 'accept' });
  expect(await assetUrls(owner, id)).toContainEqual(expect.objectContaining({ id: asset }));
});
async function fixture(phase: 'edit' | 'suggest_internal' = 'edit') {
  const id = crypto.randomUUID(),
    legacy = createDocument('single', 'Canvas fixture');
  projects.push(id);
  legacy.pages[0].canvas = { version: 1, elements: [], files: {} };
  const doc = legacyDocumentToV3(legacy);
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${id},${owner},${group},${doc.title},${doc.kind},5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${id},${sql.json(JSON.parse(JSON.stringify(doc)))},0)`;
  const session = await canvasCommand(owner, { action: 'session', projectId: id });
  if (phase !== 'edit') await sql`update canvas_control set phase=${phase} where project_id=${id}`;
  const command = (actor: string, action: string, input: Record<string, unknown> = {}) =>
    canvasCommand(actor, {
      projectId: id,
      action,
      generation: session.generation,
      operationId: crypto.randomUUID(),
      ...input,
    });
  return { id, doc, session, command };
}
it('shares a personal project only through an explicit authorized adoption and invalidates its previous generation', async () => {
  const { id, command, session } = await fixture();
  await sql`update studio_project set group_id=null where id=${id}`;
  await expect(canvasCommand(member, { action: 'session', projectId: id })).rejects.toThrow();
  await command(owner, 'comment', { body: 'Personal comment' });
  await command(owner, 'saveLibrary', { title: 'Personal library', library: [] });
  const { id: other } = await fixture();
  expect(await canvasCommand(owner, { action: 'libraries', projectId: other })).toEqual([]);
  const adopted = await command(owner, 'adopt', { groupId: group, revision: 0 });
  expect(adopted.groupId).toBe(group);
  const current = await canvasCommand(member, { action: 'session', projectId: id });
  expect(current.groupId).toBe(group);
  expect(current.generation).not.toBe(session.generation);
  expect(current.comments).toContainEqual(expect.objectContaining({ body: 'Personal comment' }));
  expect(await canvasCommand(member, { action: 'libraries', projectId: other })).toContainEqual(
    expect.objectContaining({ name: 'Personal library' })
  );
  await expect(command(owner, 'comment', { body: 'Obsolete generation' })).rejects.toThrow(
    'generation'
  );
  await expect(
    canvasCommand(outsider, { action: 'libraries', projectId: other })
  ).rejects.toThrow();
});
it('recovers an already committed operation receipt after a phase change without permitting a new edit', async () => {
  const { id, doc, session, command } = await fixture();
  const next = structuredClone(doc);
  next.title = 'Committed before phase switch';
  const input = {
    projectId: id,
    operationId: crypto.randomUUID(),
    generation: session.generation,
    expectedRevision: 0,
    changes: diffStudio(doc, next),
  };
  const apply = (args: typeof input) =>
    sql.begin(tx =>
      applyStudioOperation(
        {
          location: 'server',
          dbTransaction: { query: (q: string, p: unknown[]) => tx.unsafe(q, p as never[]) },
        } as never,
        owner,
        args
      )
    );
  const receipt = await apply(input);
  await command(owner, 'phase', { revision: 1, phase: 'vote_internal' });
  expect(await apply(input)).toEqual(receipt);
  await expect(apply({ ...input, operationId: crypto.randomUUID() })).rejects.toThrow();
  expect(
    (await sql`select content_revision from studio_state where project_id=${id}`)[0]
      .content_revision
  ).toBe(1);
});

it('blocks a corrupted submitted ballot instead of inventing a replacement voting version', async () => {
  const { id, doc, command } = await fixture('suggest_internal');
  const { workspaceId } = await command(member, 'createDraft', { title: 'Integrity', revision: 0 });
  const next = structuredClone(doc);
  next.title = 'The submitted text';
  await command(member, 'saveDraft', { workspaceId, revision: 0, changes: diffStudio(doc, next) });
  await command(member, 'submit', { workspaceId, revision: 1 });
  await sql`update canvas_proposal set changes='[]' where id=${workspaceId}`;
  await expect(command(owner, 'phase', { phase: 'vote_internal', revision: 0 })).rejects.toThrow(
    'integrity'
  );
  expect(await sql`select * from canvas_vote where proposal_id=${workspaceId}`).toHaveLength(0);
  expect(
    (await sql`select document from studio_state where project_id=${id}`)[0].document.title
  ).toBe(doc.title);
});
it('opens all submitted group Studio ballots on the mode change and closes when everyone voted', async () => {
  const { id, doc, command } = await fixture();
  await expect(command(owner, 'phase', { phase: 'view', revision: 0 })).rejects.toThrow();
  await command(owner, 'phase', { phase: 'suggest_internal', revision: 0 });
  const { workspaceId } = await command(member, 'createDraft', {
    title: 'Change the title',
    revision: 0,
  });
  const next = structuredClone(doc);
  next.title = 'Title after the vote';
  await command(member, 'saveDraft', { workspaceId, revision: 0, changes: diffStudio(doc, next) });
  await command(member, 'submit', { workspaceId, revision: 1 });
  await command(owner, 'phase', { phase: 'vote_internal', revision: 0 });
  const opened = (await canvasCommand(owner, { action: 'session', projectId: id })).proposals.find(
    (item: { id: string }) => item.id === workspaceId
  );
  expect(opened).toMatchObject({ state: 'voting', deadline: null });
  expect(opened.electorate).toEqual(expect.arrayContaining([owner, member]));
  await command(owner, 'vote', { workspaceId, choice: 'accept' });
  await command(member, 'vote', { workspaceId, choice: 'accept' });
  const closed = (await canvasCommand(owner, { action: 'session', projectId: id })).proposals.find(
    (item: { id: string }) => item.id === workspaceId
  );
  expect(closed).toMatchObject({ state: 'closed', decision: 'accepted', application: 'applied' });
  expect(
    (await sql`select document->>'title' as title from studio_state where project_id=${id}`)[0]
      .title
  ).toBe('Title after the vote');
});
it('keeps drafts private and applies exactly the immutable proposal once, retaining a conflicting second decision', async () => {
  const { id, doc, command } = await fixture('suggest_internal');
  await expect(canvasCommand(outsider, { projectId: id, action: 'session' })).rejects.toThrow();
  const make = async (title: string) => {
    const { workspaceId } = await command(member, 'createDraft', { revision: 0, title });
    expect(
      (await canvasCommand(owner, { action: 'session', projectId: id })).proposals
    ).not.toContainEqual(expect.objectContaining({ id: workspaceId }));
    const edited = structuredClone(doc);
    edited.title = title;
    await command(member, 'saveDraft', {
      workspaceId,
      revision: 0,
      changes: diffStudio(doc, edited),
    });
    await command(member, 'comment', { workspaceId, body: 'A private discussion' });
    expect(
      (await canvasCommand(owner, { action: 'session', projectId: id })).comments
    ).not.toContainEqual(expect.objectContaining({ proposal_id: workspaceId }));
    await command(member, 'submit', { workspaceId, revision: 1 });
    await expect(
      command(member, 'saveDraft', { workspaceId, revision: 1, changes: diffStudio(doc, edited) })
    ).rejects.toThrow();
    return workspaceId;
  };
  const a = await make('Accepted A'),
    b = await make('Conflicting B');
  await command(owner, 'phase', { phase: 'vote_internal', revision: 0 });
  for (const workspaceId of [a, b]) await command(owner, 'startVote', { workspaceId });
  await expect(
    sql`update studio_state set document=jsonb_set(document,'{title}','"bypass"'),content_revision=content_revision+1 where project_id=${id}`
  ).rejects.toThrow('locked');
  for (const workspaceId of [a, b]) {
    await command(owner, 'vote', { workspaceId, choice: 'accept' });
    const op = crypto.randomUUID();
    const input = { workspaceId, choice: 'accept', operationId: op };
    await command(member, 'vote', input);
    await command(member, 'vote', input);
  }
  const session = await canvasCommand(owner, { action: 'session', projectId: id });
  expect(session.proposals.find((p: any) => p.id === a)).toMatchObject({
    decision: 'accepted',
    application: 'applied',
  });
  expect(session.proposals.find((p: any) => p.id === b)).toMatchObject({
    decision: 'accepted',
    application: 'conflict',
  });
  const [stored] =
    await sql`select document,content_revision from studio_state where project_id=${id}`;
  expect(stored.document.title).toBe('Accepted A');
  expect(stored.content_revision).toBe(1);
  await expect(command(owner, 'phase', { phase: 'edit', revision: 1 })).rejects.toThrow(
    'conflicts'
  );
  const originalVotes =
    await sql`select user_id,choice from canvas_vote where proposal_id=${b} order by user_id`;
  const resolve = async (title: string, choice: string) => {
    const { workspaceId } = await command(member, 'resolveDraft', {
      workspaceId: b,
      revision: 1,
      title,
    });
    const next = structuredClone(stored.document);
    next.title = title;
    await command(member, 'saveDraft', {
      workspaceId,
      revision: 0,
      changes: diffStudio(stored.document, next),
    });
    await command(member, 'submit', { workspaceId, revision: 1 });
    await command(owner, 'startVote', { workspaceId });
    await command(owner, 'vote', { workspaceId, choice });
    await command(member, 'vote', { workspaceId, choice });
    return workspaceId;
  };
  await resolve('Rejected resolution', 'reject');
  await expect(command(owner, 'phase', { phase: 'edit', revision: 1 })).rejects.toThrow(
    'conflicts'
  );
  const resolution = await resolve('Resolved by a new decision', 'accept');
  const resolved = await canvasCommand(owner, { action: 'session', projectId: id });
  expect(resolved.proposals.find((p: any) => p.id === b)).toMatchObject({
    decision: 'accepted',
    application: 'superseded',
  });
  expect(resolved.proposals.find((p: any) => p.id === resolution)).toMatchObject({
    decision: 'accepted',
    application: 'applied',
    resolves_id: b,
  });
  expect(
    await sql`select user_id,choice from canvas_vote where proposal_id=${b} order by user_id`
  ).toEqual(originalVotes);
  await expect(command(owner, 'reapply', { workspaceId: b })).rejects.toThrow();
  await command(owner, 'phase', { phase: 'edit', revision: 2 });
  expect(
    (await sql`select document->>'title' as title from studio_state where project_id=${id}`)[0]
      .title
  ).toBe('Resolved by a new decision');
});

it('commits independent edits from ten distinct simultaneous editors and refuses stale generations', async () => {
  const { id, doc, session } = await fixture();
  for (const actor of concurrentEditors) {
    const membershipId = crypto.randomUUID();
    await sql`insert into group_membership(id,group_id,user_id,status) values(${membershipId},${group},${actor},'admin')`;
    await sql`insert into group_membership_role(group_membership_id,role_id) values(${membershipId},${memberRole})`;
  }
  const edits = Array.from({ length: 10 }, (_, i) => {
    const legacy = v3DocumentToLegacy(doc);
    legacy.pages[0].canvas ??= { version: 1, elements: [], files: {} };
    legacy.pages[0].canvas.elements.push({
      id: `shape-${i}`,
      type: 'rectangle',
      x: i * 100,
      y: 20,
      width: 80,
      height: 80,
      angle: 0,
      isDeleted: false,
    });
    const d = legacyDocumentToV3(legacy, doc);
    return {
      projectId: id,
      operationId: crypto.randomUUID(),
      generation: session.generation,
      expectedRevision: 0,
      changes: diffStudio(doc, d),
    };
  });
  const elapsed = await Promise.all(
    edits.map((args, i) =>
      sql.begin(async tx => {
        const start = performance.now();
        await applyStudioOperation(
          {
            location: 'server',
            dbTransaction: { query: (q: string, p: unknown[]) => tx.unsafe(q, p as never[]) },
          } as never,
          concurrentEditors[i],
          args
        );
        return performance.now() - start;
      })
    )
  );
  const [stored] =
    await sql`select document,content_revision from studio_state where project_id=${id}`;
  expect(stored.document.nodes.filter((node: any) => node.type === 'shape')).toHaveLength(
    doc.nodes.filter(node => node.type === 'shape').length + 10
  );
  expect(stored.document.nodes.every((node: any) => !('excalidraw' in node))).toBe(true);
  expect(stored.content_revision).toBe(10);
  expect(elapsed.sort((a, b) => a - b)[9]).toBeLessThan(1000);
  await expect(
    sql.begin(tx =>
      applyStudioOperation(
        {
          location: 'server',
          dbTransaction: { query: (q: string, p: unknown[]) => tx.unsafe(q, p as never[]) },
        } as never,
        owner,
        { ...edits[0], operationId: crypto.randomUUID(), generation: crypto.randomUUID() }
      )
    )
  ).rejects.toThrow('generation');
  await sql`delete from group_membership where group_id=${group} and user_id in ${sql(concurrentEditors)}`;
});

it('shares only explicit drafts, merges independent draft properties, and keeps comments after their target disappears', async () => {
  const { id, doc, command } = await fixture('suggest_internal');
  const { workspaceId } = await command(member, 'createDraft', {
    revision: 0,
    title: 'Shared draft',
  });
  await expect(
    canvasCommand(owner, { action: 'loadDraft', projectId: id, workspaceId })
  ).rejects.toThrow();
  await command(member, 'share', { workspaceId, revision: 0, userIds: [owner] });
  const first = structuredClone(doc),
    second = structuredClone(doc);
  first.title = 'Shared title';
  const secondFrame = second.nodes.find(node => node.type === 'frame' && !node.parentFrameId);
  if (!secondFrame) throw new Error('Missing root frame');
  secondFrame.name = 'Independent name';
  await command(member, 'saveDraft', { workspaceId, revision: 0, changes: diffStudio(doc, first) });
  await command(owner, 'saveDraft', { workspaceId, revision: 0, changes: diffStudio(doc, second) });
  const loaded = await canvasCommand(owner, { action: 'loadDraft', projectId: id, workspaceId });
  expect(loaded.document.title).toBe('Shared title');
  expect(loaded.baseDocument.title).toBe(doc.title);
  expect(
    loaded.document.nodes.find((node: any) => node.type === 'frame' && !node.parentFrameId).name
  ).toBe('Independent name');
  const commentId = crypto.randomUUID();
  await command(member, 'comment', {
    workspaceId,
    operationId: commentId,
    elementId: 'deleted-shape',
    body: 'Keep this discussion',
  });
  await expect(
    command(owner, 'editComment', { commentId, body: 'Not the author' })
  ).rejects.toThrow();
  await command(member, 'editComment', { commentId, body: 'Author correction' });
  await command(member, 'share', { workspaceId, revision: 2, userIds: [] });
  await expect(
    canvasCommand(owner, { action: 'loadDraft', projectId: id, workspaceId })
  ).rejects.toThrow();
  expect(
    (await canvasCommand(member, { action: 'session', projectId: id })).comments
  ).toContainEqual(
    expect.objectContaining({
      id: commentId,
      element_id: 'deleted-shape',
      body: 'Author correction',
    })
  );
  expect((await canvasCommand(owner, { action: 'session', projectId: id })).comments).toEqual([]);
});

it('rechecks role capabilities for drafts, comments and votes while retaining earlier valid votes', async () => {
  const { id, doc, command } = await fixture('suggest_internal');
  const role = crypto.randomUUID();
  await sql`insert into role(id,name,group_id) values(${role},'Canvas restricted role',${group})`;
  const [membership] =
    await sql`select id from group_membership where user_id=${member} and group_id=${group}`;
  await sql`insert into group_membership_role(id,group_membership_id,role_id) values(${crypto.randomUUID()},${membership.id},${role})`;
  try {
    const { workspaceId } = await command(member, 'createDraft', {
      revision: 0,
      title: 'Role test',
    });
    const updated = structuredClone(doc);
    updated.title = 'Role test result';
    await command(member, 'saveDraft', {
      workspaceId,
      revision: 0,
      changes: diffStudio(doc, updated),
    });
    await command(owner, 'setCapability', { roleId: role, capability: 'suggest', allowed: false });
    expect(
      (await canvasCommand(member, { action: 'loadDraft', projectId: id, workspaceId })).canEdit
    ).toBe(false);
    await expect(command(member, 'submit', { workspaceId, revision: 1 })).rejects.toThrow();
    await command(owner, 'setCapability', { roleId: role, capability: 'comment', allowed: false });
    await expect(
      command(member, 'comment', { workspaceId, body: 'Should be blocked' })
    ).rejects.toThrow();
    await command(owner, 'setCapability', { roleId: role, capability: 'suggest', allowed: true });
    await command(member, 'submit', { workspaceId, revision: 1 });
    await command(owner, 'phase', { phase: 'vote_internal', revision: 0 });
    await command(owner, 'startVote', { workspaceId });
    await command(member, 'vote', { workspaceId, choice: 'accept' });
    await command(owner, 'setCapability', { roleId: role, capability: 'vote', allowed: false });
    await expect(command(member, 'vote', { workspaceId, choice: 'reject' })).rejects.toThrow();
    await command(owner, 'vote', { workspaceId, choice: 'accept' });
    const session = await canvasCommand(owner, { projectId: id, action: 'session' });
    expect(session.proposals[0]).toMatchObject({
      decision: 'accepted',
      application: 'applied',
      votes: expect.arrayContaining([{ user_id: member, choice: 'accept' }]),
    });
  } finally {
    await sql`delete from group_membership_role where role_id=${role}`;
    await sql`delete from role where id=${role}`;
  }
});
