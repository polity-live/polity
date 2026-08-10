import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  txHandler: vi.fn(),
  sqlHandler: vi.fn(),
  checkpoint: {
    id: 'checkpoint',
    anchor: 'expected-anchor',
    route: '/current',
    completion: { type: 'automatic' },
  } as any,
  nextCheckpoint: {
    id: 'next-checkpoint',
    anchor: 'next-anchor',
    route: '/next',
    completion: { type: 'automatic' },
  } as any,
  matchesExpected: vi.fn(() => true),
  horizontalScrollValid: vi.fn(() => true),
  hasTodoOutput: vi.fn(() => false),
  hasTodoAttachment: vi.fn(() => false),
  mergeTodoOutput: vi.fn(() => '{"merged":true}'),
  cityState: null as any,
}));

function createTag(handler: (query: string, values: unknown[]) => unknown) {
  const tag: any = vi.fn((first: unknown, ...values: unknown[]) => {
    if (Array.isArray(first) && 'raw' in first) {
      const query = (first as string[]).join(' ? ').replace(/\s+/g, ' ').trim().toLowerCase();
      return handler(query, values);
    }
    return { values: first };
  });
  tag.json = vi.fn((value: unknown) => value);
  tag.array = vi.fn((value: unknown) => value);
  return tag;
}

const transaction = createTag((query, values) => mocks.txHandler(query, values));
const sql = createTag((query, values) => mocks.sqlHandler(query, values));
sql.begin = vi.fn((callback: (tx: unknown) => unknown) => callback(transaction));

vi.mock('../db', () => ({ getAppTutorialSql: () => sql }));
vi.mock('@/features/app-tutorial/catalog', () => ({
  APP_TUTORIAL_CHECKPOINT_IDS: ['checkpoint'],
  APP_TUTORIAL_CHECKPOINTS: [{ id: 'checkpoint' }],
  APP_TUTORIAL_FIXTURE_VERSION: 1,
  getAppTutorialCheckpoint: () => mocks.checkpoint,
  getNextAppTutorialCheckpoint: () => mocks.nextCheckpoint,
  matchesAppTutorialExpectedInput: mocks.matchesExpected,
  resolveAppTutorialRoute: (route: string) => route,
}));
vi.mock('../scroll-evidence', () => ({
  horizontalScrollEvidenceIsValid: mocks.horizontalScrollValid,
}));
vi.mock('../assistant-todo-context', () => ({
  APP_TUTORIAL_ASSISTANT_TODO_TITLE: 'Tutorial todo',
  hasAppTutorialAssistantTodoAttachment: mocks.hasTodoAttachment,
  hasAppTutorialAssistantTodoOutput: mocks.hasTodoOutput,
  mergeAppTutorialAssistantTodoOutput: mocks.mergeTodoOutput,
}));
vi.mock('@/features/app-tutorial/city-design-fixture', () => ({
  APP_TUTORIAL_CITY_DESIGN_CENTER: { lat: 48.1, lon: 11.5 },
  createAppTutorialInitialCityDesignState: () => mocks.cityState,
}));

import {
  advanceAppTutorial,
  AppTutorialEffectPendingError,
  appTutorialCatalogSnapshot,
  cleanupAppTutorial,
  cleanupExpiredAppTutorialRuns,
  getAppTutorialRun,
  isAppTutorialCheckpointId,
  pauseAppTutorial,
  startOrResumeAppTutorial,
} from '../service';

const requiredAliases = [
  'initiativeGroupId',
  'climateCouncilGroupId',
  'networkTodoId',
  'amendmentId',
  'firstEventId',
  'secondEventId',
  'firstAgendaItemId',
  'amendmentVoteId',
  'amendmentAcceptChoiceId',
  'tutorialConversationId',
];

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    user_id: 'user-1',
    status: 'active',
    current_checkpoint_id: 'checkpoint',
    fixture_version: 1,
    revision: 3,
    expires_at: new Date('2099-01-01T00:00:00.000Z'),
    ...overrides,
  } as any;
}

