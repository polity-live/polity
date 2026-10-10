import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import { checksum } from '../../../src/server/checksum';
import { createStudioDocumentV5 } from '../../../src/features/communication-studio/logic/document-v3';
import type { MutationCase } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import { groupAdminFixture } from './mutation-governance-fixtures';

export const canvasActions = [
  'phase',
  'createDraft',
  'resolveDraft',
  'saveDraft',
  'share',
  'submit',
  'withdraw',
  'startVote',
  'vote',
  'finalize',
  'reapply',
  'acceptPrivate',
  'rejectPrivate',
  'adopt',
  'comment',
  'editComment',
  'resolveComment',
  'restore',
  'saveLibrary',
  'setCapability',
] as const;
type Action = (typeof canvasActions)[number];
type Actor = 'owner' | 'outsider' | 'anonymous';
type Mode =
  | 'normal'
  | 'generation-conflict'
  | 'revision-conflict'
  | 'collaborator'
  | 'rights-denied'
  | 'merge-conflict'
  | 'open-ballots'
  | 'revoked-collaborator'
  | 'capability-denied';
type Row = Record<string, unknown>;
const object = (value: unknown): Row | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : undefined;
const fields = (value: unknown, expected: Row) => {
  const row = object(value);
  return !!row && Object.entries(expected).every(([key, val]) => isDeepStrictEqual(row[key], val));
};

