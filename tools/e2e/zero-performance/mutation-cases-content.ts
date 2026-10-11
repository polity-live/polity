import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createECDH, randomBytes } from 'node:crypto';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import type { MutationCase } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import {
  createStudioDocumentV5,
  createFrameNode,
  studioNodeSchema,
} from '../../../src/features/communication-studio/logic/document-v3';
import { POLITY_THEME } from '../../../src/features/shared/appearance-theme';
import { canvasMutationCases, studioApplyConflictCases } from './mutation-cases-canvas';
import { studioCommandSchemas } from '../../../src/zero/communication-studio/commands';

const epoch = new Date('2030-01-01T00:00:00Z');
export function assertProjectChatUndoTimestamp(value: unknown): void {
  assert(
    typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value)),
    'Undo timestamp must be a positive database epoch integer'
  );
  const timestamp = Number(value);
  assert(
    Number.isSafeInteger(timestamp) && timestamp > 0,
    'Undo timestamp must be finite and positive'
  );
}
type Row = Record<string, unknown>;
const record = (value: unknown): Row | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : undefined;
function hasFields(value: unknown, fields: Row | null): boolean {
  if (fields === null) return value === undefined || value === null;
  const row = record(value);
  return (
    !!row &&
    Object.entries(fields).every(([key, expected]) => isDeepStrictEqual(row[key], expected))
  );
}
type StatementAction =
  | 'create'
  | 'createFull'
  | 'update'
  | 'delete'
  | 'createSurvey'
  | 'deleteSurvey'
  | 'createSurveyOption'
  | 'deleteSurveyOption'
  | 'createSurveyVote'
  | 'deleteSurveyVote'
  | 'createSupportVote'
  | 'updateSupportVote'
  | 'deleteSupportVote';
const statementActions: StatementAction[] = [
  'create',
  'createFull',
  'update',
  'delete',
  'createSurvey',
  'deleteSurvey',
  'createSurveyOption',
  'deleteSurveyOption',
  'createSurveyVote',
  'deleteSurveyVote',
  'createSupportVote',
  'updateSupportVote',
  'deleteSupportVote',
];

function statementCase(
  action: StatementAction,
  actor: 'owner' | 'outsider' | 'anon' | 'public-voter'
): MutationCase {
  const rejected = actor !== 'owner' && actor !== 'public-voter';
  return {
    name: `statements.${action}`,
    variant:
      actor === 'public-voter'
        ? 'public-third-party-authorized'
        : rejected
          ? `${actor}-denied`
          : 'authorized',
    actor: actor === 'public-voter' ? 'outsider' : actor,
    outcome: rejected ? 'server-error' : 'success',
    ...(rejected ? { error: 'permission_denied' } : {}),
    observer: { query: 'statements.byIdWithDetails' },
    specification: {
      fixture:
        actor === 'public-voter'
          ? 'public statement by owner; isolated support vote owned by authenticated third party'
          : 'private owner statement; isolated survey, option and owner votes',
      action,
      actor,
      expected: rejected ? 'unchanged private owner graph' : action,
      content: {
        title: 'Fixture title',
        text: 'Fixture text',
        media_type: 'text',
        visibility: actor === 'public-voter' ? 'public' : 'private',
      },
      normalization: 'create title and text trimmed; no media; no story expiry; zero counters',
      sideEffects:
        'support vote creates no timeline entry; direct SQL parent fixture; no hashtags requested',
      cleanup: 'owned parent and every dependent ID absent',
    },
    async prepare(ctx) {
      const voterID = actor === 'public-voter' ? ctx.outsiderID : ctx.ownerID;
      const fixture = new MutationFixtures(ctx.sql);
      const sid = mutationFixtureID(ctx.id, 'statement');
      const survey = mutationFixtureID(ctx.id, 'survey');
      const option = mutationFixtureID(ctx.id, 'option');
      const vote = mutationFixtureID(ctx.id, 'survey-vote');
      const support = mutationFixtureID(ctx.id, 'support-vote');
      const create = action === 'create' || action === 'createFull';
      const baseline = {
        id: sid,
        user_id: ctx.ownerID,
        group_id: null,
        title: 'Fixture title',
        text: 'Fixture text',
        image_url: null,
        video_url: null,
        media_type: 'text',
        is_story: false,
        expires_at: null,
        visibility: actor === 'public-voter' ? 'public' : 'private',
        upvotes: 0,
        downvotes: 0,
        comment_count: 0,
      };
      await fixture.track('statement', sid);
      await fixture.trackScope('search_document', 'entity_id', sid);
      if (!create)
        await fixture.insert('statement', { ...baseline, created_at: epoch, updated_at: epoch });
      const needSurvey =
        !create &&
        ![
          'update',
          'delete',
          'createSurvey',
          'createSupportVote',
          'updateSupportVote',
          'deleteSupportVote',
        ].includes(action);
      await fixture.track('statement_survey', survey);
      if (needSurvey)
        await fixture.insert('statement_survey', {
          id: survey,
          statement_id: sid,
          question: 'Fixture question',
          ends_at: epoch,
          created_at: epoch,
        });
      const needOption = ['deleteSurveyOption', 'createSurveyVote', 'deleteSurveyVote'].includes(
        action
      );
      await fixture.track('statement_survey_option', option);
      if (needOption)
        await fixture.insert('statement_survey_option', {
          id: option,
          survey_id: survey,
          label: 'Fixture option',
          position: 0,
          vote_count: 0,
          created_at: epoch,
        });
      await fixture.track('statement_survey_vote', vote);
      if (action === 'deleteSurveyVote')
        await fixture.insert('statement_survey_vote', {
          id: vote,
          option_id: option,
          user_id: ctx.ownerID,
          created_at: epoch,
        });
      await fixture.track('statement_support_vote', support);
      const needSupport = ['updateSupportVote', 'deleteSupportVote'].includes(action);
      if (needSupport)
        await fixture.insert('statement_support_vote', {
          id: support,
          statement_id: sid,
          user_id: voterID,
          vote: 1,
          created_at: epoch,
        });
      const input = {
        id: sid,
        group_id: null,
        title: ' Fixture title ',
        text: ' Fixture text ',
        visibility: 'private',
      };
      const argsByAction: Record<StatementAction, ReadonlyJSONValue> = {
        create: input,
        createFull: { statement: input },
        update: { id: sid, text: ' Changed text ' },
        delete: { id: sid },
        createSurvey: {
          id: survey,
          statement_id: sid,
          question: 'Fixture question',
          ends_at: epoch.getTime(),
        },
        deleteSurvey: { id: survey },
        createSurveyOption: { id: option, survey_id: survey, label: 'Fixture option', position: 0 },
        deleteSurveyOption: { id: option },
        createSurveyVote: { id: vote, option_id: option },
        deleteSurveyVote: { id: vote },
        createSupportVote: { id: support, statement_id: sid, vote: 1 },
        updateSupportVote: { id: support, vote: -1 },
        deleteSupportVote: { id: support },
      };
      const success = !rejected;
      const expectedStatement =
        success && action === 'delete'
          ? null
          : create && rejected
            ? null
            : {
                ...baseline,
                ...(success && action === 'update' ? { text: 'Changed text' } : {}),
                // These public statement vote mutators do not recompute parent counters.
                upvotes: 0,
                downvotes: 0,
              };
      const expectedSurvey =
        (needSurvey && !(success && action === 'deleteSurvey')) ||
        (success && action === 'createSurvey')
          ? { id: survey, statement_id: sid, question: 'Fixture question' }
          : null;
      const expectedOption =
        (needOption && !(success && action === 'deleteSurveyOption')) ||
        (success && action === 'createSurveyOption')
          ? { id: option, survey_id: survey, label: 'Fixture option', position: 0, vote_count: 0 }
          : null;
      const expectedVote =
        (action === 'deleteSurveyVote' && rejected) || (success && action === 'createSurveyVote')
          ? { id: vote, option_id: option, user_id: ctx.ownerID }
          : null;
      const expectedSupport =
        (needSupport && !(success && action === 'deleteSupportVote')) ||
        (success && action === 'createSupportVote')
          ? {
              id: support,
              statement_id: sid,
              user_id: voterID,
              vote: success && action === 'updateSupportVote' ? -1 : 1,
            }
          : null;
      const before = (data: unknown) => {
        if (create) return hasFields(data, null);
        const row = record(data);
        if (!hasFields(row, { id: sid, text: 'Fixture text' })) return false;
        if (action.includes('Survey')) {
          const surveys = row?.surveys as Row[];
          if (action === 'createSurvey') return !surveys?.some(v => v.id === survey);
          const entry = surveys?.find(v => v.id === survey);
          if (!entry) return false;
          if (action.includes('Option') || action.includes('SurveyVote')) {
            const options = entry.options as Row[];
            const opt = options?.find(v => v.id === option);
            if (action === 'createSurveyOption') return !opt;
            if (!opt) return false;
            if (action.includes('SurveyVote'))
              return (
                Array.isArray(opt.votes) &&
                opt.votes.some((v: Row) => v.id === vote) === (action === 'deleteSurveyVote')
              );
          }
        }
        if (action.includes('SupportVote'))
          return (
            Array.isArray(row?.support_votes) &&
            (row.support_votes as Row[]).some(v => v.id === support) === needSupport
          );
        return true;
      };
      const after = (data: unknown) => {
        if (rejected) return before(data);
        if (!hasFields(data, expectedStatement)) return false;
        if (action === 'delete') return true;
        const row = record(data);
        if (!row) return false;
        if (action.includes('SupportVote')) {
          const found = (row.support_votes as Row[] | undefined)?.find(v => v.id === support);
          return hasFields(found, expectedSupport);
        }
        if (action.includes('Survey')) {
          const found = (row.surveys as Row[] | undefined)?.find(v => v.id === survey);
          if (!hasFields(found, expectedSurvey)) return false;
          if (action.includes('Option') || action.includes('SurveyVote')) {
            const opt = (found?.options as Row[] | undefined)?.find(v => v.id === option);
            if (!hasFields(opt, expectedOption)) return false;
            if (action.includes('SurveyVote'))
              return hasFields(
                (opt?.votes as Row[] | undefined)?.find(v => v.id === vote),
                expectedVote
              );
          }
        }
        return true;
      };
      return {
        args: argsByAction[action],
        observe: {
          request: queries.statements.byIdWithDetails({ id: sid, now: epoch.getTime() }),
          ...(actor === 'public-voter' ? { actor: 'writer' as const } : {}),
          before,
          after,
        },
        async verify() {
          await fixture.expect('statement', sid, expectedStatement);
          await fixture.expect('statement_survey', survey, expectedSurvey);
          await fixture.expect('statement_survey_option', option, expectedOption);
          await fixture.expect('statement_survey_vote', vote, expectedVote);
          await fixture.expect('statement_support_vote', support, expectedSupport);
          const timeline = await ctx.sql`select id from timeline_event where statement_id = ${sid}`;
          assert.equal(timeline.length, 0, 'Private statement has no timeline side effects');
        },
        restore: () => fixture.restore(),
        verifyRestored: () => fixture.verifyRestored(),
      };
    },
  };
}

