import { beforeEach, expect, it, vi } from 'vitest';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { checksum } from '@/server/checksum';
import { AUTHORITY_LOCK } from '@/server/transaction';
import { defaultBrand, element } from '@/features/communication-studio/logic/document';
import { createStudioNodeFromElement } from '@/features/communication-studio/logic/create-studio-node';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import {
  diffStudio,
  studioOperationSchema,
  type StudioChange,
} from '@/features/communication-studio/logic/operations';
import type { StudioDocumentV3 } from '@/features/communication-studio/logic/document-v3';
import { applyStudioOperation, type StudioReceipt } from '../operations';

const actor = crypto.randomUUID(),
  project = crypto.randomUUID();
let permission: { allowed: boolean; can_edit: boolean } | null;
let control: { phase: string; generation: string } | null;
let stored: { document: StudioDocumentV3; content_revision: number } | null;
let prior: { input_hash: string; actor_id: string; result: StudioReceipt } | null;
let args: ReturnType<typeof studioOperationSchema.parse>;
let assets: string[];
const query = vi.fn(async (sql: string, _values: unknown[]) => {
  if (sql.includes('studio_collaboration_access')) return permission ? [permission] : [];
  if (sql.includes('from studio_operation')) return prior ? [prior] : [];
  if (sql.includes('from canvas_control')) return control ? [control] : [];
  if (sql.includes('from studio_state')) return stored ? [stored] : [];
  if (sql.includes('from studio_asset')) return assets.map(id => ({ id }));
  return [];
});
const tx = { location: 'server', dbTransaction: { query } } as unknown as Transaction<Schema>;
const writes = () => query.mock.calls.filter(([sql]) => /^(update|insert)/.test(sql));
beforeEach(() => {
  query.mockClear();
  permission = { allowed: true, can_edit: true };
  control = { phase: 'edit', generation: crypto.randomUUID() };
  stored = {
    document: createStudioTemplateDocumentV5('single', 'Before', defaultBrand),
    content_revision: 2,
  };
  const changed = { ...stored.document, title: 'After' };
  args = {
    projectId: project,
    operationId: crypto.randomUUID(),
    generation: control.generation,
    expectedRevision: 2,
    changes: diffStudio(stored.document, changed),
  };
  prior = null;
  assets = [];
});

