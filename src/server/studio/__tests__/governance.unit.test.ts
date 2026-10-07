import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
import { diffStudio } from '@/features/communication-studio/logic/operations';
import { checksum } from '@/server/checksum';
import { element } from '@/features/communication-studio/logic/document';

const io = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  access: vi.fn(),
  assets: vi.fn(),
  sharing: vi.fn(),
  audience: vi.fn(),
  cleanup: vi.fn(),
  enabled: true,
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioTransaction: io.transaction,
  assertStudioCollaborationAccess: io.access,
  canvasEnabled: () => io.enabled,
}));
vi.mock('../ai-sources', () => ({
  assertProjectAiSourceSharing: io.sharing,
  assertStudioProposalSourceAudience: io.audience,
}));
vi.mock('../assets', () => ({ validateStudioAssetsInTransaction: io.assets }));
vi.mock('../ai-suggestions', () => ({ cleanupStudioProposalAssets: io.cleanup }));
import { canvasCommand } from '../governance';

const actor = crypto.randomUUID();
const other = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workspaceId = crypto.randomUUID();
const generation = crypto.randomUUID();
const groupId = crypto.randomUUID();
const roleId = crypto.randomUUID();
const commentId = crypto.randomUUID();
const historyId = crypto.randomUUID();
let project: any,
  control: any,
  canonical: any,
  proposal: any,
  rights: any,
  prior: any,
  comment: any,
  history: any,
  members: any[],
  voters: any[],
  votes: any[],
  submitted: any[],
  pending: any[],
  active: any[],
  proposalList: any[],
  role: any,
  allowed: boolean,
  voteCount: number;
const queryText = (parts: TemplateStringsArray) => parts.join('?').replace(/\s+/g, ' ').trim();
const calls = (prefix: string) =>
  io.sql.mock.calls.filter(
    ([parts]) =>
      Array.isArray(parts) &&
      'raw' in parts &&
      queryText(parts as unknown as TemplateStringsArray).startsWith(prefix)
  );
const command = (
  action: string,
  values: Record<string, unknown> = {}
): Record<string, unknown> => ({
  projectId,
  action,
  operationId: crypto.randomUUID(),
  generation,
  revision: 7,
  ...values,
});
const draft = (action: string, values: Record<string, unknown> = {}) =>
  command(action, { workspaceId, revision: 3, ...values });
function ballot(values: Record<string, unknown> = {}) {
  const changes = diffStudio(proposal.base_document, proposal.document);
  Object.assign(proposal, {
    state: 'voting',
    changes,
    electorate: [actor],
    checksum: checksum({
      base: proposal.base_revision,
      generation: proposal.base_generation,
      changes,
    }),
    ...values,
  });
}
beforeEach(async () => {
  vi.resetAllMocks();
  io.enabled = true;
  project = {
    id: projectId,
    owner_id: actor,
    group_id: null,
    can_edit: true,
    can_manage: true,
    source_references: [],
  };
  control = { phase: 'edit', generation };
  const document = legacyDocumentToV3(createDocument('single', 'Canonical'));
  canonical = { document, content_revision: 7 };
  proposal = {
    id: workspaceId,
    project_id: projectId,
    owner_id: actor,
    shared_ids: [],
    revision: 3,
    base_revision: 7,
    base_generation: generation,
    base_document: structuredClone(document),
    document: { ...structuredClone(document), title: 'Suggestion' },
    state: 'draft',
    can_read: true,
    origin: 'manual',
    ai_status: 'ready',
    ai_sources: [],
    application: 'pending',
    resolves_id: null,
    deadline: null,
  };
  rights = { suggest: true, comment: true, vote: true };
  prior = null;
  comment = { id: commentId, author_id: actor, proposal_id: null };
  history = { document };
  members = [{ id: actor }];
  voters = [{ id: actor }];
  votes = [{ choice: 'accept' }];
  submitted = [];
  pending = [];
  active = [];
  proposalList = [];
  role = { id: roleId };
  allowed = true;
  voteCount = 0;
  Object.assign(io.sql, { json: (value: unknown) => value, unsafe: vi.fn().mockResolvedValue([]) });
  io.sql.mockImplementation((parts: TemplateStringsArray | string[], ..._values: unknown[]) => {
    if (!('raw' in parts)) return { values: parts };
    const text = queryText(parts);
    if (text.startsWith('select *,studio_access')) return project ? [project] : [];
    if (text.startsWith('select * from canvas_control')) return control ? [control] : [];
    if (text.startsWith('select * from studio_state')) return canonical ? [canonical] : [];
    if (text.startsWith('select *,canvas_proposal_access')) return proposal ? [proposal] : [];
    if (text.startsWith('select canvas_capability')) return [rights];
    if (text.startsWith('select * from canvas_receipt')) return prior ? [prior] : [];
    if (text.startsWith('select * from canvas_proposal')) return submitted;
    if (text.startsWith('select id from canvas_proposal'))
      return text.includes("application='conflict'") ? pending : active;
    if (text.startsWith('select id,title,reason')) return proposalList;
    if (text.startsWith('select u.id')) return members;
    if (text.startsWith('select id from "user"')) return voters;
    if (text.startsWith('select choice') || text.startsWith('select user_id,choice')) return votes;
    if (text.startsWith('select count')) return [{ n: voteCount }];
    if (text.startsWith('select * from canvas_comment where id')) return comment ? [comment] : [];
    if (
      text.startsWith('select canvas_proposal_access') ||
      text.startsWith('select studio_group_access')
    )
      return [{ allowed, value: allowed }];
    if (text.startsWith('select * from canvas_history')) return history ? [history] : [];
    if (text.startsWith('select id from role')) return role ? [role] : [];
    if (text.startsWith('select owner_id as id')) return members;
    if (text.startsWith('select source_references')) return [project];
    if (text.startsWith('select r.id')) return [{ id: roleId, capabilities: { vote: true } }];
    if (text.startsWith('select id,name from "group"')) return [{ id: groupId, name: 'Group' }];
    return [];
  });
  io.transaction.mockImplementation(async body => body(io.sql));
  io.access.mockResolvedValue(undefined);
  const assets = await vi.importActual<typeof import('../assets')>('../assets');
  io.assets.mockImplementation(assets.validateStudioAssetsInTransaction);
  io.sharing.mockResolvedValue(undefined);
  io.audience.mockResolvedValue(undefined);
  io.cleanup.mockResolvedValue(undefined);
});