const todoActions = [
  'create',
  'createFull',
  'update',
  'delete',
  'assign',
  'unassign',
  'toggleComplete',
  'archive',
  'unarchive',
] as const;
type TodoAction = (typeof todoActions)[number];
function todoCase(action: TodoAction, actor: 'owner' | 'outsider' | 'anon'): MutationCase {
  const rejected = actor !== 'owner';
  const localDenial =
    rejected && ['update', 'toggleComplete', 'archive', 'unarchive'].includes(action);
  return {
    name: `todos.${action}`,
    variant: rejected ? `${actor}-denied` : 'authorized',
    actor,
    outcome: localDenial ? 'client-error' : rejected ? 'server-error' : 'success',
    ...(rejected ? { error: localDenial ? 'mutation_server_failed' : 'permission_denied' } : {}),
    observer: { query: 'todos.byIdWithRelations' },
    specification: {
      action,
      actor,
      fixture: 'private personal owner todo; no group or external assignees',
      expected: rejected ? 'unchanged' : action,
      activity: 'exact action, severity and field changes; owner actor',
      cleanup: 'todo, assignment, discussion thread, activity and search projection absent',
    },
    async prepare(ctx) {
      const fixture = new MutationFixtures(ctx.sql);
      const id = mutationFixtureID(ctx.id, 'todo');
      const aid = mutationFixtureID(ctx.id, 'assignment');
      const create = action === 'create' || action === 'createFull';
      const baseline = {
        id,
        title: 'Fixture todo',
        description: 'Fixture description',
        status: action === 'archive' || action === 'unarchive' ? 'completed' : 'open',
        priority: 'normal',
        visibility: 'private',
        creator_id: ctx.ownerID,
        group_id: null,
        event_id: null,
        amendment_id: null,
        due_date: null,
        tags: [],
      };
      await fixture.track('todo', id);
      if (!create)
        await fixture.insert('todo', {
          ...baseline,
          completed_at: null,
          archived_at: action === 'unarchive' ? epoch : null,
          created_at: epoch,
          updated_at: epoch,
        });
      await fixture.track('todo_assignment', aid);
      if (action === 'unassign')
        await fixture.insert('todo_assignment', {
          id: aid,
          todo_id: id,
          user_id: ctx.ownerID,
          role: null,
          assigned_at: epoch,
        });
      const input = {
        id,
        title: 'Fixture todo',
        description: 'Fixture description',
        status: 'open',
        priority: 'normal',
        visibility: 'private',
        group_id: null,
        event_id: null,
        amendment_id: null,
        due_date: null,
        completed_at: null,
        tags: [],
      };
      const argsByAction: Record<TodoAction, ReadonlyJSONValue> = {
        create: input,
        createFull: { todo: input },
        update: { id, title: 'Changed todo' },
        delete: { id },
        assign: { id: aid, todo_id: id, user_id: ctx.ownerID, role: null },
        unassign: { id: aid },
        toggleComplete: { id },
        archive: { id },
        unarchive: { id },
      };
      const success = !rejected;
      const expected =
        (success && action === 'delete') || (create && rejected)
          ? null
          : {
              ...baseline,
              ...(!(success && action === 'toggleComplete') ? { completed_at: null } : {}),
              ...(success && action === 'update' ? { title: 'Changed todo' } : {}),
              ...(success && action === 'toggleComplete' ? { status: 'completed' } : {}),
            };
      const assignment =
        (action === 'unassign' && rejected) || (success && action === 'assign')
          ? { id: aid, todo_id: id, user_id: ctx.ownerID, role: null }
          : null;
      const activityAction: Record<TodoAction, string | null> = {
        create: 'created',
        createFull: 'created',
        update: 'updated',
        delete: null,
        assign: 'assigned',
        unassign: 'unassigned',
        toggleComplete: 'updated',
        archive: 'archived',
        unarchive: 'unarchived',
      };
      const changes: Record<TodoAction, ReadonlyJSONValue> = {
        create: [],
        createFull: [],
        delete: [],
        update: [{ field: 'title', from: 'Fixture todo', to: 'Changed todo' }],
        assign: [{ field: 'assignees', from: [], to: [ctx.ownerID] }],
        unassign: [{ field: 'assignees', from: [ctx.ownerID], to: [] }],
        toggleComplete: [{ field: 'status', from: 'open', to: 'completed' }],
        archive: [{ field: 'archive_state', from: 'active', to: 'archived' }],
        unarchive: [{ field: 'archive_state', from: 'archived', to: 'active' }],
      };
      const before = (data: unknown) =>
        create
          ? hasFields(data, null)
          : hasFields(data, { id, title: 'Fixture todo', status: baseline.status }) &&
            (action !== 'unassign' ||
              (record(data)?.assignments as Row[])?.some(v => v.id === aid));
      const after = (data: unknown) => {
        if (rejected) return before(data);
        if (!hasFields(data, expected)) return false;
        if (expected === null) return true;
        const row = record(data);
        if (!row) return false;
        if (
          action === 'toggleComplete' &&
          !(
            typeof row.completed_at === 'number' &&
            Number.isSafeInteger(row.completed_at) &&
            row.completed_at > 0
          )
        )
          return false;
        if (action === 'archive' && typeof row.archived_at !== 'number') return false;
        if (action === 'unarchive' && row.archived_at !== null) return false;
        if (action === 'assign' || action === 'unassign')
          return hasFields(
            (row.assignments as Row[] | undefined)?.find(v => v.id === aid),
            assignment
          );
        return true;
      };
      const derivedAbsent = async () => {
        for (const table of ['todo_activity', 'thread']) {
          const rows = await ctx.sql`select id from ${ctx.sql(table)} where todo_id = ${id}`;
          assert.equal(rows.length, 0, `${table} restored`);
        }
        const search = await ctx.sql`select id from search_document where entity_id = ${id}`;
        assert.equal(search.length, 0, 'Todo search projection restored');
      };
      return {
        args: argsByAction[action],
        observe: { request: queries.todos.byIdWithRelations({ id }), before, after },
        async verify() {
          await fixture.expect('todo', id, expected);
          await fixture.expect('todo_assignment', aid, assignment);
          const activities =
            await ctx.sql`select action,severity,actor_id,subject_user_id,changes from todo_activity where todo_id = ${id}`;
          const activityExpected =
            success && activityAction[action]
              ? [
                  {
                    action: activityAction[action],
                    severity: action === 'update' ? 'normal' : 'high',
                    actor_id: ctx.ownerID,
                    subject_user_id:
                      action === 'assign' || action === 'unassign' ? ctx.ownerID : null,
                    changes: changes[action],
                  },
                ]
              : [];
          assert.deepEqual(
            Array.from(activities),
            activityExpected,
            'Exact todo activity side effect'
          );
          if (expected) {
            const [row] = await fixture.rows('todo', id);
            if (success && action === 'archive') assert(row.archived_at instanceof Date);
            else
              assert.deepEqual(row.archived_at, action === 'unarchive' && rejected ? epoch : null);
            if (success && action === 'toggleComplete')
              assert(
                row.completed_at instanceof Date &&
                  Number.isFinite(row.completed_at.getTime()) &&
                  row.completed_at.getTime() > 0
              );
            await fixture.expect('thread', id, {
              todo_id: id,
              user_id: ctx.ownerID,
              status: 'open',
              upvotes: 0,
              downvotes: 0,
            });
          }
        },
        restore: () => fixture.restore(),
        async verifyRestored() {
          await fixture.verifyRestored();
          await derivedAbsent();
        },
      };
    },
  };
}

