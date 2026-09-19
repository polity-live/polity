import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument } from '@/features/collaboration/logic/codec';
import { reconcileProjection } from '@/features/collaboration/logic/reconcile';
import { createDocument } from '@/features/communication-studio/logic/templates';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  resolve: vi.fn(),
  load: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  commit: vi.fn(),
  receipt: vi.fn(),
  record: vi.fn(),
  assets: vi.fn(),
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (actor: string) => actor,
  executeZeroTransaction: (_ctx: unknown, body: (tx: unknown) => unknown) =>
    body({ location: 'server', dbTransaction: { query: io.query } }),
}));
vi.mock('../access', () => ({ resolveAccess: io.resolve }));
vi.mock('../store', () => ({
  loadStored: io.load,
  findStored: io.find,
  createStored: io.create,
  commitState: io.commit,
}));
vi.mock('../receipts', () => ({ commandReceipt: io.receipt }));
vi.mock('../studio-assets', () => ({ validateStudioAssetsInTransaction: io.assets }));
import {
  acceptSync,
  acceptUpdate,
  authorizeStored,
  authorizedDelivery,
  committedState,
  createWorkspace,
  listWorkspaces,
  openSession,
  readSession,
  shareWorkspace,
} from '../service';
let doc: any,
  rights: any,
  phase: string,
  ballot: boolean,
  compatibility: boolean,
  workspaces: any[];
