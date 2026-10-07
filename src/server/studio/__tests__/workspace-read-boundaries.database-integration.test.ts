import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import { defaultBrand } from '@/features/communication-studio/logic/document';

const session = vi.hoisted(() => ({ actor: null as string | null }));
vi.mock('@/lib/supabase/server', async original => ({
  ...(await original<typeof import('@/lib/supabase/server')>()),
  getSession: async () => (session.actor ? { user: { id: session.actor } } : null),
}));
import { assertCanvasWorkspace } from '../workspace-access';
import { dbProvider } from '@/zero/db-provider';
import { studioQueries } from '@/zero/communication-studio/queries';
import { studioAssetUrls, studioCapabilities } from '@/zero/communication-studio/projections';

import { resolveStudioSource } from '../source';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ??
  process.env.STUDIO_DATABASE_URL ??
  process.env.ZERO_UPSTREAM_DB;
if (!database || !['localhost', '127.0.0.1'].includes(new URL(database).hostname))
  throw new Error('Workspace boundary tests require an explicit local test database');
process.env.STUDIO_DATABASE_URL = database;
const sql = postgres(database, { max: 2 });
const [owner, guest, other, group, personal, grouped, missingState, proposal, resolution, asset] =
  Array.from({ length: 10 }, () => crypto.randomUUID());
const document = createStudioTemplateDocumentV5('single', 'Workspace boundaries', defaultBrand);
const encodedDocument = JSON.parse(JSON.stringify(document));
const readRole = crypto.randomUUID();
const query = (name: keyof typeof studioQueries, args: unknown, actor = session.actor) =>
  dbProvider.transaction(tx =>
    tx.run((studioQueries[name] as any).fn({ args, ctx: { userID: actor ?? 'anon', email: '' } }))
  );
const snapshot = async (id: string) => {
  const [project, state, assets, internal] = (await Promise.all([
    query('project', { id }),
    query('document', { id }),
    query('assets', { projectId: id }),
    query('sessionProject', { projectId: id }),
  ])) as any[];
  if (!project || !state) return null;
  const caps = internal
    ? studioCapabilities(internal, session.actor ?? '', 'edit')
    : { edit: false, manage: false };
  return {
    project: { ...project, canEdit: caps.edit, canManageVisibility: caps.manage },
    document: state.document,
    assets: studioAssetUrls(assets),
  };
};

beforeAll(async () => {
  for (const actor of [owner, guest, other]) await sql`insert into "user" (id) values (${actor})`;
  await sql`insert into "group" (id,name,owner_id) values (${group},'Workspace boundaries',${owner})`;
  const membership = crypto.randomUUID();
  const role = readRole;
  await sql`insert into group_membership (id,group_id,user_id,status) values (${membership},${group},${other},'active')`;
  await sql`insert into role (id,name,scope,group_id) values (${role},'Project reader','group',${group})`;
  await sql`insert into action_right (resource,action,role_id,group_id) values ('projects','view',${role},${group})`;
  await sql`insert into group_membership_role (group_membership_id,role_id) values (${membership},${role})`;
  await sql`insert into studio_project (id,owner_id,group_id,title,kind,visibility,document_schema_version,created_at,updated_at)
    values (${personal},${owner},null,'Personal snapshot','single','private',5,0,0),
      (${grouped},${owner},${group},'Group snapshot','single','public',5,0,0),
      (${missingState},${owner},null,'State absent','single','private',5,0,0)`;
  for (const id of [personal, grouped])
    await sql`insert into studio_state (project_id,document,updated_at) values (${id},${sql.json(encodedDocument)},0)`;
  await sql`insert into studio_project_collaborator (id,project_id,user_id,invited_by_id,status,created_at,updated_at)
    values (${crypto.randomUUID()},${personal},${guest},${owner},'invited',0,0)`;
  await sql`insert into studio_asset (id,project_id,name,mime_type,byte_size,storage_path,ready,created_at)
    values (${asset},${personal},'Private image','image/png',10,${`${personal}/assets/${asset}.png`},true,0)`;
  for (const id of [resolution, proposal])
    await sql`insert into canvas_proposal (id,project_id,owner_id,title,base_document,document,base_revision,base_generation,created_at,updated_at)
      values (${id},${grouped},${owner},'Draft',${sql.json(encodedDocument)},${sql.json(encodedDocument)},0,${crypto.randomUUID()},0,0)`;
});