const state = {
  run: run() as any,
  aliases: requiredAliases.map(alias => ({ alias })),
  roots: [{ exists: true }] as any[],
  entityRows: requiredAliases.map(alias => ({ alias, entity_id: `${alias}-id` })) as any[],
  searchRows: [] as any[],
  claimEffect: true,
  mutationRows: [{ verified: true }] as any[],
  mutationSequence: [] as any[][],
  effect: {
    membershipUpdated: [{ id: 'membership-1' }] as any[],
    requestRows: [] as any[],
    connectionRows: [] as any[],
    membershipRequests: [] as any[],
    votedRequests: [] as any[],
    todoRows: [] as any[],
    currentTurnRows: [] as any[],
    assistantMessages: [] as any[],
    syntheticVoters: [] as any[],
    forwardedRows: [] as any[],
    candidateRows: [{ id: 'candidate-1' }] as any[],
    syntheticElectors: [] as any[],
  },
};

function defaultTransactionHandler(query: string, values: unknown[]) {
  if (query.includes('from app_tutorial_run') && query.includes("status in ('active', 'paused')")) {
    return state.run ? [state.run] : [];
  }
  if (query.includes('insert into app_tutorial_run')) {
    state.run = run({ revision: 0 });
    return [state.run];
  }
  if (query.includes("set status = 'active'") && query.includes('update app_tutorial_run')) {
    state.run = run({ status: 'active' });
    return [state.run];
  }
  if (query.includes("set status = 'paused'") && query.includes('update app_tutorial_run')) {
    return [run({ status: 'paused' })];
  }
  if (query.includes('set current_checkpoint_id =')) {
    return [run({ current_checkpoint_id: 'next-checkpoint', revision: 4 })];
  }
  if (query.includes('select alias, entity_id') && query.includes('from app_tutorial_entity')) {
    return state.entityRows;
  }
  if (query.includes('select entity_id from app_tutorial_entity')) {
    const alias = String(values.at(-1));
    return [{ entity_id: `${alias}-id` }];
  }
  if (query.includes('select alias') && query.includes('from app_tutorial_entity')) {
    return state.aliases;
  }
  if (query.startsWith('select 1 where exists')) return state.roots;
  if (query.includes('select id, search_text') && query.includes('from search_document')) {
    return state.searchRows;
  }
  if (query.includes('insert into app_tutorial_checkpoint_effect')) {
    return state.claimEffect ? [{ effect_key: 'claimed' }] : [];
  }
  if (query.includes('update group_membership') && query.includes('returning id')) {
    return state.effect.membershipUpdated;
  }
  if (query.includes('from group_connection_request') && query.includes('order by updated_at')) {
    return state.effect.requestRows;
  }
  if (query.includes('select id from group_connection')) return state.effect.connectionRows;
  if (query.includes('from group_membership_rule_request')) {
    return state.effect.membershipRequests;
  }
  if (query.includes('insert into group_right_grant') && query.includes('returning id')) {
    return [{ id: 'grant-1' }];
  }
  if (query.includes('from change_request_vote vote') && query.includes("vote.vote = 'accept'")) {
    return state.effect.votedRequests;
  }
  if (query.includes('select id from todo') && query.includes('creator_id')) {
    return state.effect.todoRows;
  }
  if (query.includes('select created_at') && query.includes('from message')) {
    return state.effect.currentTurnRows;
  }
  if (query.includes('select id, context_json') && query.includes('from message')) {
    return state.effect.assistantMessages;
  }
  if (query.includes('select tutorial_user.id as user_id')) {
    return state.effect.syntheticVoters;
  }
  if (query.includes('select id from final_voter_participation')) {
    return [{ id: 'participation-1' }];
  }
  if (query.includes('select id from agenda_item') && query.includes('amendment_id')) {
    return state.effect.forwardedRows;
  }
  if (query.includes('select id from election_candidate')) return state.effect.candidateRows;
  if (query.includes('select elector.id as elector_id')) return state.effect.syntheticElectors;
  if (query.includes('select id from final_elector_participation')) {
    return [{ id: 'elector-participation-1' }];
  }
  if (query.startsWith('select 1') || query.includes('select 1 from')) {
    return state.mutationSequence.shift() ?? state.mutationRows;
  }
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  state.run = run();
  state.aliases = requiredAliases.map(alias => ({ alias }));
  state.roots = [{ exists: true }];
  state.entityRows = requiredAliases.map(alias => ({ alias, entity_id: `${alias}-id` }));
  state.searchRows = [];
  state.claimEffect = true;
  state.mutationRows = [{ verified: true }];
  state.mutationSequence = [];
  Object.assign(state.effect, {
    membershipUpdated: [{ id: 'membership-1' }],
    requestRows: [],
    connectionRows: [],
    membershipRequests: [],
    votedRequests: [],
    todoRows: [],
    currentTurnRows: [],
    assistantMessages: [],
    syntheticVoters: [],
    forwardedRows: [],
    candidateRows: [{ id: 'candidate-1' }],
    syntheticElectors: [],
  });
  mocks.checkpoint = {
    id: 'checkpoint',
    anchor: 'expected-anchor',
    route: '/current',
    completion: { type: 'automatic' },
  };
  mocks.nextCheckpoint = {
    id: 'next-checkpoint',
    anchor: 'next-anchor',
    route: '/next',
    completion: { type: 'automatic' },
  };
  mocks.matchesExpected.mockReturnValue(true);
  mocks.horizontalScrollValid.mockReturnValue(true);
  mocks.hasTodoOutput.mockReturnValue(false);
  mocks.hasTodoAttachment.mockReturnValue(false);
  mocks.cityState = {
    schemaVersion: 1,
    mapSelection: {
      center: { lat: 48.1, lon: 11.5 },
      widthMeters: 100,
      heightMeters: 100,
      rotationDeg: 0,
    },
    objects: [],
  };
  mocks.txHandler.mockImplementation(defaultTransactionHandler);
  mocks.sqlHandler.mockReturnValue([]);
});

