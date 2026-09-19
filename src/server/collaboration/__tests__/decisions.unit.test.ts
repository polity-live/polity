import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '@/features/collaboration/logic/codec';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  run: vi.fn(),
  load: vi.fn(),
  commit: vi.fn(),
  decision: vi.fn(),
  update: vi.fn(),
  active: vi.fn(),
}));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  loadStored: io.load,
  commitState: io.commit,
}));
vi.mock('../governance', () => ({ recordDecision: io.decision, activeCollaboration: io.active }));
import { checksum } from '../store';
import { resolveSubmittedText } from '../decisions';
import { submissionContext } from '../submission-context';
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
const options = {
  resolutionMethod: 'internal_vote' as const,
  resolvedInMode: 'vote_internal',
  visibilityScope: 'collaborators' as const,
  now: 100,
};
const tx: any = {
  location: 'server',
  run: io.run,
  dbTransaction: { query: io.query },
  mutate: { change_request: { update: io.update } },
};
let cr: any, proof: any, doc: any, context: any[];
beforeEach(() => {
  vi.clearAllMocks();
  cr = { suggestion_id: 's', id: 'proposal' };
  context = [{ draft: 'draft' }];
  const submitted = [
    {
      ...text('Base')[0],
      children: [
        { text: 'Base' },
        { text: ' accepted', suggestion: true, suggestion_s: { id: 's', type: 'insert' } },
      ],
    },
  ];
  const snapshot = createChangeRequestDiffSnapshot('s', submitted);
  proof = {
    document_id: 'main',
    base: text('Base'),
    submitted,
    submitted_content: snapshot,
    checksum: checksum(snapshot),
    decision_result: null,
    application_status: 'pending',
    projection: submitted,
    entity_id: 'entity',
    branch_id: null,
  };
  const y = seedDocument('document', text('Base'));
  doc = {
    id: 'main',
    kind: 'document',
    entity_id: 'entity',
    branch_id: null,
    projection: text('Base'),
    state: Y.encodeStateAsUpdate(y),
  };
  y.destroy();
  io.run.mockImplementation(async () => cr);
  io.load.mockImplementation(async () => doc);
  io.commit.mockResolvedValue({ revisionId: 'result-proof' });
  io.active.mockResolvedValue(true);
  io.update.mockResolvedValue(undefined);
  io.decision.mockResolvedValue(undefined);
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select current_setting') ? context : proof ? [proof] : []
  );
});
describe('immutable text decision application', () => {
  it('applies the decided suggestion and atomically records its revision and procedural status', async () => {
    expect(await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).toMatchObject({
      status: 'accepted',
      applicationStatus: 'applied',
    });
    const y = new Y.Doc();
    Y.applyUpdate(y, io.commit.mock.calls[0][2]);
    expect(projectDocument('document', y)).toEqual(text('Base accepted'));
    y.destroy();
    expect(io.commit).toHaveBeenCalledWith(
      expect.anything(),
      doc,
      expect.any(Uint8Array),
      'owner',
      'decision:proposal',
      'decision'
    );
    expect(io.update).toHaveBeenCalledWith({
      id: 'proposal',
      status: 'accepted',
      voting_status: 'completed',
      resolution_method: 'internal_vote',
      resolved_in_mode: 'vote_internal',
      visibility_scope: 'collaborators',
      updated_at: 100,
    });
    expect(io.decision).toHaveBeenCalledWith(tx, 'proposal', 'passed', 'result-proof', undefined);
  });
  it('keeps canonical content for rejection or tie and never converts either result to acceptance', async () => {
    for (const result of ['rejected', 'tie'] as const) {
      io.commit.mockClear();
      expect(await resolveSubmittedText(tx, 'owner', 'proposal', result, options)).toMatchObject({
        status: 'rejected',
        applicationStatus: 'applied',
      });
      const y = new Y.Doc();
      Y.applyUpdate(y, io.commit.mock.calls[0][2]);
      expect(projectDocument('document', y)).toEqual(text('Base'));
      y.destroy();
      expect(io.decision).toHaveBeenLastCalledWith(
        tx,
        'proposal',
        result,
        'result-proof',
        undefined
      );
    }
  });
  it('retains decisions and votes when application conflicts, then retries only the same recorded decision', async () => {
    doc.projection = text('CONCURRENT');
    const result = await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options);
    expect(result).toMatchObject({
      status: 'accepted',
      applicationStatus: 'conflict',
      conflictReason: 'proposal_content_conflict',
    });
    expect(io.commit).not.toHaveBeenCalled();
    expect(io.decision).toHaveBeenCalledWith(
      tx,
      'proposal',
      'passed',
      null,
      'proposal_content_conflict'
    );
    proof.decision_result = 'passed';
    proof.application_status = 'conflict';
    io.load.mockClear();
    expect(await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).toMatchObject({
      applicationStatus: 'conflict',
    });
    expect(io.load).not.toHaveBeenCalled();
    doc.projection = text('Base');
    expect(
      await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options, true)
    ).toMatchObject({ applicationStatus: 'applied' });
    proof.application_status = 'applied';
    io.commit.mockClear();
    await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options, true);
    expect(io.commit).not.toHaveBeenCalled();
    await expect(
      resolveSubmittedText(tx, 'owner', 'proposal', 'rejected', options, true)
    ).rejects.toThrow('decision_already_recorded');
  });
  it('rejects missing anchors and proof, and marks content tampering explicitly without changing the decision', async () => {
    cr = null;
    await expect(resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).rejects.toThrow(
      'proposal_anchor_missing'
    );
    cr = { suggestion_id: 's' };
    const original = proof;
    proof = null;
    await expect(resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).rejects.toThrow(
      'submitted_revision_missing'
    );
    proof = original;
    proof.submitted_content = { rewritten: true };
    expect(await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).toMatchObject({
      applicationStatus: 'conflict',
      conflictReason: 'submitted_content_changed',
    });
    proof.submitted_content = createChangeRequestDiffSnapshot('s', proof.submitted);
    proof.checksum = 'different';
    expect(await resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)).toMatchObject({
      applicationStatus: 'conflict',
      conflictReason: 'submitted_content_changed',
    });
    expect(io.commit).not.toHaveBeenCalled();
  });
  it('propagates storage and integrity failures so the enclosing transaction rolls back', async () => {
    for (const error of [new Error('connection_lost'), new CollaborationError('integrity_error')]) {
      io.commit.mockRejectedValueOnce(error);
      await expect(
        resolveSubmittedText(tx, 'owner', 'proposal', 'passed', options)
      ).rejects.toThrow(error.message);
    }
    expect(io.update).not.toHaveBeenCalled();
    expect(io.decision).not.toHaveBeenCalled();
  });
});
describe('submission context isolation', () => {
  it('reads immutable submissions and rejects a different document, branch or altered snapshot', async () => {
    expect(await submissionContext(tx, 'entity', null, 'proposal', 's')).toEqual({
      content: proof.projection,
      discussions: [{ id: 's', changeRequestEntityId: 'proposal' }],
      mode: null,
    });
    await expect(submissionContext(tx, 'other', null, 'proposal')).rejects.toThrow(
      'submitted_content_changed'
    );
    await expect(submissionContext(tx, 'entity', 'branch', 'proposal')).rejects.toThrow(
      'submitted_content_changed'
    );
    proof.checksum = 'wrong';
    await expect(submissionContext(tx, 'entity', null, 'proposal')).rejects.toThrow(
      'submitted_content_changed'
    );
  });
  it('uses only an explicit unfrozen draft when no submission exists and preserves legacy fallback', async () => {
    io.active.mockResolvedValue(false);
    expect(await submissionContext(tx, 'entity', null, 'proposal')).toBeNull();
    io.active.mockResolvedValue(true);
    proof = null;
    expect(await submissionContext(tx, 'entity', null, 'proposal', 's')).toEqual({
      content: doc.projection,
      discussions: [{ id: 's', changeRequestEntityId: 'proposal' }],
      mode: null,
    });
    for (const change of [
      { kind: 'blog' },
      { entity_id: 'other' },
      { branch_id: 'branch' },
      { frozen: true },
    ]) {
      io.load.mockResolvedValueOnce({ ...doc, ...change });
      await expect(submissionContext(tx, 'entity', null, 'proposal')).rejects.toThrow(
        'proposal_document_mismatch'
      );
    }
    context = [];
    await expect(submissionContext(tx, 'entity', null, 'proposal')).rejects.toThrow(
      'proposal_requires_workspace'
    );
  });
});