const documentActions = [
  'create',
  'updateContent',
  'createVersion',
  'addCollaborator',
  'createThread',
  'addComment',
  'voteThread',
  'voteComment',
  'delete',
  'updateVersion',
  'deleteVersion',
  'updateCommentVote',
  'deleteCommentVote',
  'updateThreadVote',
  'deleteThreadVote',
  'updateThread',
  'updateComment',
] as const;
type DocumentAction = (typeof documentActions)[number];
function documentCase(
  action: DocumentAction,
  actor: 'owner' | 'outsider' | 'anon' | 'revoked',
  revisionConflict = false
): MutationCase {
  const rejected = actor !== 'owner' || revisionConflict;
  const queryName = ['createVersion', 'updateVersion', 'deleteVersion'].includes(action)
    ? 'documents.versions'
    : action === 'addCollaborator'
      ? 'documents.collaborators'
      : [
            'createThread',
            'voteThread',
            'updateThreadVote',
            'deleteThreadVote',
            'updateThread',
          ].includes(action)
        ? 'documents.threads'
        : [
              'addComment',
              'voteComment',
              'updateCommentVote',
              'deleteCommentVote',
              'updateComment',
            ].includes(action)
          ? 'documents.comments'
          : 'documents.byId';
  return {
    name: `documents.${action}`,
    variant: revisionConflict
      ? 'stale-content-revision'
      : rejected
        ? `${actor}-denied`
        : 'authorized',
    actor: actor === 'revoked' ? 'outsider' : actor,
    outcome: rejected ? 'server-error' : 'success',
    ...(rejected
      ? { error: revisionConflict ? 'project_revision_conflict' : 'permission_denied' }
      : {}),
    observer:
      action === 'create' && !rejected
        ? {
            reason:
              'A newly created unparented document has no collaborator or amendment. Every public document query requires one of these links, so independent SQL proves creation.',
          }
        : { query: queryName },
    specification: {
      action,
      actor,
      revisionConflict,
      fixture:
        'standalone document with active owner collaborator; optional revoked outsider collaborator',
      content: [{ type: 'p', children: [{ text: 'Fixture content' }] }],
      revision: 0,
      expected: rejected
        ? 'unchanged document, versions, collaborators, thread, comments and votes'
        : action,
      voteCounters: 'server recomputes exact count from persisted vote rows',
      threadTimestamp: {
        createResolvedAtInput: null,
        parsed: 0,
        sql: '1970-01-01T00:00:00.000Z',
        existingFixtureResolvedAt: null,
      },
      notifications:
        'self collaborator, unparented version and owner comment avoid notification recipients',
      cleanup: 'every explicitly owned document graph row absent',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const id = mutationFixtureID(ctx.id, 'document');
      const cid = mutationFixtureID(ctx.id, 'owner-collaborator');
      const newCid = mutationFixtureID(ctx.id, 'new-collaborator');
      const vid = mutationFixtureID(ctx.id, 'version');
      const tid = mutationFixtureID(ctx.id, 'thread');
      const comment = mutationFixtureID(ctx.id, 'comment');
      const tv = mutationFixtureID(ctx.id, 'thread-vote');
      const cv = mutationFixtureID(ctx.id, 'comment-vote');
      const content = [{ type: 'p', children: [{ text: 'Fixture content' }] }];
      const changed = [{ type: 'p', children: [{ text: 'Changed content' }] }];
      const baseline: Row = {
        id,
        amendment_id: null,
        editing_mode: 'edit',
        content,
        content_revision: 0,
      };
      await f.track('document', id);
      if (action !== 'create')
        await f.insert('document', {
          ...baseline,
          id,
          content: ctx.sql.json(content),
          created_at: epoch,
          updated_at: epoch,
        });
      if (action !== 'create')
        await f.insert('document_collaborator', {
          id: cid,
          document_id: id,
          user_id: ctx.ownerID,
          role_id: null,
          status: 'active',
          visibility: 'private',
          created_at: epoch,
        });
      if (actor === 'revoked')
        await f.insert('document_collaborator', {
          id: mutationFixtureID(ctx.id, 'revoked-collaborator'),
          document_id: id,
          user_id: ctx.outsiderID,
          role_id: null,
          status: 'revoked',
          visibility: 'private',
          created_at: epoch,
        });
      await f.track('document_collaborator', newCid);
      await f.track('document_version', vid);
      const needVersion = action === 'updateVersion' || action === 'deleteVersion';
      const versionFields = {
        id: vid,
        document_id: id,
        amendment_id: null,
        blog_id: null,
        content,
        version_number: 1,
        change_summary: 'Fixture version',
        author_id: ctx.ownerID,
      };
      if (needVersion)
        await f.insert('document_version', {
          ...versionFields,
          content: ctx.sql.json(content),
          created_at: epoch,
        });
      await f.track('thread', tid);
      const needThread =
        action !== 'createThread' &&
        ![
          'create',
          'updateContent',
          'createVersion',
          'addCollaborator',
          'delete',
          'updateVersion',
          'deleteVersion',
        ].includes(action);
      const threadFields = {
        id: tid,
        document_id: id,
        amendment_id: null,
        statement_id: null,
        blog_id: null,
        todo_id: null,
        user_id: ctx.ownerID,
        content: 'Fixture thread',
        status: 'open',
        resolved_at: null,
        upvotes: 0,
        downvotes: 0,
        position: null,
      };
      if (needThread)
        await f.insert('thread', { ...threadFields, created_at: epoch, updated_at: epoch });
      await f.track('comment', comment);
      const needComment = [
        'voteComment',
        'updateCommentVote',
        'deleteCommentVote',
        'updateComment',
      ].includes(action);
      const commentFields = {
        id: comment,
        thread_id: tid,
        user_id: ctx.ownerID,
        parent_id: null,
        content: 'Fixture comment',
        upvotes: 0,
        downvotes: 0,
      };
      if (needComment)
        await f.insert('comment', { ...commentFields, created_at: epoch, updated_at: epoch });
      await f.track('thread_vote', tv);
      const needTV = action === 'updateThreadVote' || action === 'deleteThreadVote';
      if (needTV) {
        await f.insert('thread_vote', {
          id: tv,
          thread_id: tid,
          user_id: ctx.ownerID,
          vote: 1,
          created_at: epoch,
        });
        await f.update('thread', { id: tid, upvotes: 1 });
      }
      await f.track('comment_vote', cv);
      const needCV = action === 'updateCommentVote' || action === 'deleteCommentVote';
      if (needCV) {
        await f.insert('comment_vote', {
          id: cv,
          comment_id: comment,
          user_id: ctx.ownerID,
          vote: 1,
          created_at: epoch,
        });
        await f.update('comment', { id: comment, upvotes: 1 });
      }
      const argsByAction: Record<DocumentAction, ReadonlyJSONValue> = {
        create: { id, amendment_id: null, content, editing_mode: 'edit' },
        updateContent: {
          id,
          content: changed,
          expected_content_revision: revisionConflict ? 1 : 0,
        },
        createVersion: {
          id: vid,
          document_id: id,
          amendment_id: null,
          blog_id: null,
          content,
          version_number: 1,
          change_summary: 'Fixture version',
        },
        addCollaborator: {
          id: newCid,
          document_id: id,
          user_id: ctx.ownerID,
          role_id: null,
          status: 'active',
          visibility: 'private',
        },
        createThread: threadFields,
        addComment: commentFields,
        voteThread: { id: tv, thread_id: tid, user_id: ctx.ownerID, vote: 1 },
        voteComment: { id: cv, comment_id: comment, user_id: ctx.ownerID, vote: 1 },
        delete: { id },
        updateVersion: { id: vid, change_summary: 'Changed version', version_number: 2 },
        deleteVersion: { id: vid },
        updateCommentVote: { id: cv, vote: -1 },
        deleteCommentVote: { id: cv },
        updateThreadVote: { id: tv, vote: -1 },
        deleteThreadVote: { id: tv },
        updateThread: { id: tid, content: 'Changed thread' },
        updateComment: { id: comment, content: 'Changed comment' },
      } as Record<DocumentAction, ReadonlyJSONValue>;
      const success = !rejected;
      const expectedDocument =
        (action === 'create' && rejected) || (success && action === 'delete')
          ? null
          : {
              ...baseline,
              ...(success && action === 'updateContent'
                ? { content: changed, content_revision: 1 }
                : {}),
            };
      const expectedVersion =
        (needVersion && !(success && action === 'deleteVersion')) ||
        (success && action === 'createVersion')
          ? {
              ...versionFields,
              ...(success && action === 'updateVersion'
                ? { change_summary: 'Changed version', version_number: 2 }
                : {}),
            }
          : null;
      const expectedThread =
        needThread || (success && action === 'createThread')
          ? {
              ...threadFields,
              ...(success && action === 'createThread' ? { resolved_at: 0 } : {}),
              ...(success && action === 'updateThread' ? { content: 'Changed thread' } : {}),
              upvotes: (needTV && rejected) || (success && action === 'voteThread') ? 1 : 0,
              downvotes: success && action === 'updateThreadVote' ? 1 : 0,
            }
          : null;
      const expectedComment =
        needComment || (success && action === 'addComment')
          ? {
              ...commentFields,
              ...(success && action === 'updateComment' ? { content: 'Changed comment' } : {}),
              upvotes: (needCV && rejected) || (success && action === 'voteComment') ? 1 : 0,
              downvotes: success && action === 'updateCommentVote' ? 1 : 0,
            }
          : null;
      const expectedTV =
        (needTV && !(success && action === 'deleteThreadVote')) ||
        (success && action === 'voteThread')
          ? {
              id: tv,
              thread_id: tid,
              user_id: ctx.ownerID,
              vote: success && action === 'updateThreadVote' ? -1 : 1,
            }
          : null;
      const expectedCV =
        (needCV && !(success && action === 'deleteCommentVote')) ||
        (success && action === 'voteComment')
          ? {
              id: cv,
              comment_id: comment,
              user_id: ctx.ownerID,
              vote: success && action === 'updateCommentVote' ? -1 : 1,
            }
          : null;
      const newCollaborator =
        success && action === 'addCollaborator'
          ? {
              id: newCid,
              document_id: id,
              user_id: ctx.ownerID,
              role_id: null,
              status: 'active',
              visibility: 'private',
            }
          : null;
      let request: unknown;
      let beforeFields: Row | null = baseline;
      let afterFields: Row | null = expectedDocument;
      let target = id;
      let array = false;
      switch (queryName) {
        case 'documents.versions':
          request = queries.documents.versions({ document_id: id });
          target = vid;
          array = true;
          beforeFields = needVersion ? versionFields : null;
          afterFields = expectedVersion;
          break;
        case 'documents.collaborators':
          request = queries.documents.collaborators({ document_id: id });
          target = newCid;
          array = true;
          beforeFields = null;
          afterFields = newCollaborator;
          break;
        case 'documents.threads':
          request = queries.documents.threads({ document_id: id });
          target = tid;
          array = true;
          beforeFields = needThread ? { ...threadFields, upvotes: needTV ? 1 : 0 } : null;
          afterFields = expectedThread;
          break;
        case 'documents.comments':
          request = queries.documents.comments({ thread_id: tid });
          target = comment;
          array = true;
          beforeFields = needComment ? { ...commentFields, upvotes: needCV ? 1 : 0 } : null;
          afterFields = expectedComment;
          break;
        default:
          request = queries.documents.byId({ id });
          break;
      }
      const match = (data: unknown, expected: Row | null) =>
        hasFields(
          array
            ? Array.isArray(data)
              ? data.find(v => record(v)?.id === target)
              : undefined
            : data,
          expected
        );
      if (action === 'create') {
        beforeFields = null;
        afterFields = null;
      }
      return {
        args: argsByAction[action],
        ...(action === 'create' && !rejected
          ? {}
          : {
              observe: {
                request,
                before: (data: unknown) => match(data, beforeFields),
                after: (data: unknown) => match(data, rejected ? beforeFields : afterFields),
              },
            }),
        async verify() {
          await f.expect('document', id, expectedDocument);
          await f.expect('document_version', vid, expectedVersion);
          await f.expect('document_collaborator', newCid, newCollaborator);
          await f.expect(
            'thread',
            tid,
            expectedThread
              ? {
                  ...expectedThread,
                  resolved_at:
                    expectedThread.resolved_at === 0 ? new Date(0) : expectedThread.resolved_at,
                }
              : null
          );
          await f.expect('comment', comment, expectedComment);
          await f.expect('thread_vote', tv, expectedTV);
          await f.expect('comment_vote', cv, expectedCV);
        },
        restore: () => f.restore(),
        verifyRestored: () => f.verifyRestored(),
      };
    },
  };
}

const messageActions = [
  'createConversation',
  'createConversationFull',
  'sendMessage',
  'sendAssistantMessage',
  'markRead',
  'deleteConversation',
  'deleteConversationFull',
  'updateMessage',
  'updateConversation',
  'addParticipant',
  'removeParticipant',
  'deleteMessage',
] as const;
type MessageAction = (typeof messageActions)[number];
function messageCase(
  action: MessageAction,
  actor: 'owner' | 'outsider' | 'anon' | 'revoked'
): MutationCase {
  const rejected = actor !== 'owner';
  const error =
    action === 'sendAssistantMessage' ||
    (actor !== 'anon' &&
      [
        'sendMessage',
        'deleteConversation',
        'deleteConversationFull',
        'updateMessage',
        'updateConversation',
        'addParticipant',
        'removeParticipant',
        'deleteMessage',
      ].includes(action))
      ? 'mutation_server_failed'
      : 'permission_denied';
  return {
    name: `messages.${action}`,
    variant: rejected ? `${actor}-denied` : 'authorized',
    actor: actor === 'revoked' ? 'outsider' : actor,
    outcome: rejected ? 'server-error' : 'success',
    ...(rejected ? { error } : {}),
    observer: { query: 'messages.conversationById' },
    specification: {
      action,
      actor,
      fixture:
        'accepted personal conversation, owner requester and participant, no other active recipients',
      expected: rejected ? 'all rows unchanged' : action,
      immutableOwnership: 'sender and requester bound to authenticated identity',
      sideEffects: 'persisted message rollups and last_message_at; no notification recipients',
      normalization: {
        contextJSON: '[]',
        nullableTimestampInput: null,
        nullableTimestampParsed: 0,
        sqlTimestamp: '1970-01-01T00:00:00.000Z',
      },
      cleanup: 'conversation and all participants and messages absent',
      participantAddition:
        'new outsider membership; owner membership already exists and unique conversation/user pair must remain distinct',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const id = mutationFixtureID(ctx.id, 'conversation');
      const pid = mutationFixtureID(ctx.id, 'participant');
      const newPid = mutationFixtureID(ctx.id, 'new-participant');
      const mid = mutationFixtureID(ctx.id, 'message');
      const assistant = action === 'sendAssistantMessage';
      const assistantID = 'a12a0000-0000-4000-a000-000000000001';
      if (assistant)
        assert.equal(
          (await f.rows('user', assistantID)).length,
          1,
          'Seeded assistant system identity required'
        );
      const create = action === 'createConversation' || action === 'createConversationFull';
      const baseline = {
        id,
        type: 'direct',
        name: 'Fixture conversation',
        status: 'accepted',
        pinned: false,
        assistant_for_user_id: assistant ? ctx.ownerID : null,
        group_id: null,
        event_id: null,
        requested_by_id: ctx.ownerID,
      };
      await f.track('conversation', id);
      if (!create)
        await f.insert('conversation', { ...baseline, created_at: epoch, last_message_at: null });
      await f.track('conversation_participant', pid);
      const participant = { id: pid, conversation_id: id, user_id: ctx.ownerID, left_at: null };
      if (!create)
        await f.insert('conversation_participant', {
          ...participant,
          joined_at: epoch,
          last_read_at: epoch,
        });
      await f.track('conversation_participant', newPid);
      if (actor === 'revoked')
        await f.insert('conversation_participant', {
          id: mutationFixtureID(ctx.id, 'revoked-participant'),
          conversation_id: id,
          user_id: ctx.outsiderID,
          joined_at: epoch,
          last_read_at: epoch,
          left_at: epoch,
        });
      await f.track('message', mid);
      const needMessage = ['updateMessage', 'deleteMessage', 'deleteConversationFull'].includes(
        action
      );
      const message = {
        id: mid,
        conversation_id: id,
        sender_id: ctx.ownerID,
        content: 'Fixture message',
        context_json: '[]',
        is_read: false,
        deleted_at: null,
      };
      if (needMessage)
        await f.insert('message', { ...message, created_at: epoch, updated_at: epoch });
      const input = {
        id,
        type: 'direct',
        name: 'Fixture conversation',
        status: 'accepted',
        pinned: false,
        assistant_for_user_id: null,
        group_id: null,
        event_id: null,
        last_message_at: null,
      };
      const participantInput = {
        ...participant,
        joined_at: epoch.getTime(),
        last_read_at: epoch.getTime(),
      };
      const messageInput = {
        id: mid,
        conversation_id: id,
        content: 'Fixture message',
        context_json: '[]',
        deleted_at: null,
      };
      const argsByAction: Record<MessageAction, ReadonlyJSONValue> = {
        createConversation: input,
        createConversationFull: { conversation: input, participants: [participantInput] },
        sendMessage: messageInput,
        sendAssistantMessage: messageInput,
        markRead: { id: pid, last_read_at: epoch.getTime() + 1000 },
        deleteConversation: { id },
        deleteConversationFull: { id, messageIds: [mid], participantIds: [pid] },
        updateMessage: { id: mid, content: 'Changed message' },
        updateConversation: { id, name: 'Changed conversation' },
        addParticipant: {
          id: newPid,
          conversation_id: id,
          user_id: ctx.outsiderID,
          joined_at: epoch.getTime(),
          last_read_at: null,
          left_at: null,
        },
        removeParticipant: { id: pid },
        deleteMessage: { id: mid },
      };
      const success = !rejected;
      const removedConversation =
        success && (action === 'deleteConversation' || action === 'deleteConversationFull');
      const expectedConversation =
        removedConversation || (create && rejected)
          ? null
          : {
              ...baseline,
              ...(success && action === 'updateConversation'
                ? { name: 'Changed conversation' }
                : {}),
            };
      const expectedParticipant =
        removedConversation ||
        (create && action !== 'createConversationFull') ||
        (create && rejected) ||
        (success && action === 'removeParticipant')
          ? null
          : {
              ...participant,
              left_at: create && success ? 0 : null,
              last_read_at: new Date(
                epoch.getTime() + (success && action === 'markRead' ? 1000 : 0)
              ),
            };
      const newParticipant =
        success && action === 'addParticipant'
          ? { id: newPid, conversation_id: id, user_id: ctx.outsiderID, left_at: 0 }
          : null;
      const expectedMessage =
        removedConversation || (success && action === 'deleteMessage')
          ? null
          : needMessage ||
              (success && (action === 'sendMessage' || action === 'sendAssistantMessage'))
            ? {
                ...message,
                ...(success && ['sendMessage', 'sendAssistantMessage'].includes(action)
                  ? { deleted_at: 0 }
                  : {}),
                ...(assistant ? { sender_id: assistantID } : {}),
                ...(success && action === 'updateMessage' ? { content: 'Changed message' } : {}),
              }
            : null;
      const before = (data: unknown) => {
        if (create) return hasFields(data, null);
        if (!hasFields(data, baseline)) return false;
        const row = record(data);
        if (!row) return false;
        if (['markRead', 'removeParticipant'].includes(action))
          return (row.participants as Row[])?.some(
            v => v.id === pid && v.last_read_at === epoch.getTime()
          );
        if (action === 'addParticipant')
          return !(row.participants as Row[])?.some(v => v.id === newPid);
        if (['sendMessage', 'sendAssistantMessage'].includes(action))
          return !(row.messages as Row[])?.some(v => v.id === mid);
        if (action === 'updateMessage' || action === 'deleteMessage')
          return (row.messages as Row[])?.some(
            v => v.id === mid && v.content === 'Fixture message'
          );
        return true;
      };
      const after = (data: unknown) => {
        if (rejected) return before(data);
        if (!hasFields(data, expectedConversation)) return false;
        if (!expectedConversation) return true;
        const row = record(data);
        if (!row) return false;
        if (action === 'markRead')
          return (row.participants as Row[])?.some(
            v => v.id === pid && v.last_read_at === epoch.getTime() + 1000
          );
        if (action === 'removeParticipant')
          return !(row.participants as Row[])?.some(v => v.id === pid);
        if (action === 'addParticipant')
          return (row.participants as Row[])?.some(v => hasFields(v, newParticipant));
        if (
          ['sendMessage', 'sendAssistantMessage', 'updateMessage', 'deleteMessage'].includes(action)
        )
          return hasFields(
            (row.messages as Row[] | undefined)?.find(v => v.id === mid),
            expectedMessage
          );
        return true;
      };
      return {
        args: argsByAction[action],
        observe: { request: queries.messages.conversationById({ id }), before, after },
        async verify() {
          await f.expect('conversation', id, expectedConversation);
          await f.expect(
            'conversation_participant',
            pid,
            expectedParticipant
              ? {
                  ...expectedParticipant,
                  left_at:
                    expectedParticipant.left_at === 0 ? new Date(0) : expectedParticipant.left_at,
                }
              : null
          );
          await f.expect(
            'conversation_participant',
            newPid,
            newParticipant ? { ...newParticipant, left_at: new Date(0) } : null
          );
          await f.expect(
            'message',
            mid,
            expectedMessage
              ? {
                  ...expectedMessage,
                  deleted_at:
                    expectedMessage.deleted_at === 0 ? new Date(0) : expectedMessage.deleted_at,
                }
              : null
          );
          if (success && (action === 'sendMessage' || action === 'sendAssistantMessage')) {
            const [row] = await f.rows('conversation', id);
            assert(row.last_message_at instanceof Date, 'Message updates conversation timestamp');
            const [stored] = await f.rows('message', mid);
            assert.deepEqual(row.last_message_at, stored.created_at);
          }
        },
        restore: () => f.restore(),
        verifyRestored: () => f.verifyRestored(),
      };
    },
  };
}