async function advance(evidence: Record<string, unknown> = {}, effect?: string) {
  mocks.checkpoint = {
    ...mocks.checkpoint,
    effect,
  };
  return advanceAppTutorial('user-1', 3, 'checkpoint' as any, evidence as any);
}

describe('app tutorial run lifecycle', () => {
  it('returns null for absent, expired, and obsolete runs', async () => {
    state.run = null;
    await expect(getAppTutorialRun('user-1')).resolves.toBeNull();

    state.run = run({ expires_at: new Date('2020-01-01T00:00:00Z') });
    await expect(getAppTutorialRun('user-1')).resolves.toBeNull();

    state.run = run({ fixture_version: 0 });
    await expect(getAppTutorialRun('user-1')).resolves.toBeNull();
  });

  it('repairs valid fixture ownership and search aliases before returning a run', async () => {
    state.searchRows = [
      { id: 'unchanged', search_text: 'neutral text' },
      { id: 'changed', search_text: 'Initiative Klimafitte Euckenstraße' },
    ];
    await expect(getAppTutorialRun('user-1')).resolves.toMatchObject({
      runId: 'run-1',
      route: '/current',
    });

    state.run = run({ current_checkpoint_id: 'secondary-navigation' });
    await expect(getAppTutorialRun('user-1')).resolves.toBeTruthy();
  });

  it('rejects incomplete aliases and missing fixture roots', async () => {
    state.aliases = [];
    await expect(getAppTutorialRun('user-1')).rejects.toThrow(
      'Tutorial sandbox cannot be repaired'
    );

    state.aliases = requiredAliases.map(alias => ({ alias }));
    state.roots = [];
    await expect(getAppTutorialRun('user-1')).rejects.toThrow(
      'Tutorial sandbox cannot be repaired'
    );
  });

  it('creates a complete fixture graph for a new run', async () => {
    state.run = null;
    await expect(startOrResumeAppTutorial('user-1')).resolves.toMatchObject({
      status: 'active',
      revision: 0,
    });
    expect(transaction).toHaveBeenCalled();
  });

  it('rejects a fixture build without its required city selection', async () => {
    state.run = null;
    mocks.cityState = { schemaVersion: 1, mapSelection: null, objects: [] };
    await expect(startOrResumeAppTutorial('user-1')).rejects.toThrow(
      'The app tutorial city design selection is missing.'
    );
  });

  it('resumes or recreates runs for every restart condition', async () => {
    await expect(startOrResumeAppTutorial('user-1')).resolves.toMatchObject({ status: 'active' });

    await expect(startOrResumeAppTutorial('user-1', true)).resolves.toMatchObject({
      status: 'active',
    });

    state.run = run({ expires_at: new Date('2020-01-01T00:00:00Z') });
    await expect(startOrResumeAppTutorial('user-1')).resolves.toMatchObject({ status: 'active' });

    state.run = run({ fixture_version: 0 });
    await expect(startOrResumeAppTutorial('user-1')).resolves.toMatchObject({ status: 'active' });
  });

  it('pauses a matching run and reports missing or conflicting runs', async () => {
    state.run = null;
    await expect(pauseAppTutorial('user-1', 3)).rejects.toThrow('No tutorial run found');
    state.run = run();
    await expect(pauseAppTutorial('user-1', 4)).rejects.toThrow('Tutorial revision conflict');
    await expect(pauseAppTutorial('user-1', 3)).resolves.toMatchObject({ status: 'paused' });
  });

  it('cleans up optional runs with optimistic revision checks', async () => {
    state.run = null;
    await expect(cleanupAppTutorial('user-1')).resolves.toBeUndefined();
    state.run = run();
    await expect(cleanupAppTutorial('user-1', 4)).rejects.toThrow('Tutorial revision conflict');
    await expect(cleanupAppTutorial('user-1')).resolves.toBeUndefined();
    await expect(cleanupAppTutorial('user-1', 3)).resolves.toBeUndefined();
  });

  it('returns cleanup counts and stable catalog helpers', async () => {
    mocks.sqlHandler
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ cleanup_expired_app_tutorial_runs: 4 }]);
    await expect(cleanupExpiredAppTutorialRuns()).resolves.toBe(0);
    await expect(cleanupExpiredAppTutorialRuns()).resolves.toBe(4);
    expect(isAppTutorialCheckpointId('checkpoint')).toBe(true);
    expect(isAppTutorialCheckpointId('unknown')).toBe(false);
    expect(appTutorialCatalogSnapshot()).toEqual([{ id: 'checkpoint' }]);
  });
});

