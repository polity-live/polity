import { beforeEach, expect, it, vi } from 'vitest';
import {
  createCtx,
  createQueryHarness,
  createTxHarness,
  evaluatePredicate,
} from '../../__tests__/test-utils/zeroHarness';
vi.mock('@rocicorp/zero', () => ({ defineMutator: (_schema: unknown, fn: unknown) => ({ fn }) }));
const io = vi.hoisted(() => ({ zql: {} as any }));
vi.mock('../../schema', () => ({ zql: new Proxy({}, { get: (_target, key) => io.zql[key] }) }));
import { projectChatSharedMutators } from '../shared-mutators';
let queries: ReturnType<typeof createQueryHarness>;
const actor = crypto.randomUUID(),
  conversationId = crypto.randomUUID(),
  participantId = crypto.randomUUID();
const ctx = createCtx({ userID: actor });
beforeEach(() => {
  queries = createQueryHarness();
  io.zql = queries.zql;
});
const invoke = (
  name: keyof typeof projectChatSharedMutators,
  tx: ReturnType<typeof createTxHarness>['tx'],
  args: unknown,
  user = ctx
) => (projectChatSharedMutators[name].fn as any)({ tx, ctx: user, args });

it.each(['studio', 'amendment'] as const)(
  'creates a %s conversation and initial participant only after current project access',
  async kind => {
    const state = createTxHarness();
    const projectId = crypto.randomUUID();
    state.queueRunResults({ id: projectId });
    const scope = kind === 'studio' ? { kind, projectId } : { kind, amendmentId: projectId };
    await invoke('create', state.tx, { id: conversationId, scope, name: 'Chat' });
    expect(
      queries.lastQuery(kind === 'studio' ? 'studio_project' : 'amendment').calls
    ).toContainEqual(['where', 'id', projectId]);
    const conversation = state.mutation('conversation', 'insert').mock.lastCall![0];
    expect(conversation).toMatchObject({
      id: conversationId,
      type: 'project_ai',
      name: 'Chat',
      status: 'accepted',
      requested_by_id: actor,
      studio_project_id: kind === 'studio' ? projectId : null,
      amendment_id: kind === 'amendment' ? projectId : null,
    });
    expect(state.mutation('conversation_participant', 'insert')).toHaveBeenCalledWith({
      id: conversationId,
      conversation_id: conversationId,
      user_id: actor,
      joined_at: conversation.created_at,
      last_read_at: conversation.created_at,
    });
  }
);

it.each(['studio', 'amendment'] as const)(
  'supports optimistic %s creation without asserting canonical server project access',
  async kind => {
    const state = createTxHarness({ location: 'client' });
    const id = crypto.randomUUID();
    await invoke('create', state.tx, {
      id: conversationId,
      scope: kind === 'studio' ? { kind, projectId: id } : { kind, amendmentId: id },
      name: 'Draft chat',
    });
    expect(state.tx.run).not.toHaveBeenCalled();
    expect(state.mutation('conversation', 'insert')).toHaveBeenCalledOnce();
  }
);

it.each(['studio', 'amendment'] as const)(
  'rejects denied %s creation without inserting speculative participants on the server',
  async kind => {
    const state = createTxHarness();
    state.queueRunResults(null);
    const id = crypto.randomUUID();
    await expect(
      invoke('create', state.tx, {
        id: conversationId,
        scope: kind === 'studio' ? { kind, projectId: id } : { kind, amendmentId: id },
        name: 'Chat',
      })
    ).rejects.toThrow('Project access denied');
    expect(state.mutation('conversation', 'insert')).not.toHaveBeenCalled();
    expect(state.mutation('conversation_participant', 'insert')).not.toHaveBeenCalled();
  }
);

it.each(['join', 'create', 'setSurface'] as const)(
  'requires authenticated identity before server %s queries',
  async name => {
    const state = createTxHarness();
    await expect(invoke(name, state.tx, {}, createCtx({ userID: 'anon' }))).rejects.toThrow();
    expect(state.tx.run).not.toHaveBeenCalled();
  }
);

