import assert from 'node:assert/strict';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import type { MutationCase, MutationCaseContext } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import { reviewedRowMutationCases, type MutationRowPlan } from './mutation-cases-core';
import { groupAdminFixture, eventAdminFixture } from './mutation-governance-fixtures';

type Fields = Record<string, unknown>;
type Build = (ctx: MutationCaseContext, id: (label: string) => string) => MutationRowPlan;
const amendmentInput = {
  code: null,
  title: 'Before',
  reason: null,
  category: null,
  preamble: null,
  group_id: null,
  event_id: null,
  clone_source_id: null,
  document_id: null,
  country: null,
  region: null,
  post_code: null,
  city: null,
  street: null,
  house_number: null,
  latitude: null,
  longitude: null,
  tags: [],
  visibility: 'private',
  discussions: [],
  image_url: null,
  video_url: null,
  x: null,
  youtube: null,
  linkedin: null,
  website: null,
};
const cityDesign = {
  title: 'Before',
  bbox: null,
  center_lat: null,
  center_lon: null,
  osm_snapshot: null,
  design_state: null,
  currency: 'EUR',
  estimated_total_cost_minor: 0,
  cost_catalog_version: null,
  cost_summary: null,
};
const processRun = {
  root_workflow_id: null,
  selected_source_group_id: null,
  selected_target_group_id: null,
  selected_target_workflow_id: null,
  active_branch_id: null,
  terminal_step_run_id: null,
  status: 'pending_event',
  evaluation_mode: null,
  evaluation_date: null,
  evaluation_offset_months: null,
  evaluation_offset_years: null,
  implementation_status: null,
};
const branch = {
  parent_branch_id: null,
  merged_into_branch_id: null,
  source_step_run_id: null,
  document_version_id: null,
  document_id: null,
  discussions: [],
  title: 'Before',
  status: 'pending_event',
  editing_mode: 'edit',
  resolution: null,
};
const step = {
  workflow_id: null,
  workflow_step_id: null,
  step_kind: 'group_vote',
  selection_mode: null,
  merge_strategy: null,
  status: 'pending_event',
  source_group_id: null,
  target_group_id: null,
  event_id: null,
  agenda_item_id: null,
  vote_id: null,
  support_confirmation_id: null,
  decision_status: null,
  order_index: 0,
  starts_at: null,
  ends_at: null,
};
const task = {
  branch_id: null,
  step_run_id: null,
  task_type: 'schedule_event',
  status: 'open',
  title: 'Before',
  description: null,
  group_id: null,
  target_group_id: null,
  event_id: null,
  agenda_item_id: null,
  support_confirmation_id: null,
  due_at: null,
  resolved_at: null,
  metadata: null,
};
async function baseFixture(
  f: MutationFixtures,
  ctx: MutationCaseContext,
  amendmentID: string,
  create = false
) {
  await f.track('user', ctx.ownerID);
  if (!create)
    await f.insert('amendment', {
      id: amendmentID,
      created_by_id: ctx.ownerID,
      title: 'Before',
      visibility: 'public',
      discussions: [],
    });
  for (const table of [
    'role',
    'action_right',
    'amendment_collaborator',
    'amendment_activity',
    'notification',
  ])
    await f.trackScope(
      table,
      table === 'notification' ? 'related_amendment_id' : 'amendment_id',
      amendmentID
    );
  await f.trackScope('notification', 'recipient_amendment_id', amendmentID);
  await f.trackScope('notification', 'recipient_entity_id', amendmentID);
  await f.trackScope('notification', 'on_behalf_of_entity_id', amendmentID);
}
export function amendmentMutationCases(): MutationCase[] {
  const cases: MutationCase[] = [];
  const add = (
    operation: string,
    query: string,
    oracle: string,
    build: Build,
    denied: 'anonymous' | 'outsider' | false = 'outsider'
  ) =>
    cases.push(
      ...reviewedRowMutationCases(
        `amendments.${operation}`,
        { query, oracle, fixture: 'fresh amendment authored by owner; scoped SQL snapshots' },
        build,
        denied
      )
    );
  for (const operation of ['create', 'createFull', 'update', 'delete'])
    add(
      operation,
      'amendments.byId',
      'explicit title/creator/origin; full creation links independent document; delete absence',
      (ctx, id) => {
        const amendmentID = id('row');
        const create = operation.startsWith('create');
        const documentID = id('document');
        return {
          table: 'amendment',
          query: 'amendments.byId',
          request: queries.amendments.byId({ id: amendmentID }),
          args:
            operation === 'create'
              ? { id: amendmentID, ...amendmentInput }
              : operation === 'createFull'
                ? {
                    amendment: { id: amendmentID, ...amendmentInput },
                    document: {
                      id: documentID,
                      amendment_id: amendmentID,
                      content: [{ type: 'p', children: [{ text: 'Fixture text' }] }],
                      editing_mode: 'edit',
                    },
                  }
                : operation === 'update'
                  ? { id: amendmentID, title: 'After' }
                  : { id: amendmentID },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID, true);
            if (operation === 'createFull') await f.track('document', documentID);
          },
          ...(!create
            ? {
                initial: {
                  created_by_id: ctx.ownerID,
                  title: 'Before',
                  visibility: 'private',
                  discussions: [],
                },
              }
            : {}),
          expected:
            operation === 'delete'
              ? null
              : {
                  created_by_id: ctx.ownerID,
                  title: operation === 'update' ? 'After' : 'Before',
                  ...(create ? { origin_amendment_id: amendmentID } : {}),
                  ...(operation === 'createFull' ? { document_id: documentID } : {}),
                },
        };
      },
      operation === 'create' || operation === 'createFull' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['addCollaborator', 'updateCollaborator', 'removeCollaborator'])
    add(
      operation,
      'amendments.collaborators',
      'author manages outsider collaborator record without granting actor self bypass',
      (ctx, id) => {
        const amendmentID = id('amendment');
        const fields = {
          amendment_id: amendmentID,
          user_id: ctx.ownerID,
          role_id: null,
          status: 'active',
          visibility: 'public',
        };
        return {
          table: 'amendment_collaborator',
          query: 'amendments.collaborators',
          request: queries.amendments.collaborators({ amendment_id: amendmentID }),
          args:
            operation === 'addCollaborator'
              ? { id: id('row'), ...fields }
              : operation === 'updateCollaborator'
                ? { id: id('row'), visibility: 'private' }
                : { id: id('row') },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID);
          },
          ...(operation !== 'addCollaborator' ? { initial: fields } : {}),
          expected:
            operation === 'removeCollaborator'
              ? null
              : {
                  ...fields,
                  ...(operation === 'updateCollaborator' ? { visibility: 'private' } : {}),
                },
        };
      }
    );
  for (const operation of ['createCityDesign', 'updateCityDesign', 'deleteCityDesign'])
    add(
      operation,
      'amendments.cityDesigns',
      'author direct edit changes only title; no external OSM request',
      (ctx, id) => {
        const amendmentID = id('amendment');
        const fields = { ...cityDesign, amendment_id: amendmentID };
        return {
          table: 'amendment_city_design',
          query: 'amendments.cityDesigns',
          request: queries.amendments.cityDesigns({ amendment_id: amendmentID }),
          args:
            operation === 'createCityDesign'
              ? { id: id('row'), ...fields }
              : operation === 'updateCityDesign'
                ? { id: id('row'), title: 'After' }
                : { id: id('row') },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID);
          },
          ...(operation !== 'createCityDesign'
            ? { initial: { ...fields, created_by_id: ctx.ownerID } }
            : {}),
          expected:
            operation === 'deleteCityDesign'
              ? null
              : {
                  ...fields,
                  created_by_id: ctx.ownerID,
                  ...(operation === 'updateCityDesign' ? { title: 'After' } : {}),
                },
        };
      }
    );
  for (const operation of ['supportAmendment', 'updateSupportVote', 'deleteSupportVote'])
    add(
      operation,
      'amendments.byIdFull',
      'owned support vote and recomputed amendment counters',
      (ctx, id) => {
        const amendmentID = id('amendment');
        const fields = { amendment_id: amendmentID, user_id: ctx.ownerID, vote: 1 };
        return {
          table: 'amendment_support_vote',
          query: 'amendments.byIdFull',
          request: queries.amendments.byIdFull({ id: amendmentID }),
          args:
            operation === 'supportAmendment'
              ? { id: id('row'), amendment_id: amendmentID, vote: 1 }
              : operation === 'updateSupportVote'
                ? { id: id('row'), vote: -1 }
                : { id: id('row') },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID);
          },
          ...(operation !== 'supportAmendment' ? { initial: fields } : {}),
          expected:
            operation === 'deleteSupportVote'
              ? null
              : { ...fields, vote: operation === 'updateSupportVote' ? -1 : 1 },
          verifyAdditional: async (f, successful) =>
            f.expect('amendment', amendmentID, {
              upvotes: successful && operation === 'supportAmendment' ? 1 : 0,
              downvotes: successful && operation === 'updateSupportVote' ? 1 : 0,
            }),
        };
      },
      operation === 'supportAmendment' ? 'anonymous' : 'outsider'
    );
  cases.push(...internalProcessCases());
  cases.push(...changeRequestCases());
  cases.push(...workflowCases());
  add(
    'updateProcessBranch',
    'amendments.processRunById',
    'author updates title through real server override despite shared server-only guard',
    (ctx, id) => ({
      table: 'amendment_process_branch',
      query: 'amendments.processRunById',
      request: queries.amendments.processRunById({ id: id('run') }),
      args: { id: id('row'), title: 'After' },
      setup: async f => {
        await baseFixture(f, ctx, id('amendment'));
        await f.insert('amendment_process_run', {
          id: id('run'),
          amendment_id: id('amendment'),
          created_by_id: ctx.ownerID,
          ...processRun,
        });
      },
      initial: { process_run_id: id('run'), ...branch },
      expected: { process_run_id: id('run'), ...branch, title: 'After' },
    })
  );
  return cases;
}