describe('app tutorial evidence validation', () => {
  it('reports all advance precondition conflicts', async () => {
    state.run = null;
    await expect(advance()).rejects.toThrow('No tutorial run found');
    state.run = run({ status: 'paused' });
    await expect(advance()).rejects.toThrow('Tutorial run is paused');
    state.run = run({ revision: 2 });
    await expect(advance()).rejects.toThrow('Tutorial revision conflict');
    state.run = run({ current_checkpoint_id: 'other' });
    await expect(advance()).rejects.toThrow('Tutorial checkpoint conflict');
  });

  it('validates action evidence and its optional input contract', async () => {
    mocks.checkpoint.completion = { type: 'action', event: 'opened' };
    await expect(advance({ type: 'click', event: 'opened' })).rejects.toThrow(
      'Expected tutorial action'
    );
    await expect(advance({ type: 'action', event: 'wrong' })).rejects.toThrow(
      'Expected tutorial action'
    );
    await expect(advance({ type: 'action', event: 'opened' })).resolves.toBeTruthy();

    mocks.checkpoint.completion = { type: 'action', event: 'opened', expectedInputKey: 'key' };
    mocks.matchesExpected.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(advance({ type: 'action', event: 'opened' })).rejects.toThrow();
    await expect(
      advance({ type: 'action', event: 'opened', value: 'value' })
    ).resolves.toBeTruthy();
  });

  it('validates acknowledgement, scrolling, click, drop, mutation, view and automatic evidence', async () => {
    for (const [completion, invalid, valid] of [
      [{ type: 'acknowledge' }, { type: 'click' }, { type: 'acknowledge' }],
      [{ type: 'click' }, { type: 'view' }, { type: 'click', anchor: 'expected-anchor' }],
      [
        { type: 'drop', event: 'dropped' },
        { type: 'drop', event: 'wrong' },
        { type: 'drop', event: 'dropped' },
      ],
      [{ type: 'view' }, { type: 'click' }, { type: 'view' }],
    ] as any[]) {
      mocks.checkpoint.completion = completion;
      await expect(advance(invalid)).rejects.toThrow();
      await expect(advance(valid)).resolves.toBeTruthy();
    }

    mocks.checkpoint.completion = { type: 'horizontal-scroll', minimumPixels: 48 };
    mocks.horizontalScrollValid.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(advance({ type: 'scroll' })).rejects.toThrow('Horizontal navigation scroll');
    await expect(advance({ type: 'scroll' })).resolves.toBeTruthy();

    mocks.checkpoint.completion = { type: 'automatic' };
    await expect(advance()).resolves.toBeTruthy();
  });

  it('validates input and entity selection short circuits', async () => {
    mocks.checkpoint.completion = { type: 'input', expectedInputKey: 'key' };
    await expect(advance({ type: 'click' })).rejects.toThrow();
    mocks.matchesExpected.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(advance({ type: 'input' })).rejects.toThrow();
    await expect(advance({ type: 'input', value: 'value' })).resolves.toBeTruthy();

    mocks.checkpoint.completion = {
      type: 'entity-selection',
      expectedEntityAlias: 'amendmentId',
    };
    await expect(advance({ type: 'click' })).rejects.toThrow();
    await expect(advance({ type: 'entity-selection' })).rejects.toThrow();
    await expect(advance({ type: 'entity-selection', entityId: 'wrong' })).rejects.toThrow();
    await expect(
      advance({ type: 'entity-selection', entityId: 'amendmentId-id' })
    ).resolves.toBeTruthy();

    const baseHandler = defaultTransactionHandler;
    mocks.txHandler.mockImplementation((query: string, values: unknown[]) =>
      query.includes('select entity_id from app_tutorial_entity') ? [] : baseHandler(query, values)
    );
    await expect(advance({ type: 'entity-selection', entityId: 'amendmentId-id' })).rejects.toThrow(
      'Missing tutorial entity'
    );
  });
});

