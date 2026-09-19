import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  run: vi.fn(),
  active: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  load: vi.fn(),
}));
vi.mock('../governance', () => ({ activeCollaboration: io.active }));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  findStored: io.find,
  createStored: io.create,
  loadStored: io.load,
}));
import { captureCreatedProposal } from '../capture-proposal';
let cr: any,
  amendment: any,
  branch: any,
  city: any,
  doc: any,
  draft: any,
  context: any[],
  archived: any[];
const tx: any = { location: 'server', run: io.run, dbTransaction: { query: io.query } };
function responses(values: unknown[]) {
  let n = 0;
  io.run.mockImplementation(async () => values[n++]);
}
beforeEach(() => {
  vi.clearAllMocks();
  cr = {
    id: 'request',
    amendment_id: 'amendment',
    user_id: 'owner',
    status: 'open',
    suggestion_id: 's',
    process_branch_id: null,
  };
  amendment = { document_id: 'text' };
  branch = { id: 'branch', document_id: 'branch-text' };
  city = { id: 'city', amendment_id: 'amendment', design_state: { title: 'City' } };
  doc = { id: 'canonical', revision: 3 };
  draft = {
    id: 'draft',
    base_document_id: 'canonical',
    base_revision: 2,
    revision: 4,
    frozen: false,
    projection: [
      {
        id: 'p',
        type: 'p',
        children: [
          { text: 'Base' },
          { text: ' added', suggestion: true, suggestion_s: { id: 's', type: 'insert' } },
        ],
      },
    ],
  };
  context = [{ draft: 'draft' }];
  archived = [{ id: 'proof' }];
  io.active.mockResolvedValue(true);
  io.find.mockImplementation(async () => doc);
  io.create.mockResolvedValue({ id: 'canonical', revision: 3 });
  io.load.mockImplementation(async () => draft);
  responses([cr, amendment, { content: 'Legacy' }]);
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select current_setting')
      ? context
      : sql.startsWith('select id from collaboration_revision')
        ? archived
        : []
  );
});
describe('new proposal capture inside the domain mutation', () => {
  it('archives the exact draft and its base rather than substituting current canonical content', async () => {
    await captureCreatedProposal(tx, 'request');
    const values = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into collaboration_proposal')
    )![1];
    expect(values.slice(0, 4)).toEqual(['request', 'canonical', 'proof', 'proof']);
    expect(values[4]).toMatchObject({ change_type: 'insert', new_text: ' added' });
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('select id from collaboration_revision'),
      ['canonical', 2]
    );
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('select id from collaboration_revision'),
      ['draft', 4]
    );
  });
  it('uses the selected process branch and initializes a missing canonical document once', async () => {
    cr.process_branch_id = 'branch';
    doc = null;
    responses([cr, amendment, branch, { content: 'Branch content' }]);
    await captureCreatedProposal(tx, 'request');
    expect(io.create).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'document', entityId: 'branch-text', branchId: 'branch', workspaceId: null },
      'Branch content',
      'owner'
    );
  });
  it('does not capture already decided, absent or legacy requests', async () => {
    io.active.mockResolvedValue(false);
    await captureCreatedProposal(tx, 'request');
    expect(io.run).not.toHaveBeenCalled();
    io.active.mockResolvedValue(true);
    responses([null]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow('proposal_not_found');
    cr.status = 'accepted';
    responses([cr]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'proposal_requires_separate_decision'
    );
    cr.status = null;
    responses([cr, null]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'proposal_document_missing'
    );
  });
  it('requires an unfrozen workspace belonging to the same canonical document', async () => {
    for (const bad of [
      null,
      { ...draft, frozen: true },
      { ...draft, base_document_id: 'another' },
    ]) {
      responses([cr, amendment, { content: [] }]);
      io.load.mockResolvedValueOnce(bad);
      await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
        'proposal_requires_workspace'
      );
    }
    context = [];
    responses([cr, amendment, { content: [] }]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'proposal_requires_workspace'
    );
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
  it('rejects lost suggestion anchors and missing immutable revision records', async () => {
    cr.suggestion_id = null;
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow('proposal_anchor_missing');
    cr.suggestion_id = 'lost';
    responses([cr, amendment, { content: [] }]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow('proposal_anchor_missing');
    cr.suggestion_id = 's';
    archived = [];
    responses([cr, amendment, { content: [] }]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'submitted_revision_missing'
    );
  });
  it('captures city object properties only from a design owned by the proposal amendment', async () => {
    cr.source_type = 'city_design_object';
    cr.source_id = 'object';
    cr.original_properties = { cityDesignId: 'city', x: 1 };
    cr.new_properties = { cityDesignId: 'city', x: 2 };
    responses([cr, amendment, city]);
    await captureCreatedProposal(tx, 'request');
    expect(
      io.query.mock.calls.find(([sql]) =>
        sql.startsWith('insert into collaboration_proposal')
      )![1][4]
    ).toEqual({
      source_type: cr.source_type,
      source_id: 'object',
      original_properties: cr.original_properties,
      new_properties: cr.new_properties,
    });
    cr.new_properties = null;
    responses([cr, amendment, city]);
    await captureCreatedProposal(tx, 'request');
    city.amendment_id = 'another';
    responses([cr, amendment, city]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'proposal_document_mismatch'
    );
    cr.original_properties = null;
    responses([cr, amendment]);
    await expect(captureCreatedProposal(tx, 'request')).rejects.toThrow(
      'proposal_document_mismatch'
    );
  });
});