function internalProcessCases(): MutationCase[] {
  const groups = [
    { type: 'Path', table: 'amendment_path', operations: ['create', 'delete'] },
    { type: 'PathSegment', table: 'amendment_path_segment', operations: ['create', 'delete'] },
    {
      type: 'SupportConfirmation',
      table: 'support_confirmation',
      operations: ['create', 'update'],
    },
    { type: 'GroupDecision', table: 'amendment_group_decision', operations: ['upsert', 'delete'] },
    {
      type: 'ProcessRun',
      table: 'amendment_process_run',
      operations: ['create', 'update', 'delete'],
    },
    { type: 'ProcessBranch', table: 'amendment_process_branch', operations: ['create', 'delete'] },
    {
      type: 'ProcessStepRun',
      table: 'amendment_process_step_run',
      operations: ['create', 'update', 'delete'],
    },
    { type: 'ProcessTask', table: 'process_task', operations: ['create', 'update', 'delete'] },
  ];
  return groups.flatMap(({ type, table, operations }) =>
    operations.flatMap(prefix =>
      ['owner', 'anonymous'].map(actor => {
        const name = `amendments.${prefix}${type}`;
        return {
          name,
          variant: 'public-api-denied',
          actor,
          outcome: 'server-error',
          error: 'permission_denied',
          observer: {
            query: type.startsWith('Process') ? 'amendments.processRunById' : 'amendments.byIdFull',
          },
          specification: {
            restriction:
              'explicit denyPublicAmendmentProcessMutation before writes; server-only workflow internals',
            oracle:
              'main row and fresh parent remain baseline; generated scoped activity/notification rows absent',
          },
          async prepare(ctx) {
            const f = new MutationFixtures(ctx.sql);
            const id = (label: string) => mutationFixtureID(ctx.id, `${name}:${label}`);
            const amendmentID = id('amendment');
            await baseFixture(f, ctx, amendmentID);
            const groupID = await groupAdminFixture(f, ctx, 'amendment-internal-group');
            const runID = type === 'ProcessRun' ? id('row') : id('run');
            if (['ProcessBranch', 'ProcessStepRun', 'ProcessTask'].includes(type))
              await f.insert('amendment_process_run', {
                id: runID,
                amendment_id: amendmentID,
                created_by_id: ctx.ownerID,
                ...processRun,
              });
            if (type === 'ProcessStepRun')
              await f.insert('amendment_process_branch', {
                id: id('branch'),
                process_run_id: runID,
                ...branch,
              });
            if (type === 'PathSegment')
              await f.insert('amendment_path', {
                id: id('path'),
                amendment_id: amendmentID,
                title: 'Fixture path',
              });
            const fields: Fields =
              type === 'Path'
                ? { amendment_id: amendmentID, title: 'Before', workflow_id: null }
                : type === 'PathSegment'
                  ? {
                      path_id: id('path'),
                      group_id: groupID,
                      event_id: null,
                      order_index: 0,
                      status: 'pending',
                    }
                  : type === 'SupportConfirmation'
                    ? {
                        amendment_id: amendmentID,
                        group_id: groupID,
                        event_id: null,
                        confirmed_by_id: ctx.ownerID,
                        status: 'pending',
                        confirmed_at: null,
                      }
                    : type === 'GroupDecision'
                      ? { amendment_id: amendmentID, group_id: groupID, status: 'supported' }
                      : type === 'ProcessRun'
                        ? { amendment_id: amendmentID, ...processRun }
                        : type === 'ProcessBranch'
                          ? { process_run_id: runID, ...branch }
                          : type === 'ProcessStepRun'
                            ? { process_run_id: runID, branch_id: id('branch'), ...step }
                            : { process_run_id: runID, ...task };
            const create = prefix === 'create' || prefix === 'upsert';
            if (create) await f.track(table, id('row'));
            else
              await f.insert(table, {
                id: id('row'),
                ...fields,
                ...(type === 'ProcessRun' ? { created_by_id: ctx.ownerID } : {}),
              });
            const args = create
              ? { id: id('row'), ...fields }
              : prefix === 'delete'
                ? { id: id('row') }
                : {
                    id: id('row'),
                    ...(type === 'SupportConfirmation'
                      ? { status: 'confirmed' }
                      : type === 'ProcessRun'
                        ? { status: 'scheduled' }
                        : type === 'ProcessStepRun'
                          ? { status: 'scheduled' }
                          : { title: 'After' }),
                  };
            const locate = (data: unknown): Fields | undefined => {
              if (!data || typeof data !== 'object') return undefined;
              if ((data as Fields).id === id('row')) return data as Fields;
              for (const value of Object.values(data)) {
                const result = locate(value);
                if (result) return result;
              }
              return undefined;
            };
            await f.sealScopes();
            const baseline = (data: unknown) => {
              const row = locate(data);
              return create ? !row : !!row;
            };
            return {
              args: args as ReadonlyJSONValue,
              observe: {
                request: type.startsWith('Process')
                  ? queries.amendments.processRunById({ id: runID })
                  : queries.amendments.byIdFull({ id: amendmentID }),
                before: baseline,
                after: baseline,
              },
              verify: async () => {
                await f.expect(table, id('row'), create ? null : fields);
                await f.verifyScopesUnchanged();
              },
              restore: () => f.restore(),
              verifyRestored: () => f.verifyRestored(),
            };
          },
        } satisfies MutationCase;
      })
    )
  );
}