function messageDeliveryCase(): MutationCase {
  const base = messageCase('sendMessage', 'owner');
  return {
    ...base,
    variant: 'accepted-recipient-push-delivery',
    specification: {
      action: 'sendMessage',
      recipient: 'accepted second participant',
      transport:
        'benchmark-only local deterministic delivery endpoint; real P256 keys, VAPID, notification and outbox processing',
      expected: {
        message: 'Fixture message',
        notificationType: 'direct_message',
        notificationJobs: 1,
        notificationJobStatus: 'completed',
        deliveryJobs: 1,
        deliveryStatus: 'sent',
        attempts: 1,
      },
      cleanup:
        'conversation graph, owned subscription, new notification and both outboxes absent; recipient settings restored',
    },
    async prepare(ctx) {
      const target = new URL(process.env.ZERO_PERFORMANCE_DELIVERY_URL ?? '');
      assert(
        ['127.0.0.1', 'localhost', 'host.docker.internal', '[::1]'].includes(target.hostname),
        'Only local benchmark delivery transport is allowed'
      );
      assert.equal(
        process.env.PUSH_DELIVERY_ENABLED,
        'true',
        'Real push delivery processing must be enabled'
      );
      const prepared = await base.prepare(ctx);
      const f = new MutationFixtures(ctx.sql);
      const conversation = mutationFixtureID(ctx.id, 'conversation');
      const participant = mutationFixtureID(ctx.id, 'delivery-recipient');
      const subscription = mutationFixtureID(ctx.id, 'delivery-subscription');
      const endpoint = `https://benchmark.example.invalid/push/${subscription}`;
      try {
        // No other endpoint can be dispatched by this case, even in the isolated database.
        assert.equal(
          (await ctx.sql`select id from push_subscription where user_id=${ctx.outsiderID}`).length,
          0,
          'Delivery recipient must have no pre-existing push subscriptions'
        );
        await f.insert('conversation_participant', {
          id: participant,
          conversation_id: conversation,
          user_id: ctx.outsiderID,
          joined_at: epoch,
          last_read_at: epoch,
          left_at: null,
        });
        await f.trackScope('notification', 'recipient_id', ctx.outsiderID);
        await f.trackScope('push_delivery_outbox', 'push_subscription_id', subscription);
        await f.trackScope('notification_setting', 'user_id', ctx.outsiderID);
        const [settings] =
          await ctx.sql`select id from notification_setting where user_id=${ctx.outsiderID}`;
        const settingsID = settings
          ? String(settings.id)
          : mutationFixtureID(ctx.id, 'delivery-settings');
        const enabled = {
          id: settingsID,
          delivery_settings: ctx.sql.json({ inAppNotifications: true, pushNotifications: true }),
          social_notifications: ctx.sql.json({ directMessages: true }),
        };
        if (settings) await f.update('notification_setting', enabled);
        else await f.insert('notification_setting', { ...enabled, user_id: ctx.outsiderID });
        const key = createECDH('prime256v1');
        key.generateKeys();
        await f.insert('push_subscription', {
          id: subscription,
          user_id: ctx.outsiderID,
          device_id: mutationFixtureID(ctx.id, 'delivery-device'),
          endpoint,
          p256dh: key.getPublicKey().toString('base64url'),
          auth: randomBytes(16).toString('base64url'),
          user_agent: 'isolated-zero-mutation-benchmark',
        });
      } catch (error) {
        await f.restore();
        await prepared.restore();
        throw error;
      }
      const actionURL = `/messages?conversationId=${conversation}`;
      let createdNotificationIDs: string[] = [];
      return {
        ...prepared,
        async verify() {
          await prepared.verify();
          await f.expect('conversation_participant', participant, {
            conversation_id: conversation,
            user_id: ctx.outsiderID,
            left_at: null,
          });
          await f.expect('push_subscription', subscription, { user_id: ctx.outsiderID, endpoint });
          const notifications =
            await ctx.sql`select id,type,sender_id,recipient_id,related_user_id,action_url,is_read from notification where recipient_id=${ctx.outsiderID} and action_url=${actionURL}`;
          assert.equal(notifications.length, 1, 'Exactly one real direct-message notification');
          const notification = notifications[0];
          assert.deepEqual(
            {
              type: notification.type,
              sender_id: notification.sender_id,
              recipient_id: notification.recipient_id,
              related_user_id: notification.related_user_id,
              action_url: notification.action_url,
              is_read: notification.is_read,
            },
            {
              type: 'direct_message',
              sender_id: ctx.ownerID,
              recipient_id: ctx.outsiderID,
              related_user_id: ctx.ownerID,
              action_url: actionURL,
              is_read: false,
            }
          );
          const jobs =
            await ctx.sql`select id,status,attempt_count,completed_at,last_error from push_notification_outbox where notification_id=${notification.id}`;
          assert.equal(jobs.length, 1);
          assert.equal(jobs[0].status, 'completed');
          assert.equal(jobs[0].attempt_count, 1);
          assert(jobs[0].completed_at instanceof Date);
          assert.equal(jobs[0].last_error, null);
          const deliveries =
            await ctx.sql`select notification_id,notification_job_id,user_id,push_subscription_id,kind,status,attempt_count,completed_at,locked_at,last_error,skip_reason,payload from push_delivery_outbox where push_subscription_id=${subscription}`;
          assert.equal(deliveries.length, 1);
          const delivery = deliveries[0];
          assert.deepEqual(
            {
              notification_id: delivery.notification_id,
              notification_job_id: delivery.notification_job_id,
              user_id: delivery.user_id,
              push_subscription_id: delivery.push_subscription_id,
              kind: delivery.kind,
              status: delivery.status,
              attempt_count: delivery.attempt_count,
              locked_at: delivery.locked_at,
              last_error: delivery.last_error,
              skip_reason: delivery.skip_reason,
            },
            {
              notification_id: notification.id,
              notification_job_id: jobs[0].id,
              user_id: ctx.outsiderID,
              push_subscription_id: subscription,
              kind: 'notification',
              status: 'sent',
              attempt_count: 1,
              locked_at: null,
              last_error: null,
              skip_reason: null,
            }
          );
          assert(delivery.completed_at instanceof Date);
          const payload = delivery.payload as Row;
          assert.deepEqual(
            {
              type: payload.type,
              actionUrl: payload.actionUrl,
              notificationId: payload.notificationId,
              tag: payload.tag,
              icon: payload.icon,
              badge: payload.badge,
              requireInteraction: payload.requireInteraction,
              foregroundBehavior: payload.foregroundBehavior,
            },
            {
              type: 'direct_message',
              actionUrl: actionURL,
              notificationId: notification.id,
              tag: notification.id,
              icon: '/android-chrome-192x192.png',
              badge: '/favicon-32x32.png',
              requireInteraction: false,
              foregroundBehavior: 'toast',
            }
          );
        },
        async restore() {
          createdNotificationIDs = (
            await ctx.sql`select id from notification where recipient_id=${ctx.outsiderID} and action_url=${actionURL}`
          ).map(row => String(row.id));
          await f.restore();
          await prepared.restore();
        },
        async verifyRestored() {
          await f.verifyRestored();
          await prepared.verifyRestored();
          assert.equal(
            (
              await ctx.sql`select id from notification where recipient_id=${ctx.outsiderID} and action_url=${actionURL}`
            ).length,
            0
          );
          for (const id of createdNotificationIDs)
            for (const table of [
              'push_notification_outbox',
              'push_delivery_outbox',
              'notification_user_state',
            ]) {
              assert.equal(
                (await ctx.sql`select id from ${ctx.sql(table)} where notification_id=${id}`)
                  .length,
                0,
                `${table} cascade independently verified`
              );
            }
        },
      };
    },
  };
}