function canvasCase(action: Action, actor: Actor, mode: Mode = 'normal'): MutationCase {
  const successful =
    (actor === 'owner' && !['generation-conflict', 'revision-conflict'].includes(mode)) ||
    mode === 'collaborator';
  const rejected = !successful;
  const variant = `canvas-${action}-${mode === 'normal' ? (successful ? 'authorized' : `${actor}-denied`) : mode}`;
  return {
    name: 'studio.canvas.command',
    variant,
    actor,
    outcome: actor === 'anonymous' ? 'client-error' : rejected ? 'server-error' : 'success',
    ...(rejected
      ? {
          error: ['generation-conflict', 'revision-conflict'].includes(mode)
            ? 'project_revision_conflict'
            : 'permission_denied',
        }
      : {}),
    observer: {
      query:
        mode === 'collaborator'
          ? action === 'comment'
            ? 'studio.comments'
            : 'studio.proposals'
          : 'studio.canvasReceipt',
    },
    specification: {
      action,
      actor,
      mode,
      fixture:
        action === 'setCapability' || mode === 'capability-denied'
          ? 'fresh private group v5 project with real owned group and scoped role; canonical revision 0 and owned generation'
          : 'fresh private personal v5 project; literal title-only proposal, canonical revision 0, owned generation',
      transition: rejected ? 'unchanged graph, no receipt' : action,
      proposalPatch: { path: ['title'], before: 'Fixture canvas', after: 'Changed canvas' },
      vote: 'literal one-person accept majority (or two accepted collaborators), real electorate and integrity checksum',
      cleanup:
        'owned proposals, reader links, votes, comments, library, receipts, history, controls and project absent; scoped role capability and group absent',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const id = (label: string) => mutationFixtureID(ctx.id, label);
      const project = id('canvas-project'),
        generation = id('canvas-generation'),
        operation = id('canvas-operation');
      const workspace = id('canvas-workspace'),
        comment = id('canvas-comment'),
        history = id('canvas-history');
      const collaborator = id('canvas-collaborator'),
        role = id('canvas-role');
      const canonical = createStudioDocumentV5('Fixture canvas');
      const changed = { ...canonical, title: 'Changed canvas' };
      const historical = { ...canonical, title: 'Historical canvas' };
      const patch = [
        {
          path: ['title'],
          before: { exists: true, value: 'Fixture canvas' },
          after: { exists: true, value: 'Changed canvas' },
        },
      ];
      const digest = checksum({ base: 0, generation, changes: patch });
      const grouped = action === 'setCapability' || mode === 'capability-denied';
      const group =
        grouped || action === 'adopt' ? await groupAdminFixture(f, ctx, 'canvas-group') : null;
      if (grouped)
        await f.insert('role', {
          id: role,
          scope: 'group',
          group_id: group,
          name: 'Canvas scoped role',
        });
      if (mode === 'capability-denied') {
        const membership = id('canvas-member');
        await f.insert('group_membership', {
          id: membership,
          group_id: group,
          user_id: ctx.outsiderID,
          status: 'active',
          source: 'direct',
          visibility: 'public',
        });
        await f.insert('group_membership_role', {
          id: id('canvas-member-role'),
          group_membership_id: membership,
          role_id: role,
          assigned_by_id: ctx.ownerID,
        });
        await f.insert('action_right', {
          id: id('canvas-member-right'),
          role_id: role,
          group_id: group,
          resource: 'projects',
          action: 'manage',
        });
        await ctx.sql`insert into canvas_role_capability(role_id,capability,allowed) values(${role},'comment',false)`;
      }
      await f.insert('studio_project', {
        id: project,
        owner_id: ctx.ownerID,
        group_id: grouped ? group : null,
        title: canonical.title,
        kind: 'single',
        visibility: 'private',
        document_schema_version: 5,
        created_at: 0,
        updated_at: 0,
      });
      const phase = ['resolveDraft', 'startVote', 'vote', 'finalize', 'reapply'].includes(action)
        ? 'vote_internal'
        : mode === 'open-ballots'
          ? 'suggest_internal'
          : 'edit';
      await ctx.sql`insert into canvas_control(project_id,phase,generation) values(${project},${phase},${generation})`;
      await ctx.sql`insert into studio_state(project_id,document,content_revision,updated_at) values(${project},${ctx.sql.json(canonical as never)},0,0)`;
      const acceptedCollaborator =
        action === 'share' ||
        mode === 'collaborator' ||
        mode === 'rights-denied' ||
        mode === 'revoked-collaborator';
      if (acceptedCollaborator)
        await f.insert('studio_project_collaborator', {
          id: collaborator,
          project_id: project,
          user_id: ctx.outsiderID,
          status: mode === 'revoked-collaborator' ? 'revoked' : 'active',
          invited_by_id: ctx.ownerID,
          created_at: 0,
          updated_at: 0,
        });
      await f.track('canvas_receipt', operation);
      await f.track('studio_command_receipt', operation);
      await f.track('canvas_proposal', workspace);
      await f.track('canvas_proposal', operation);
      await f.track('canvas_comment', comment);
      await f.track('canvas_comment', operation);
      await f.trackScope('canvas_library', 'project_id', project);
      const needsProposal =
        [
          'resolveDraft',
          'saveDraft',
          'share',
          'submit',
          'withdraw',
          'startVote',
          'vote',
          'finalize',
          'reapply',
          'acceptPrivate',
          'rejectPrivate',
        ].includes(action) || mode === 'open-ballots';
      const submitted = action === 'startVote' || mode === 'open-ballots';
      const voting = action === 'vote' || action === 'finalize';
      const conflicted = action === 'resolveDraft' || action === 'reapply';
      const ai = action === 'acceptPrivate' || action === 'rejectPrivate';
      const electorate =
        mode === 'collaborator' ? [ctx.ownerID, ctx.outsiderID].sort() : [ctx.ownerID];
      const proposal = {
        id: workspace,
        project_id: project,
        owner_id: ctx.ownerID,
        title: 'Fixture proposal',
        reason: 'Fixture reason',
        base_document: canonical,
        base_revision: 0,
        base_generation: generation,
        document:
          mode === 'merge-conflict'
            ? { ...canonical, title: 'Concurrent canvas' }
            : action === 'saveDraft'
              ? canonical
              : changed,
        revision: 0,
        state: submitted ? 'submitted' : voting ? 'voting' : conflicted ? 'closed' : 'draft',
        decision: conflicted ? 'accepted' : null,
        application: conflicted ? 'conflict' : 'pending',
        changes: submitted || voting || conflicted ? patch : null,
        checksum: submitted || voting || conflicted ? digest : null,
        electorate: voting ? electorate : null,
        deadline: null,
        conflicts: conflicted ? [{ reason: 'fixture-conflict' }] : [],
        origin: ai ? 'ai' : 'human',
        ai_status: 'ready',
        ai_sources: [],
        shared_ids: [] as string[],
      };
      if (needsProposal)
        await f.insert('canvas_proposal', {
          ...proposal,
          document: ctx.sql.json(proposal.document as never),
          base_document: ctx.sql.json(canonical as never),
          changes: proposal.changes ? ctx.sql.json(patch) : null,
          conflicts: ctx.sql.json(proposal.conflicts),
          ai_sources: ctx.sql.json([]),
          created_at: 0,
          updated_at: 0,
        });
      if (action === 'finalize' || (mode === 'collaborator' && action === 'vote'))
        await ctx.sql`insert into canvas_vote(proposal_id,user_id,choice,created_at) values(${workspace},${ctx.ownerID},'accept',0)`;
      if (action === 'editComment' || action === 'resolveComment')
        await f.insert('canvas_comment', {
          id: comment,
          project_id: project,
          proposal_id: null,
          author_id: ctx.ownerID,
          body: 'Fixture comment',
          resolved: false,
          created_at: 0,
          updated_at: 0,
        });
      if (action === 'restore')
        await f.insert('canvas_history', {
          id: history,
          project_id: project,
          revision: 7,
          generation,
          document: ctx.sql.json(historical as never),
          created_at: 0,
        });
      const revision = mode === 'revision-conflict' ? 1 : 0;
      const common = {
        projectId: project,
        operationId: operation,
        generation: mode === 'generation-conflict' ? id('stale-generation') : generation,
      };
      const input: Record<Action, ReadonlyJSONValue> = {
        phase: {
          ...common,
          action,
          revision,
          phase: mode === 'open-ballots' ? 'vote_internal' : 'suggest_internal',
        },
        createDraft: { ...common, action, revision, title: 'New draft', reason: 'New reason' },
        resolveDraft: {
          ...common,
          action,
          revision,
          workspaceId: workspace,
          title: 'Resolution draft',
          reason: 'Resolution reason',
        },
        saveDraft: { ...common, action, revision, workspaceId: workspace, changes: patch },
        share: { ...common, action, revision, workspaceId: workspace, userIds: [ctx.outsiderID] },
        submit: { ...common, action, revision, workspaceId: workspace },
        withdraw: { ...common, action, workspaceId: workspace },
        startVote: { ...common, action, workspaceId: workspace, minutes: 5 },
        vote: { ...common, action, workspaceId: workspace, choice: 'accept' },
        finalize: { ...common, action, workspaceId: workspace },
        reapply: { ...common, action, workspaceId: workspace },
        acceptPrivate: { ...common, action, revision, workspaceId: workspace },
        rejectPrivate: { ...common, action, revision, workspaceId: workspace },
        adopt: { ...common, action, revision, groupId: group },
        comment: { ...common, action, body: 'New canvas comment' },
        editComment: { ...common, action, commentId: comment, body: 'Edited canvas comment' },
        resolveComment: { ...common, action, commentId: comment },
        restore: { ...common, action, revision, historyId: history },
        saveLibrary: {
          ...common,
          action,
          title: 'Fixture library',
          library: [{ label: 'Fixture item' }],
        },
        setCapability: { ...common, action, roleId: role, capability: 'comment', allowed: false },
      };
      const before = (data: unknown) =>
        mode === 'collaborator'
          ? action === 'comment'
            ? Array.isArray(data) && data.length === 0
            : Array.isArray(data) &&
              data.some(row => fields(row, { id: workspace, state: 'voting' }))
          : data === null || data === undefined;
      const after = (data: unknown) =>
        rejected
          ? before(data)
          : mode === 'collaborator'
            ? action === 'comment'
              ? Array.isArray(data) &&
                data.some(row =>
                  fields(row, {
                    id: operation,
                    author_id: ctx.outsiderID,
                    body: 'New canvas comment',
                  })
                )
              : Array.isArray(data) &&
                data.some(row =>
                  fields(row, {
                    id: workspace,
                    state: 'closed',
                    decision: 'accepted',
                    application: 'applied',
                  })
                )
            : fields(data, { id: operation, actor_id: ctx.actorID });
      const request =
        mode === 'collaborator'
          ? action === 'comment'
            ? queries.studio.comments({ projectId: project })
            : queries.studio.proposals({ projectId: project })
          : queries.studio.canvasReceipt({ operationId: operation });
      const preparationTime = Date.now();
      return {
        args: input[action],
        observe: { request, before, after },
        async verify() {
          await f.expect(
            'canvas_receipt',
            operation,
            rejected ? null : { project_id: project, actor_id: ctx.actorID }
          );
          await f.expect('studio_command_receipt', operation, null);
          await f.expect(
            'studio_project_collaborator',
            collaborator,
            acceptedCollaborator
              ? {
                  project_id: project,
                  user_id: ctx.outsiderID,
                  status: mode === 'revoked-collaborator' ? 'revoked' : 'active',
                }
              : null
          );
          const applies =
            successful && ['vote', 'finalize', 'reapply', 'acceptPrivate'].includes(action);
          const advances = applies || (successful && ['adopt', 'restore'].includes(action));
          const expectedDocument = applies
            ? changed
            : successful && action === 'restore'
              ? historical
              : canonical;
          const [state] =
            await ctx.sql`select document,content_revision from studio_state where project_id=${project}`;
          assert.deepEqual(state, {
            document: expectedDocument,
            content_revision: advances ? 1 : 0,
          });
          await f.expect('studio_project', project, {
            title: expectedDocument.title,
            group_id: successful && action === 'adopt' ? group : grouped ? group : null,
            owner_id: ctx.ownerID,
          });
          const [control] =
            await ctx.sql`select phase,generation from canvas_control where project_id=${project}`;
          assert.equal(
            control.phase,
            successful && action === 'phase'
              ? mode === 'open-ballots'
                ? 'vote_internal'
                : 'suggest_internal'
              : phase
          );
          assert(
            successful && ['adopt', 'restore'].includes(action)
              ? control.generation !== generation
              : control.generation === generation
          );
          const historyRows =
            await ctx.sql`select revision,generation,document from canvas_history where project_id=${project} order by revision`;
          const expectedHistory = [{ revision: 0, generation, document: canonical }];
          if (advances)
            expectedHistory.push({
              revision: 1,
              generation: control.generation,
              document: expectedDocument,
            });
          if (action === 'restore')
            expectedHistory.push({ revision: 7, generation, document: historical });
          assert.deepEqual(Array.from(historyRows), expectedHistory);
          if (successful && action !== 'saveDraft') {
            const result = ['createDraft', 'resolveDraft'].includes(action)
              ? { workspaceId: operation }
              : ['acceptPrivate', 'rejectPrivate'].includes(action)
                ? { decision: action === 'acceptPrivate' ? 'accepted' : 'rejected' }
                : action === 'adopt'
                  ? { groupId: group }
                  : { ok: true };
            await f.expect('canvas_receipt', operation, {
              input_hash: checksum(input[action]),
              result,
            });
          }
          if (needsProposal) {
            const expected = { ...proposal };
            if (successful)
              switch (action) {
                case 'saveDraft':
                  if (mode !== 'merge-conflict') {
                    expected.document = changed;
                    expected.revision = 1;
                  }
                  break;
                case 'share':
                  expected.shared_ids = [ctx.outsiderID];
                  break;
                case 'submit':
                  expected.state = 'submitted';
                  expected.changes = patch;
                  expected.checksum = digest;
                  break;
                case 'withdraw':
                  expected.state = 'withdrawn';
                  expected.application = 'not_applicable';
                  break;
                case 'startVote':
                  expected.state = 'voting';
                  expected.electorate = electorate;
                  break;
                case 'vote':
                case 'finalize':
                case 'acceptPrivate':
                case 'reapply':
                  expected.state = 'closed';
                  expected.decision = 'accepted';
                  expected.application = 'applied';
                  expected.conflicts = [];
                  if (action === 'acceptPrivate') {
                    expected.changes = patch;
                    expected.checksum = digest;
                  }
                  break;
                case 'rejectPrivate':
                  expected.state = 'closed';
                  expected.decision = 'rejected';
                  expected.application = 'not_applicable';
                  expected.changes = [];
                  break;
                case 'phase':
                  if (mode === 'open-ballots') {
                    expected.state = 'voting';
                    expected.electorate = electorate;
                  }
                  break;
              }
            const { deadline: ignored, ...expectation } = expected;
            void ignored;
            await f.expect('canvas_proposal', workspace, expectation);
            const [stored] = await f.rows('canvas_proposal', workspace);
            if (successful && action === 'startVote')
              assert(
                Number(stored.deadline) >= preparationTime + 300_000 &&
                  Number(stored.deadline) <= Date.now() + 300_000
              );
            else assert.equal(stored.deadline, null);
          }
          await f.expect(
            'canvas_proposal',
            operation,
            successful && ['createDraft', 'resolveDraft'].includes(action)
              ? {
                  project_id: project,
                  owner_id: ctx.ownerID,
                  title: action === 'createDraft' ? 'New draft' : 'Resolution draft',
                  reason: action === 'createDraft' ? 'New reason' : 'Resolution reason',
                  state: 'draft',
                  revision: 0,
                  base_document: canonical,
                  base_revision: 0,
                  base_generation: generation,
                  document: canonical,
                  resolves_id: action === 'resolveDraft' ? workspace : null,
                  shared_ids: [],
                }
              : null
          );
          const votes =
            await ctx.sql`select user_id,choice from canvas_vote where proposal_id=${workspace} order by user_id`;
          const expectedVoters =
            action === 'finalize' || (mode === 'collaborator' && action === 'vote')
              ? [ctx.ownerID]
              : [];
          if (successful && action === 'vote') expectedVoters.push(ctx.actorID);
          assert.deepEqual(
            Array.from(votes),
            expectedVoters.sort().map(user_id => ({ user_id, choice: 'accept' }))
          );
          await f.expect(
            'canvas_comment',
            operation,
            successful && action === 'comment'
              ? {
                  project_id: project,
                  author_id: ctx.actorID,
                  body: 'New canvas comment',
                  resolved: false,
                }
              : null
          );
          await f.expect(
            'canvas_comment',
            comment,
            ['editComment', 'resolveComment'].includes(action)
              ? {
                  author_id: ctx.ownerID,
                  body:
                    successful && action === 'editComment'
                      ? 'Edited canvas comment'
                      : 'Fixture comment',
                  resolved: successful && action === 'resolveComment',
                }
              : null
          );
          const readers =
            await ctx.sql`select user_id from canvas_workspace_reader where workspace_id=${workspace} order by user_id`;
          assert.deepEqual(
            Array.from(readers),
            successful && action === 'share' ? [{ user_id: ctx.outsiderID }] : []
          );
          const libraries =
            await ctx.sql`select name,content,created_by from canvas_library where project_id=${project}`;
          assert.deepEqual(
            Array.from(libraries),
            successful && action === 'saveLibrary'
              ? [
                  {
                    name: 'Fixture library',
                    content: [{ label: 'Fixture item' }],
                    created_by: ctx.ownerID,
                  },
                ]
              : []
          );
          if (grouped)
            assert.deepEqual(
              Array.from(
                await ctx.sql`select capability,allowed from canvas_role_capability where role_id=${role}`
              ),
              successful || mode === 'capability-denied'
                ? [{ capability: 'comment', allowed: false }]
                : []
            );
          if (successful && action === 'saveDraft') {
            const [receipt] = await f.rows('canvas_receipt', operation);
            assert.deepEqual(receipt.result, {
              operationId: operation,
              document: mode === 'merge-conflict' ? proposal.document : changed,
              revision: mode === 'merge-conflict' ? 0 : 1,
              status: mode === 'merge-conflict' ? 'conflict' : 'applied',
              conflicts:
                mode === 'merge-conflict'
                  ? [
                      {
                        path: ['title'],
                        base: 'Fixture canvas',
                        local: 'Changed canvas',
                        remote: 'Concurrent canvas',
                      },
                    ]
                  : [],
            });
          }
        },
        async restore() {
          await ctx.sql`delete from canvas_vote where proposal_id in (${workspace},${operation})`;
          await ctx.sql`delete from canvas_workspace_reader where workspace_id in (${workspace},${operation})`;
          if (grouped) await ctx.sql`delete from canvas_role_capability where role_id=${role}`;
          await f.restore();
        },
        async verifyRestored() {
          await f.verifyRestored();
          for (const table of [
            'studio_state',
            'canvas_control',
            'canvas_history',
            'canvas_proposal',
            'canvas_comment',
            'canvas_receipt',
            'canvas_library',
          ])
            assert.equal(
              (await ctx.sql`select * from ${ctx.sql(table)} where project_id=${project}`).length,
              0
            );
          assert.equal(
            (
              await ctx.sql`select * from canvas_vote where proposal_id in (${workspace},${operation})`
            ).length,
            0
          );
          assert.equal(
            (
              await ctx.sql`select * from canvas_workspace_reader where workspace_id in (${workspace},${operation})`
            ).length,
            0
          );
          if (grouped)
            assert.equal(
              (await ctx.sql`select * from canvas_role_capability where role_id=${role}`).length,
              0
            );
          if (group)
            assert.equal(
              (await ctx.sql`select * from search_document where entity_id=${group}`).length,
              0
            );
        },
      };
    },
  };
}