beforeEach(() => {
  session.actor = owner;
});

afterAll(async () => {
  await sql`update canvas_proposal set resolves_id=null where id=${proposal}`;
  for (const id of [proposal, resolution]) await sql`delete from canvas_proposal where id=${id}`;
  for (const id of [personal, grouped, missingState])
    await sql`delete from studio_project where id=${id}`;
  await sql`delete from "group" where id=${group}`;
  for (const id of [owner, guest, other]) await sql`delete from "user" where id=${id}`;
  await sql.end();
});

it('reads owner, public and collaborator snapshots through Zero and reflects rights revocation', async () => {
  expect(await snapshot(personal)).toMatchObject({
    project: { id: personal, canEdit: true, canManageVisibility: true },
    document,
    assets: [{ id: asset, url: '/api/studio/media/' + asset }],
  });
  expect(await snapshot(missingState)).toBeNull();
  session.actor = other;
  expect(await snapshot(personal)).toBeNull();
  session.actor = null;
  expect(await snapshot(personal)).toBeNull();
  expect(await snapshot(grouped)).toMatchObject({
    project: { canEdit: false, canManageVisibility: false },
  });
  await sql`update studio_project_collaborator set status='active' where project_id=${personal} and user_id=${guest}`;
  try {
    session.actor = guest;
    expect(await snapshot(personal)).toMatchObject({
      project: { canEdit: true, canManageVisibility: false },
    });
  } finally {
    await sql`update studio_project_collaborator set status='invited' where project_id=${personal} and user_id=${guest}`;
  }
  expect(await snapshot(personal)).toBeNull();
});
it('protects invitation and collaborator queries with owner and actor predicates', async () => {
  expect(await query('collaborators', { projectId: personal }, owner)).toMatchObject([
    { user_id: guest, status: 'invited' },
  ]);
  expect(await query('invitations', undefined, guest)).toMatchObject([
    { project_id: personal, project: { owner_id: owner } },
  ]);
  for (const actor of [other, null])
    expect(await query('collaborators', { projectId: personal }, actor)).toEqual([]);
  expect(await query('collaborators', { projectId: grouped }, owner)).toEqual([]);
});

it('matches SQL group access when an assigned role and its rights belong to another group', async () => {
  const foreignGroup = crypto.randomUUID();
  const foreignRole = crypto.randomUUID();
  const membership = crypto.randomUUID();
  await sql`insert into "group" (id,name,owner_id) values (${foreignGroup},'Foreign role boundary',${owner})`;
  try {
    await sql`insert into role (id,name,scope,group_id) values (${foreignRole},'Foreign manager','group',${foreignGroup})`;
    await sql`insert into action_right (resource,action,role_id,group_id) values ('projects','manage',${foreignRole},${foreignGroup})`;
    await sql`insert into group_membership (id,group_id,user_id,status) values (${membership},${group},${guest},'active')`;
    await sql`insert into group_membership_role (group_membership_id,role_id) values (${membership},${foreignRole})`;
    expect(
      (await sql`select studio_group_access(${guest},${group},false) as allowed`)[0].allowed
    ).toBe(false);
    expect(await query('sessionProject', { projectId: grouped }, guest)).toBeUndefined();
    await sql`insert into action_right (resource,action,role_id,group_id) values ('projects','manage',${foreignRole},${group})`;
    await sql`insert into canvas_role_capability (role_id,capability,allowed) values (${foreignRole},'vote',false)`;
    expect(
      (await sql`select studio_group_access(${guest},${group},true) as allowed`)[0].allowed
    ).toBe(true);
    const project = await query('sessionProject', { projectId: grouped }, guest);
    expect(project).toMatchObject({ id: grouped });
    expect(studioCapabilities(project as any, guest, 'edit').manage).toBe(true);
    expect(
      (await sql`select canvas_capability(${guest},${grouped},'vote') as allowed`)[0].allowed
    ).toBe(true);
    expect(studioCapabilities(project as any, guest, 'edit').vote).toBe(true);
    await sql`delete from action_right where role_id=${foreignRole} and group_id=${group}`;
    expect(await query('sessionProject', { projectId: grouped }, guest)).toBeUndefined();
  } finally {
    await sql`delete from group_membership where id=${membership}`;
    await sql`delete from "group" where id=${foreignGroup}`;
  }
});