function documentLateRevocationCase(): MutationCase {
  const base = documentCase('updateContent', 'revoked');
  return {
    ...base,
    variant: 'rights-revoked-after-writer-preload',
    specification: {
      action: 'updateContent',
      actor: 'outsider',
      initialAuthority: 'active document collaborator',
      transition:
        'SQL revokes collaborator only after writer preload, before real subject invocation',
      expected:
        'permission_denied; original content and revision 0 remain; revoked collaborator retains existing public-query read access',
      rollback:
        'settled writer query contains original content and revision 0, with no optimistic changed content',
      cleanup: 'entire fixture graph absent',
    },
    async prepare(ctx) {
      const prepared = await base.prepare(ctx);
      const collaborator = mutationFixtureID(ctx.id, 'revoked-collaborator');
      await ctx.sql`update document_collaborator set status='active' where id=${collaborator}`;
      return {
        ...prepared,
        requireWriterBefore: true,
        async beforeInvoke() {
          await ctx.sql`update document_collaborator set status='revoked' where id=${collaborator}`;
        },
        async verify() {
          await prepared.verify();
          const [row] =
            await ctx.sql`select status,user_id from document_collaborator where id=${collaborator}`;
          assert.deepEqual(row, { status: 'revoked', user_id: ctx.outsiderID });
        },
        async verifyRollback(writer) {
          assert(prepared.observe);
          interface View {
            addListener: (listener: (data: unknown, type: string) => void) => () => void;
            destroy: () => void;
          }
          const view = (
            writer as { materialize: (request: unknown, options: { ttl: 'none' }) => View }
          ).materialize(prepared.observe.request, { ttl: 'none' });
          let release: (() => void) | undefined;
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await new Promise<void>((resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('Revoked writer document query did not settle')),
                15_000
              );
              release = view.addListener((data, type) => {
                if (type === 'error') reject(new Error('Writer revocation query failed'));
                if (type === 'complete' && prepared.observe?.before(data)) resolve();
              });
            });
          } finally {
            if (timer) clearTimeout(timer);
            release?.();
            view.destroy();
          }
        },
      };
    },
  };
}

const blogActions = [
  'create',
  'createFull',
  'update',
  'delete',
  'createEntry',
  'updateEntry',
  'deleteEntry',
  'createSupportVote',
  'updateSupportVote',
  'deleteSupportVote',
  'createRole',
  'assignActionRight',
] as const;
type BlogAction = (typeof blogActions)[number];
function blogCase(
  action: BlogAction,
  actor: 'owner' | 'outsider' | 'anon' | 'public-voter' | 'revoked'
): MutationCase {
  const rejected = actor !== 'owner' && actor !== 'public-voter';
  const management = action === 'createRole' || action === 'assignActionRight';
  return {
    name: `blogs.${action}`,
    variant:
      actor === 'public-voter'
        ? 'public-third-party-authorized'
        : rejected
          ? `${actor}-denied`
          : 'authorized',
    actor: actor === 'revoked' || actor === 'public-voter' ? 'outsider' : actor,
    outcome: rejected ? 'server-error' : 'success',
    ...(rejected ? { error: 'permission_denied' } : {}),
    observer: { query: management ? 'blogs.byIdWithManagement' : 'blogs.byIdWithDetails' },
    specification: {
      action,
      actor,
      fixture:
        actor === 'public-voter'
          ? 'public personal blog by owner; authenticated third-party support vote; real owner role and management rights'
          : 'private personal blog with real owner role and manage rights',
      createBootstrap: {
        roles: ['Owner', 'Writer'],
        rights: [
          'blogs/manage',
          'blogBloggers/manage',
          'notifications/manageNotifications',
          'notifications/viewNotifications',
          'blogs/view',
          'blogs/update',
          'notifications/viewNotifications',
        ],
        owner: 'authenticated actor',
      },
      expected: rejected ? 'unchanged' : action,
      supportCounters:
        'server maintains supporter_count and like_count from positive persisted support votes; upvotes/downvotes remain zero',
      cleanup:
        'blog, bloggers, roles, action rights, votes, generated notifications and search projection restored',
    },
    async prepare(ctx) {
      const voterID = actor === 'public-voter' ? ctx.outsiderID : ctx.ownerID;
      const f = new MutationFixtures(ctx.sql);
      const id = mutationFixtureID(ctx.id, 'blog');
      const ownerEntry = mutationFixtureID(ctx.id, 'blog-owner');
      const rid = mutationFixtureID(ctx.id, 'owner-role');
      const entry = mutationFixtureID(ctx.id, 'blog-entry');
      const support = mutationFixtureID(ctx.id, 'blog-support');
      const newRole = mutationFixtureID(ctx.id, 'blog-new-role');
      const newRight = mutationFixtureID(ctx.id, 'blog-new-right');
      const create = action === 'create' || action === 'createFull';
      const baseline = {
        id,
        title: 'Fixture blog',
        description: 'Fixture description',
        content: null,
        date: null,
        image_url: null,
        video_url: null,
        visibility: actor === 'public-voter' ? 'public' : 'private',
        editing_mode: 'edit',
        discussions: null,
        group_id: null,
        subscriber_count: 0,
        supporter_count: 0,
        like_count: 0,
        comment_count: 0,
        upvotes: 0,
        downvotes: 0,
      };
      await f.track('blog', id);
      await f.trackScope('search_document', 'entity_id', id);
      if (!create) await f.insert('blog', { ...baseline, created_at: epoch, updated_at: epoch });
      await f.trackScope('blog_blogger', 'blog_id', id);
      await f.trackScope('role', 'blog_id', id);
      await f.trackScope('action_right', 'blog_id', id);
      await f.trackScope('notification', 'related_blog_id', id);
      if (!create) {
        await f.insert('role', {
          id: rid,
          name: 'Fixture owner',
          scope: 'blog',
          blog_id: id,
          created_at: epoch,
        });
        for (const resource of ['blogs', 'blogBloggers'])
          await f.insert('action_right', {
            id: mutationFixtureID(ctx.id, `right-${resource}`),
            resource,
            action: 'manage',
            role_id: rid,
            blog_id: id,
            created_at: epoch,
          });
        await f.insert('blog_blogger', {
          id: ownerEntry,
          blog_id: id,
          user_id: ctx.ownerID,
          role_id: rid,
          status: 'owner',
          visibility: 'private',
          created_at: epoch,
        });
      }
      if (actor === 'revoked')
        await f.insert('blog_blogger', {
          id: mutationFixtureID(ctx.id, 'revoked-blogger'),
          blog_id: id,
          user_id: ctx.outsiderID,
          role_id: rid,
          status: 'removed',
          visibility: 'private',
          created_at: epoch,
        });
      await f.track('blog_blogger', entry);
      const needEntry = action === 'updateEntry' || action === 'deleteEntry';
      const entryFields = {
        id: entry,
        blog_id: id,
        user_id: ctx.ownerID,
        role_id: null,
        status: 'writer',
        visibility: 'private',
      };
      if (needEntry) await f.insert('blog_blogger', { ...entryFields, created_at: epoch });
      await f.track('blog_support_vote', support);
      const needVote = action === 'updateSupportVote' || action === 'deleteSupportVote';
      if (needVote) {
        await f.insert('blog_support_vote', {
          id: support,
          blog_id: id,
          user_id: voterID,
          vote: 1,
          created_at: epoch,
        });
        await f.update('blog', { id, supporter_count: 1, like_count: 1 });
      }
      await f.track('role', newRole);
      await f.track('action_right', newRight);
      const input = {
        id,
        title: 'Fixture blog',
        description: 'Fixture description',
        content: null,
        date: null,
        image_url: null,
        video_url: null,
        visibility: 'private',
        editing_mode: 'edit',
        discussions: null,
        group_id: null,
        like_count: 0,
        comment_count: 0,
        upvotes: 0,
        downvotes: 0,
      };
      const roleInput = {
        id: newRole,
        name: 'Fixture writer',
        description: 'Reviewed fixture role',
        scope: 'blog',
        blog_id: id,
        group_id: null,
        event_id: null,
        amendment_id: null,
      };
      const rightInput = {
        id: newRight,
        role_id: rid,
        resource: 'blogs',
        action: 'view',
        blog_id: id,
        group_id: null,
        event_id: null,
        amendment_id: null,
      };
      const args: Record<BlogAction, ReadonlyJSONValue> = {
        create: input,
        createFull: { blog: input },
        update: { id, content: [{ type: 'p', children: [{ text: 'Changed blog' }] }] },
        delete: { id },
        createEntry: entryFields,
        updateEntry: { id: entry, visibility: 'public' },
        deleteEntry: { id: entry },
        createSupportVote: { id: support, blog_id: id, vote: 1 },
        updateSupportVote: { id: support, vote: -1 },
        deleteSupportVote: { id: support },
        createRole: roleInput,
        assignActionRight: rightInput,
      };
      const success = !rejected;
      const expectedBlog =
        (create && rejected) || (success && action === 'delete')
          ? null
          : {
              ...baseline,
              ...(success && action === 'update'
                ? { content: [{ type: 'p', children: [{ text: 'Changed blog' }] }] }
                : {}),
              supporter_count:
                (needVote && rejected) || (success && action === 'createSupportVote') ? 1 : 0,
              like_count:
                (needVote && rejected) || (success && action === 'createSupportVote') ? 1 : 0,
            };
      const expectedEntry =
        (needEntry && !(success && action === 'deleteEntry')) ||
        (success && action === 'createEntry')
          ? {
              ...entryFields,
              ...(success && action === 'updateEntry' ? { visibility: 'public' } : {}),
            }
          : null;
      const expectedVote =
        (needVote && !(success && action === 'deleteSupportVote')) ||
        (success && action === 'createSupportVote')
          ? {
              id: support,
              blog_id: id,
              user_id: voterID,
              vote: success && action === 'updateSupportVote' ? -1 : 1,
            }
          : null;
      const before = (data: unknown) => {
        if (create) return hasFields(data, null);
        if (
          !hasFields(data, {
            ...baseline,
            supporter_count: needVote ? 1 : 0,
            like_count: needVote ? 1 : 0,
          })
        )
          return false;
        const row = record(data);
        if (!row) return false;
        if (action.includes('Entry'))
          return hasFields(
            (row.bloggers as Row[])?.find(v => v.id === entry),
            needEntry ? entryFields : null
          );
        if (action.includes('SupportVote'))
          return hasFields(
            (row.support_votes as Row[])?.find(v => v.id === support),
            needVote ? { vote: 1 } : null
          );
        if (action === 'createRole') return !(row.roles as Row[])?.some(v => v.id === newRole);
        if (action === 'assignActionRight')
          return !(row.roles as Row[])?.some(v =>
            (v.action_rights as Row[])?.some(r => r.id === newRight)
          );
        return true;
      };
      const after = (data: unknown) => {
        if (rejected) return before(data);
        if (!hasFields(data, expectedBlog)) return false;
        if (!expectedBlog) return true;
        const row = record(data);
        if (!row) return false;
        if (action.includes('Entry'))
          return hasFields(
            (row.bloggers as Row[])?.find(v => v.id === entry),
            expectedEntry
          );
        if (action.includes('SupportVote'))
          return hasFields(
            (row.support_votes as Row[])?.find(v => v.id === support),
            expectedVote
          );
        if (action === 'createRole')
          return (row.roles as Row[])?.some(v => hasFields(v, roleInput));
        if (action === 'assignActionRight')
          return (row.roles as Row[])?.some(v =>
            (v.action_rights as Row[])?.some(r => hasFields(r, rightInput))
          );
        return true;
      };
      let createdNotificationIDs: string[] = [];
      return {
        args: args[action],
        observe: {
          request: management
            ? queries.blogs.byIdWithManagement({ id })
            : queries.blogs.byIdWithDetails({ id }),
          before,
          after,
        },
        async verify() {
          await f.expect('blog', id, expectedBlog);
          await f.expect('blog_blogger', entry, expectedEntry);
          await f.expect('blog_support_vote', support, expectedVote);
          await f.expect(
            'role',
            newRole,
            success && action === 'createRole'
              ? {
                  ...roleInput,
                  assignment_mode: 'assigned',
                  visibility: 'public',
                  assignee_kind: 'member',
                }
              : null
          );
          await f.expect(
            'action_right',
            newRight,
            success && action === 'assignActionRight' ? rightInput : null
          );
          if (create && success) {
            const roles =
              await ctx.sql`select name,scope,blog_id from role where blog_id = ${id} order by name`;
            assert.deepEqual(Array.from(roles), [
              { name: 'Owner', scope: 'blog', blog_id: id },
              { name: 'Writer', scope: 'blog', blog_id: id },
            ]);
            const rights =
              await ctx.sql`select r.name,a.resource,a.action from action_right a join role r on r.id=a.role_id where a.blog_id=${id} order by r.name,a.resource,a.action`;
            assert.deepEqual(Array.from(rights), [
              { name: 'Owner', resource: 'blogBloggers', action: 'manage' },
              { name: 'Owner', resource: 'blogs', action: 'manage' },
              { name: 'Owner', resource: 'notifications', action: 'manageNotifications' },
              { name: 'Owner', resource: 'notifications', action: 'viewNotifications' },
              { name: 'Writer', resource: 'blogs', action: 'update' },
              { name: 'Writer', resource: 'blogs', action: 'view' },
              { name: 'Writer', resource: 'notifications', action: 'viewNotifications' },
            ]);
            const [owner] =
              await ctx.sql`select user_id,status from blog_blogger where blog_id=${id}`;
            assert.deepEqual(owner, { user_id: ctx.ownerID, status: 'owner' });
          }
          const notices =
            await ctx.sql`select type,sender_id from notification where related_blog_id=${id} order by type`;
          const notificationType =
            success && action === 'deleteEntry'
              ? 'blog_writer_left'
              : success && action.includes('SupportVote') && action !== 'deleteSupportVote'
                ? 'blog_vote_cast'
                : success && action === 'delete'
                  ? 'blog_deleted'
                  : null;
          const count =
            notificationType === 'blog_writer_left' ||
            (notificationType === 'blog_vote_cast' && actor === 'public-voter')
              ? 2
              : notificationType
                ? 1
                : 0;
          assert.deepEqual(
            Array.from(notices),
            Array.from({ length: count }, () => ({
              type: notificationType,
              sender_id: actor === 'public-voter' ? ctx.outsiderID : ctx.ownerID,
            }))
          );
        },
        async restore() {
          createdNotificationIDs = (
            await ctx.sql`select id from notification where related_blog_id=${id}`
          ).map(row => String(row.id));
          await f.restore();
        },
        async verifyRestored() {
          await f.verifyRestored();
          for (const notificationID of createdNotificationIDs)
            for (const table of [
              'push_notification_outbox',
              'push_delivery_outbox',
              'notification_user_state',
            ])
              assert.equal(
                (
                  await ctx.sql`select * from ${ctx.sql(table)} where notification_id=${notificationID}`
                ).length,
                0
              );
        },
      };
    },
  };
}

