import postgres from 'postgres';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { dbProvider } from '@/zero/db-provider';
import { studioServerMutators } from '@/zero/communication-studio/server-mutators';
import { studioCommandSchemas } from '@/zero/communication-studio/commands';
import { studioQueries } from '@/zero/communication-studio/queries';

const database = process.env.ZERO_UPSTREAM_DB!;
if (!database || !['localhost', '127.0.0.1'].includes(new URL(database).hostname))
  throw new Error('Explicit local database required');
const sql = postgres(database, { max: 2 });
const owner = crypto.randomUUID(),
  guest = crypto.randomUUID(),
  outsider = crypto.randomUUID();
const project = crypto.randomUUID(),
  clone = crypto.randomUUID();
const createInput = {
  operationId: crypto.randomUUID(),
  id: project,
  title: 'Zero command integration',
  groupId: null,
  kind: 'single',
  themeId: '00000000-0000-4000-8000-000000000001',
  themeMode: 'light',
  template: { kind: 'builtin', id: 'announcement' },
};
const run = (name: keyof typeof studioCommandSchemas, input: unknown, actor = owner) =>
  dbProvider.transaction(tx =>
    (studioServerMutators[name] as any).fn({
      tx,
      ctx: { userID: actor, email: '' },
      args: studioCommandSchemas[name].parse(input),
    })
  );
const receipt = (id: string, actor = owner) =>
  dbProvider.transaction(tx =>
    tx.run(
      studioQueries.commandReceipt.fn({
        ctx: { userID: actor, email: '' },
        args: { operationId: id },
      })
    )
  );
let storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>;
const files: string[] = [];
beforeAll(async () => {
  const local = JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
  );
  process.env.SUPABASE_URL = local.API_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY;
  storage = createClient(local.API_URL, local.SERVICE_ROLE_KEY).storage.from('studio');
  for (const id of [owner, guest, outsider]) await sql`insert into "user"(id) values(${id})`;
});
afterAll(async () => {
  await sql.begin(async tx => {
    await tx`set local session_replication_role = replica`;
    for (const id of [project, clone]) {
      await tx`delete from studio_export where project_id=${id}`;
      await tx`delete from studio_revision where project_id=${id}`;
      await tx`delete from studio_project where id=${id}`;
    }
    await tx`delete from studio_command_receipt where actor_id in (${owner},${guest},${outsider})`;
    for (const id of [owner, guest, outsider]) await tx`delete from "user" where id=${id}`;
  });
  if (files.length) await storage.remove(files);
  await sql.end();
});
it('uses the wrapped Zero transaction for creation, repeat receipts, identity checks and rollback', async () => {
  await run('create', createInput);
  await run('create', createInput);
  expect(await receipt(createInput.operationId)).toMatchObject({
    result: { id: project },
    actor_id: owner,
  });
  expect(await receipt(createInput.operationId, outsider)).toBeUndefined();
  await expect(run('create', { ...createInput, title: 'Changed' })).rejects.toThrow();
  await expect(run('create', createInput, outsider)).rejects.toThrow();
  const aborted = { ...createInput, id: crypto.randomUUID(), operationId: crypto.randomUUID() };
  await expect(
    dbProvider.transaction(async tx => {
      await studioServerMutators.create.fn({
        tx,
        ctx: { userID: owner, email: '' },
        args: studioCommandSchemas.create.parse(aborted),
      });
      throw new Error('Simulated commit failure');
    })
  ).rejects.toThrow('Simulated commit failure');
  expect(await sql`select id from studio_project where id=${aborted.id}`).toEqual([]);
  expect(await sql`select id from studio_command_receipt where id=${aborted.operationId}`).toEqual(
    []
  );
});
it('confirms element synchronization and repeats its empty result through Zero', async () => {
  const input = { operationId: crypto.randomUUID(), projectId: project };
  await run('synchronizeElements', input);
  await run('synchronizeElements', input);
  expect(await receipt(input.operationId)).toMatchObject({ result: null, actor_id: owner });
});
it('confirms invitations, upload reservation and media verification before cloning and exporting', async () => {
  const invite = { operationId: crypto.randomUUID(), projectId: project, userIds: [guest] };
  await run('inviteCollaborators', invite);
  const [invitation] =
    await sql`select id from studio_project_collaborator where project_id=${project} and user_id=${guest}`;
  await run(
    'respondInvitation',
    { operationId: crypto.randomUUID(), invitationId: invitation.id, accept: true },
    guest
  );
  await expect(
    run(
      'setVisibility',
      { operationId: crypto.randomUUID(), id: project, visibility: 'public' },
      guest
    )
  ).rejects.toThrow();
  const asset = crypto.randomUUID(),
    operationId = crypto.randomUUID();
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=',
    'base64'
  );
  await run('beginUpload', {
    operationId,
    id: asset,
    projectId: project,
    name: 'pixel.png',
    mime: 'image/png',
    size: image.length,
  });
  const token = ((await receipt(operationId)) as any).result;
  const [reservation] = await sql`select storage_path from studio_asset where id=${asset}`;
  files.push(reservation.storage_path);
  expect(
    (
      await storage.uploadToSignedUrl(reservation.storage_path, token.token, image, {
        contentType: 'image/png',
      })
    ).error
  ).toBeNull();
  await run('finishUpload', { operationId: crypto.randomUUID(), id: asset });
  const duplicate = {
    operationId: crypto.randomUUID(),
    id: project,
    destinationId: clone,
    groupId: null,
    visibility: 'private',
  };
  await run('duplicate', duplicate);
  await run('duplicate', duplicate);
  const copied = await sql`select id,storage_path from studio_asset where project_id=${clone}`;
  expect(copied).toHaveLength(1);
  files.push(copied[0].storage_path);
  expect((await storage.download(copied[0].storage_path)).error).toBeNull();
  const exportId = crypto.randomUUID();
  await run('requestExport', {
    operationId: crypto.randomUUID(),
    id: exportId,
    projectId: clone,
    format: 'png',
    pageIds: [],
    revision: 0,
  });
  expect(await sql`select status from studio_export where id=${exportId}`).toMatchObject([
    { status: 'queued' },
  ]);
  await run('cancelExport', { operationId: crypto.randomUUID(), id: exportId });
  await run('removeCollaborator', {
    operationId: crypto.randomUUID(),
    projectId: project,
    userId: guest,
  });
  expect(
    await dbProvider.transaction(tx =>
      tx.run(
        studioQueries.sessionProject.fn({
          args: { projectId: project },
          ctx: { userID: guest, email: '' },
        })
      )
    )
  ).toBeUndefined();
});