it('checks canonical project access when a proposal workspace is absent', async () => {
  await expect(
    assertCanvasWorkspace(owner, personal, undefined, true, sql)
  ).resolves.toBeUndefined();
  await expect(assertCanvasWorkspace(other, personal, undefined, false, sql)).rejects.toMatchObject(
    { status: 403 }
  );
});

it('resolves real canonical and proposal sources through the production SQL adapter', async () => {
  await expect(resolveStudioSource(owner, 'invalid')).rejects.toMatchObject({
    status: 400,
    code: 'ai_workspace_invalid',
  });
  await expect(resolveStudioSource(other, personal)).rejects.toMatchObject({
    status: 404,
    code: 'ai_workspace_unavailable',
  });
  const canonical = await resolveStudioSource(owner, personal);
  expect(canonical).toMatchObject({
    projectId: personal,
    workspaceId: null,
    document,
    canonical: document,
    groupId: null,
  });
  const workspace = await resolveStudioSource(owner, grouped, proposal);
  expect(workspace).toMatchObject({
    projectId: grouped,
    workspaceId: proposal,
    document,
    proposal: { owner_id: owner },
  });
  await expect(resolveStudioSource(owner, grouped, crypto.randomUUID())).rejects.toMatchObject({
    status: 404,
    code: 'ai_workspace_unavailable',
  });
});

it.each([
  ['edit', 'owner', false, true],
  ['suggest_internal', 'owner', false, true],
  ['vote_internal', 'owner', true, true],
  ['vote_internal', 'owner', false, false],
  ['view', 'owner', false, false],
  ['edit', 'shared', false, true],
  ['edit', 'reader', false, false],
] as const)(
  'checks %s proposal editing for a %s actor with resolution %s',
  async (phase, role, resolves, allowed) => {
    await sql`update canvas_control set phase=${phase} where project_id=${grouped}`;
    await sql`update canvas_proposal set state='draft',checksum=null,owner_id=${owner},shared_ids=${role === 'shared' ? [other] : []},resolves_id=${resolves ? resolution : null} where id=${proposal}`;
    const actor = role === 'owner' ? owner : other;
    const operation = assertCanvasWorkspace(actor, grouped, proposal, true, sql);
    if (allowed) await expect(operation).resolves.toBeUndefined();
    else await expect(operation).rejects.toMatchObject({ status: 403 });
  }
);

it('allows reading a published proposal while refusing edits after submission or suggest-capability revocation', async () => {
  await sql`update canvas_control set phase='edit' where project_id=${grouped}`;
  await sql`update canvas_proposal set state='submitted',checksum='published',shared_ids='{}' where id=${proposal}`;
  await expect(
    assertCanvasWorkspace(other, grouped, proposal, false, sql)
  ).resolves.toBeUndefined();
  await expect(assertCanvasWorkspace(owner, grouped, proposal, true, sql)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    assertCanvasWorkspace(owner, grouped, crypto.randomUUID(), false, sql)
  ).rejects.toMatchObject({ status: 403 });
  await sql`update canvas_proposal set state='draft',checksum=null,shared_ids=${[other]} where id=${proposal}`;
  await sql`insert into canvas_role_capability (role_id,capability,allowed) values (${readRole},'suggest',false)`;
  try {
    await expect(assertCanvasWorkspace(other, grouped, proposal, true, sql)).rejects.toMatchObject({
      status: 403,
    });
  } finally {
    await sql`delete from canvas_role_capability where role_id=${readRole} and capability='suggest'`;
  }
});