const crInput = {
  process_branch_id: null,
  title: 'CR-1',
  description: 'Fixture request',
  status: 'open',
  reason: null,
  source_type: 'city_design_object',
  source_id: 'fixture-tree',
  source_title: 'Tree',
  change_type: 'update',
  original_text: 'Before',
  new_text: 'After',
  original_properties: null,
  new_properties: null,
  voting_status: 'open',
  voting_deadline: null,
  voting_majority_type: null,
  quorum_required: null,
};
const crPersisted = {
  ...crInput,
  branch_sequence_number: 1,
  changed_character_count: 0,
  votes_for: 0,
  votes_against: 0,
  votes_abstain: 0,
  created_in_mode: 'edit',
  resolved_in_mode: null,
  resolution_method: null,
  visibility_scope: 'public',
};
const suggestedContent = [
  {
    type: 'p',
    children: [
      {
        text: 'Neu',
        suggestion: true,
        suggestion_suggestion_1: { id: 'suggestion-1', type: 'insert' },
      },
    ],
  },
];
function changeRequestCases(): MutationCase[] {
  const cases: MutationCase[] = [];
  for (const operation of ['updateChangeRequest', 'deleteChangeRequest'])
    cases.push(
      ...reviewedRowMutationCases(
        `amendments.${operation}`,
        {
          oracle: 'owner edits own request description or deletes own pending submission',
          query: 'amendments.byIdFull',
        },
        (ctx, id) => {
          const amendmentID = id('amendment');
          const initial = {
            ...crPersisted,
            amendment_id: amendmentID,
            user_id: ctx.ownerID,
            status: operation === 'deleteChangeRequest' ? 'pending_submission' : 'open',
          };
          return {
            table: 'change_request',
            query: 'amendments.byIdFull',
            request: queries.amendments.byIdFull({ id: amendmentID }),
            args:
              operation === 'deleteChangeRequest'
                ? { id: id('row') }
                : { id: id('row'), description: 'After' },
            initial,
            setup: async f => {
              await baseFixture(f, ctx, amendmentID);
            },
            expected:
              operation === 'deleteChangeRequest' ? null : { ...initial, description: 'After' },
          };
        }
      )
    );
  for (const operation of [
    'createChangeRequest',
    'createDocumentChangeRequest',
    'createCityDesignChangeRequests',
  ])
    cases.push(
      ...reviewedRowMutationCases(
        `amendments.${operation}`,
        {
          oracle:
            'first numbered CR belongs to owner; city-object creation or linked persisted document suggestion',
          query: 'amendments.byIdFull',
        },
        (ctx, id) => {
          const amendmentID = id('amendment');
          const rowID = id('row');
          const document = operation === 'createDocumentChangeRequest';
          const input = {
            id: rowID,
            amendment_id: amendmentID,
            ...crInput,
            ...(document
              ? {
                  source_type: null,
                  source_id: null,
                  source_title: null,
                  discussion_id: 'suggestion-1',
                  changed_character_count: 3,
                }
              : {}),
          };
          return {
            table: 'change_request',
            query: 'amendments.byIdFull',
            request: queries.amendments.byIdFull({ id: amendmentID }),
            args:
              operation === 'createCityDesignChangeRequests'
                ? { amendment_id: amendmentID, process_branch_id: null, requests: [input] }
                : document
                  ? {
                      ...input,
                      document_content: suggestedContent,
                      discussions: [{ id: 'suggestion-1', changeRequestEntityId: rowID }],
                    }
                  : input,
            setup: async f => {
              await baseFixture(f, ctx, amendmentID);
              await f.insert('amendment_collaborator', {
                id: id('collaborator'),
                amendment_id: amendmentID,
                user_id: ctx.ownerID,
                status: 'active',
                visibility: 'public',
              });
              if (document) {
                await f.insert('document', {
                  id: id('document'),
                  amendment_id: amendmentID,
                  content: [{ type: 'p', children: [{ text: '' }] }],
                  editing_mode: 'edit',
                });
                await f.update('amendment', amendmentID, { document_id: id('document') });
              }
            },
            expected: {
              amendment_id: amendmentID,
              user_id: ctx.ownerID,
              title: 'CR-1',
              status: 'open',
              branch_sequence_number: 1,
              changed_character_count: document ? 3 : 0,
              votes_for: 0,
              votes_against: 0,
              votes_abstain: 0,
              created_in_mode: 'edit',
              resolved_in_mode: null,
              resolution_method: null,
              visibility_scope: 'collaborators',
              suggestion_id: document ? 'suggestion-1' : null,
            },
          };
        }
      )
    );
  for (const operation of [
    'finalizeInternalChangeRequestVote',
    'finalizeExpiredInternalChangeRequestVotes',
  ])
    cases.push(
      ...reviewedRowMutationCases(
        `amendments.${operation}`,
        {
          oracle:
            'zero voters means rejected strict majority, completed internal vote; expired case has literal past deadline',
          query: 'amendments.byIdFull',
        },
        (ctx, id) => {
          const amendmentID = id('amendment');
          const initial = {
            ...crPersisted,
            amendment_id: amendmentID,
            user_id: ctx.ownerID,
            created_in_mode: 'vote_internal',
            voting_deadline:
              operation === 'finalizeExpiredInternalChangeRequestVotes'
                ? '2000-01-01T00:00:00.000Z'
                : null,
          };
          return {
            table: 'change_request',
            query: 'amendments.byIdFull',
            request: queries.amendments.byIdFull({ id: amendmentID }),
            args:
              operation === 'finalizeInternalChangeRequestVote'
                ? { change_request_id: id('row') }
                : { amendment_id: amendmentID },
            initial,
            setup: async f => {
              await baseFixture(f, ctx, amendmentID);
              await f.insert('document', {
                id: id('document'),
                amendment_id: amendmentID,
                editing_mode: 'vote_internal',
                content: [{ type: 'p', children: [{ text: 'Before' }] }],
              });
              await f.update('amendment', amendmentID, {
                document_id: id('document'),
                internal_cr_voting_close_trigger: 'after_minutes',
              });
            },
            expected: {
              ...initial,
              status: 'rejected',
              voting_status: 'completed',
              resolved_in_mode: 'vote_internal',
              resolution_method: 'internal_vote',
            },
          };
        },
        operation === 'finalizeExpiredInternalChangeRequestVotes' ? 'anonymous' : 'outsider'
      )
    );
  cases.push(
    ...reviewedRowMutationCases(
      'amendments.voteOnChangeRequest',
      {
        oracle: 'author casts one affirmative vote before future deadline; one persisted own vote',
        query: 'amendments.byIdFull',
      },
      (ctx, id) => {
        const amendmentID = id('amendment');
        return {
          table: 'change_request_vote',
          query: 'amendments.byIdFull',
          request: queries.amendments.byIdFull({ id: amendmentID }),
          args: { id: id('row'), change_request_id: id('cr'), vote: 'accept' },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID);
            await f.insert('document', {
              id: id('document'),
              amendment_id: amendmentID,
              editing_mode: 'vote_internal',
              content: [{ type: 'p', children: [{ text: 'Before' }] }],
            });
            await f.update('amendment', amendmentID, {
              document_id: id('document'),
              internal_cr_voting_close_trigger: 'after_minutes',
            });
            await f.insert('change_request', {
              id: id('cr'),
              ...crPersisted,
              amendment_id: amendmentID,
              user_id: ctx.ownerID,
              created_in_mode: 'vote_internal',
              voting_deadline: '2100-01-01T00:00:00.000Z',
            });
          },
          expected: { change_request_id: id('cr'), user_id: ctx.ownerID, vote: 'accept' },
          verifyAdditional: async (f, successful) =>
            f.expect('change_request', id('cr'), {
              votes_for: successful ? 1 : 0,
              votes_against: 0,
              votes_abstain: 0,
              status: 'open',
              voting_status: 'open',
            }),
        };
      }
    )
  );
  cases.push(
    ...reviewedRowMutationCases(
      'amendments.repairInternalChangeRequestResolution',
      {
        oracle:
          'accepted insertion reconstructed from saved pre-event suggestion yields exact Neu text',
        query: 'amendments.byIdFull',
      },
      (ctx, id) => {
        const amendmentID = id('amendment');
        return {
          table: 'document',
          rowID: id('row'),
          existing: true,
          query: 'amendments.byIdFull',
          request: queries.amendments.byIdFull({ id: amendmentID }),
          args: { amendment_id: amendmentID },
          setup: async f => {
            await baseFixture(f, ctx, amendmentID);
            await f.insert('document', {
              id: id('row'),
              amendment_id: amendmentID,
              content: [{ type: 'p', children: [{ text: 'Broken' }] }],
              editing_mode: 'edit',
            });
            await f.update('amendment', amendmentID, {
              document_id: id('row'),
              discussions: [{ id: 'suggestion-1', changeRequestEntityId: id('cr'), crId: 'CR-1' }],
            });
            await f.trackScope('document_version', 'document_id', id('row'));
            await f.insert('document_version', {
              id: id('version'),
              document_id: id('row'),
              amendment_id: amendmentID,
              version_number: 1,
              author_id: ctx.ownerID,
              content: suggestedContent,
              change_summary: 'Internal change requests resolved before event phase',
            });
            await f.insert('change_request', {
              id: id('cr'),
              ...crPersisted,
              amendment_id: amendmentID,
              user_id: ctx.ownerID,
              suggestion_id: 'suggestion-1',
              created_in_mode: 'vote_internal',
              resolved_in_mode: 'vote_internal',
              resolution_method: 'internal_vote',
              status: 'accepted',
              voting_status: 'completed',
              votes_for: 1,
            });
          },
          expected: { content: [{ type: 'p', children: [{ text: 'Neu' }] }] },
        };
      }
    )
  );
  return cases;
}