describe('Canvas governance authority, ballots and operation receipts', () => {
  it('rejects disabled canvas and invalid input before opening a transaction', async () => {
    io.enabled = false;
    await expect(canvasCommand(actor, command('session'))).rejects.toMatchObject({ status: 404 });
    io.enabled = true;
    await expect(canvasCommand(actor, { projectId, action: 'unknown' })).rejects.toThrow();
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it.each(['project', 'control', 'canonical'])('rejects a missing %s row', async row => {
    if (row === 'project') project = null;
    if (row === 'control') control = null;
    if (row === 'canonical') canonical = null;
    await expect(canvasCommand(actor, command('session'))).rejects.toThrow(
      'Studio V5 project not found'
    );
  });
  it.each([false, true])('rejects inaccessible workspace with missing row %s', async missing => {
    if (missing) proposal = null;
    else proposal.can_read = false;
    await expect(canvasCommand(actor, draft('loadDraft'))).rejects.toMatchObject({ status: 403 });
  });
  it('stops immediately after collaboration access is revoked', async () => {
    io.access.mockRejectedValueOnce(new Error('revoked'));
    await expect(canvasCommand(actor, command('session'))).rejects.toThrow('revoked');
    expect(io.sql).not.toHaveBeenCalled();
  });
  it.each(['personal', 'group', 'group-reader', 'personal-collaborator'])(
    'returns server-computed session capabilities for %s',
    async kind => {
      if (kind.startsWith('group')) project.group_id = groupId;
      if (kind.endsWith('reader')) project.can_manage = false;
      if (kind.endsWith('collaborator')) project.owner_id = other;
      proposalList = [proposal];
      const result = await canvasCommand(actor, command('session'));
      expect(result.capabilities).toEqual({
        read: true,
        edit: true,
        suggest: true,
        comment: true,
        vote: true,
        manage: project.can_manage,
      });
      expect(result.proposals[0].votes).toEqual(votes);
      expect(result.roles).toHaveLength(kind === 'group' ? 1 : 0);
      expect(result.adoptionGroups).toHaveLength(kind === 'personal' ? 1 : 0);
      expect(io.transaction).toHaveBeenCalledWith(expect.any(Function), { readOnly: true });
      expect(calls('insert into canvas_receipt')).toHaveLength(0);
    }
  );
  it.each([
    ['edit-owner', 'edit', 'draft', true, actor, [], null, true],
    ['suggest-shared', 'suggest_internal', 'draft', true, other, [actor], null, true],
    ['vote-resolution', 'vote_internal', 'draft', true, actor, [], other, true],
    ['vote-no-resolution', 'vote_internal', 'draft', true, actor, [], null, false],
    ['view', 'view', 'draft', true, actor, [], null, false],
    ['submitted', 'edit', 'submitted', true, actor, [], null, false],
    ['no-capability', 'edit', 'draft', false, actor, [], null, false],
    ['not-shared', 'edit', 'draft', true, other, [], null, false],
  ])(
    'loads draft editability for %s',
    async (_name, phase, state, suggest, owner, shared, resolves, canEdit) => {
      control.phase = phase;
      rights.suggest = suggest;
      Object.assign(proposal, {
        state,
        owner_id: owner,
        shared_ids: shared,
        resolves_id: resolves,
      });
      expect(await canvasCommand(actor, draft('loadDraft'))).toMatchObject({
        document: proposal.document,
        baseDocument: proposal.base_document,
        canEdit,
      });
    }
  );
  it('requires a ready workspace for loading a draft and supports read-only library browsing', async () => {
    await expect(canvasCommand(actor, command('loadDraft'))).rejects.toThrow('not permitted');
    proposal.ai_status = 'generating';
    await expect(canvasCommand(actor, draft('loadDraft'))).rejects.toThrow('not permitted');
    expect(await canvasCommand(actor, command('libraries'))).toEqual([]);
  });
  it('requires an operation ID and current generation for every write', async () => {
    await expect(
      canvasCommand(actor, command('comment', { operationId: undefined }))
    ).rejects.toThrow('Missing canvas input');
    await expect(
      canvasCommand(actor, command('comment', { generation: other }))
    ).rejects.toMatchObject({ status: 409 });
    expect(calls('insert into canvas_comment')).toHaveLength(0);
  });
  it('replays an identical receipt and rejects another actor or another input', async () => {
    const input = command('comment', { body: 'Comment' });
    prior = { actor_id: actor, input_hash: checksum(input), result: { replay: true } };
    expect(await canvasCommand(actor, input)).toEqual({ replay: true });
    prior.actor_id = other;
    await expect(canvasCommand(actor, input)).rejects.toThrow('Operation ID reused');
    prior.actor_id = actor;
    prior.input_hash = 'changed';
    await expect(canvasCommand(actor, input)).rejects.toThrow('Operation ID reused');
    expect(calls('insert into canvas_comment')).toHaveLength(0);
  });
  it.each(['createDraft', 'resolveDraft'])(
    'creates a reviewable %s from the current canonical state',
    async action => {
      if (action === 'resolveDraft') {
        control.phase = 'vote_internal';
        Object.assign(proposal, { decision: 'accepted', application: 'conflict' });
      }
      const input = command(action, {
        title: 'Draft',
        ...(action === 'resolveDraft' ? { workspaceId } : { reason: 'Reason' }),
      });
      expect(await canvasCommand(actor, input)).toEqual({ workspaceId: input.operationId });
      const inserted = calls('insert into canvas_proposal')[0];
      expect(inserted[6]).toEqual(canonical.document);
      expect(inserted[10]).toBe(action === 'resolveDraft' ? workspaceId : null);
      expect(calls('insert into canvas_receipt')).toHaveLength(1);
    }
  );
  it.each([
    ['group-edit', 'createDraft', 'group', 'edit', true, 7, true],
    ['no-suggest', 'createDraft', null, 'edit', false, 7, true],
    ['view', 'createDraft', null, 'view', true, 7, true],
    ['unresolved', 'resolveDraft', null, 'edit', true, 7, false],
    ['stale', 'createDraft', null, 'edit', true, 6, true],
  ])(
    'rejects draft creation for %s',
    async (_name, action, group, phase, suggest, revision, resolving) => {
      project.group_id = group;
      control.phase = phase;
      rights.suggest = suggest;
      Object.assign(proposal, {
        decision: resolving ? 'accepted' : 'rejected',
        application: 'conflict',
      });
      await expect(
        canvasCommand(actor, command(String(action), { workspaceId, revision, title: 'Draft' }))
      ).rejects.toThrow();
      expect(calls('insert into canvas_proposal')).toHaveLength(0);
    }
  );
  it.each([
    ['missing', null, true, 'draft', actor, [], 'edit', null, 3],
    ['no-suggest', true, false, 'draft', actor, [], 'edit', null, 3],
    ['submitted', true, true, 'submitted', actor, [], 'edit', null, 3],
    ['not-owner', true, true, 'draft', other, [], 'edit', null, 3],
    ['view', true, true, 'draft', actor, [], 'view', null, 3],
    ['vote-no-resolution', true, true, 'draft', actor, [], 'vote_internal', null, 3],
    ['missing-revision', true, true, 'draft', actor, [], 'edit', null, undefined],
    ['future-revision', true, true, 'draft', actor, [], 'edit', null, 4],
    ['stale-exact', true, true, 'draft', actor, [], 'edit', null, 2],
  ])(
    'protects draft writes for %s',
    async (_name, present, suggest, state, owner, shared, phase, resolves, revision) => {
      rights.suggest = suggest;
      control.phase = phase;
      if (present)
        Object.assign(proposal, {
          state,
          owner_id: owner,
          shared_ids: shared,
          resolves_id: resolves,
        });
      const input = present ? draft('share', { revision }) : command('share', { revision });
      await expect(canvasCommand(actor, input)).rejects.toThrow();
      expect(calls('update canvas_proposal')).toHaveLength(0);
    }
  );
  it('saves compatible draft changes and returns conflicts without overwriting newer edits', async () => {
    const changed = { ...structuredClone(proposal.document), title: 'Edited' };
    const changes = diffStudio(proposal.document, changed);
    const saved = await canvasCommand(actor, draft('saveDraft', { revision: 2, changes }));
    expect(saved).toMatchObject({
      status: 'applied',
      revision: 4,
      document: { title: 'Edited' },
    });
    expect(saved.document.nodes).toHaveLength(changed.nodes.length);
    expect(saved.document.nodes).toEqual(expect.arrayContaining(changed.nodes));
    proposal.document.title = 'Later title';
    expect(await canvasCommand(actor, draft('saveDraft', { changes }))).toMatchObject({
      status: 'conflict',
      revision: 3,
      document: proposal.document,
    });
    expect(calls('update canvas_proposal')).toHaveLength(1);
  });
  it.each([undefined, [other]])(
    'shares a draft with authorized readers %s and verifies AI sources',
    async userIds => {
      proposal.origin = 'ai';
      await canvasCommand(actor, draft('share', { userIds }));
      expect(io.audience).toHaveBeenCalledWith(actor, projectId, [], io.sql);
      expect(calls('update canvas_proposal')[0][1]).toEqual(userIds ?? []);
      expect(io.access).toHaveBeenCalledTimes(userIds ? 2 : 1);
    }
  );
  it('allows a shared editor to save but reserves sharing and submission for the owner', async () => {
    proposal.owner_id = other;
    proposal.shared_ids = [actor];
    await canvasCommand(actor, draft('saveDraft', { changes: [] }));
    await expect(canvasCommand(actor, draft('share'))).rejects.toThrow('not permitted');
    await expect(canvasCommand(actor, draft('submit'))).rejects.toThrow('not permitted');
  });
  it.each(['normal', 'resolution'])(
    'submits a %s proposal with an immutable checksum',
    async kind => {
      if (kind === 'resolution') {
        control.phase = 'vote_internal';
        proposal.resolves_id = other;
      }
      await canvasCommand(actor, draft('submit'));
      const inserted = calls('update canvas_proposal')[0];
      const changes = diffStudio(proposal.base_document, proposal.document);
      expect(inserted[1]).toBe(kind === 'resolution' ? 'voting' : 'submitted');
      expect(inserted[3]).toBe(checksum({ base: 7, generation, changes }));
      expect(inserted[4]).toEqual(kind === 'resolution' ? [actor] : null);
    }
  );
  it('rejects submission without changes, without resolution voters or outside the group suggestion phase', async () => {
    proposal.document = structuredClone(proposal.base_document);
    await expect(canvasCommand(actor, draft('submit'))).rejects.toThrow('Proposal has no changes');
    proposal.document.title = 'Change';
    control.phase = 'vote_internal';
    proposal.resolves_id = other;
    members = [];
    await expect(canvasCommand(actor, draft('submit'))).rejects.toThrow('No eligible voters');
    project.group_id = groupId;
    proposal.origin = 'ai';
    control.phase = 'edit';
    await expect(canvasCommand(actor, draft('submit'))).rejects.toThrow('not permitted');
  });
  it.each(['draft', 'submitted'])('withdraws an owned %s and cleans staged media', async state => {
    proposal.state = state;
    await canvasCommand(actor, draft('withdraw'));
    expect(calls('update canvas_proposal')[0][2]).toBe(workspaceId);
    expect(io.cleanup).toHaveBeenCalledWith(workspaceId);
  });
  it.each(['missing', 'other-owner', 'closed'])('denies withdrawal for %s', async kind => {
    if (kind === 'other-owner') proposal.owner_id = other;
    if (kind === 'closed') proposal.state = 'closed';
    await expect(
      canvasCommand(actor, kind === 'missing' ? command('withdraw') : draft('withdraw'))
    ).rejects.toThrow('not permitted');
  });
  it('changes phase only after checking revision, pending conflicts and ballot integrity', async () => {
    ballot({ state: 'submitted' });
    submitted = [proposal];
    await canvasCommand(actor, command('phase', { phase: 'vote_internal' }));
    expect(calls('update canvas_proposal')[0][1]).toEqual([actor]);
    expect(calls('update canvas_control')[0][1]).toBe('vote_internal');
    expect(io.assets).not.toHaveBeenCalled();
  });
  it.each([
    'unmanaged',
    'view',
    'stale',
    'pending',
    'no-voters',
    'no-members',
    'checksum',
    'no-phase',
  ])('rejects a phase change for %s', async kind => {
    ballot({ state: 'submitted' });
    submitted = [proposal];
    const input = command('phase', { phase: 'vote_internal' });
    if (kind === 'unmanaged') project.can_manage = false;
    if (kind === 'view') input.phase = 'view';
    if (kind === 'stale') input.revision = 6;
    if (kind === 'pending') pending = [{ id: other }];
    if (kind === 'no-voters') voters = [];
    if (kind === 'no-members') members = [];
    if (kind === 'checksum') proposal.checksum = 'tampered';
    if (kind === 'no-phase') input.phase = undefined;
    await expect(canvasCommand(actor, input)).rejects.toThrow();
  });
  it('supports an empty ballot-opening phase and repeated phase updates', async () => {
    await canvasCommand(actor, command('phase', { phase: 'vote_internal' }));
    control.phase = 'vote_internal';
    await canvasCommand(actor, command('phase', { phase: 'vote_internal' }));
    await canvasCommand(actor, command('phase', { phase: 'edit' }));
    expect(calls('update canvas_control')).toHaveLength(3);
  });
  it.each([undefined, 10])(
    'opens a submitted ballot with minutes %s and tolerates repeated start requests',
    async minutes => {
      control.phase = 'vote_internal';
      ballot({ state: 'submitted' });
      await canvasCommand(actor, draft('startVote', { minutes }));
      expect(calls('update canvas_proposal')[0][1]).toEqual([actor]);
      proposal.state = 'voting';
      await canvasCommand(actor, draft('startVote'));
      expect(calls('update canvas_proposal')).toHaveLength(1);
    }
  );
  it.each(['unmanaged', 'phase', 'missing', 'draft', 'voters', 'changes', 'checksum'])(
    'protects ballot opening for %s',
    async kind => {
      control.phase = 'vote_internal';
      ballot({ state: 'submitted' });
      if (kind === 'unmanaged') project.can_manage = false;
      if (kind === 'phase') control.phase = 'edit';
      if (kind === 'draft') proposal.state = 'draft';
      if (kind === 'voters') voters = [];
      if (kind === 'changes') proposal.changes = null;
      if (kind === 'checksum') proposal.checksum = 'tampered';
      await expect(
        canvasCommand(actor, kind === 'missing' ? command('startVote') : draft('startVote'))
      ).rejects.toThrow();
    }
  );
  it.each(['capability', 'phase', 'missing', 'state', 'electorate'])(
    'denies ineligible voting for %s',
    async kind => {
      control.phase = 'vote_internal';
      ballot();
      if (kind === 'capability') rights.vote = false;
      if (kind === 'phase') control.phase = 'edit';
      if (kind === 'state') proposal.state = 'submitted';
      if (kind === 'electorate') proposal.electorate = [other];
      await expect(
        canvasCommand(
          actor,
          kind === 'missing'
            ? command('vote', { choice: 'accept' })
            : draft('vote', { choice: 'accept' })
        )
      ).rejects.toThrow('not permitted');
      expect(calls('insert into canvas_vote')).toHaveLength(0);
    }
  );
  it.each(['no-deadline', 'future', 'elapsed', 'last-vote'])(
    'records or finalizes a vote with deadline %s',
    async kind => {
      control.phase = 'vote_internal';
      ballot();
      if (kind === 'future') proposal.deadline = Date.now() + 60_000;
      if (kind === 'elapsed') proposal.deadline = Date.now() - 1;
      if (kind === 'last-vote') voteCount = 1;
      const result = await canvasCommand(actor, draft('vote', { choice: 'accept' }));
      expect(calls('insert into canvas_vote')).toHaveLength(kind === 'elapsed' ? 0 : 1);
      expect(calls('update studio_state')).toHaveLength(
        ['elapsed', 'last-vote'].includes(kind) ? 1 : 0
      );
      if (kind === 'elapsed') expect(result).toEqual({ closed: true });
    }
  );
  it.each(['closed', 'accepted', 'rejected', 'elapsed-reader'])(
    'finalizes %s ballots without bypassing the electorate',
    async kind => {
      control.phase = 'vote_internal';
      ballot();
      if (kind === 'closed') proposal.state = 'closed';
      if (kind === 'rejected') votes = [{ choice: 'reject' }];
      if (kind === 'elapsed-reader') {
        project.can_manage = false;
        proposal.deadline = Date.now() - 1;
      }
      await canvasCommand(actor, draft('finalize'));
      expect(calls('update studio_state')).toHaveLength(
        ['accepted', 'elapsed-reader'].includes(kind) ? 1 : 0
      );
      if (kind === 'rejected') expect(calls('update canvas_proposal')[0][1]).toBe('rejected');
    }
  );
  it.each([
    'missing',
    'phase',
    'no-deadline-reader',
    'future-reader',
    'not-voting',
    'electorate',
    'changes',
    'checksum',
  ])('rejects finalization for %s', async kind => {
    control.phase = 'vote_internal';
    ballot();
    if (kind === 'phase') control.phase = 'edit';
    if (kind === 'no-deadline-reader') project.can_manage = false;
    if (kind === 'future-reader') {
      project.can_manage = false;
      proposal.deadline = Date.now() + 60_000;
    }
    if (kind === 'not-voting') proposal.state = 'draft';
    if (kind === 'electorate') proposal.electorate = null;
    if (kind === 'changes') proposal.changes = null;
    if (kind === 'checksum') proposal.checksum = null;
    await expect(
      canvasCommand(actor, kind === 'missing' ? command('finalize') : draft('finalize'))
    ).rejects.toThrow();
  });
  it.each(['accepted', 'rejected'])('decides a personal AI suggestion as %s', async decision => {
    proposal.origin = 'ai';
    await canvasCommand(actor, draft(decision === 'accepted' ? 'acceptPrivate' : 'rejectPrivate'));
    expect(calls('update studio_state')).toHaveLength(decision === 'accepted' ? 1 : 0);
    expect(io.audience).toHaveBeenCalledTimes(decision === 'accepted' ? 1 : 0);
    expect(io.cleanup).toHaveBeenCalledWith(workspaceId);
  });
  it.each([
    'group',
    'phase',
    'unmanaged',
    'missing',
    'manual',
    'generating',
    'submitted',
    'revision',
    'no-changes',
  ])('protects private AI acceptance for %s', async kind => {
    proposal.origin = 'ai';
    if (kind === 'group') project.group_id = groupId;
    if (kind === 'phase') control.phase = 'suggest_internal';
    if (kind === 'unmanaged') project.can_manage = false;
    if (kind === 'manual') proposal.origin = 'manual';
    if (kind === 'generating') proposal.ai_status = 'generating';
    if (kind === 'submitted') proposal.state = 'submitted';
    if (kind === 'no-changes') proposal.document = structuredClone(proposal.base_document);
    await expect(
      canvasCommand(
        actor,
        kind === 'missing'
          ? command('acceptPrivate')
          : draft('acceptPrivate', { revision: kind === 'revision' ? 2 : 3 })
      )
    ).rejects.toThrow();
  });
  it.each(['generation', 'later-title', 'already-applied', 'superseded'])(
    'protects applying an accepted ballot from %s',
    async kind => {
      ballot({ decision: 'accepted', application: 'conflict' });
      if (kind === 'generation') proposal.base_generation = other;
      if (kind === 'later-title') canonical.document.title = 'Other editor';
      if (kind === 'already-applied') proposal.application = 'applied';
      if (kind === 'superseded') proposal.application = 'superseded';
      proposal.checksum = checksum({
        base: proposal.base_revision,
        generation: proposal.base_generation,
        changes: proposal.changes,
      });
      if (['already-applied', 'superseded'].includes(kind)) {
        // Finalization can repeat an accepted decision while its application is already complete.
        control.phase = 'vote_internal';
        await canvasCommand(actor, draft('finalize'));
        expect(calls('update studio_state')).toHaveLength(0);
      } else {
        await canvasCommand(actor, draft('reapply'));
        expect(calls('update canvas_proposal')[0][0].join('')).toContain("application='conflict'");
        expect(calls('update studio_state')).toHaveLength(0);
      }
    }
  );
  it('reapplies an accepted resolution and retains deduplicated AI provenance', async () => {
    const ref = { type: 'blog', id: other };
    project.source_references = [ref];
    ballot({
      decision: 'accepted',
      application: 'conflict',
      origin: 'ai',
      ai_sources: [ref, { type: 'event', id: actor }],
      resolves_id: other,
    });
    await canvasCommand(actor, draft('reapply'));
    expect(calls('update studio_project set source_references')[0][1]).toEqual([
      ref,
      { type: 'event', id: actor },
    ]);
    expect(calls('update canvas_proposal')).toHaveLength(2);
    expect(io.audience).toHaveBeenCalledWith(null, projectId, proposal.ai_sources, io.sql);
  });
  it.each(['unmanaged', 'missing', 'rejected', 'not-conflicted'])(
    'denies reapplication for %s',
    async kind => {
      ballot({ decision: 'accepted', application: 'conflict' });
      if (kind === 'unmanaged') project.can_manage = false;
      if (kind === 'rejected') proposal.decision = 'rejected';
      if (kind === 'not-conflicted') proposal.application = 'pending';
      await expect(
        canvasCommand(actor, kind === 'missing' ? command('reapply') : draft('reapply'))
      ).rejects.toThrow('not permitted');
    }
  );
  it.each([false, true])('adds a comment associated with workspace %s', async scoped => {
    await canvasCommand(
      actor,
      (scoped ? draft : command)('comment', {
        body: '  A comment  ',
        ...(scoped ? { elementId: 'node' } : {}),
      })
    );
    const inserted = calls('insert into canvas_comment')[0];
    expect(inserted[3]).toBe(scoped ? workspaceId : null);
    expect(inserted[5]).toBe(scoped ? 'node' : null);
    expect(inserted[6]).toBe('A comment');
  });
  it.each(['editComment', 'resolveComment'])(
    'updates an authorized %s including proposal access checks',
    async action => {
      comment.proposal_id = workspaceId;
      await canvasCommand(actor, command(action, { commentId, body: 'Edited' }));
      expect(calls('update canvas_comment')).toHaveLength(1);
    }
  );
  it.each(['no-right', 'missing', 'foreign-author', 'manager-edit', 'workspace-access'])(
    'denies comment changes for %s',
    async kind => {
      if (kind === 'no-right') rights.comment = false;
      if (kind === 'missing') comment = null;
      if (kind === 'foreign-author') {
        comment.author_id = other;
        project.can_manage = false;
      }
      if (kind === 'manager-edit') comment.author_id = other;
      if (kind === 'workspace-access') {
        comment.proposal_id = workspaceId;
        allowed = false;
      }
      await expect(
        canvasCommand(actor, command('editComment', { commentId, body: 'Edit' }))
      ).rejects.toThrow('not permitted');
    }
  );
  it('allows a manager to resolve another author’s canonical comment but denies commenting without the capability', async () => {
    comment.author_id = other;
    await canvasCommand(actor, command('resolveComment', { commentId }));
    rights.comment = false;
    await expect(canvasCommand(actor, command('comment', { body: 'Comment' }))).rejects.toThrow(
      'not permitted'
    );
  });
  it('restores a validated historical document with a fresh generation and revision', async () => {
    await canvasCommand(actor, command('restore', { historyId }));
    expect(io.assets).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      canonical.document,
      undefined
    );
    expect(calls('update studio_state')[0][1]).toEqual(canonical.document);
  });
  it.each(['unmanaged', 'phase', 'revision', 'active', 'history'])(
    'rejects restoration for %s',
    async kind => {
      if (kind === 'unmanaged') project.can_manage = false;
      if (kind === 'phase') control.phase = 'vote_internal';
      if (kind === 'active') active = [{ id: workspaceId }];
      if (kind === 'history') history = null;
      await expect(
        canvasCommand(
          actor,
          command('restore', { historyId, revision: kind === 'revision' ? 6 : 7 })
        )
      ).rejects.toThrow();
    }
  );
  it('saves an owned reusable library and checks current project edit authority', async () => {
    await canvasCommand(
      actor,
      command('saveLibrary', { title: 'Library', library: [{ content: 'Reusable' }] })
    );
    expect(calls('delete from canvas_library')).toHaveLength(1);
    expect(calls('insert into canvas_library')[0][3]).toEqual([{ content: 'Reusable' }]);
    project.can_edit = false;
    await expect(
      canvasCommand(actor, command('saveLibrary', { title: 'Library', library: [] }))
    ).rejects.toThrow('not permitted');
  });
  it.each([false, true])('sets a valid group role capability to %s', async value => {
    project.group_id = groupId;
    await canvasCommand(
      actor,
      command('setCapability', { roleId, capability: 'vote', allowed: value })
    );
    expect(calls('insert into canvas_role_capability')[0].slice(1, 4)).toEqual([
      roleId,
      'vote',
      value,
    ]);
  });
  it.each(['unmanaged', 'personal', 'role'])(
    'denies role capability changes for %s',
    async kind => {
      project.group_id = groupId;
      if (kind === 'unmanaged') project.can_manage = false;
      if (kind === 'personal') project.group_id = null;
      if (kind === 'role') role = null;
      await expect(
        canvasCommand(
          actor,
          command('setCapability', { roleId, capability: 'vote', allowed: true })
        )
      ).rejects.toThrow('not permitted');
    }
  );
  it('adopts a personal project only after checking group rights and every source reader', async () => {
    expect(await canvasCommand(actor, command('adopt', { groupId }))).toEqual({ groupId });
    expect(io.sharing).toHaveBeenCalledWith(projectId, [actor], 'private', io.sql);
    expect(calls('update studio_state')).toHaveLength(1);
  });
  it.each(['group', 'owner', 'phase', 'revision', 'access', 'source'])(
    'rejects project adoption for %s',
    async kind => {
      if (kind === 'group') project.group_id = other;
      if (kind === 'owner') project.owner_id = other;
      if (kind === 'phase') control.phase = 'vote_internal';
      if (kind === 'access') allowed = false;
      if (kind === 'source') io.sharing.mockRejectedValueOnce(new Error('Private source'));
      await expect(
        canvasCommand(actor, command('adopt', { groupId, revision: kind === 'revision' ? 6 : 7 }))
      ).rejects.toThrow();
      expect(calls('update studio_project')).toHaveLength(0);
    }
  );
  it('logs cleanup failures after returning a successful withdrawn operation', async () => {
    io.cleanup.mockRejectedValueOnce(new Error('storage down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await canvasCommand(actor, draft('withdraw'))).toEqual({ ok: true });
      expect(log).toHaveBeenCalledWith('Cannot clean up rejected AI media', expect.any(Error));
    } finally {
      log.mockRestore();
    }
  });
  it('validates proposal media and chart files in the locked transaction before moving them into canonical scope', async () => {
    const image = crypto.randomUUID();
    const chartFile = crypto.randomUUID();
    const legacy = createDocument('single', 'Media');
    legacy.pages[0].elements.push(
      element('image', { assetId: image }),
      element('chart'),
      element('chart'),
      element('chart')
    );
    const additions = legacyDocumentToV3(legacy).nodes.filter(
      node => node.type === 'media' || node.type === 'chart'
    );
    additions.forEach(node => {
      node.parentFrameId = canonical.document.nodes.find(
        (candidate: any) => candidate.type === 'frame'
      ).id;
    });
    const charts = additions.filter(node => node.type === 'chart');
    charts[0].sourceAssetId = image;
    charts[1].sourceAssetId = chartFile;
    proposal.document.nodes.push(...additions);
    Object.assign(io.sql, {
      unsafe: vi.fn().mockResolvedValue([{ id: image }, { id: chartFile }]),
    });
    proposal.origin = 'ai';
    await canvasCommand(actor, draft('acceptPrivate'));
    const unsafe = (io.sql as unknown as { unsafe: ReturnType<typeof vi.fn> }).unsafe;
    expect(unsafe).toHaveBeenCalledWith(
      expect.stringContaining('workspace_id is null or workspace_id=$3'),
      [projectId, [image, chartFile], workspaceId]
    );
    expect(calls('update studio_asset set workspace_id=null')[0][1]).toBe(workspaceId);
    const published = calls('update studio_asset set workspace_id=null')[0][2] as {
      values: string[];
    };
    expect([...published.values].sort()).toEqual([image, image, chartFile].sort());
  });
  it('shares a manual draft without requesting AI-source audience checks', async () => {
    await canvasCommand(actor, draft('share', { userIds: [other] }));
    expect(io.audience).not.toHaveBeenCalled();
    expect(calls('update canvas_proposal')[0][1]).toEqual([other]);
  });
});