it.each(['server', 'client'] as const)(
  'joins from %s only once and records the current actor as participant',
  async location => {
    const state = createTxHarness({ location });
    state.queueRunResults(...(location === 'server' ? [{ id: conversationId }, null] : [null]));
    await invoke('join', state.tx, { conversationId, participantId });
    expect(queries.lastQuery('conversation_participant').calls).toEqual(
      expect.arrayContaining([
        ['where', 'conversation_id', conversationId],
        ['where', 'user_id', actor],
      ])
    );
    expect(state.mutation('conversation_participant', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: participantId,
        conversation_id: conversationId,
        user_id: actor,
        joined_at: expect.any(Number),
        last_read_at: expect.any(Number),
      })
    );
    state.queueRunResults(
      ...(location === 'server'
        ? [{ id: conversationId }, { id: participantId }]
        : [{ id: participantId }])
    );
    await invoke('join', state.tx, { conversationId, participantId });
    expect(state.mutation('conversation_participant', 'insert')).toHaveBeenCalledOnce();
  }
);

it.each(['join', 'setSurface'] as const)(
  'denies %s after conversation access is revoked, before looking up participant state',
  async name => {
    const state = createTxHarness();
    state.queueRunResults(null);
    await expect(
      invoke(name, state.tx, { conversationId, participantId, surface: 'city_design' })
    ).rejects.toThrow('Project access denied');
    expect(state.tx.run).toHaveBeenCalledOnce();
    expect(state.mutation('conversation_participant', 'insert')).not.toHaveBeenCalled();
    expect(state.mutation('conversation_participant', 'update')).not.toHaveBeenCalled();
  }
);

it.each(['server', 'client'] as const)(
  'changes only the current %s participant surface and requires an existing participant',
  async location => {
    const state = createTxHarness({ location });
    state.queueRunResults(...(location === 'server' ? [{ id: conversationId }, null] : [null]));
    await expect(
      invoke('setSurface', state.tx, { conversationId, surface: 'city_design' })
    ).rejects.toThrow('Project access denied');
    expect(state.mutation('conversation_participant', 'update')).not.toHaveBeenCalled();
    state.queueRunResults(
      ...(location === 'server'
        ? [{ id: conversationId }, { id: participantId }]
        : [{ id: participantId }])
    );
    await invoke('setSurface', state.tx, { conversationId, surface: 'amendment_text' });
    expect(state.mutation('conversation_participant', 'update')).toHaveBeenCalledWith({
      id: participantId,
      project_surface: 'amendment_text',
    });
    expect(queries.lastQuery('conversation_participant').calls).toContainEqual([
      'where',
      'user_id',
      actor,
    ]);
  }
);

it('does not speculate a run cancellation or inverse document mutation on the client', async () => {
  const state = createTxHarness({ location: 'client' });
  await invoke('cancel', state.tx, { runId: crypto.randomUUID() });
  await invoke('undo', state.tx, { changeSetId: crypto.randomUUID() });
  expect(state.tx.run).not.toHaveBeenCalled();
  expect(state.mutation('ai_run', 'update')).not.toHaveBeenCalled();
});

it.each(['missing', 'foreign', 'revoked'] as const)(
  'rejects cancellation of a %s run without updating it',
  async reason => {
    const state = createTxHarness();
    const runId = crypto.randomUUID();
    state.queueRunResults(
      reason === 'missing'
        ? null
        : {
            id: runId,
            actor_id: reason === 'foreign' ? crypto.randomUUID() : actor,
            conversation_id: conversationId,
            status: 'running',
          },
      null
    );
    await expect(invoke('cancel', state.tx, { runId })).rejects.toThrow('Project access denied');
    expect(state.mutation('ai_run', 'update')).not.toHaveBeenCalled();
  }
);

it.each(['running', 'interrupted', 'completed', 'cancelled'] as const)(
  'cancels only a current actor’s active or interrupted run (status=%s)',
  async status => {
    const state = createTxHarness();
    const runId = crypto.randomUUID();
    state.queueRunResults(
      { id: runId, actor_id: actor, conversation_id: conversationId, status },
      { id: conversationId }
    );
    await invoke('cancel', state.tx, { runId });
    if (status === 'running' || status === 'interrupted')
      expect(state.mutation('ai_run', 'update')).toHaveBeenCalledWith({
        id: runId,
        status: 'cancelled',
        updated_at: expect.any(Number),
      });
    else expect(state.mutation('ai_run', 'update')).not.toHaveBeenCalled();
    const query = queries.lastQuery('conversation');
    expect(query.calls).toContainEqual(['where', 'type', 'project_ai']);
    expect(
      JSON.stringify(
        evaluatePredicate(
          query.calls.find(call => call[0] === 'where' && typeof call[1] === 'function')?.[1]
        )
      )
    ).toContain(actor);
  }
);