function workflowCases(): MutationCase[] {
  return [
    'initializeProcessPath',
    'resolveProcessVote',
    'completeProcessTaskWithEvent',
    'replanProcessBranchEvents',
  ].flatMap(operation =>
    ['owner', 'outsider', 'anonymous'].map(
      actor =>
        ({
          name: `amendments.${operation}`,
          variant: actor === 'owner' ? 'authorized' : `${actor}-denied`,
          actor,
          outcome: actor === 'owner' ? 'success' : 'server-error',
          ...(actor === 'owner' ? {} : { error: 'permission_denied' }),
          observer: {
            query:
              operation === 'initializeProcessPath'
                ? 'amendments.byIdWithProcessData'
                : 'amendments.processRunById',
          },
          specification: {
            oracle:
              operation === 'initializeProcessPath'
                ? 'one real hierarchy step without event creates pending run/branch/step and one schedule task'
                : operation === 'resolveProcessVote'
                  ? 'zero-voter implementation evaluation ties and fails implementation'
                  : operation === 'completeProcessTaskWithEvent'
                    ? 'support confirmation task completes and links chosen future event'
                    : 'unsetting future scheduled event clears step and creates one open schedule task',
            fixture:
              'owned fresh amendment, owned base group, real scoped event rights; SQL verifies scalar states and child counts',
          },
          async prepare(ctx) {
            const f = new MutationFixtures(ctx.sql);
            const id = (label: string) =>
              mutationFixtureID(ctx.id, `amendments.${operation}:${label}`);
            const amendmentID = id('amendment');
            await baseFixture(f, ctx, amendmentID);
            const groupID = await groupAdminFixture(f, ctx, 'amendment-workflow-group');
            await f.trackScope('notification', 'related_group_id', groupID);
            await f.trackScope('notification', 'recipient_group_id', groupID);
            await f.trackScope('amendment_process_run', 'amendment_id', amendmentID);
            await f.trackScope('amendment_path', 'amendment_id', amendmentID);
            let args: Fields;
            let table: string;
            let rowID: string;
            let before: Fields;
            let after: Fields;
            if (operation === 'initializeProcessPath') {
              args = {
                amendment_id: amendmentID,
                amendment_title: 'Before',
                amendment_reason: null,
                source_group_id: groupID,
                path_mode: 'hierarchy',
                evaluation_mode: 'none',
                enriched_path: [
                  {
                    groupId: groupID,
                    groupName: 'Mutation governance fixture',
                    eventId: null,
                    eventTitle: '',
                    eventStartDate: null,
                    agendaItemId: null,
                    amendmentVoteId: null,
                    forwardingStatus: 'previous_decision_outstanding',
                  },
                ],
              };
              table = 'amendment';
              rowID = amendmentID;
              before = { current_process_run_id: null };
              after = {};
            } else {
              await f.insert('amendment_process_run', {
                id: id('run'),
                amendment_id: amendmentID,
                created_by_id: ctx.ownerID,
                ...processRun,
              });
              await f.trackScope('process_task', 'process_run_id', id('run'));
              if (operation === 'resolveProcessVote') {
                await f.insert('agenda_item', {
                  id: id('agenda'),
                  amendment_id: amendmentID,
                  creator_id: ctx.ownerID,
                  title: 'Implementation evaluation',
                  type: 'implementation_review',
                });
                await f.insert('vote', {
                  id: id('vote'),
                  agenda_item_id: id('agenda'),
                  amendment_id: amendmentID,
                  title: 'Evaluation',
                  purpose: 'closing',
                  status: 'final',
                  majority_type: 'simple',
                });
                for (const [index, label] of ['yes', 'no'].entries())
                  await f.insert('vote_choice', {
                    id: id(`choice-${label}`),
                    vote_id: id('vote'),
                    label,
                    semantic_key: label,
                    order_index: index,
                  });
                await f.insert('process_task', {
                  id: id('task'),
                  process_run_id: id('run'),
                  ...task,
                  task_type: 'implementation_evaluation',
                  agenda_item_id: id('agenda'),
                });
                args = { agenda_item_id: id('agenda') };
                table = 'amendment_process_run';
                rowID = id('run');
                before = { implementation_status: null };
                after = { implementation_status: 'implementation_failed' };
              } else if (operation === 'completeProcessTaskWithEvent') {
                const event = await eventAdminFixture(f, ctx, 'amendment-task-event');
                await f.update('event', event.id, {
                  start_date: '2100-01-01T00:00:00.000Z',
                  end_date: '2100-01-01T02:00:00.000Z',
                  group_id: groupID,
                });
                await f.insert('support_confirmation', {
                  id: id('confirmation'),
                  amendment_id: amendmentID,
                  group_id: groupID,
                  confirmed_by_id: ctx.ownerID,
                  status: 'pending',
                  process_run_id: id('run'),
                });
                await f.insert('process_task', {
                  id: id('task'),
                  process_run_id: id('run'),
                  ...task,
                  task_type: 'support_confirmation',
                  support_confirmation_id: id('confirmation'),
                });
                args = { process_task_id: id('task'), event_id: event.id };
                table = 'process_task';
                rowID = id('task');
                before = { status: 'open', event_id: null, agenda_item_id: null };
                after = { status: 'completed', event_id: event.id, agenda_item_id: null };
              } else {
                const event = await eventAdminFixture(f, ctx, 'amendment-replan-event');
                await f.update('event', event.id, {
                  start_date: '2100-01-01T00:00:00.000Z',
                  end_date: '2100-01-01T02:00:00.000Z',
                  group_id: groupID,
                });
                await f.insert('amendment_process_branch', {
                  id: id('branch'),
                  process_run_id: id('run'),
                  ...branch,
                  status: 'scheduled',
                });
                await f.insert('amendment_process_step_run', {
                  id: id('step'),
                  process_run_id: id('run'),
                  branch_id: id('branch'),
                  ...step,
                  event_id: event.id,
                  status: 'scheduled',
                  target_group_id: groupID,
                  source_group_id: groupID,
                  decision_status: 'forward_confirmed',
                });
                args = {
                  branch_id: id('branch'),
                  event_updates: [{ step_run_id: id('step'), event_id: null }],
                };
                table = 'amendment_process_step_run';
                rowID = id('step');
                before = {
                  event_id: event.id,
                  status: 'scheduled',
                  decision_status: 'forward_confirmed',
                };
                after = {
                  event_id: null,
                  status: 'pending_event',
                  decision_status: 'previous_decision_outstanding',
                };
              }
            }
            await f.sealScopes();
            const locate = (data: unknown): Fields | undefined => {
              if (!data || typeof data !== 'object') return undefined;
              if ((data as Fields).id === rowID) return data as Fields;
              for (const value of Object.values(data)) {
                const row = locate(value);
                if (row) return row;
              }
              return undefined;
            };
            const matches = (data: unknown, fields: Fields) => {
              const row = locate(data);
              return (
                !!row &&
                Object.entries(fields).every(
                  ([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value)
                )
              );
            };
            return {
              args: args as ReadonlyJSONValue,
              observe: {
                request:
                  operation === 'initializeProcessPath'
                    ? queries.amendments.byIdWithProcessData({ id: amendmentID })
                    : queries.amendments.processRunById({ id: id('run') }),
                before: data => matches(data, before),
                after: data =>
                  actor === 'owner'
                    ? operation === 'initializeProcessPath'
                      ? !!locate(data)?.current_process_run_id
                      : matches(data, after)
                    : matches(data, before),
              },
              verify: async () => {
                if (actor !== 'owner') {
                  await f.expect(table, rowID, before);
                  await f.verifyScopesUnchanged();
                  return;
                }
                if (operation === 'initializeProcessPath') {
                  const runs =
                    await ctx.sql`select * from amendment_process_run where amendment_id=${amendmentID}`;
                  assert.equal(runs.length, 1);
                  assert.equal(runs[0].selected_source_group_id, groupID);
                  assert.equal(runs[0].selected_target_group_id, groupID);
                  assert.equal(runs[0].status, 'pending_event');
                  await f.expect('amendment', amendmentID, { current_process_run_id: runs[0].id });
                  const branches =
                    await ctx.sql`select * from amendment_process_branch where process_run_id=${runs[0].id}`;
                  assert.equal(branches.length, 1);
                  assert.equal(branches[0].title, 'Before');
                  assert.equal(branches[0].status, 'pending_event');
                  const steps =
                    await ctx.sql`select * from amendment_process_step_run where process_run_id=${runs[0].id}`;
                  assert.equal(steps.length, 1);
                  assert.equal(steps[0].target_group_id, groupID);
                  assert.equal(steps[0].status, 'pending_event');
                  const tasks =
                    await ctx.sql`select * from process_task where process_run_id=${runs[0].id}`;
                  assert.equal(tasks.length, 1);
                  assert.equal(tasks[0].task_type, 'schedule_event');
                  assert.equal(tasks[0].status, 'open');
                } else {
                  await f.expect(table, rowID, after);
                  if (operation === 'resolveProcessVote') {
                    await f.expect('agenda_item', id('agenda'), { forwarding_status: 'tie' });
                    assert.ok((await f.rows('agenda_item', id('agenda')))[0].completed_at);
                  }
                  if (operation === 'completeProcessTaskWithEvent') {
                    await f.expect('support_confirmation', id('confirmation'), {
                      event_id: args.event_id,
                      process_task_id: id('task'),
                    });
                    assert.ok((await f.rows('process_task', id('task')))[0].resolved_at);
                  }
                  if (operation === 'replanProcessBranchEvents') {
                    const tasks =
                      await ctx.sql`select * from process_task where process_run_id=${id('run')}`;
                    assert.equal(tasks.length, 1);
                    assert.equal(tasks[0].step_run_id, id('step'));
                    assert.equal(tasks[0].status, 'open');
                    assert.equal(tasks[0].task_type, 'schedule_event');
                  }
                }
              },
              restore: () => f.restore(),
              verifyRestored: () => f.verifyRestored(),
            };
          },
        }) satisfies MutationCase
    )
  );
}
