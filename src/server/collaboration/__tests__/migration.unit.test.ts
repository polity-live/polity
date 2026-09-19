import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '@/features/collaboration/logic/codec';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createDocument } from '@/features/communication-studio/logic/templates';
const io = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  persist: vi.fn(),
  comments: vi.fn(),
}));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  createStored: io.create,
  loadStored: io.load,
  persistProjection: io.persist,
}));
vi.mock('../migrate-comments', () => ({ migrateComments: io.comments }));
import { checksum, type StoredDocument } from '../store';
import { activateMigration, checkWindow, governanceManifest, migrateDocuments } from '../migration';
import { enterCompatibility } from '../rollback';
let state: any;
const query = vi.fn(),
  sql = { query },
  docs = new Map<string, StoredDocument>();
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
const key = (r: any) => JSON.stringify(r);
beforeEach(() => {
  vi.clearAllMocks();
  docs.clear();
  state = {
    attempt: null,
    activated: null,
    phase: 'maintenance',
    manifest: null,
    deadline: null,
    documents: [
      {
        id: 'text',
        content: text('Current'),
        branch_id: null,
        original: { id: 'text', content: text('Current') },
      },
    ],
    blogs: [],
    cities: [],
    studio: [],
    branches: [],
    cityArchives: [],
    proposals: [],
    votes: [],
    choices: [],
    links: [],
    archives: [],
    versions: [],
    contexts: [],
    proof: null,
    changed: false,
    governanceReads: 0,
    discussions: {},
    history: [],
    badStored: false,
  };
  io.create.mockImplementation(async (_sql, reference, value, actor, workspace) => {
    const k = key(reference);
    if (docs.has(k)) return docs.get(k);
    const y = seedDocument(reference.kind, value);
    const projection = projectDocument(reference.kind, y);
    const doc = {
      id: crypto.randomUUID(),
      kind: reference.kind,
      entity_id: reference.entityId,
      branch_id: reference.branchId,
      workspace_id: reference.workspaceId,
      workspace_type: workspace?.type ?? 'canonical',
      generation: crypto.randomUUID(),
      revision: 1,
      state: Y.encodeStateAsUpdate(y),
      projection,
      checksum: checksum(projection),
      owner_id: workspace ? actor : null,
      base_document_id: workspace?.base.id ?? null,
      base_revision: workspace?.base.revision ?? null,
      shared: false,
      deleted: false,
      frozen: false,
    };
    y.destroy();
    docs.set(k, doc);
    return doc;
  });
  io.load.mockImplementation(async (_sql, id) => {
    const d = [...docs.values()].find(d => d.id === id)!;
    return state.badStored ? { ...d, checksum: 'mismatch' } : d;
  });
  io.persist.mockResolvedValue(undefined);
  io.comments.mockResolvedValue(undefined);
  query.mockReset().mockImplementation(async (statement: string, p: any[] = []) => {
    if (statement.startsWith('select to_regclass'))
      return [{ name: ['public.vote', 'public.amendment'].includes(p[0]) ? p[0] : null }];
    if (statement.startsWith('select to_jsonb')) {
      state.governanceReads++;
      return [
        {
          value: {
            id: 'protected',
            deadline: 1234,
            votes: state.changed && state.governanceReads > 2 ? 3 : 2,
          },
        },
      ];
    }
    if (statement.includes('extract(epoch')) return [{ deadline: state.deadline }];
    if (statement.startsWith('select status from collaboration_migration_attempt'))
      return state.attempt ? [{ status: state.attempt }] : [];
    if (statement.startsWith('select activated_at')) return [{ activated_at: state.activated }];
    if (statement.startsWith('select phase,manifest'))
      return [{ phase: state.phase, manifest: state.manifest }];
    if (statement.startsWith('select phase,activated_at'))
      return [{ phase: state.phase, activated_at: state.activated }];
    if (statement.startsWith('insert into collaboration_migration_attempt'))
      state.attempt = 'prepared';
    if (statement === 'delete from collaboration_document') docs.clear();
    if (statement.startsWith('select d.id,d.content')) return state.documents;
    if (statement.startsWith('select id,content,to_jsonb')) return state.blogs;
    if (statement.startsWith('select id,amendment_id,design_state')) return state.cities;
    if (statement.startsWith('select b.id from amendment_process_branch')) return state.branches;
    if (statement.startsWith('select projection,checksum from collaboration_legacy_snapshot'))
      return state.cityArchives;
    if (statement.startsWith('select p.id,s.document')) return state.studio;
    if (statement.startsWith('select * from change_request where')) return state.proposals;
    if (statement.startsWith('select coalesce(b.document_id'))
      return [{ document_id: state.target ?? 'text' }];
    if (statement.startsWith('select id from collaboration_revision'))
      return [{ id: `${p[0]}:r1` }];
    if (statement.startsWith('select * from vote where')) return state.votes;
    if (statement.startsWith('select vote_id from collaboration_ballot_context'))
      return state.contexts.includes(p[0]) ? [{ vote_id: p[0] }] : [];
    if (statement.startsWith('select * from vote_choice')) return state.choices;
    if (statement.startsWith('select * from agenda_item_change_request')) return state.links;
    if (statement.startsWith('select * from collaboration_proposal'))
      return state.proof ? [state.proof] : [];
    if (statement.startsWith('select * from collaboration_legacy_snapshot')) return state.archives;
    if (statement.startsWith('select created_by_id')) return [{ created_by_id: 'owner' }];
    if (statement.startsWith('select content,document_id from document_version'))
      return state.versions;
    if (statement.startsWith('select * from collaboration_document'))
      return [...docs.values()].filter(
        d => !statement.includes("workspace_type='canonical'") || d.workspace_type === 'canonical'
      );
    if (statement.startsWith('select id,discussions from'))
      return state.discussions[statement.split(' ')[3]] ?? [];
    if (statement.startsWith('select document_id from amendment'))
      return [{ document_id: state.target ?? 'text' }];
    if (statement.startsWith('select id,content from document_version')) return state.history;
    return [];
  });
});
afterEach(() => vi.restoreAllMocks());
function vote(purpose = 'closing') {
  state.votes = [{ id: 'vote', amendment_id: 'amendment', purpose }];
  state.choices = [{ process_branch_id: null }];
}
function archive(branch: string | null = null) {
  const projection = text('Historical ballot');
  return {
    id: crypto.randomUUID(),
    kind: 'document',
    entity_id: 'text',
    branch_id: branch,
    projection,
    checksum: checksum(projection),
    version_id: 'version',
  };
}
describe('migration evidence and retry rules', () => {
  it('captures an independent ballot without inventing a document and preserves archived city evidence', async () => {
    vote();
    state.votes[0].amendment_id = null;
    await migrateDocuments(sql, 'attempt');
    expect(
      query.mock.calls.filter(([statement]) =>
        statement.startsWith('insert into collaboration_ballot(')
      )
    ).toHaveLength(0);
    vote();
    const a = archive();
    const city = createEmptyCityDesignState();
    state.cities = [{ id: 'city', amendment_id: 'amendment', design_state: city, original: {} }];
    state.archives = [
      a,
      {
        id: 'city-proof',
        kind: 'city',
        entity_id: 'city',
        branch_id: null,
        projection: city,
        checksum: checksum(city),
        version_id: null,
      },
    ];
    state.versions = [{ document_id: 'text', content: a.projection }];
    await migrateDocuments(sql, 'attempt');
    expect([...docs.values()].find(d => d.workspace_id === 'city-proof')).toMatchObject({
      kind: 'city',
      projection: city,
    });
  });
  it('blocks shared text identities across branches instead of choosing arbitrary visibility or decision scope', async () => {
    state.documents = [
      { ...state.documents[0], branch_id: 'one' },
      { ...state.documents[0], branch_id: 'two' },
    ];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'ambiguous_document_branches:text'
    );
    expect(io.create).not.toHaveBeenCalled();
  });
  it('preserves governance checksums and refuses deadlines inside the unchanged reserve', async () => {
    expect(await governanceManifest(sql)).toEqual({
      vote: {
        count: 1,
        checksum: checksum([{ value: { id: 'protected', deadline: 1234, votes: 2 } }]),
      },
      amendment: {
        count: 1,
        checksum: checksum([{ value: { id: 'protected', deadline: 1234, votes: 2 } }]),
      },
    });
    await expect(checkWindow(sql, NaN)).rejects.toThrow('maintenance_reserve_required');
    await expect(checkWindow(sql, 59000)).rejects.toThrow('maintenance_reserve_required');
    expect(await checkWindow(sql, 60000)).toBeNull();
    state.deadline = String(Date.now() + 1);
    await expect(checkWindow(sql, 60000)).rejects.toThrow('insufficient_maintenance_window');
    state.deadline = String(Date.now() + 120000);
    expect(await checkWindow(sql, 60000)).toBe(Number(state.deadline));
  });
  it('creates a fresh attempt, migrates all editor kinds and remains idempotent while prepared', async () => {
    state.blogs = [{ id: 'blog', content: text('Blog'), original: { content: text('Blog') } }];
    state.cities = [
      {
        id: 'city',
        amendment_id: 'amendment',
        design_state: createEmptyCityDesignState(),
        original: {},
      },
    ];
    state.branches = [{ id: 'branch' }];
    const city = createEmptyCityDesignState({ lat: 52, lon: 13, label: 'Branch city' });
    state.cityArchives = [{ projection: city, checksum: checksum(city) }];
    state.studio = [{ id: 'studio', document: createDocument('single', 'Studio'), original: {} }];
    const first = await migrateDocuments(sql, 'attempt');
    const second = await migrateDocuments(sql, 'attempt');
    expect(first).toEqual(second);
    expect(first).toMatchObject({ documents: 5, proposals: 0, verified: true });
    expect(
      query.mock.calls.filter(([s]) => s === 'delete from collaboration_document')
    ).toHaveLength(1);
    expect([...docs.values()].filter(d => d.kind === 'city').map(d => d.branch_id)).toEqual([
      null,
      'branch',
    ]);
  });
  it('rejects closed attempts, a restarted initial conversion after activation and changed governance', async () => {
    state.attempt = 'aborted';
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('migration_attempt_closed');
    state.attempt = null;
    state.activated = 123;
    await expect(migrateDocuments(sql, 'new-attempt')).rejects.toThrow(
      'migration_already_activated'
    );
    state.activated = null;
    state.changed = true;
    state.governanceReads = 0;
    await expect(migrateDocuments(sql, 'new-attempt')).rejects.toThrow(
      'governance_manifest_changed'
    );
  });
  it('blocks missing city branch snapshots and reconstructed content that differs from persisted state', async () => {
    state.cities = [
      {
        id: 'city',
        amendment_id: 'amendment',
        design_state: createEmptyCityDesignState(),
        original: {},
      },
    ];
    state.branches = [{ id: 'branch' }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_city_branch:branch');
    state.cityArchives = [{ projection: createEmptyCityDesignState(), checksum: 'incorrect' }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_city_branch:branch');
    state.cities = [];
    state.badStored = true;
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('migration_content_mismatch');
  });
  it('freezes each actual inline proposal separately while canonical content excludes its pending insertion', async () => {
    state.documents[0].branch_id = 'proposal-branch';
    state.documents[0].content[0].children.push({
      text: ' Proposed insertion',
      suggestion: true,
      suggestion_s1: { id: 's1', type: 'insert', userId: 'proposer' },
    });
    state.proposals = [
      {
        id: 'proposal',
        amendment_id: 'amendment',
        process_branch_id: 'proposal-branch',
        user_id: 'proposer',
        suggestion_id: 's1',
      },
    ];
    const result = await migrateDocuments(sql, 'attempt');
    expect(result.proposals).toBe(1);
    const [canonical, proposal] = [...docs.values()];
    expect(JSON.stringify(canonical.projection)).not.toContain('Proposed insertion');
    expect(JSON.stringify(proposal.projection)).toContain('Proposed insertion');
    expect(query).toHaveBeenCalledWith(
      'update collaboration_document set frozen=true where id=$1',
      [proposal.id]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_proposal'),
      expect.arrayContaining(['proposal', canonical.id, `${canonical.id}:r1`, `${proposal.id}:r1`])
    );
    expect(proposal.branch_id).toBe('proposal-branch');
  });
  it('rejects unresolved proposals when their original document or marked change cannot be reconstructed', async () => {
    state.proposals = [
      {
        id: 'proposal',
        amendment_id: 'amendment',
        process_branch_id: null,
        user_id: 'author',
        suggestion_id: 'missing',
      },
    ];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_proposal:proposal');
    state.target = 'absent';
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_proposal:proposal');
    state.proposals = [
      {
        id: 'city-proposal',
        process_branch_id: null,
        source_type: 'city_design_update',
        new_properties: null,
      },
    ];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'missing_proposal_document:city-proposal'
    );
  });
  it('preserves object proposal payloads and the author without applying their decision during conversion', async () => {
    state.cities = [
      {
        id: 'city',
        amendment_id: 'amendment',
        design_state: createEmptyCityDesignState(),
        original: {},
      },
    ];
    state.proposals = [
      {
        id: 'city-proposal',
        user_id: 'author',
        amendment_id: 'amendment',
        process_branch_id: null,
        source_type: 'city_design_update',
        source_id: 'object',
        original_properties: { cityDesignId: 'city' },
        new_properties: null,
      },
    ];
    expect((await migrateDocuments(sql, 'attempt')).proposals).toBe(1);
    expect([...docs.values()].find(d => d.workspace_id === 'city-proposal')).toMatchObject({
      kind: 'city',
      owner_id: 'author',
    });
    state.proposals[0].amendment_id = 'foreign-amendment';
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'missing_proposal_document:city-proposal'
    );
  });
  it('requires complete ballot choices and proof for every linked proposal before migrating a ballot', async () => {
    vote();
    state.choices = [];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_ballot_choices:vote');
    state.choices = [{}];
    state.links = [{ change_request_id: 'proposal' }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'ambiguous_ballot_proposal:vote'
    );
    state.proof = {
      document_id: 'document',
      submitted_revision_id: 'submitted',
      checksum: 'proof',
    };
    await migrateDocuments(sql, 'attempt');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'insert into collaboration_ballot(vote_id,document_id,revision_id,change_request_id'
      ),
      ['vote', 'document', 'submitted', 'proposal', 'proof', expect.any(Number)]
    );
    state.contexts = ['vote'];
    query.mockClear();
    await migrateDocuments(sql, 'attempt');
    expect(query.mock.calls.some(([s]) => s.startsWith('select * from vote_choice'))).toBe(false);
  });
  it('never substitutes current content for an unknown historical ballot or invalid archived version', async () => {
    vote();
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('ambiguous_ballot:vote');
    const a = archive();
    state.archives = [{ ...a, checksum: 'wrong' }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'legacy_snapshot_checksum_mismatch'
    );
    state.archives = [{ ...a, version_id: null }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow('legacy_ballot_version_missing');
    state.archives = [a];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'legacy_snapshot_version_mismatch'
    );
    state.versions = [{ document_id: 'text', content: text('Wrong') }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'legacy_snapshot_version_mismatch'
    );
    state.versions = [{ document_id: 'text', content: a.projection }];
    state.documents = [];
    docs.clear();
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'legacy_ballot_document_missing'
    );
  });
  it('migrates the immutable archived ballot and requires all competing variants', async () => {
    vote();
    const a = archive();
    state.archives = [a];
    state.versions = [{ document_id: 'text', content: a.projection }];
    await migrateDocuments(sql, 'attempt');
    const saved = [...docs.values()].find(d => d.workspace_id === a.id)!;
    expect(saved.projection).toEqual(a.projection);
    expect(saved.projection).not.toEqual(state.documents[0].content);
    state.votes[0].purpose = 'merge_variant';
    state.choices = [{ process_branch_id: 'one' }];
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'ambiguous_ballot_variants:vote'
    );
    state.choices.push({ process_branch_id: 'two' });
    await expect(migrateDocuments(sql, 'attempt')).rejects.toThrow(
      'missing_ballot_variant:vote:one'
    );
  });
  it('activates only a verified unchanged manifest and protects all archived revisions through compatibility rollback', async () => {
    await expect(activateMigration(sql, 'attempt', 60000)).rejects.toThrow('unverified_migration');
    state.manifest = await migrateDocuments(sql, 'attempt');
    state.manifest.contentChecksum = 'wrong';
    await expect(activateMigration(sql, 'attempt', 60000)).rejects.toThrow(
      'content_manifest_changed'
    );
    state.manifest = await migrateDocuments(sql, 'attempt');
    state.manifest.governance = {};
    await expect(activateMigration(sql, 'attempt', 60000)).rejects.toThrow(
      'governance_manifest_changed'
    );
    state.manifest = await migrateDocuments(sql, 'attempt');
    await activateMigration(sql, 'attempt', 60000);
    expect(io.persist).toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("set phase='active',activated_at"), [
      expect.any(Number),
    ]);
    await expect(enterCompatibility(sql, 60000)).rejects.toThrow('maintenance after activation');
    state.activated = 123;
    expect(await enterCompatibility(sql, 60000)).toEqual({
      phase: 'active',
      transport: 'http',
      documents: 1,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('generation=gen_random_uuid()'), [
      expect.any(Number),
    ]);
  });
  it('moves discussions and annotated historical text into private checkpoints during activation', async () => {
    state.documents.push({
      id: 'branch-text',
      branch_id: 'branch',
      content: text('Branch'),
      original: {},
    });
    state.blogs = [{ id: 'blog', content: text('Blog'), original: {} }];
    state.manifest = await migrateDocuments(sql, 'attempt');
    state.discussions = {
      amendment: [{ id: 'amendment', discussions: [] }],
      amendment_process_branch: [{ id: 'branch', discussions: [] }],
      blog: [
        { id: 'blog', discussions: [] },
        { id: 'empty-retired-blog', discussions: [] },
      ],
    };
    const marked = text('History');
    marked[0].children.push({
      text: ' Pending',
      suggestion: true,
      suggestion_s1: { id: 's1', type: 'insert', userId: 'author' },
    } as any);
    state.history = [
      { id: 'plain', content: text('Plain') },
      { id: 'marked', content: marked },
    ];
    await activateMigration(sql, 'attempt', 60000);
    expect(io.comments).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenCalledWith(
      'update document_version set content=$1::jsonb where id=$2',
      [expect.any(Array), 'marked']
    );
    state.discussions.blog.push({ id: 'missing-blog', discussions: [{}] });
    await expect(activateMigration(sql, 'attempt', 60000)).rejects.toThrow(
      'missing_discussion_document:missing-blog'
    );
  });
});