const studioActions = [...Object.keys(studioCommandSchemas), 'canvas.command', 'apply'];
function studioCase(action: string, actor: 'owner' | 'outsider' | 'anon'): MutationCase {
  const rejected = actor !== 'owner';
  const apply = action === 'apply';
  const canvas = action === 'canvas.command';
  const error =
    actor === 'anon'
      ? apply
        ? 'mutation_server_failed'
        : 'permission_denied'
      : apply || action === 'requestExport'
        ? 'mutation_server_failed'
        : ['renameElementSet', 'archiveElementSet'].includes(action)
          ? 'resource_not_found'
          : 'permission_denied';
  return {
    name: `studio.${action}`,
    variant: rejected ? `${actor}-denied` : 'authorized',
    actor,
    outcome: actor === 'anon' ? 'client-error' : rejected ? 'server-error' : 'success',
    ...(rejected ? { error } : {}),
    observer: {
      query: apply ? 'studio.operation' : canvas ? 'studio.canvasReceipt' : 'studio.commandReceipt',
    },
    specification: {
      action,
      actor,
      fixture:
        'private v5 owner project, deterministic frame and rectangle, revision 0 and explicit canvas generation',
      expected: rejected ? 'no receipt and unchanged state' : action,
      applyNormalization:
        'successful title patch sorts rectangle (UUID parentFrameId) before frame (null parentFrameId); canonical revision 1 and durable applied receipt',
      observer: 'existing public canonical command receipt, independent owner identity',
      upload: '68-byte static PNG through verified local Supabase storage API only',
      cleanup:
        'project, state, revisions, receipts, comments, owned element library, notifications and local storage object absent',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const id = mutationFixtureID(ctx.id, 'studio-project');
      const operationId = mutationFixtureID(ctx.id, 'studio-operation');
      const generation = mutationFixtureID(ctx.id, 'studio-generation');
      const destination = mutationFixtureID(ctx.id, 'studio-copy');
      const frameID = mutationFixtureID(ctx.id, 'studio-frame');
      const shapeID = mutationFixtureID(ctx.id, 'studio-shape');
      const assetID = mutationFixtureID(ctx.id, 'studio-asset');
      const invitationID = mutationFixtureID(ctx.id, 'studio-invitation');
      const setID = mutationFixtureID(ctx.id, 'element-set');
      const revisionID = mutationFixtureID(ctx.id, 'element-revision');
      const instanceID = mutationFixtureID(ctx.id, 'element-instance');
      const editorID = mutationFixtureID(ctx.id, 'editor-action');
      const clientID = mutationFixtureID(ctx.id, 'editor-client');
      const document = createStudioDocumentV5('Fixture studio');
      const frame = createFrameNode('square', { id: frameID, name: 'Fixture frame' });
      const shape = studioNodeSchema.parse({
        id: shapeID,
        type: 'shape',
        name: 'Fixture rectangle',
        shape: 'rectangle',
        parentFrameId: frameID,
        transform: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 1,
        style: {},
      });
      document.nodes = [frame, shape];
      const snapshotShape = { ...shape, parentFrameId: null, zIndex: 0 };
      const snapshot = { nodes: [snapshotShape], width: 100, height: 100, assets: [] };
      const needSet = [
        'instantiateElementSet',
        'renameElementSet',
        'archiveElementSet',
        'publishElementSet',
        'synchronizeElements',
      ].includes(action);
      if (action === 'publishElementSet' || action === 'synchronizeElements')
        document.componentInstances = [
          {
            id: instanceID,
            setId: setID,
            revisionId: revisionID,
            sourceToInstance: { [shapeID]: shapeID },
            localOverrides: {},
            localDeletions: [],
            detachedNodes: [],
          },
        ];
      if (action === 'synchronizeElements') shape.componentRef = instanceID;
      await f.track('studio_project', id);
      await f.track('studio_project', destination);
      await f.track('studio_command_receipt', operationId);
      await f.track('canvas_receipt', operationId);
      await f.track('studio_operation', operationId);
      await f.track('studio_element_set', setID);
      // Generated personal sets use deterministic receipt result IDs but are scoped to an isolated actor snapshot.
      if (action === 'createElementSet')
        await f.trackScope('studio_element_set', 'owner_id', ctx.ownerID);
      await f.trackScope('notification', 'recipient_id', ctx.outsiderID);
      if (action !== 'create') {
        await f.insert('studio_project', {
          id,
          owner_id: ctx.ownerID,
          group_id: null,
          title: 'Fixture studio',
          kind: 'single',
          visibility: 'private',
          document_schema_version: 5,
          created_at: 0,
          updated_at: 0,
        });
        await ctx.sql`insert into studio_state(project_id,document,updated_at) values(${id},${ctx.sql.json(document as never)},0)`;
        await ctx.sql`insert into canvas_control(project_id,phase,generation) values(${id},'edit',${generation}) on conflict(project_id) do update set generation=${generation}`;
      }
      if (needSet) {
        await f.trackScope('studio_element_set_revision', 'set_id', setID);
        await f.insert('studio_element_set', {
          id: setID,
          owner_id: ctx.ownerID,
          group_id: null,
          name: 'Fixture elements',
          ...(action === 'synchronizeElements' ? { archived_at: epoch } : {}),
          created_at: epoch,
          updated_at: epoch,
        });
        await f.insert('studio_element_set_revision', {
          id: revisionID,
          set_id: setID,
          version: 1,
          snapshot: ctx.sql.json(snapshot as never),
          width: 100,
          height: 100,
          created_by_id: ctx.ownerID,
          created_at: epoch,
        });
        await f.update('studio_element_set', { id: setID, current_revision_id: revisionID });
      }
      if (action === 'respondInvitation' || action === 'removeCollaborator')
        await f.insert('studio_project_collaborator', {
          id: invitationID,
          project_id: id,
          user_id: action === 'respondInvitation' ? ctx.ownerID : ctx.outsiderID,
          invited_by_id: ctx.ownerID,
          status: action === 'respondInvitation' ? 'invited' : 'active',
          created_at: 0,
          updated_at: 0,
        });
      if (action === 'inviteCollaborators')
        await f.trackScope('studio_project_collaborator', 'project_id', id);
      const invitationNotificationsBefore =
        action === 'inviteCollaborators'
          ? new Set(
              (await ctx.sql`select id from notification where recipient_id=${ctx.outsiderID}`).map(
                row => String(row.id)
              )
            )
          : new Set<string>();
      if (action === 'claimEditorActions' || action === 'completeEditorAction')
        await f.insert('studio_editor_action', {
          id: editorID,
          project_id: id,
          actor_id: ctx.ownerID,
          request_id: 'fixture-request',
          name: 'fixture-action',
          input: ctx.sql.json({}),
          result: null,
          claimed_by: action === 'completeEditorAction' ? clientID : null,
          created_at: Date.now(),
        });
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII=',
        'base64'
      );
      const path = `${id}/assets/${assetID}`;
      let localStorageURL: URL | undefined;
      let storageKey: string | undefined;
      const storageRequest = async (method: string, url: string, body?: BodyInit) => {
        assert(localStorageURL && storageKey, 'Local Supabase storage credentials required');
        return fetch(new URL(url, localStorageURL), {
          method,
          headers: {
            authorization: `Bearer ${storageKey}`,
            apikey: storageKey,
            'content-type': method === 'POST' ? 'image/png' : 'application/json',
          },
          body,
        });
      };
      if (action === 'finishUpload' && !rejected) {
        localStorageURL = new URL(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '');
        assert(
          ['localhost', '127.0.0.1', '[::1]'].includes(localStorageURL.hostname),
          'Upload fixture rejects nonlocal storage'
        );
        storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const response = await storageRequest('POST', `/storage/v1/object/studio/${path}`, png);
        assert(response.ok, 'Local PNG fixture upload succeeds');
      }
      if (action === 'finishUpload' || action === 'cancelUpload')
        await f.insert('studio_asset', {
          id: assetID,
          project_id: id,
          name: 'Fixture PNG',
          mime_type: 'image/png',
          byte_size: png.length,
          storage_path: path,
          ready: false,
          created_at: 0,
        });
      if (action === 'cancelExport') {
        await f.insert('studio_revision', {
          id: revisionID,
          project_id: id,
          document: ctx.sql.json(document as never),
          created_by_id: ctx.ownerID,
          content_revision: 0,
          created_at: 0,
        });
        await f.insert('studio_export', {
          id: assetID,
          project_id: id,
          revision_id: revisionID,
          requested_by_id: ctx.ownerID,
          format: 'png',
          page_ids: ctx.sql.json([]),
          status: 'queued',
          created_at: 0,
          updated_at: 0,
        });
      }
      await f.track('studio_asset', assetID);
      if (action === 'requestExport') await f.track('studio_export', assetID);
      if (canvas) await f.track('canvas_comment', operationId);
      const common = { operationId };
      const args: Record<string, ReadonlyJSONValue> = {
        create: {
          ...common,
          id,
          groupId: null,
          visibility: 'private',
          title: 'Fixture studio',
          kind: 'single',
          themeId: POLITY_THEME.id,
          themeMode: 'light',
          template: { kind: 'builtin', id: 'blank' },
        },
        duplicate: {
          ...common,
          id,
          destinationId: destination,
          groupId: null,
          visibility: 'private',
        },
        setVisibility: { ...common, id, visibility: 'authenticated' },
        setTemplate: { ...common, id, value: true },
        delete: { ...common, id },
        inviteCollaborators: { ...common, projectId: id, userIds: [ctx.outsiderID] },
        respondInvitation: { ...common, invitationId: invitationID, accept: true },
        removeCollaborator: { ...common, projectId: id, userId: ctx.outsiderID },
        beginUpload: {
          ...common,
          projectId: id,
          id: assetID,
          name: 'Fixture PNG',
          mime: 'image/png',
          size: png.length,
        },
        finishUpload: { ...common, id: assetID },
        cancelUpload: { ...common, id: assetID },
        requestExport: {
          ...common,
          projectId: id,
          id: assetID,
          format: 'png',
          pageIds: [frameID],
          revision: 0,
        },
        cancelExport: { ...common, id: assetID },
        createElementSet: {
          ...common,
          projectId: id,
          groupId: null,
          selectedIds: [shapeID],
          name: 'Fixture elements',
        },
        instantiateElementSet: { ...common, projectId: id, setId: setID },
        renameElementSet: { ...common, setId: setID, name: 'Changed elements' },
        archiveElementSet: { ...common, setId: setID },
        publishElementSet: { ...common, projectId: id, instanceId: instanceID },
        synchronizeElements: { ...common, projectId: id },
        claimEditorActions: { ...common, projectId: id, clientId: clientID },
        completeEditorAction: {
          ...common,
          projectId: id,
          id: editorID,
          clientId: clientID,
          result: { status: 'completed', revision: 0 },
        },
        'canvas.command': {
          ...common,
          projectId: id,
          generation,
          action: 'comment',
          body: 'Fixture comment',
        },
        apply: {
          ...common,
          projectId: id,
          generation,
          expectedRevision: 0,
          changes: [
            {
              path: ['title'],
              before: { exists: true, value: 'Fixture studio' },
              after: { exists: true, value: 'Changed studio' },
            },
          ],
        },
      };
      const request = apply
        ? queries.studio.operation({ projectId: id, operationId })
        : canvas
          ? queries.studio.canvasReceipt({ operationId })
          : queries.studio.commandReceipt({ operationId });
      const before = (data: unknown) => hasFields(data, null);
      const after = (data: unknown) =>
        rejected
          ? before(data)
          : hasFields(data, {
              id: operationId,
              actor_id: ctx.ownerID,
              ...(!apply && !canvas ? { command: action } : {}),
            });
      return {
        args: args[action],
        observe: { request, before, after },
        async verify() {
          await f.expect(
            apply ? 'studio_operation' : canvas ? 'canvas_receipt' : 'studio_command_receipt',
            operationId,
            rejected
              ? null
              : { actor_id: ctx.ownerID, ...(!apply && !canvas ? { command: action } : {}) }
          );
          const success = !rejected;
          await f.expect(
            'studio_project',
            id,
            (action === 'create' && rejected) || (action === 'delete' && success)
              ? null
              : {
                  owner_id: ctx.ownerID,
                  group_id: null,
                  title: apply && success ? 'Changed studio' : 'Fixture studio',
                  kind: 'single',
                  visibility: action === 'setVisibility' && success ? 'authenticated' : 'private',
                  is_template: action === 'setTemplate' && success,
                }
          );
          await f.expect(
            'studio_project',
            destination,
            action === 'duplicate' && success
              ? { owner_id: ctx.ownerID, title: 'Fixture studio · Kopie', visibility: 'private' }
              : null
          );
          if (action !== 'create' && !(action === 'delete' && success)) {
            const [state] =
              await ctx.sql`select document,content_revision from studio_state where project_id=${id}`;
            const expectedDocument =
              action === 'synchronizeElements' && success
                ? {
                    ...document,
                    componentInstances: [],
                    nodes: document.nodes.map(node =>
                      node.id === shapeID ? { ...node, componentRef: null } : node
                    ),
                  }
                : apply && success
                  ? { ...document, title: 'Changed studio', nodes: [shape, frame] }
                  : document;
            assert.deepEqual(state.document, expectedDocument);
            if (apply && success)
              await f.expect('studio_operation', operationId, {
                result: {
                  operationId,
                  status: 'applied',
                  revision: 1,
                  document: expectedDocument,
                  conflicts: [],
                },
                changes: (args.apply as { changes: ReadonlyJSONValue }).changes,
              });
            assert.equal(
              state.content_revision,
              (apply || action === 'synchronizeElements') && success ? 1 : 0
            );
          }
          if (['beginUpload', 'finishUpload', 'cancelUpload'].includes(action))
            await f.expect(
              'studio_asset',
              assetID,
              action === 'beginUpload' && rejected
                ? null
                : {
                    project_id: id,
                    name: 'Fixture PNG',
                    mime_type: 'image/png',
                    byte_size: String(png.length),
                    storage_path: path,
                    ready: action === 'finishUpload' && success,
                  }
            );
          if (action === 'cancelExport')
            await f.expect('studio_export', assetID, {
              status: success ? 'cancelled' : 'queued',
              project_id: id,
            });
          if (action === 'requestExport') {
            await f.expect(
              'studio_export',
              assetID,
              success
                ? {
                    project_id: id,
                    requested_by_id: ctx.ownerID,
                    format: 'png',
                    status: 'queued',
                    page_ids: [frameID],
                  }
                : null
            );
            if (success) {
              const revisions =
                await ctx.sql`select document,content_revision from studio_revision where project_id=${id}`;
              assert.equal(revisions.length, 1);
              assert.deepEqual(revisions[0].document, document);
              assert.equal(revisions[0].content_revision, 0);
            }
          }
          if (action === 'respondInvitation')
            await f.expect('studio_project_collaborator', invitationID, {
              status: success ? 'active' : 'invited',
              user_id: ctx.ownerID,
            });
          if (action === 'inviteCollaborators') {
            const collaborators =
              await ctx.sql`select user_id,status,invited_by_id from studio_project_collaborator where project_id=${id}`;
            assert.deepEqual(
              Array.from(collaborators),
              success
                ? [{ user_id: ctx.outsiderID, status: 'invited', invited_by_id: ctx.ownerID }]
                : []
            );
            const notifications = (
              await ctx.sql`select id,type,sender_id,recipient_id from notification where recipient_id=${ctx.outsiderID}`
            ).filter(row => !invitationNotificationsBefore.has(String(row.id)));
            assert.equal(notifications.length, success ? 1 : 0);
            if (success)
              assert.deepEqual(
                {
                  type: notifications[0].type,
                  sender_id: notifications[0].sender_id,
                  recipient_id: notifications[0].recipient_id,
                },
                {
                  type: 'studio_collaboration_invite',
                  sender_id: ctx.ownerID,
                  recipient_id: ctx.outsiderID,
                }
              );
          }
          if (action === 'removeCollaborator')
            await f.expect(
              'studio_project_collaborator',
              invitationID,
              success ? null : { status: 'active', user_id: ctx.outsiderID }
            );
          if (action === 'claimEditorActions')
            await f.expect('studio_editor_action', editorID, {
              claimed_by: success ? clientID : null,
              result: null,
            });
          if (action === 'completeEditorAction')
            await f.expect('studio_editor_action', editorID, {
              claimed_by: clientID,
              result: success ? { status: 'completed', revision: 0 } : null,
            });
          if (canvas)
            await f.expect(
              'canvas_comment',
              operationId,
              success
                ? {
                    project_id: id,
                    author_id: ctx.ownerID,
                    body: 'Fixture comment',
                    resolved: false,
                  }
                : null
            );
          if (action === 'renameElementSet')
            await f.expect('studio_element_set', setID, {
              name: success ? 'Changed elements' : 'Fixture elements',
            });
          if (action === 'archiveElementSet') {
            const [set] = await f.rows('studio_element_set', setID);
            assert(success ? set.archived_at instanceof Date : set.archived_at === null);
          }
          if (action === 'publishElementSet') {
            const revisions =
              await ctx.sql`select version,width,height from studio_element_set_revision where set_id=${setID} order by version`;
            assert.deepEqual(
              Array.from(revisions),
              success
                ? [
                    { version: 1, width: 100, height: 100 },
                    { version: 2, width: 100, height: 100 },
                  ]
                : [{ version: 1, width: 100, height: 100 }]
            );
          }
          if (action === 'createElementSet' && success) {
            const [receipt] = await f.rows('studio_command_receipt', operationId);
            const result = receipt.result as Row;
            await f.expect('studio_element_set', String(result.id), {
              name: 'Fixture elements',
              owner_id: ctx.ownerID,
            });
            await f.expect('studio_element_set_revision', String(result.revisionId), {
              version: 1,
              width: 100,
              height: 100,
              snapshot: { ...snapshot, nodes: [{ ...snapshotShape, zIndex: 1 }] },
            });
          }
          if (action === 'instantiateElementSet' && success) {
            const [receipt] = await f.rows('studio_command_receipt', operationId);
            assert.deepEqual(receipt.result, {
              setId: setID,
              revisionId: revisionID,
              snapshot,
              assetIds: {},
            });
          }
        },
        async restore() {
          if (localStorageURL) {
            const response = await storageRequest(
              'DELETE',
              '/storage/v1/object/studio',
              JSON.stringify({ prefixes: [path] })
            );
            assert(response.ok, 'Local storage fixture removed');
          }
          await f.restore();
        },
        async verifyRestored() {
          await f.verifyRestored();
          for (const table of [
            'studio_state',
            'canvas_control',
            'canvas_history',
            'studio_revision',
            'studio_project_collaborator',
            'studio_asset',
          ]) {
            const rows = await ctx.sql`select * from ${ctx.sql(table)} where project_id=${id}`;
            assert.equal(rows.length, 0, `${table} restored`);
          }
          if (localStorageURL) {
            const response = await storageRequest('GET', `/storage/v1/object/info/studio/${path}`);
            assert(!response.ok, 'Local storage fixture absent');
          }
        },
      };
    },
  };
}