export function canvasMutationCases(): MutationCase[] {
  return [
    ...canvasActions.flatMap(action =>
      (['owner', 'outsider', 'anonymous'] as const).map(actor => canvasCase(action, actor))
    ),
    ...canvasActions.map(action => canvasCase(action, 'owner', 'generation-conflict')),
    ...canvasActions.map(action => canvasCase(action, 'outsider', 'revoked-collaborator')),
    ...(['phase', 'createDraft', 'resolveDraft', 'saveDraft', 'share', 'submit'] as const).map(
      action => canvasCase(action, 'owner', 'revision-conflict')
    ),
    ...(
      [
        'phase',
        'startVote',
        'finalize',
        'reapply',
        'acceptPrivate',
        'rejectPrivate',
        'restore',
      ] as const
    ).map(action => canvasCase(action, 'outsider', 'rights-denied')),
    canvasCase('comment', 'outsider', 'capability-denied'),
    canvasCase('comment', 'outsider', 'collaborator'),
    canvasCase('vote', 'outsider', 'collaborator'),
    canvasCase('saveDraft', 'owner', 'merge-conflict'),
    canvasCase('phase', 'owner', 'open-ballots'),
  ];
}

export function studioApplyConflictCases(): MutationCase[] {
  return (
    [
      'future-revision',
      'stale-generation',
      'stale-revision-merge-conflict',
      'stale-revision-compatible',
      'revoked-collaborator',
      'rights-revoked-after-writer-preload',
    ] as const
  ).map(mode => {
    const revoked = mode.includes('revoked');
    const stale = mode.startsWith('stale-revision');
    const success = stale;
    return {
      name: 'studio.apply',
      variant: mode,
      actor: revoked ? 'outsider' : 'owner',
      outcome: success ? 'success' : 'server-error',
      ...(success ? {} : { error: 'mutation_server_failed' }),
      observer: { query: revoked ? 'studio.document' : 'studio.operation' },
      specification: {
        mode,
        startingRevision: 0,
        currentRevision: stale ? 1 : 0,
        expected:
          mode === 'stale-revision-merge-conflict'
            ? 'successful durable conflict receipt; concurrent canonical title and revision 1 unchanged'
            : mode === 'stale-revision-compatible'
              ? 'historical revision accepted; literal compatible title patch applied at revision 2'
              : 'server rejection; no operation; canonical document unchanged',
        permission: revoked
          ? 'actual personal collaborator revoked; studio read access is redacted; writer settles to null'
          : 'project owner',
        cleanup:
          'fresh owned project, operation, collaborator, canonical state, control and history absent',
      },
      async prepare(ctx) {
        const f = new MutationFixtures(ctx.sql),
          id = (label: string) => mutationFixtureID(ctx.id, label);
        const project = id('apply-project'),
          operation = id('apply-operation'),
          generation = id('apply-generation'),
          collaborator = id('apply-collaborator');
        const original = createStudioDocumentV5('Fixture canvas');
        const current =
          mode === 'stale-revision-merge-conflict'
            ? { ...original, title: 'Concurrent canvas' }
            : original;
        const changed = { ...original, title: 'Changed canvas' };
        const revision = stale ? 1 : 0;
        const changes = [
          {
            path: ['title'],
            before: { exists: true, value: 'Fixture canvas' },
            after: { exists: true, value: 'Changed canvas' },
          },
        ];
        await f.insert('studio_project', {
          id: project,
          owner_id: ctx.ownerID,
          group_id: null,
          title: current.title,
          kind: 'single',
          visibility: 'private',
          document_schema_version: 5,
          created_at: 0,
          updated_at: 0,
        });
        await ctx.sql`insert into canvas_control(project_id,phase,generation) values(${project},'edit',${generation})`;
        await ctx.sql`insert into studio_state(project_id,document,content_revision,updated_at) values(${project},${ctx.sql.json(current as never)},${revision},0)`;
        if (stale)
          await ctx.sql`insert into canvas_history(project_id,revision,generation,document,created_at) values(${project},0,${generation},${ctx.sql.json(original as never)},0)`;
        if (revoked)
          await f.insert('studio_project_collaborator', {
            id: collaborator,
            project_id: project,
            user_id: ctx.outsiderID,
            status: mode === 'revoked-collaborator' ? 'revoked' : 'active',
            invited_by_id: ctx.ownerID,
            created_at: 0,
            updated_at: 0,
          });
        await f.track('studio_operation', operation);
        const before = (value: unknown) =>
          fields(value, { project_id: project, document: current, content_revision: revision });
        const expected = mode === 'stale-revision-compatible' ? changed : current;
        const expectedRevision = mode === 'stale-revision-compatible' ? 2 : revision;
        const documentRequest = queries.studio.document({ id: project });
        const request = revoked
          ? documentRequest
          : queries.studio.operation({ projectId: project, operationId: operation });
        return {
          args: {
            projectId: project,
            operationId: operation,
            generation: mode === 'stale-generation' ? id('wrong-generation') : generation,
            expectedRevision: mode === 'future-revision' ? 1 : 0,
            changes,
          },
          observe: {
            request,
            before: revoked ? before : value => value === null || value === undefined,
            after: revoked
              ? before
              : success
                ? value =>
                    fields(value, { id: operation, actor_id: ctx.ownerID }) &&
                    fields(object(value)?.result, {
                      status: mode === 'stale-revision-merge-conflict' ? 'conflict' : 'applied',
                      revision: expectedRevision,
                      document: expected,
                    })
                : value => value === null || value === undefined,
          },
          ...(mode === 'rights-revoked-after-writer-preload'
            ? {
                requireWriterBefore: true,
                beforeInvoke: async () => {
                  await f.update('studio_project_collaborator', collaborator, {
                    status: 'revoked',
                  });
                },
              }
            : {}),
          ...(revoked
            ? {
                async verifyRollback(writer: unknown) {
                  const client = writer as {
                    materialize: (
                      request: unknown,
                      options: { ttl: string }
                    ) => {
                      addListener: (listener: (value: unknown, type: string) => void) => () => void;
                      destroy: () => void;
                    };
                  };
                  const view = client.materialize(documentRequest, { ttl: 'none' });
                  try {
                    await new Promise<void>((resolve, reject) => {
                      const timer = setTimeout(() => {
                        unsubscribe();
                        reject(
                          new Error('Revoked studio writer did not settle to redacted document')
                        );
                      }, 15_000);
                      let unsubscribe = () => {
                        /* Listener is installed immediately below. */
                      };
                      unsubscribe = view.addListener((value, type) => {
                        if (type === 'complete' && (value === null || value === undefined)) {
                          clearTimeout(timer);
                          resolve();
                        }
                      });
                    });
                  } finally {
                    view.destroy();
                  }
                },
              }
            : {}),
          async verify() {
            const [state] =
              await ctx.sql`select document,content_revision from studio_state where project_id=${project}`;
            assert.deepEqual(state, { document: expected, content_revision: expectedRevision });
            await f.expect('studio_project', project, {
              title: expected.title,
              owner_id: ctx.ownerID,
              group_id: null,
            });
            const [control] =
              await ctx.sql`select phase,generation from canvas_control where project_id=${project}`;
            assert.deepEqual(control, { phase: 'edit', generation });
            const result = {
              operationId: operation,
              status: mode === 'stale-revision-merge-conflict' ? 'conflict' : 'applied',
              revision: expectedRevision,
              document: expected,
              conflicts:
                mode === 'stale-revision-merge-conflict'
                  ? [
                      {
                        path: ['title'],
                        base: 'Fixture canvas',
                        local: 'Changed canvas',
                        remote: 'Concurrent canvas',
                      },
                    ]
                  : [],
            };
            await f.expect(
              'studio_operation',
              operation,
              success ? { project_id: project, actor_id: ctx.ownerID, changes, result } : null
            );
            const historyRows =
              await ctx.sql`select revision,generation,document from canvas_history where project_id=${project} order by revision`;
            const expectedHistory = stale
              ? [
                  { revision: 0, generation, document: original },
                  { revision: 1, generation, document: current },
                ]
              : [{ revision: 0, generation, document: current }];
            if (mode === 'stale-revision-compatible')
              expectedHistory.push({ revision: 2, generation, document: changed });
            assert.deepEqual(Array.from(historyRows), expectedHistory);
            if (revoked)
              await f.expect('studio_project_collaborator', collaborator, {
                status: 'revoked',
                user_id: ctx.outsiderID,
              });
          },
          restore: () => f.restore(),
          async verifyRestored() {
            await f.verifyRestored();
            for (const table of [
              'studio_state',
              'canvas_control',
              'canvas_history',
              'studio_operation',
              'studio_project_collaborator',
            ])
              assert.equal(
                (await ctx.sql`select * from ${ctx.sql(table)} where project_id=${project}`).length,
                0
              );
          },
        };
      },
    } satisfies MutationCase;
  });
}
