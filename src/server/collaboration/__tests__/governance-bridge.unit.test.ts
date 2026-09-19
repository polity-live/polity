import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '@/features/collaboration/logic/codec';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createDocument } from '@/features/communication-studio/logic/templates';
const io = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), commit: vi.fn(), query: vi.fn() }));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  findStored: io.find,
  createStored: io.create,
  commitState: io.commit,
}));
import { checksum } from '../store';
import {
  activeCollaboration,
  agendaHasConflicts,
  commitGovernanceContent,
  inheritGroupedDecision,
  inspectDecision,
  recordDecision,
} from '../governance';
let phase: string,
  stored: any,
  source: any[],
  branch: any[],
  conflict: any[],
  proof: any[],
  grouped: any[];
const tx: any = { location: 'server', dbTransaction: { query: io.query } };
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
function document(kind: any, value: unknown) {
  const y = seedDocument(kind, value);
  try {
    return {
      id: 'doc',
      kind,
      revision: 3,
      projection: value,
      state: Y.encodeStateAsUpdate(y),
      checksum: checksum(value),
    };
  } finally {
    y.destroy();
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  phase = 'active';
  stored = document('document', text('Base'));
  source = [{ content: text('Base') }];
  branch = [{ id: 'branch' }];
  conflict = [];
  proof = [
    {
      decision_result: null,
      checksum: checksum({ text: 'Submitted' }),
      application_status: 'pending',
    },
  ];
  grouped = [];
  io.find.mockImplementation(async () => stored);
  io.create.mockImplementation(async (_tx, ref, content) => document(ref.kind, content));
  io.commit.mockResolvedValue({ revisionId: 'next' });
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select phase')
      ? [{ phase }]
      : sql.startsWith('select id from amendment_process_branch')
        ? branch
        : sql.includes(' as content from ')
          ? source
          : sql.startsWith('select 1 from collaboration_proposal')
            ? conflict
            : sql.startsWith('select decision_result')
              ? proof
              : sql.startsWith('select * from collaboration_proposal')
                ? grouped
                : []
  );
});
describe('governance bridge authority and immutable decision checks', () => {
  it('never applies a decision to a different or ambiguous text branch', async () => {
    await expect(
      commitGovernanceContent(
        tx,
        'owner',
        'document',
        'entity',
        text('Decided'),
        'decision',
        'op',
        'foreign'
      )
    ).rejects.toThrow('invalid_branch');
    branch = [{ id: 'one' }, { id: 'two' }];
    await expect(
      commitGovernanceContent(tx, 'owner', 'document', 'entity', text('Decided'), 'decision', 'op')
    ).rejects.toThrow('ambiguous_document_branches');
    expect(io.commit).not.toHaveBeenCalled();
    expect(io.find).not.toHaveBeenCalled();
  });
  it('leaves legacy/client mutations to existing behavior and blocks dependent agendas only for recorded conflicts', async () => {
    expect(await activeCollaboration({ location: 'client' })).toBe(false);
    expect(await agendaHasConflicts({ location: 'client' }, 'agenda')).toBe(false);
    expect(
      await commitGovernanceContent(
        { location: 'client' },
        'owner',
        'document',
        'entity',
        [],
        'decision',
        'op'
      )
    ).toBeNull();
    phase = 'legacy';
    expect(await activeCollaboration(tx)).toBe(false);
    expect(
      await commitGovernanceContent(tx, 'owner', 'document', 'entity', [], 'decision', 'op')
    ).toBeNull();
    await recordDecision(tx, 'proposal', 'passed', null);
    expect(await inspectDecision(tx, 'proposal', 'passed', null)).toBe('apply');
    phase = 'active';
    expect(await activeCollaboration(tx)).toBe(true);
    expect(await agendaHasConflicts(tx, 'agenda')).toBe(false);
    conflict = [{ conflict: true }];
    expect(await agendaHasConflicts(tx, 'agenda')).toBe(true);
    expect(await inspectDecision({ location: 'client' } as any, 'proposal', 'passed', null)).toBe(
      'apply'
    );
    await recordDecision({ location: 'client' } as any, 'proposal', 'passed', null);
  });
  it('commits governance results as reconcilable Yjs updates with the actual text branch and stable operation identity', async () => {
    expect(
      await commitGovernanceContent(
        tx,
        'owner',
        'document',
        'entity',
        text('Decided'),
        'decision',
        'op'
      )
    ).toEqual({ revisionId: 'next' });
    expect(io.find).toHaveBeenCalledWith(expect.anything(), {
      kind: 'document',
      entityId: 'entity',
      branchId: 'branch',
      workspaceId: null,
    });
    const y = new Y.Doc();
    Y.applyUpdate(y, io.commit.mock.calls[0][2]);
    expect(projectDocument('document', y)).toEqual(text('Decided'));
    y.destroy();
    expect(io.commit).toHaveBeenCalledWith(
      expect.anything(),
      stored,
      expect.any(Uint8Array),
      'owner',
      'op',
      'decision'
    );
    io.commit.mockClear();
    expect(
      await commitGovernanceContent(
        tx,
        'owner',
        'document',
        'entity',
        text('Base'),
        'decision',
        'op'
      )
    ).toBeNull();
    expect(io.commit).not.toHaveBeenCalled();
  });
  it('initializes missing canonical content from domain rows and never invents a missing Studio document', async () => {
    stored = null;
    branch = [];
    for (const [kind, before, after] of [
      ['document', text('Base'), text('Next')],
      ['blog', text('Base'), text('Next')],
      [
        'city',
        createEmptyCityDesignState(),
        createEmptyCityDesignState({ lat: 52, lon: 13, label: 'Decision' }),
      ],
    ] as const) {
      source = [{ content: before }];
      await commitGovernanceContent(tx, 'owner', kind, 'entity', after, 'decision', `op-${kind}`);
      expect(io.create).toHaveBeenCalledWith(
        expect.anything(),
        { kind, entityId: 'entity', branchId: null, workspaceId: null },
        before,
        'owner'
      );
    }
    source = [];
    await expect(
      commitGovernanceContent(tx, 'owner', 'document', 'missing', [], 'decision', 'op')
    ).rejects.toThrow('canonical_document_missing');
    await expect(
      commitGovernanceContent(
        tx,
        'owner',
        'studio',
        'missing',
        createDocument('single', 'Missing'),
        'decision',
        'op'
      )
    ).rejects.toThrow('canonical_document_missing');
  });
  it('requires immutable submitted content and preserves votes as conflicts when that content has changed', async () => {
    expect(await inspectDecision(tx, 'proposal', 'passed', { text: 'Submitted' })).toBe('apply');
    expect(await inspectDecision(tx, 'proposal', 'passed', { text: 'Changed after voting' })).toBe(
      'conflict'
    );
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'conflict', null, 'submitted_content_changed', 'proposal']
    );
    expect(await inspectDecision(tx, 'proposal', 'rejected', null)).toBe('conflict');
    proof = [];
    await expect(inspectDecision(tx, 'proposal', 'passed', {})).rejects.toThrow(
      'submitted_revision_missing'
    );
  });
  it('does not reinterpret or reapply decisions and retries only explicit conflicts', async () => {
    proof[0].decision_result = 'passed';
    proof[0].application_status = 'applied';
    expect(await inspectDecision(tx, 'proposal', 'passed', {})).toBe('duplicate');
    expect(await inspectDecision(tx, 'proposal', 'passed', {}, true)).toBe('duplicate');
    await expect(inspectDecision(tx, 'proposal', 'rejected', {})).rejects.toThrow(
      'decision_already_recorded'
    );
    proof[0].application_status = 'conflict';
    expect(await inspectDecision(tx, 'proposal', 'passed', {})).toBe('conflict');
    expect(await inspectDecision(tx, 'proposal', 'passed', { text: 'Submitted' }, true)).toBe(
      'apply'
    );
    await recordDecision(tx, 'proposal', 'passed', 'applied');
    expect(io.query).toHaveBeenLastCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'applied', 'applied', null, 'proposal']
    );
  });
  it('groups legacy duplicates only with matching immutable documents and preserves existing conflicts', async () => {
    await expect(inheritGroupedDecision(tx, 'canonical', 'duplicate')).rejects.toThrow(
      'submitted_revision_missing'
    );
    grouped = [
      {
        change_request_id: 'canonical',
        document_id: 'doc',
        checksum: 'sum',
        decision_result: 'passed',
        application_revision_id: null,
        conflict_reason: 'overlap',
      },
      {
        change_request_id: 'duplicate',
        document_id: 'doc',
        checksum: 'sum',
        decision_result: null,
      },
    ];
    await inheritGroupedDecision(tx, 'canonical', 'duplicate');
    expect(io.query).toHaveBeenLastCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'conflict', null, 'overlap', 'duplicate']
    );
    grouped[1].document_id = 'another';
    await inheritGroupedDecision(tx, 'canonical', 'duplicate');
    expect(io.query).toHaveBeenLastCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'conflict', null, 'grouped_proposal_content_differs', 'duplicate']
    );
    grouped[1].decision_result = 'passed';
    io.query.mockClear();
    await inheritGroupedDecision(tx, 'canonical', 'duplicate');
    expect(io.query).toHaveBeenCalledTimes(1);
  });
});