describe('app tutorial mutation verification', () => {
  it.each([
    'subscriber.created',
    'group-membership.requested',
    'notification.read',
    'group-connection.requested',
    'todo.completed',
    'amendment.text-updated',
    'amendment.mode.suggest_internal',
    'city-design.tree-row-added',
    'city-design.saved',
    'amendment.mode.vote_internal',
    'change-request.voted',
    'amendment-process.started',
    'event.started',
    'agenda-amendment.voted',
    'agenda-election.voted',
    'todo.in-progress',
  ])('verifies %s', async event => {
    mocks.checkpoint.completion = { type: 'mutation', event };
    await expect(advance({ type: 'mutation', event })).resolves.toBeTruthy();
  });

  it('rejects invalid mutation evidence and unsupported mutations', async () => {
    mocks.checkpoint.completion = { type: 'mutation', event: 'subscriber.created' };
    await expect(advance({ type: 'click' })).rejects.toThrow('Expected mutation');
    await expect(advance({ type: 'mutation', event: 'wrong' })).rejects.toThrow(
      'Expected mutation'
    );

    mocks.checkpoint.completion = { type: 'mutation', event: 'unsupported' };
    await expect(advance({ type: 'mutation', event: 'unsupported' })).rejects.toThrow(
      'Unsupported tutorial mutation'
    );
  });

  it('retries briefly missing mutations and rejects them after the final attempt', async () => {
    vi.useFakeTimers();
    mocks.checkpoint.completion = { type: 'mutation', event: 'subscriber.created' };
    state.mutationSequence = [[], [{ verified: true }]];
    const recovered = advance({ type: 'mutation', event: 'subscriber.created' });
    await vi.runAllTimersAsync();
    await expect(recovered).resolves.toBeTruthy();

    state.mutationRows = [];
    const missing = advance({ type: 'mutation', event: 'subscriber.created' });
    const missingExpectation = expect(missing).rejects.toThrow(
      'Expected tutorial mutation was not found'
    );
    await vi.runAllTimersAsync();
    await missingExpectation;
  });
});