const projectChatActions = ['join', 'create', 'cancel', 'setSurface', 'undo'] as const;
type ProjectChatAction = (typeof projectChatActions)[number];
function projectChatCase(
  action: ProjectChatAction,
  actor: 'owner' | 'outsider' | 'anon',
  conflict = false
): MutationCase {
  const rejected = actor !== 'owner' || conflict;
  const localDenial = rejected && action === 'setSurface';
  const error = conflict
    ? 'project_undo_conflict'
    : actor === 'anon' && !['cancel', 'undo', 'setSurface'].includes(action)
      ? 'permission_denied'
      : 'mutation_server_failed';
  const queryName =
    action === 'cancel'
      ? 'projectChat.runs'
      : action === 'undo'
        ? 'projectChat.changes'
        : 'messages.conversationById';
  return {
    name: `projectChat.${action}`,
    variant: conflict ? 'concurrent-text-conflict' : rejected ? `${actor}-denied` : 'authorized',
    actor,
    outcome: localDenial ? 'client-error' : rejected ? 'server-error' : 'success',
    ...(rejected ? { error } : {}),
    observer: { query: queryName },
    specification: {
      action,
      actor,
      conflict,
      fixture:
        'private owner amendment, edit-mode text document, real project conversation and running AI run',
      undo: {
        beforeText: 'Original',
        afterText: 'Changed',
        concurrentText: 'Concurrent',
        metadataUnchanged: true,
        expected: conflict
          ? 'project_undo_conflict; change and document unchanged'
          : 'Original restored; revision 1; change undone',
      },
      expected: rejected ? 'unchanged entire graph' : action,
      cleanup: 'amendment, document, conversation, participants, run and changes absent',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const amendment = mutationFixtureID(ctx.id, 'chat-amendment');
      const document = mutationFixtureID(ctx.id, 'chat-document');
      const conversation = mutationFixtureID(ctx.id, 'project-chat');
      const participant = mutationFixtureID(ctx.id, 'project-participant');
      const run = mutationFixtureID(ctx.id, 'project-run');
      const change = mutationFixtureID(ctx.id, 'project-change');
      const original = [{ type: 'p', children: [{ text: 'Original' }] }];
      const changed = [{ type: 'p', children: [{ text: 'Changed' }] }];
      const current = conflict ? [{ type: 'p', children: [{ text: 'Concurrent' }] }] : changed;
      await f.insert('amendment', {
        id: amendment,
        created_by_id: ctx.ownerID,
        title: 'Fixture amendment',
        visibility: 'private',
        code: null,
        reason: null,
        preamble: null,
        discussions: ctx.sql.json([]),
        created_at: epoch,
        updated_at: epoch,
      });
      await f.insert('document', {
        id: document,
        amendment_id: amendment,
        content: ctx.sql.json(current),
        editing_mode: 'edit',
        content_revision: 0,
        created_at: epoch,
        updated_at: epoch,
      });
      await f.update('amendment', { id: amendment, document_id: document });
      await f.track('conversation', conversation);
      if (action !== 'create')
        await f.insert('conversation', {
          id: conversation,
          type: 'project_ai',
          name: 'Fixture project chat',
          status: 'accepted',
          requested_by_id: ctx.ownerID,
          amendment_id: amendment,
          studio_project_id: null,
          created_at: epoch,
          last_message_at: epoch,
        });
      await f.track('conversation_participant', participant);
      await f.track('conversation_participant', conversation);
      if (action !== 'create' && action !== 'join')
        await f.insert('conversation_participant', {
          id: participant,
          conversation_id: conversation,
          user_id: ctx.ownerID,
          joined_at: epoch,
          last_read_at: epoch,
          project_surface: 'amendment_text',
        });
      await f.track('ai_run', run);
      if (action === 'cancel' || action === 'undo')
        await f.insert('ai_run', {
          id: run,
          conversation_id: conversation,
          actor_id: ctx.ownerID,
          request_id: mutationFixtureID(ctx.id, 'request'),
          status: 'running',
          request_hash: 'fixture-request-hash',
          lease_token: mutationFixtureID(ctx.id, 'lease'),
          lease_expires_at: 0,
          created_at: 0,
          updated_at: 0,
        });
      await f.track('ai_change_set', change);
      const metadata = {
        hashtags: [],
        title: 'Fixture amendment',
        code: null,
        reason: null,
        preamble: null,
      };
      if (action === 'undo')
        await f.insert('ai_change_set', {
          id: change,
          conversation_id: conversation,
          run_id: run,
          tool_call_id: 'fixture-tool',
          actor_id: ctx.ownerID,
          resource_kind: 'amendment_text',
          resource_id: document,
          branch_id: null,
          summary: 'Fixture text change',
          status: 'applied',
          before_value: ctx.sql.json({ content: original, metadata, discussions: [] }),
          after_value: ctx.sql.json({ content: changed, metadata, discussions: [] }),
          created_at: 0,
        });
      const args: Record<ProjectChatAction, ReadonlyJSONValue> = {
        join: { conversationId: conversation, participantId: participant },
        create: {
          id: conversation,
          scope: { kind: 'amendment', amendmentId: amendment },
          name: 'Fixture project chat',
        },
        cancel: { runId: run },
        setSurface: { conversationId: conversation, surface: 'city_design' },
        undo: { changeSetId: change },
      };
      const success = !rejected;
      const expectedConversation =
        action === 'create' && rejected
          ? null
          : {
              type: 'project_ai',
              name: 'Fixture project chat',
              status: 'accepted',
              requested_by_id: ctx.ownerID,
              amendment_id: amendment,
              studio_project_id: null,
            };
      const expectedParticipant =
        (action === 'join' && rejected) || action === 'create'
          ? null
          : {
              conversation_id: conversation,
              user_id: ctx.ownerID,
              ...(action === 'setSurface'
                ? { project_surface: success ? 'city_design' : 'amendment_text' }
                : {}),
            };
      const request =
        action === 'cancel'
          ? queries.projectChat.runs({ conversationId: conversation })
          : action === 'undo'
            ? queries.projectChat.changes({ conversationId: conversation })
            : queries.messages.conversationById({ id: conversation });
      const before = (data: unknown) => {
        if (action === 'cancel' || action === 'undo')
          return (
            Array.isArray(data) &&
            data.some(v =>
              hasFields(v, {
                id: action === 'cancel' ? run : change,
                status: action === 'cancel' ? 'running' : 'applied',
              })
            )
          );
        if (action === 'create') return hasFields(data, null);
        if (!hasFields(data, expectedConversation)) return false;
        const participants = record(data)?.participants as Row[];
        return action === 'join'
          ? !participants?.some(v => v.id === participant)
          : participants?.some(v => v.id === participant && v.project_surface === 'amendment_text');
      };
      const after = (data: unknown) => {
        if (rejected) return before(data);
        if (action === 'cancel' || action === 'undo')
          return (
            Array.isArray(data) &&
            data.some(v =>
              hasFields(v, {
                id: action === 'cancel' ? run : change,
                status: action === 'cancel' ? 'cancelled' : 'undone',
              })
            )
          );
        if (!hasFields(data, expectedConversation)) return false;
        const participants = record(data)?.participants as Row[];
        if (action === 'create')
          return participants?.some(v => v.id === conversation && v.user_id === ctx.ownerID);
        return participants?.some(
          v =>
            v.id === participant &&
            v.user_id === ctx.ownerID &&
            (action !== 'setSurface' || v.project_surface === 'city_design')
        );
      };
      return {
        args: args[action],
        observe: { request, before, after },
        async verify() {
          await f.expect('conversation', conversation, expectedConversation);
          await f.expect('conversation_participant', participant, expectedParticipant);
          await f.expect(
            'conversation_participant',
            conversation,
            action === 'create' && success
              ? { conversation_id: conversation, user_id: ctx.ownerID }
              : null
          );
          await f.expect('document', document, {
            amendment_id: amendment,
            content: action === 'undo' && success ? original : current,
            content_revision: action === 'undo' && success ? 1 : 0,
          });
          await f.expect(
            'ai_run',
            run,
            action === 'cancel' || action === 'undo'
              ? {
                  status: action === 'cancel' && success ? 'cancelled' : 'running',
                  actor_id: ctx.ownerID,
                }
              : null
          );
          await f.expect(
            'ai_change_set',
            change,
            action === 'undo'
              ? {
                  status: success ? 'undone' : 'applied',
                  resource_id: document,
                  ...(rejected ? { undone_at: null } : {}),
                }
              : null
          );
          if (action === 'undo' && success) {
            const [row] = await f.rows('ai_change_set', change);
            assertProjectChatUndoTimestamp(row.undone_at);
          }
        },
        restore: () => f.restore(),
        verifyRestored: () => f.verifyRestored(),
      };
    },
  };
}