const ref = { kind: 'document' as const, entityId: 'entity', branchId: null, workspaceId: null };
const tx: any = { location: 'server', dbTransaction: { query: io.query } };
it('opens an existing canonical revision without recreating its state', async () => {
  const opened = await openSession('owner', ref);
  expect(opened.session).toMatchObject({ id: doc.id, revision: 3, checksum: 'hash' });
  expect(io.create).not.toHaveBeenCalled();
});
it('initializes a missing canonical document from the authorized entity content', async () => {
  io.find.mockResolvedValue(null);
  const opened = await openSession('owner', ref);
  expect(opened.phase).toBe('active');
  expect(io.create).toHaveBeenCalledWith(expect.anything(), ref, doc.projection, 'owner');
  expect(opened.session?.reference.workspaceId).toBeNull();
});
it('does not create a new document in place of a missing proposal workspace', async () => {
  io.find.mockResolvedValue(null);
  await expect(openSession('owner', { ...ref, workspaceId: 'missing' })).rejects.toMatchObject({
    code: 'document_not_found',
    status: 404,
  });
  expect(io.create).not.toHaveBeenCalled();
});
function snapshot(kind: 'document' | 'studio', value: unknown) {
  const y = seedDocument(kind, value);
  try {
    return Y.encodeStateAsUpdate(y);
  } finally {
    y.destroy();
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  phase = 'active';
  ballot = false;
  compatibility = false;
  workspaces = [];
  const projection = [{ id: 'p', type: 'p', children: [{ text: 'Committed' }] }];
  doc = {
    id: 'document',
    kind: 'document',
    entity_id: 'entity',
    branch_id: null,
    workspace_id: null,
    workspace_type: 'canonical',
    owner_id: 'owner',
    generation: 'current',
    revision: 3,
    checksum: 'hash',
    projection,
    state: snapshot('document', projection),
    frozen: false,
    deleted: false,
    shared: false,
  };
  rights = {
    reference: ref,
    content: projection,
    amendmentId: null,
    capabilities: {
      read: true,
      edit: true,
      suggest: true,
      comment: true,
      vote: false,
      manage: true,
    },
  };
  io.resolve.mockImplementation(async () => structuredClone(rights));
  io.load.mockImplementation(async () => doc);
  io.find.mockImplementation(async () => doc);
  io.create.mockImplementation(async () => doc);
  io.receipt.mockResolvedValue({ previous: null, record: io.record });
  io.commit.mockResolvedValue({ duplicate: false });
  io.assets.mockResolvedValue(undefined);
  io.query.mockImplementation(async (sql: string) =>
    sql.includes('select phase')
      ? [{ phase }]
      : sql.includes('select compatibility')
        ? [{ compatibility }]
        : sql.includes('select 1 from collaboration_ballot')
          ? ballot
            ? [{}]
            : []
          : sql.includes('workspace_type<>')
            ? workspaces
            : []
  );
});
describe('shared collaboration service boundary', () => {
  it('keeps maintenance read-only and creates canonical sessions only after active authorization', async () => {
    phase = 'maintenance';
    expect(await openSession('owner', ref)).toEqual({ phase: 'maintenance' });
    expect(io.create).not.toHaveBeenCalled();
    expect(io.resolve).not.toHaveBeenCalled();
    phase = 'active';
    io.find.mockResolvedValue(undefined);
    expect(await openSession('owner', ref)).toMatchObject({
      phase: 'active',
      session: { revision: 3, transport: 'websocket', draftAction: 'publish' },
    });
    expect(io.create).toHaveBeenCalledWith(expect.anything(), ref, doc.projection, 'owner');
    await expect(openSession('owner', { ...ref, workspaceId: 'missing' })).rejects.toThrow(
      'document_not_found'
    );
  });
  it('exposes compatibility transport and the last verified state without granting write access', async () => {
    compatibility = true;
    rights.amendmentId = 'amendment';
    doc.integrity_error = 'bad-checksum';
    doc.readableRevision = 2;
    const s = await readSession('owner', doc.id, 'current');
    expect(s).toMatchObject({
      transport: 'http',
      draftAction: 'proposal',
      integrityError: 'bad-checksum',
      readableRevision: 2,
      capabilities: { read: true, edit: false, suggest: false, comment: false },
    });
    expect((await committedState('owner', doc.id, 'current')).bytes).toEqual(
      Buffer.from(doc.state)
    );
  });
  it('separates public readers, private drafts, shared suggesters and frozen ballot content', async () => {
    ballot = true;
    expect((await authorizeStored(tx, 'owner', doc)).capabilities.edit).toBe(false);
    await expect(authorizeStored(tx, 'owner', doc, 'current', true)).rejects.toThrow(
      'write_denied'
    );
    ballot = false;
    doc.workspace_type = 'proposal';
    doc.workspace_id = 'draft';
    await expect(authorizeStored(tx, 'other', doc)).rejects.toThrow('access_denied');
    doc.shared = true;
    rights.capabilities.suggest = false;
    await expect(authorizeStored(tx, 'other', doc)).rejects.toThrow('access_denied');
    rights.capabilities.suggest = true;
    expect((await authorizeStored(tx, 'other', doc)).capabilities.edit).toBe(true);
    doc.frozen = true;
    await expect(authorizeStored(tx, 'owner', doc, 'current', true)).rejects.toThrow(
      'write_denied'
    );
    await expect(authorizeStored(tx, 'owner', doc, 'old')).rejects.toThrow('generation_changed');
    doc.deleted = true;
    await expect(authorizeStored(tx, 'owner', doc)).rejects.toThrow('document_not_found');
  });
  it('permits an unchanged reader handshake but rejects its actual content mutation', async () => {
    rights.capabilities.edit = false;
    await acceptSync('reader', doc.id, 'current', doc.state);
    expect(io.commit).toHaveBeenCalledOnce();
    io.commit.mockClear();
    const changed = reconcileProjection('document', doc.state, [
      { id: 'p', type: 'p', children: [{ text: 'Tampered' }] },
    ]);
    await expect(acceptSync('reader', doc.id, 'current', changed)).rejects.toThrow('write_denied');
    await expect(acceptUpdate('reader', doc.id, 'current', doc.state)).rejects.toThrow(
      'write_denied'
    );
    expect(io.commit).not.toHaveBeenCalled();
  });
  it('keeps suggestion markers out of canonical content and validates project media before committing', async () => {
    const proposed = reconcileProjection('document', doc.state, [
      {
        id: 'p',
        type: 'p',
        children: [
          {
            text: 'Proposed',
            suggestion: true,
            suggestion_change: { id: 'change', type: 'insert', userId: 'owner' },
          },
        ],
      },
    ]);
    await expect(acceptUpdate('owner', doc.id, 'current', proposed)).rejects.toThrow(
      'proposal_requires_workspace'
    );
    expect(io.commit).not.toHaveBeenCalled();
    doc.kind = 'studio';
    doc.projection = createDocument('single', 'Studio');
    doc.state = snapshot('studio', doc.projection);
    io.assets.mockRejectedValueOnce(new Error('asset_access_denied'));
    await expect(acceptUpdate('owner', doc.id, 'current', doc.state)).rejects.toThrow(
      'asset_access_denied'
    );
    expect(io.commit).not.toHaveBeenCalled();
    await acceptUpdate('owner', doc.id, 'current', doc.state);
    expect(io.assets).toHaveBeenCalledWith(expect.anything(), 'entity', doc.projection);
    expect(io.commit).toHaveBeenCalledOnce();
  });
  it('creates a private workspace at the expected revision and returns a receipt on retry', async () => {
    const base = doc;
    const draft = {
      ...doc,
      id: 'draft-document',
      workspace_id: 'operation',
      workspace_type: 'followup',
    };
    io.create.mockResolvedValue(draft);
    expect(
      await createWorkspace('owner', 'document', 'current', 3, 'operation', 'followup')
    ).toMatchObject({
      id: 'draft-document',
      reference: { workspaceId: 'operation' },
      capabilities: { edit: true },
    });
    expect(io.record).toHaveBeenCalledWith({ id: 'draft-document' });
    expect(io.create).toHaveBeenCalledWith(
      expect.anything(),
      { ...ref, workspaceId: 'operation' },
      doc.projection,
      'owner',
      { type: 'followup', base }
    );
    io.create.mockClear();
    io.receipt.mockResolvedValue({ previous: { id: 'draft-document' }, record: io.record });
    io.load.mockResolvedValueOnce(base).mockResolvedValueOnce(draft);
    expect(
      await createWorkspace('owner', 'document', 'current', 3, 'operation', 'followup')
    ).toMatchObject({ id: 'draft-document' });
    expect(io.create).not.toHaveBeenCalled();
  });
  it('rejects forbidden workspace creation and stale expected revisions without storing a draft', async () => {
    await expect(
      createWorkspace('owner', 'document', 'current', 2, 'operation', 'proposal')
    ).rejects.toThrow('revision_changed');
    await expect(
      createWorkspace('owner', 'document', 'old', 3, 'operation', 'proposal')
    ).rejects.toThrow('revision_changed');
    rights.capabilities.suggest = false;
    await expect(
      createWorkspace('owner', 'document', 'current', 3, 'operation', 'proposal')
    ).rejects.toThrow('suggestion_denied');
    rights.capabilities.suggest = true;
    doc.workspace_type = 'proposal';
    await expect(
      createWorkspace('owner', 'document', 'current', 3, 'operation', 'proposal')
    ).rejects.toThrow('suggestion_denied');
    expect(io.create).not.toHaveBeenCalled();
  });
  it('lists only authorized workspace metadata and validates every stored workspace identity', async () => {
    workspaces = [
      { ...doc, workspace_id: 'mine', workspace_type: 'proposal' },
      {
        ...doc,
        workspace_id: 'shared',
        owner_id: 'other',
        shared: true,
        frozen: true,
        workspace_type: 'followup',
      },
    ];
    expect(await listWorkspaces('owner', ref)).toEqual([
      { id: 'mine', owner: true, shared: false, frozen: false, type: 'proposal' },
      { id: 'shared', owner: false, shared: true, frozen: true, type: 'followup' },
    ]);
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('(owner_id=$4 or (shared and $5))'),
      ['document', 'entity', null, 'owner', true]
    );
    workspaces[0].workspace_id = null;
    await expect(listWorkspaces('owner', ref)).rejects.toThrow('invalid_workspace');
  });
  it('restricts sharing to the draft owner and rotates its generation with a durable delivery', async () => {
    await expect(shareWorkspace('owner', 'document', 'current', true)).rejects.toThrow(
      'share_denied'
    );
    doc.workspace_type = 'proposal';
    doc.shared = true;
    await expect(shareWorkspace('other', 'document', 'current', false)).rejects.toThrow(
      'share_denied'
    );
    expect(await shareWorkspace('owner', 'document', 'current', false)).toEqual({ shared: false });
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining('generation=gen_random_uuid()'), [
      false,
      expect.any(Number),
      'document',
    ]);
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_outbox'),
      ['document']
    );
  });
  it('performs outgoing delivery only inside an active authorized transaction', async () => {
    const send = vi.fn();
    await authorizedDelivery('owner', 'document', 'current', send);
    expect(send).toHaveBeenCalledOnce();
    send.mockClear();
    phase = 'maintenance';
    await expect(authorizedDelivery('owner', 'document', 'current', send)).rejects.toThrow(
      'collaboration_unavailable'
    );
    expect(send).not.toHaveBeenCalled();
    phase = 'active';
    await expect(authorizedDelivery('owner', 'document', 'stale', send)).rejects.toThrow(
      'generation_changed'
    );
    expect(send).not.toHaveBeenCalled();
  });
});