describe('app tutorial effects and completion', () => {
  it('does not repeat an already claimed effect', async () => {
    state.claimEffect = false;
    await expect(advance({}, 'accept-membership')).resolves.toBeTruthy();
  });

  it('accepts membership or reports that its mutation is pending', async () => {
    state.effect.membershipUpdated = [];
    await expect(advance({}, 'accept-membership')).rejects.toBeInstanceOf(
      AppTutorialEffectPendingError
    );
    state.effect.membershipUpdated = [{ id: 'membership-1' }];
    await expect(advance({}, 'accept-membership')).resolves.toBeTruthy();
  });

  it('uses the fixture-native network confirmation path', async () => {
    await expect(advance({}, 'confirm-network-rights')).resolves.toBeTruthy();
  });

  it('reports a pending legacy network request and creates its full graph', async () => {
    state.run = run({ fixture_version: 0 });
    state.effect.requestRows = [];
    await expect(advance({}, 'confirm-network-rights')).rejects.toBeInstanceOf(
      AppTutorialEffectPendingError
    );

    state.effect.requestRows = [
      {
        id: 'request-1',
        proposed_connection_id: 'proposed-1',
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: 'climateCouncilGroupId-id',
        desired_child_group_id: 'initiativeGroupId-id',
      },
    ];
    state.effect.connectionRows = [];
    state.effect.membershipRequests = [
      {
        id: 'membership-request-1',
        existing_membership_rule_id: null,
        operation: 'upsert',
        member_source_group_id: 'source',
        member_target_group_id: 'target',
        membership_mode: 'direct',
        required_source_role_id: null,
      },
    ];
    await expect(advance({}, 'confirm-network-rights')).resolves.toBeTruthy();

    state.effect.connectionRows = [{ id: 'connection-1' }];
    state.effect.membershipRequests = [
      {
        id: 'membership-request-2',
        existing_membership_rule_id: 'rule-1',
        operation: 'upsert',
        member_source_group_id: 'source',
        member_target_group_id: 'target',
        membership_mode: 'inherited',
        required_source_role_id: 'role-1',
      },
    ];
    await expect(advance({}, 'confirm-network-rights')).resolves.toBeTruthy();
  });

  it('short-circuits incomplete legacy membership-rule requests', async () => {
    state.run = run({ fixture_version: 0 });
    state.effect.requestRows = [
      {
        id: 'request-1',
        proposed_connection_id: 'proposed-1',
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: null,
        desired_child_group_id: null,
      },
    ];
    for (const membershipRequest of [
      undefined,
      { operation: 'delete' },
      { operation: 'upsert', member_source_group_id: null },
      { operation: 'upsert', member_source_group_id: 'source', member_target_group_id: null },
      {
        operation: 'upsert',
        member_source_group_id: 'source',
        member_target_group_id: 'target',
        membership_mode: null,
      },
    ]) {
      state.effect.membershipRequests = membershipRequest ? [membershipRequest] : [];
      await expect(advance({}, 'confirm-network-rights')).resolves.toBeTruthy();
    }
  });

  it('accepts a reviewed change request or waits for its vote', async () => {
    state.effect.votedRequests = [];
    await expect(advance({}, 'accept-reviewed-change-request')).rejects.toBeInstanceOf(
      AppTutorialEffectPendingError
    );

    state.effect.votedRequests = [{ id: 'request-1', suggestion_id: null }];
    await expect(advance({}, 'accept-reviewed-change-request')).resolves.toBeTruthy();
    state.effect.votedRequests = [{ id: 'request-2', suggestion_id: 'suggestion-2' }];
    await expect(advance({}, 'accept-reviewed-change-request')).resolves.toBeTruthy();
  });

  it('reconciles existing and new assistant todos and messages', async () => {
    state.effect.todoRows = [{ id: 'todo-1' }];
    state.effect.currentTurnRows = [{ created_at: new Date('2026-08-09T00:00:00Z') }];
    state.effect.assistantMessages = [{ id: 'message-1', context_json: '{"existing":true}' }];
    mocks.hasTodoOutput.mockReturnValue(true);
    await expect(advance({}, 'assistant-todo-fallback')).resolves.toBeTruthy();

    mocks.hasTodoOutput.mockReturnValue(false);
    mocks.hasTodoAttachment.mockReturnValue(true);
    await expect(advance({}, 'assistant-todo-fallback')).resolves.toBeTruthy();

    mocks.hasTodoAttachment.mockReturnValue(false);
    state.effect.assistantMessages = [
      { id: 'message-2', context_json: null },
      { id: 'message-3', context_json: '{"other":true}' },
    ];
    await expect(advance({}, 'assistant-todo-fallback')).resolves.toBeTruthy();

    state.effect.todoRows = [];
    state.effect.currentTurnRows = [];
    state.effect.assistantMessages = [];
    await expect(advance({}, 'assistant-todo-fallback')).resolves.toBeTruthy();
  });

  it('casts simulated amendment votes with and without forwarding work', async () => {
    state.effect.syntheticVoters = [];
    state.effect.forwardedRows = [{ id: 'forwarded-1' }];
    await expect(advance({}, 'cast-simulated-amendment-votes')).resolves.toBeTruthy();

    state.effect.syntheticVoters = [
      { user_id: 'synthetic-1', voter_id: 'voter-1' },
      { user_id: 'synthetic-2', voter_id: 'voter-2' },
    ];
    state.effect.forwardedRows = [];
    await expect(advance({}, 'cast-simulated-amendment-votes')).resolves.toBeTruthy();
  });

  it('keeps forwarding idempotent and casts simulated election votes', async () => {
    await expect(advance({}, 'forward-amendment')).resolves.toBeTruthy();

    state.effect.syntheticElectors = [];
    await expect(advance({}, 'cast-simulated-election-votes')).resolves.toBeTruthy();
    state.effect.syntheticElectors = [{ elector_id: 'elector-1' }];
    await expect(advance({}, 'cast-simulated-election-votes')).resolves.toBeTruthy();
    await expect(advance({}, 'unknown-effect')).resolves.toBeTruthy();
  });

  it('completes and removes the tutorial sandbox', async () => {
    mocks.checkpoint.effect = 'complete-and-cleanup';
    mocks.checkpoint.completion = { type: 'acknowledge' };
    await expect(
      advanceAppTutorial('user-1', 3, 'checkpoint' as any, {
        type: 'acknowledge',
      })
    ).resolves.toEqual({ completed: true, route: '/home' });
  });

  it('rejects checkpoints without a successor', async () => {
    mocks.nextCheckpoint = null as any;
    await expect(advance()).rejects.toThrow('Tutorial has no next checkpoint');
  });
});
