import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '@/features/collaboration/logic/codec';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  load: vi.fn(),
  access: vi.fn(),
  receipt: vi.fn(),
  record: vi.fn(),
  create: vi.fn(),
  revision: vi.fn(),
  persist: vi.fn(),
  verified: vi.fn(),
  commit: vi.fn(),
  assets: vi.fn(),
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (actor: string) => actor,
  executeZeroTransaction: (_ctx: unknown, body: (tx: unknown) => unknown) =>
    body({ location: 'server', dbTransaction: { query: io.query } }),
}));
vi.mock('../service', async original => ({
  ...(await original<typeof import('../service')>()),
  authorizeStored: io.access,
}));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  loadStored: io.load,
  createStored: io.create,
  recordRevision: io.revision,
  persistProjection: io.persist,
  verifiedRevision: io.verified,
  commitState: io.commit,
}));
vi.mock('../receipts', () => ({ commandReceipt: io.receipt }));
vi.mock('../studio-assets', () => ({ validateStudioAssetsInTransaction: io.assets }));
import { restoreVersion } from '../commands';
import { repairDocument } from '../repair';
import { publishDraftInTransaction, rebaseDraft, resumeDraft, revisions } from '../recovery';
import { checksum } from '../store';
const tx: any = { location: 'server', dbTransaction: { query: io.query } };
let base: any, draft: any, access: any, historical: any[], old: any[], previous: any;
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
function state(kind: any, value: unknown) {
  const y = seedDocument(kind, value);
  try {
    return Y.encodeStateAsUpdate(y);
  } finally {
    y.destroy();
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  previous = null;
  base = {
    id: 'base',
    kind: 'document',
    entity_id: 'entity',
    branch_id: null,
    workspace_id: null,
    workspace_type: 'canonical',
    generation: 'current',
    revision: 3,
    projection: text('Original'),
    state: state('document', text('Original')),
    checksum: checksum(text('Original')),
    frozen: false,
    base_document_id: null,
  };
  draft = {
    ...base,
    id: 'draft',
    workspace_type: 'followup',
    workspace_id: 'workspace',
    base_document_id: 'base',
    base_revision: 1,
    projection: text('Updated'),
  };
  access = { amendmentId: null, capabilities: { manage: true, suggest: true, edit: true } };
  historical = [{ id: 'old', content: text('Historical') }];
  old = [{ projection: text('Original') }];
  io.load.mockImplementation(async (_tx, id) => (id === 'draft' ? draft : base));
  io.access.mockImplementation(async () => access);
  io.receipt.mockResolvedValue({ previous: null, record: io.record });
  io.record.mockImplementation(async result => result);
  io.create.mockResolvedValue({ workspace_id: 'new-workspace' });
  io.revision.mockResolvedValue('new-revision');
  io.commit.mockResolvedValue({});
  io.assets.mockResolvedValue(undefined);
  io.persist.mockResolvedValue(undefined);
  io.verified.mockResolvedValue({ ...base, revision: 2 });
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select phase')
      ? [{ phase: 'active' }]
      : sql.startsWith('select id,projection as content')
        ? historical
        : sql.startsWith('select id,content from document_version')
          ? []
          : sql.startsWith('select projection from collaboration_revision')
            ? old
            : sql.startsWith('select * from collaboration_command')
              ? previous
                ? [previous]
                : []
              : sql.startsWith('select id,revision,generation')
                ? [{ id: 'history', revision: 3 }]
                : []
  );
});
describe('recovery and restoration authority', () => {
  it('returns only this authorized document history and checks its current generation', async () => {
    expect(await revisions('owner', 'base', 'current')).toEqual([{ id: 'history', revision: 3 }]);
    expect(io.access).toHaveBeenCalledWith(expect.anything(), 'owner', base, 'current');
    io.access.mockRejectedValueOnce(new Error('access_denied'));
    await expect(revisions('reader', 'base', 'old')).rejects.toThrow('access_denied');
  });
  it('resumes offline work only into a new private workspace under current rights', async () => {
    expect(await resumeDraft('owner', 'base', 'current', 3, 'operation', text('Offline'))).toEqual({
      workspaceId: 'new-workspace',
    });
    expect(io.create).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'document', entityId: 'entity', branchId: null, workspaceId: 'operation' },
      text('Offline'),
      'owner',
      { type: 'followup', base }
    );
    expect(io.commit).not.toHaveBeenCalled();
    io.receipt.mockResolvedValue({ previous: { workspaceId: 'old-result' }, record: io.record });
    io.create.mockClear();
    expect(await resumeDraft('owner', 'base', 'old', 1, 'operation', text('Offline'))).toEqual({
      workspaceId: 'old-result',
    });
    expect(io.create).not.toHaveBeenCalled();
  });
  it('rejects stale or unauthorized resume and validates Studio media before recovering it', async () => {
    access.capabilities.suggest = false;
    await expect(resumeDraft('reader', 'base', 'current', 3, 'op', [])).rejects.toThrow(
      'suggestion_denied'
    );
    access.capabilities.suggest = true;
    base.workspace_type = 'proposal';
    await expect(resumeDraft('owner', 'base', 'current', 3, 'op', [])).rejects.toThrow(
      'suggestion_denied'
    );
    base.workspace_type = 'canonical';
    await expect(resumeDraft('owner', 'base', 'old', 3, 'op', [])).rejects.toThrow(
      'revision_changed'
    );
    await expect(resumeDraft('owner', 'base', 'current', 2, 'op', [])).rejects.toThrow(
      'revision_changed'
    );
    base.kind = 'studio';
    io.assets.mockRejectedValueOnce(new Error('asset_access_denied'));
    await expect(resumeDraft('owner', 'base', 'current', 3, 'op', {})).rejects.toThrow(
      'asset_access_denied'
    );
    expect(io.create).not.toHaveBeenCalled();
    await resumeDraft('owner', 'base', 'current', 3, 'op', {});
    expect(io.assets).toHaveBeenCalledWith(expect.anything(), 'entity', {});
  });
  it('rebases an authorized draft onto a known base revision using a new generation', async () => {
    const result = await rebaseDraft('owner', 'draft', 'current', 3, 'operation');
    expect(result).toEqual({ id: 'new-revision', revision: 4 });
    const next = io.revision.mock.calls[0][1];
    expect(next.generation).not.toBe('current');
    expect(next.projection).toEqual(text('Updated'));
    expect(next.checksum).toBe(checksum(next.projection));
    expect(io.commit).not.toHaveBeenCalled();
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('base_revision=$6'),
      expect.arrayContaining([base.revision, 'draft'])
    );
    io.receipt.mockResolvedValue({ previous: result });
    io.revision.mockClear();
    expect(await rebaseDraft('owner', 'draft', 'old', 1, 'operation')).toEqual(result);
    expect(io.revision).not.toHaveBeenCalled();
  });
  it('blocks rebases with stale generations, missing ancestry, lost permission or competing changes', async () => {
    await expect(rebaseDraft('owner', 'base', 'current', 3, 'operation')).rejects.toThrow(
      'workspace_required'
    );
    await expect(rebaseDraft('owner', 'draft', 'old', 3, 'operation')).rejects.toThrow(
      'revision_changed'
    );
    await expect(rebaseDraft('owner', 'draft', 'current', 2, 'operation')).rejects.toThrow(
      'revision_changed'
    );
    old = [];
    await expect(rebaseDraft('owner', 'draft', 'current', 3, 'operation')).rejects.toThrow(
      'base_revision_missing'
    );
    old = [{ projection: text('Original') }];
    base.projection = text('Competing change');
    await expect(rebaseDraft('owner', 'draft', 'current', 3, 'operation')).rejects.toThrow();
    expect(io.revision).not.toHaveBeenCalled();
    io.access.mockRejectedValueOnce(new Error('write_denied'));
    await expect(rebaseDraft('reader', 'draft', 'current', 3, 'operation')).rejects.toThrow(
      'write_denied'
    );
  });
  it('restores every document type exclusively from a server-held snapshot and logs the new generation', async () => {
    for (const [kind, value] of [
      ['document', text('History')],
      ['blog', text('Blog history')],
      ['city', createEmptyCityDesignState()],
      ['studio', createDocument('single', 'Studio history')],
    ] as const) {
      base.kind = kind;
      historical = [{ id: 'archive', content: value }];
      io.revision.mockClear();
      expect(
        await restoreVersion('owner', 'base', 'current', 3, `operation-${kind}`, value)
      ).toEqual({ id: 'new-revision', revision: 4 });
      const next = io.revision.mock.calls[0][1];
      expect(next.generation).not.toBe('current');
      expect(next.projection).toEqual(value);
      expect(next.revision).toBe(4);
      expect(io.revision).toHaveBeenCalledWith(
        expect.anything(),
        next,
        'owner',
        `restore:operation-${kind}`,
        'restore:archive'
      );
    }
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining("conflict_reason='target_generation_restored'"),
      ['base']
    );
  });
  it('does not accept arbitrary restoration JSON, old revisions or a draft without management authority', async () => {
    await expect(
      restoreVersion('owner', 'base', 'current', 3, 'op', text('Invented'))
    ).rejects.toThrow('version_not_found');
    await expect(
      restoreVersion('owner', 'base', 'old', 3, 'op', text('Historical'))
    ).rejects.toThrow('revision_changed');
    await expect(
      restoreVersion('owner', 'base', 'current', 2, 'op', text('Historical'))
    ).rejects.toThrow('revision_changed');
    access.capabilities.manage = false;
    await expect(
      restoreVersion('editor', 'base', 'current', 3, 'op', text('Historical'))
    ).rejects.toThrow('restore_denied');
    access.capabilities.manage = true;
    await expect(
      restoreVersion('owner', 'draft', 'current', 3, 'op', text('Historical'))
    ).rejects.toThrow('restore_denied');
    expect(io.revision).not.toHaveBeenCalled();
    io.receipt.mockResolvedValue({ previous: { id: 'saved', revision: 4 } });
    expect(await restoreVersion('owner', 'base', 'old', 2, 'op', text('Historical'))).toEqual({
      id: 'saved',
      revision: 4,
    });
  });
  it('repairs only an integrity-blocked canonical document from a verified immutable revision', async () => {
    await expect(repairDocument('owner', 'base', 'current', 3, 'op')).rejects.toThrow(
      'repair_not_required'
    );
    base.integrity_error = 'invalid';
    const result = await repairDocument('owner', 'base', 'current', 3, 'op');
    expect(result).toEqual({ id: 'new-revision', revision: 4 });
    const next = io.revision.mock.calls[0][1];
    expect(next.integrity_error).toBeNull();
    expect(next.generation).not.toBe('current');
    expect(io.revision).toHaveBeenCalledWith(
      expect.anything(),
      next,
      'owner',
      'repair:op',
      'integrity_repair:verified_revision:2'
    );
    io.receipt.mockResolvedValue({ previous: result });
    io.verified.mockClear();
    expect(await repairDocument('owner', 'base', 'old', 1, 'op')).toEqual(result);
    expect(io.verified).not.toHaveBeenCalled();
  });
  it('refuses repair after authority, revision or workspace identity changes', async () => {
    access.capabilities.manage = false;
    await expect(repairDocument('reader', 'base', 'current', 3, 'op')).rejects.toThrow(
      'repair_denied'
    );
    access.capabilities.manage = true;
    await expect(repairDocument('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'repair_denied'
    );
    await expect(repairDocument('owner', 'base', 'old', 3, 'op')).rejects.toThrow(
      'revision_changed'
    );
    await expect(repairDocument('owner', 'base', 'current', 1, 'op')).rejects.toThrow(
      'revision_changed'
    );
    expect(io.revision).not.toHaveBeenCalled();
  });
  it('publishes only permitted non-amendment drafts and binds retries to actor and payload', async () => {
    expect(await publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).toEqual({
      ids: [],
    });
    const update = io.commit.mock.calls[0][2],
      y = new Y.Doc();
    Y.applyUpdate(y, update);
    expect(projectDocument('document', y)).toEqual(text('Updated'));
    y.destroy();
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining('set frozen=true,generation='), [
      'draft',
    ]);
    const args = io.query.mock.calls.find(([q]) =>
      q.startsWith('insert into collaboration_command')
    )![1];
    previous = { actor_id: args[2], request_hash: args[3], result: args[4] };
    io.commit.mockClear();
    expect(await publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).toEqual({
      ids: [],
    });
    expect(io.commit).not.toHaveBeenCalled();
    await expect(publishDraftInTransaction(tx, 'other', draft, 'current', 3, 'op')).rejects.toThrow(
      'operation_id_reused'
    );
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'old', 3, 'op')).rejects.toThrow(
      'operation_id_reused'
    );
  });
  it('requires decisions for amendments and blocks stale, unresolved or untraceable draft publication', async () => {
    await expect(publishDraftInTransaction(tx, 'owner', base, 'current', 3, 'op')).rejects.toThrow(
      'workspace_required'
    );
    access.amendmentId = 'amendment';
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).rejects.toThrow(
      'decision_required'
    );
    access.amendmentId = null;
    draft.frozen = true;
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).rejects.toThrow(
      'revision_changed'
    );
    draft.frozen = false;
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'old', 3, 'op')).rejects.toThrow(
      'revision_changed'
    );
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 2, 'op')).rejects.toThrow(
      'revision_changed'
    );
    old = [];
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).rejects.toThrow(
      'base_revision_missing'
    );
    old = [{ projection: text('Original') }];
    draft.projection = [
      {
        id: 'p',
        type: 'p',
        children: [
          {
            text: 'Proposed',
            suggestion: true,
            suggestion_s1: { id: 's1', type: 'insert', userId: 'owner' },
          },
        ],
      },
    ];
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).rejects.toThrow(
      'unresolved_draft_suggestions'
    );
    expect(io.commit).not.toHaveBeenCalled();
  });
  it('publishes Studio media only after validating the merged assets and preserves editable state', async () => {
    base.kind = draft.kind = 'studio';
    base.projection = createDocument('single', 'Studio');
    base.state = state('studio', base.projection);
    old = [{ projection: base.projection }];
    draft.projection = { ...base.projection, title: 'Published Studio' };
    io.assets.mockRejectedValueOnce(new Error('asset_access_denied'));
    await expect(publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op')).rejects.toThrow(
      'asset_access_denied'
    );
    expect(io.commit).not.toHaveBeenCalled();
    await publishDraftInTransaction(tx, 'owner', draft, 'current', 3, 'op');
    const y = new Y.Doc();
    Y.applyUpdate(y, io.commit.mock.calls[0][2]);
    expect(projectDocument('studio', y)).toEqual(draft.projection);
    y.destroy();
  });
});
