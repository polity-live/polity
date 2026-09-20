import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  run: vi.fn(),
  load: vi.fn(),
  access: vi.fn(),
  receipt: vi.fn(),
  record: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  city: vi.fn(),
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (id: string) => id,
  executeZeroTransaction: (ctx: unknown, body: (tx: unknown, ctx: unknown) => unknown) =>
    body({ location: 'server', run: io.run, dbTransaction: { query: io.query } }, ctx),
}));
vi.mock('../service', () => ({ authorizeStored: io.access }));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  loadStored: io.load,
}));
vi.mock('../receipts', () => ({ commandReceipt: io.receipt }));
vi.mock('../recovery', () => ({ publishDraftInTransaction: io.publish }));
vi.mock('@/zero/amendments/server-mutators', () => ({
  amendmentServerMutators: {
    createChangeRequest: { fn: io.create },
    updateChangeRequest: { fn: io.update },
  },
}));
vi.mock('@/features/amendments/city-design/logic/cityDesignChangeRequestDiff', () => ({
  createCityDesignChangeRequestPayloads: io.city,
}));
import { registerSuggestion, resolveDirectly, submitWorkspace } from '../proposals';
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
let draft: any, base: any, access: any, archived: any[], previous: any, proof: any[], request: any;
beforeEach(() => {
  vi.clearAllMocks();
  previous = null;
  base = {
    id: 'main',
    kind: 'document',
    branch_id: null,
    entity_id: 'entity',
    workspace_type: 'canonical',
    generation: 'current',
    revision: 3,
    projection: text('Base'),
  };
  draft = {
    ...base,
    id: 'draft',
    workspace_type: 'proposal',
    base_document_id: 'main',
    base_revision: 3,
    projection: [
      {
        ...text('Base')[0],
        children: [
          { text: 'Base' },
          {
            text: ' added',
            suggestion: true,
            suggestion_a: { id: 'a', type: 'insert', userId: 'owner' },
          },
        ],
      },
    ],
  };
  access = {
    amendmentId: 'amendment',
    mode: 'suggest_internal',
    capabilities: { suggest: true, edit: true, manage: true },
  };
  archived = [{ id: 'immutable' }];
  proof = [{ decision_result: 'passed', application_status: 'applied', conflict_reason: null }];
  request = { id: 'request', amendment_id: 'amendment', process_branch_id: null };
  io.load.mockImplementation(async (_sql, id) => (id === 'draft' ? draft : base));
  io.access.mockImplementation(async () => access);
  io.receipt.mockResolvedValue({ previous: null, record: io.record });
  io.record.mockImplementation(async value => value);
  io.publish.mockResolvedValue({ ids: [] });
  io.create.mockResolvedValue(undefined);
  io.update.mockResolvedValue(undefined);
  io.run.mockImplementation(async () => request);
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select phase')
      ? [{ phase: 'active' }]
      : sql.startsWith('select id from collaboration_revision')
        ? archived
        : sql.startsWith('select * from collaboration_command')
          ? previous
            ? [previous]
            : []
          : sql.startsWith('select application_status')
            ? proof
            : []
  );
});
describe('immutable proposal submission and direct decisions', () => {
  it('refuses a marked draft whose suggestion type has no renderable immutable change', async () => {
    draft.projection = [
      {
        ...text('Base')[0],
        children: [
          {
            text: 'Base',
            suggestion: true,
            suggestion_unknown: { id: 'unknown', type: 'unsupported' },
          },
        ],
      },
    ];
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'operation')).rejects.toThrow(
      'invalid_proposal'
    );
    expect(io.create).not.toHaveBeenCalled();
  });
  it('never treats editing or suggesting as permission to decide a proposal', async () => {
    access.capabilities.manage = false;
    await expect(
      resolveDirectly('proposer', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('decision_denied');
    expect(io.update).not.toHaveBeenCalled();
  });
  it('captures marked changes as immutable requests without changing the canonical text', async () => {
    draft.projection[0].children.push({
      text: ' second',
      suggestion: true,
      suggestion_b: { id: 'b', type: 'insert', userId: 'owner' },
    });
    const before = JSON.stringify(base);
    const result = await submitWorkspace('owner', 'draft', 'current', 3, 'operation');
    expect(result.ids).toHaveLength(2);
    expect(result.ids[0]).toBe('operation');
    expect(new Set(result.ids).size).toBe(2);
    expect(JSON.stringify(base)).toBe(before);
    expect(io.create).toHaveBeenCalledTimes(2);
    expect(io.create.mock.calls[0][0].args).toMatchObject({
      amendment_id: 'amendment',
      discussion_id: 'a',
      new_text: ' added',
    });
    const proofs = io.query.mock.calls.filter(([sql]) =>
      sql.startsWith('insert into collaboration_proposal')
    );
    expect(proofs).toHaveLength(2);
    expect(proofs[0][1].slice(0, 4)).toEqual(['operation', 'main', 'immutable', 'immutable']);
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining('set frozen=true,generation='), [
      'draft',
    ]);
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_outbox'),
      expect.arrayContaining(['draft'])
    );
  });
  it('returns an existing submission receipt without creating or freezing another request', async () => {
    io.receipt.mockResolvedValue({ previous: { ids: ['saved'] } });
    expect(await submitWorkspace('owner', 'draft', 'old', 1, 'operation')).toEqual({
      ids: ['saved'],
    });
    expect(io.create).not.toHaveBeenCalled();
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
  });
  it('enforces current workspace rights, revision, phase and ancestry before submission', async () => {
    await expect(submitWorkspace('owner', 'main', 'current', 3, 'op')).rejects.toThrow(
      'proposal_requires_amendment'
    );
    access.capabilities.suggest = false;
    await expect(submitWorkspace('reader', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'suggestion_denied'
    );
    access.capabilities.suggest = true;
    await expect(submitWorkspace('owner', 'draft', 'old', 3, 'op')).rejects.toThrow(
      'generation_changed'
    );
    access.capabilities.edit = false;
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'write_denied'
    );
    access.capabilities.edit = true;
    draft.frozen = true;
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'write_denied'
    );
    draft.frozen = false;
    access.mode = 'vote_event';
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'submission_phase_closed'
    );
    access.mode = 'edit';
    await expect(submitWorkspace('owner', 'draft', 'current', 2, 'op')).rejects.toThrow(
      'revision_changed'
    );
    base.revision = 4;
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'proposal_base_changed'
    );
    expect(io.create).not.toHaveBeenCalled();
  });
  it('rejects missing archived proof and unmarked rewrites with explicit errors', async () => {
    archived = [];
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'submitted_revision_missing'
    );
    archived = [{ id: 'proof' }];
    draft.projection[0].children[0].text = 'Unmarked rewrite';
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'unmarked_proposal_changes'
    );
    expect(io.create).not.toHaveBeenCalled();
  });
  it('uses draft publication for personal content and rejects stale main-document registration', async () => {
    access.amendmentId = null;
    expect(await submitWorkspace('owner', 'draft', 'current', 3, 'op')).toEqual({ ids: [] });
    expect(io.publish).toHaveBeenCalledWith(expect.anything(), 'owner', draft, 'current', 3, 'op');
    await expect(
      registerSuggestion('owner', 'main', 'current', 3, 'request', 'suggestion')
    ).rejects.toThrow('proposal_requires_workspace');
  });
  it('freezes structured city proposals with their exact object properties', async () => {
    base.kind = draft.kind = 'city';
    base.projection = createEmptyCityDesignState();
    draft.projection = { ...base.projection };
    io.city.mockReturnValue([
      {
        id: 'city-request',
        amendment_id: 'amendment',
        process_branch_id: null,
        title: null,
        description: '',
        status: 'open',
        reason: null,
        source_type: 'city_design_object',
        source_id: 'object',
        source_title: 'Tree',
        original_properties: { x: 1 },
        new_properties: { x: 2 },
        voting_status: 'open',
        voting_deadline: null,
        voting_majority_type: null,
        quorum_required: null,
      },
    ]);
    expect(await submitWorkspace('owner', 'draft', 'current', 3, 'op')).toEqual({
      ids: ['city-request'],
    });
    expect(
      io.query.mock.calls.find(([sql]) =>
        sql.startsWith('insert into collaboration_proposal')
      )![1][4]
    ).toEqual({
      source_type: 'city_design_object',
      source_id: 'object',
      original_properties: { x: 1 },
      new_properties: { x: 2 },
    });
    io.city.mockReturnValue([]);
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'proposal_has_no_changes'
    );
    draft.kind = 'studio';
    await expect(submitWorkspace('owner', 'draft', 'current', 3, 'op')).rejects.toThrow(
      'unsupported_proposal'
    );
  });
  it('returns decision and application status separately and binds retries to the actor and decision', async () => {
    proof = [
      {
        decision_result: 'passed',
        application_status: 'conflict',
        conflict_reason: 'proposal_content_conflict',
      },
    ];
    const result = await resolveDirectly(
      'owner',
      'main',
      'current',
      3,
      'request',
      'accepted',
      'op'
    );
    expect(result).toEqual({
      id: 'request',
      decisionResult: 'passed',
      applicationStatus: 'conflict',
      conflictReason: 'proposal_content_conflict',
    });
    const values = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into collaboration_command')
    )![1];
    previous = { actor_id: values[2], request_hash: values[3], result: values[4] };
    io.update.mockClear();
    expect(
      await resolveDirectly('owner', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).toEqual(result);
    expect(io.update).not.toHaveBeenCalled();
    await expect(
      resolveDirectly('other', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('operation_id_reused');
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'rejected', 'op')
    ).rejects.toThrow('operation_id_reused');
  });
  it('rejects decisions for another branch, missing proof, stale generation or a voting phase', async () => {
    await expect(
      resolveDirectly('owner', 'draft', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('invalid_proposal');
    request = null;
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('invalid_proposal');
    request = { amendment_id: 'other' };
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('invalid_proposal');
    request = { amendment_id: 'amendment', process_branch_id: 'other' };
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('invalid_proposal');
    request.process_branch_id = null;
    await expect(
      resolveDirectly('owner', 'main', 'old', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('generation_changed');
    access.mode = 'vote_internal';
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'accepted', 'op')
    ).rejects.toThrow('decision_requires_vote');
    access.mode = 'edit';
    await expect(
      resolveDirectly('owner', 'main', 'current', 2, 'request', 'accepted', 'op')
    ).rejects.toThrow('revision_changed');
    proof = [];
    await expect(
      resolveDirectly('owner', 'main', 'current', 3, 'request', 'rejected', 'op')
    ).rejects.toThrow('submitted_revision_missing');
  });
});