function documentTitleCase(actor: 'owner' | 'outsider' | 'anon'): MutationCase {
  const rejected = actor !== 'owner';
  return {
    name: 'documents.updateGroupDocumentTitle',
    variant: rejected ? `${actor}-denied` : 'authorized',
    actor,
    outcome: rejected ? 'client-error' : 'success',
    ...(rejected ? { error: 'mutation_server_failed' } : {}),
    observer: { query: 'documents.byId' },
    specification: {
      fixture: 'owner-authored private amendment and linked document',
      actor,
      expectedParentTitle: rejected ? 'Fixture amendment' : 'Changed amendment',
      documentContent: null,
      denial:
        'private parent is absent in unauthorized writer cache; shared title lookup rejects locally before API submission',
      cleanup: 'amendment, document and search projections absent',
    },
    async prepare(ctx) {
      const f = new MutationFixtures(ctx.sql);
      const amendment = mutationFixtureID(ctx.id, 'document-title-amendment');
      const id = mutationFixtureID(ctx.id, 'document-title');
      await f.insert('amendment', {
        id: amendment,
        created_by_id: ctx.ownerID,
        title: 'Fixture amendment',
        visibility: 'private',
        created_at: epoch,
        updated_at: epoch,
      });
      await f.insert('document', {
        id,
        amendment_id: amendment,
        content: null,
        editing_mode: 'edit',
        created_at: epoch,
        updated_at: epoch,
      });
      await f.update('amendment', { id: amendment, document_id: id });
      const match = (data: unknown, title: string) =>
        hasFields(data, { id, amendment_id: amendment }) &&
        hasFields(record(data)?.amendment, { id: amendment, title });
      return {
        args: { document_id: id, title: 'Changed amendment' },
        observe: {
          request: queries.documents.byId({ id }),
          before: data => match(data, 'Fixture amendment'),
          after: data => match(data, rejected ? 'Fixture amendment' : 'Changed amendment'),
        },
        async verify() {
          await f.expect('amendment', amendment, {
            title: rejected ? 'Fixture amendment' : 'Changed amendment',
            created_by_id: ctx.ownerID,
          });
          await f.expect('document', id, { amendment_id: amendment, content: null });
        },
        restore: () => f.restore(),
        verifyRestored: () => f.verifyRestored(),
      };
    },
  };
}

export function contentMutationCases(): MutationCase[] {
  return [
    ...statementActions.flatMap(action =>
      (action === 'create' || action === 'createFull'
        ? (['owner', 'anon'] as const)
        : (['owner', 'outsider', 'anon'] as const)
      ).map(actor => statementCase(action, actor))
    ),
    ...todoActions.flatMap(action =>
      (action === 'create' || action === 'createFull'
        ? (['owner', 'anon'] as const)
        : (['owner', 'outsider', 'anon'] as const)
      ).map(actor => todoCase(action, actor))
    ),
    ...documentActions.flatMap(action =>
      (action === 'create'
        ? (['owner', 'anon'] as const)
        : (['owner', 'outsider', 'anon'] as const)
      ).map(actor => documentCase(action, actor))
    ),
    documentCase('updateContent', 'revoked'),
    documentCase('updateContent', 'owner', true),
    documentLateRevocationCase(),
    ...(['owner', 'outsider', 'anon'] as const).map(documentTitleCase),
    ...messageActions.flatMap(action =>
      (action === 'createConversation' || action === 'createConversationFull'
        ? (['owner', 'anon'] as const)
        : (['owner', 'outsider', 'anon'] as const)
      ).map(actor => messageCase(action, actor))
    ),
    messageCase('sendMessage', 'revoked'),
    messageDeliveryCase(),
    ...blogActions.flatMap(action =>
      (action === 'create' || action === 'createFull'
        ? (['owner', 'anon'] as const)
        : (['owner', 'outsider', 'anon'] as const)
      ).map(actor => blogCase(action, actor))
    ),
    blogCase('update', 'revoked'),
    ...(['createSupportVote', 'updateSupportVote', 'deleteSupportVote'] as const).flatMap(
      action => [statementCase(action, 'public-voter'), blogCase(action, 'public-voter')]
    ),
    ...canvasMutationCases(),
    ...studioApplyConflictCases(),
    ...studioActions
      .filter(action => action !== 'canvas.command')
      .flatMap(action =>
        (action === 'create'
          ? (['owner', 'anon'] as const)
          : (['owner', 'outsider', 'anon'] as const)
        ).map(actor => studioCase(action, actor))
      ),
    ...projectChatActions.flatMap(action =>
      (['owner', 'outsider', 'anon'] as const).map(actor => projectChatCase(action, actor))
    ),
    projectChatCase('undo', 'owner', true),
  ].map(entry => ({ ...entry, actor: entry.actor === 'anon' ? 'anonymous' : entry.actor }));
}