it('applies the actual native three-way merge and persists a revision and actor-bound receipt after authority locking', async () => {
  const before = structuredClone(stored!.document);
  const result = await applyStudioOperation(tx, actor, args);
  expect(query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock($1)', [AUTHORITY_LOCK]]);
  expect(result).toMatchObject({
    operationId: args.operationId,
    status: 'applied',
    revision: 3,
    document: { title: 'After' },
    conflicts: [],
  });
  expect(stored!.document).toEqual(before);
  expect(Object.fromEntries(result.document.nodes.map(node => [node.id, node]))).toEqual(
    Object.fromEntries(before.nodes.map(node => [node.id, node]))
  );
  expect(writes()).toEqual([
    [
      'update studio_state set document=$2::jsonb,content_revision=$3,updated_at=$4 where project_id=$1',
      [project, result.document, 3, expect.any(Number)],
    ],
    [
      'update studio_project set title=$2,kind=$3,updated_at=$4 where id=$1',
      [project, 'After', 'single', expect.any(Number)],
    ],
    [
      'insert into studio_operation(id,project_id,actor_id,input_hash,changes,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',
      [
        args.operationId,
        project,
        actor,
        checksum(studioOperationSchema.parse(args)),
        args.changes,
        result,
        expect.any(Number),
      ],
    ],
  ]);
});

it.each([
  'missing-access',
  'denied-access',
  'view-only',
  'missing-control',
  'voting',
  'generation',
  'missing-state',
  'missing-revision',
  'future-revision',
] as const)('fails closed for %s before any document or receipt write', async failure => {
  const messages = {
    'missing-access': 'Studio access denied',
    'denied-access': 'Studio access denied',
    'view-only': 'Studio access denied',
    'missing-control': 'Canvas phase does not allow direct editing',
    voting: 'Canvas phase does not allow direct editing',
    generation: 'Canvas generation changed',
    'missing-state': 'Studio project not found',
    'missing-revision': 'Invalid starting revision',
    'future-revision': 'Invalid starting revision',
  };
  if (failure === 'missing-access') permission = null;
  if (failure === 'denied-access') permission!.allowed = false;
  if (failure === 'view-only') permission!.can_edit = false;
  if (failure === 'missing-control') control = null;
  if (failure === 'voting') control!.phase = 'voting';
  if (failure === 'generation') args.generation = crypto.randomUUID();
  if (failure === 'missing-state') stored = null;
  if (failure === 'missing-revision') delete args.expectedRevision;
  if (failure === 'future-revision') args.expectedRevision = 3;
  await expect(applyStudioOperation(tx, actor, args)).rejects.toThrow(messages[failure]);
  expect(writes()).toEqual([]);
});

it('returns the durable receipt under current collaborative access even after edit permission is removed', async () => {
  const receipt: StudioReceipt = {
    operationId: args.operationId,
    status: 'applied',
    revision: 3,
    document: { ...stored!.document, title: 'After' },
    conflicts: [],
  };
  prior = {
    input_hash: checksum(studioOperationSchema.parse(args)),
    actor_id: actor,
    result: receipt,
  };
  permission!.can_edit = false;
  expect(await applyStudioOperation(tx, actor, args)).toBe(receipt);
  expect(writes()).toEqual([]);
  expect(query.mock.calls.some(([sql]) => sql.includes('from studio_state'))).toBe(false);
});

it.each(['different-input', 'different-actor'] as const)(
  'rejects operation identity reuse for %s',
  async reason => {
    prior = {
      input_hash:
        reason === 'different-input' ? 'different' : checksum(studioOperationSchema.parse(args)),
      actor_id: reason === 'different-actor' ? crypto.randomUUID() : actor,
      result: {} as StudioReceipt,
    };
    await expect(applyStudioOperation(tx, actor, args)).rejects.toThrow('Operation ID reused');
    expect(writes()).toEqual([]);
  }
);

it.each(['ancestor', 'descendant', 'keep-locked'] as const)(
  'rejects an %s operation affecting a locked node',
  async scope => {
    const node = stored!.document.nodes.find(node => node.type !== 'frame')!;
    node.locked = true;
    const change: StudioChange =
      scope === 'ancestor'
        ? {
            path: ['nodes'],
            before: { exists: true, value: [] },
            after: { exists: true, value: [] },
          }
        : scope === 'descendant'
          ? {
              path: ['nodes', `#${node.id}`, 'transform', 'x'],
              before: { exists: true, value: node.transform.x },
              after: { exists: true, value: node.transform.x + 1 },
            }
          : {
              path: ['nodes', `#${node.id}`, 'locked'],
              before: { exists: true, value: true },
              after: { exists: true, value: true },
            };
    args.changes = [change];
    await expect(applyStudioOperation(tx, actor, args)).rejects.toThrow('Node is locked');
    expect(writes()).toEqual([]);
  }
);

it('allows an explicit unlock and changes outside the locked node without unlocking unrelated nodes', async () => {
  const node = stored!.document.nodes.find(node => node.type !== 'frame')!;
  node.locked = true;
  args.changes = [
    {
      path: ['nodes', `#${node.id}`, 'locked'],
      before: { exists: true, value: true },
      after: { exists: true, value: false },
    },
  ];
  const result = await applyStudioOperation(tx, actor, args);
  expect(result.document.nodes.find(candidate => candidate.id === node.id)!.locked).toBe(false);
  expect(node.locked).toBe(true);
  args = {
    ...args,
    operationId: crypto.randomUUID(),
    changes: diffStudio(stored!.document, { ...stored!.document, title: 'Unrelated' }),
  };
  const unrelated = await applyStudioOperation(tx, actor, args);
  expect(unrelated.document.title).toBe('Unrelated');
  expect(unrelated.document.nodes.find(candidate => candidate.id === node.id)!.locked).toBe(true);
});

it('stores a conflict receipt without increasing the revision or persisting a partial canonical merge', async () => {
  args.changes[0].before.value = 'Different base';
  const result = await applyStudioOperation(tx, actor, args);
  expect(result).toMatchObject({ status: 'conflict', revision: 2, document: stored!.document });
  expect(result.conflicts).toEqual([expect.objectContaining({ path: ['title'] })]);
  expect(writes()).toHaveLength(1);
  expect(writes()[0][0]).toMatch(/^insert into studio_operation/);
});

it.each([false, true])(
  'validates all newly referenced assets before committing (ready=%s)',
  async ready => {
    const frame = stored!.document.nodes.find(node => node.type === 'frame')!;
    const media = createStudioNodeFromElement(
      element('image', { assetId: crypto.randomUUID() }),
      frame.id,
      50
    );
    if (media.type !== 'media') throw Error('Media fixture');
    const updated = structuredClone(stored!.document);
    updated.nodes.push(media);
    args.changes = diffStudio(stored!.document, updated);
    if (ready) assets = [media.assetId];
    if (ready) {
      const result = await applyStudioOperation(tx, actor, args);
      expect(result.status).toBe('applied');
      expect(Object.fromEntries(result.document.nodes.map(node => [node.id, node]))).toEqual(
        Object.fromEntries(updated.nodes.map(node => [node.id, node]))
      );
    } else {
      await expect(applyStudioOperation(tx, actor, args)).rejects.toMatchObject({
        message: 'invalid_asset',
        status: 422,
      });
      expect(writes()).toEqual([]);
    }
    expect(query.mock.calls.find(([sql]) => sql.includes('from studio_asset'))?.[1]).toEqual([
      project,
      [media.assetId],
      null,
    ]);
  }
);

it('rejects malformed operation schemas before reading or locking any database state', async () => {
  await expect(applyStudioOperation(tx, actor, { ...args, changes: [] })).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});
