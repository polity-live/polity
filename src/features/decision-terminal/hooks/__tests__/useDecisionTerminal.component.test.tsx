/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDecisionTerminal } from '../useDecisionTerminal';

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, any>,
  types: {} as Record<string, string>,
  user: { id: 'user-1' } as any,
  agendaItems: [] as any[],
  agendaLoading: false,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: any) => {
    if (!query) return [undefined, { type: 'complete' }];
    return [mocks.data[query.key], { type: mocks.types[query.key] ?? 'complete' }];
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    elections: {
      decisionOverviewPage: () => ({ key: 'election-overview' }),
      decisionManagerProjection: () => ({ key: 'election-manager' }),
      viewerDecisionState: () => ({ key: 'election-viewer' }),
    },
    votes: {
      decisionOverviewPage: () => ({ key: 'vote-overview' }),
      decisionManagerProjection: () => ({ key: 'vote-manager' }),
      viewerDecisionState: () => ({ key: 'vote-viewer' }),
    },
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaTimingState: () => ({ agendaItems: mocks.agendaItems, isLoading: mocks.agendaLoading }),
}));

vi.mock('../../logic/decision-phase', () => ({
  normalizeDecisionVotingPhase: (status: string) => status,
}));

vi.mock('../../logic/decision-timing', () => ({
  getDecisionAgendaRuntimeTimes: ({ closingEndTime, createdAt, updatedAt }: any) => ({
    startsAt: closingEndTime === 'no-start' ? null : (createdAt ?? '2026-01-01T00:00:00.000Z'),
    endsAt: updatedAt ?? '2026-01-02T00:00:00.000Z',
    sortStartsAt: closingEndTime === 'no-sort-start' ? null : createdAt,
    sortEndsAt: closingEndTime === 'no-sort-end' ? null : updatedAt,
    hasExplicitClosingEnd: Boolean(closingEndTime),
  }),
  resolveDecisionTiming: ({ phase }: any) => {
    if (phase === 'closed' || phase === 'legacy-past') {
      return {
        isActiveDecision: false,
        isFutureDecision: false,
        isEnded: true,
        temporalBucket: phase === 'legacy-past' ? undefined : 'past',
      };
    }
    if (phase === 'future') {
      return {
        isActiveDecision: false,
        isFutureDecision: true,
        isEnded: false,
        temporalBucket: 'future',
      };
    }
    return {
      isActiveDecision: true,
      isFutureDecision: false,
      isEnded: false,
      temporalBucket: phase === 'legacy-active' ? undefined : 'active',
    };
  },
}));

vi.mock('../../logic/decision-status', () => ({
  getDecisionStatus: () => 'active',
  isUrgent: () => true,
  isClosingSoon: () => true,
  isOpeningSoon: () => true,
  isRecentlyClosed: () => true,
  generateDecisionId: (type: string, index: number) => `${type}-${index}`,
}));

vi.mock('../../logic/trend-calculation', () => ({
  calculateSupportPercentage: (votes: any) => votes.support,
  calculateTrend: () => ({ direction: 'up', percentage: 5 }),
  calculateTurnout: (voted: number, total: number) => (voted / total) * 100,
}));

vi.mock('@/features/vote-cast/logic/computeVoteResults', () => ({
  computeVoteResultSummary: (choices: any[]) => ({ result: choices[0]?.label ?? 'passed' }),
}));

vi.mock('@/features/elections/logic/electionAssignmentMetadata', () => ({
  stripDelegateElectionMetadata: (value: string | null | undefined) => value ?? '',
}));

vi.mock('../../logic/voteChoiceTranslation', () => ({
  translateVoteChoiceLabel: (choice: any, index: number) => choice.label || `Choice ${index + 1}`,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, options?: any) => (options?.number ? `${key}:${options.number}` : key),
}));

const event = (id = 'event-1', title = 'Assembly') => ({
  id,
  title,
  participants: [
    { user_id: 'other', status: 'active', participant_roles: [{}] },
    { user_id: 'user-1', status: 'active', participant_roles: [{}] },
  ],
});

const agenda = (id: string, eventValue?: any, title?: string) => ({
  id,
  title,
  event: eventValue,
  status: 'active',
  duration: 30,
  activated_at: 1,
  completed_at: null,
  start_time: 2,
  end_time: 3,
});

function installDecisionData() {
  mocks.data['election-overview'] = [
    {
      id: 'e-full',
      title: 'Board election',
      description: 'Elect the board',
      status: 'closed',
      visibility: 'private',
      ballot_visibility: 'named',
      max_votes: 2,
      election_mode: 'list',
      seat_count: 2,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-05T00:00:00.000Z',
      closing_end_time: 'closed',
      role: { name: 'Chair' },
      agenda_item: agenda('agenda-election', event()),
      candidates: [
        {
          id: 'candidate-1',
          name: 'Fallback',
          image_url: 'image.png',
          user: { first_name: 'Ada', last_name: 'Lovelace', avatar: 'avatar.png' },
        },
        { id: 'candidate-2', name: 'Grace', user: { avatar: 'grace.png' } },
        { id: 'candidate-3', name: ' ', user: null },
      ],
    },
    {
      id: 'e-active',
      title: '',
      description: null,
      status: 'indication',
      visibility: null,
      election_mode: 'invalid',
      candidates: null,
      agenda_item: null,
    },
    {
      id: 'e-future',
      title: '',
      status: 'future',
      election_mode: 'single',
      agenda_item: agenda('agenda-without-event', event('event-future'), ''),
      candidates: [{ id: 'future-candidate', name: 'Future', user: null }],
    },
  ];
  mocks.data['election-manager'] = [
    {
      id: 'e-full',
      offline_tallies: [{}],
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      indicative_selections: [{ candidate_id: 'candidate-1' }, { candidate_id: 'candidate-1' }],
      final_selections: [
        { candidate_id: 'candidate-1' },
        { candidate_id: 'candidate-1' },
        { candidate_id: 'candidate-2' },
      ],
    },
    { id: 'e-future', electors: [], indicative_selections: [], final_selections: [] },
  ];
  mocks.data['election-viewer'] = [
    { id: 'elector-1', election_id: 'e-full', user_id: 'user-1' },
    { id: 'elector-2', election_id: 'e-full', user_id: 'other' },
    { id: 'elector-3', election_id: 'e-future', user_id: 'other' },
  ];

  const resultChoices = (result: string) => [
    { id: `${result}-support`, label: result, order_index: null },
    { id: `${result}-oppose`, label: '', order_index: 1 },
    { id: `${result}-abstain`, label: 'Abstain', order_index: 2 },
  ];
  mocks.data['vote-overview'] = [
    {
      id: 'v-rejected',
      title: 'Rejected vote',
      description: 'Description',
      status: 'closed',
      visibility: 'authenticated',
      ballot_visibility: 'secret',
      majority_type: 'absolute',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-08T00:00:00.000Z',
      closing_end_time: 'closed',
      agenda_item: agenda('agenda-vote', event('event-2', 'Congress')),
      choices: resultChoices('rejected'),
    },
    {
      id: 'v-tie',
      title: '',
      status: 'closed',
      majority_type: 'two_thirds',
      agenda_item: agenda('agenda-tie', event('event-3'), 'Agenda fallback'),
      choices: resultChoices('tie'),
    },
    {
      id: 'v-passed',
      title: '',
      status: 'closed',
      majority_type: 'unexpected',
      amendment: { id: 'amendment-1', title: 'Amendment fallback' },
      choices: resultChoices('passed'),
    },
    { id: 'v-no-result', title: '', status: 'closed', choices: [] },
    {
      id: 'v-indication',
      title: 'Indicative vote',
      status: 'indication',
      choices: resultChoices('indicative'),
    },
    {
      id: 'v-active-final',
      title: 'Final vote',
      status: 'voting',
      choices: resultChoices('final'),
    },
    {
      id: 'v-future',
      title: '',
      status: 'future',
      closing_end_time: 'future',
      amendment: { id: 'amendment-2', title: '' },
      choices: null,
    },
    { id: 'v-legacy-active', title: '', status: 'legacy-active', choices: null },
    {
      id: 'v-legacy-past',
      title: '',
      status: 'legacy-past',
      closing_end_time: 'no-sort-end',
      choices: null,
    },
  ];
  mocks.data['vote-manager'] = mocks.data['vote-overview'].map((vote: any, index: number) => ({
    id: vote.id,
    offline_tallies: index === 0 ? [{}] : undefined,
    voters:
      index === 0
        ? [
            { id: 'voter-1', user_id: 'user-1' },
            { id: 'voter-2', user_id: 'other' },
          ]
        : undefined,
    indicative_decisions:
      vote.id === 'v-indication' || vote.id === 'v-active-final'
        ? [{ choice_id: `${vote.id === 'v-indication' ? 'indicative' : 'final'}-support` }]
        : undefined,
    final_decisions:
      vote.id === 'v-rejected'
        ? [{ choice_id: 'rejected-support' }, { choice_id: 'rejected-oppose' }]
        : vote.id === 'v-tie'
          ? [{ choice_id: 'tie-support' }]
          : vote.id === 'v-passed'
            ? [{ choice_id: 'passed-support' }]
            : undefined,
  }));
  mocks.data['vote-viewer'] = [
    { id: 'voter-1', vote_id: 'v-rejected', user_id: 'user-1' },
    { id: 'voter-3', vote_id: 'v-rejected', user_id: 'other' },
    { id: 'voter-4', vote_id: 'v-tie', user_id: 'other' },
  ];
  mocks.agendaItems = [
    {
      id: 'agenda-election',
      status: 'calculated',
      duration: 60,
      activated_at: 10,
      completed_at: 20,
      start_time: 30,
      end_time: 40,
      calculated_start_time: 50,
      calculated_end_time: 60,
    },
  ];
}

beforeEach(() => {
  mocks.data = {};
  mocks.types = {};
  mocks.user = { id: 'user-1' };
  mocks.agendaItems = [];
  mocks.agendaLoading = false;
  installDecisionData();
});

describe('useDecisionTerminal', () => {
  it('maps complete election and vote projections into decision rows', () => {
    const { result } = renderHook(() =>
      useDecisionTerminal({ groupIds: ['group-b', 'group-a', 'group-a'] })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.decisions).toHaveLength(12);
    expect(result.current.decisions.find(item => item.sourceId === 'e-full')).toMatchObject({
      status: 'elected',
      winnerName: 'Ada Lovelace',
      href: '/event/event-1/agenda/agenda-election',
      electionMode: 'list',
      seatCount: 2,
      electorId: 'elector-1',
      hasConfirmedEventRole: true,
    });
    expect(result.current.decisions.find(item => item.sourceId === 'e-active')).toMatchObject({
      title: 'common.entities.election',
      href: '#',
      visibility: 'public',
      electionMode: null,
      maxVotes: 1,
    });
    expect(result.current.decisions.find(item => item.sourceId === 'v-rejected')).toMatchObject({
      status: 'failed',
      voterId: 'voter-1',
      hasConfirmedEventRole: true,
    });
    expect(result.current.decisions.find(item => item.sourceId === 'v-tie')?.status).toBe('tied');
    expect(result.current.decisions.find(item => item.sourceId === 'v-passed')?.status).toBe(
      'passed'
    );
    expect(result.current.decisions.find(item => item.sourceId === 'v-no-result')?.status).toBe(
      'tied'
    );
    expect(result.current.decisions.find(item => item.sourceId === 'v-future')?.href).toBe(
      '/amendment/amendment-2'
    );
    expect(result.current.urgentCount).toBeGreaterThan(0);
    expect(result.current.activeCount).toBeGreaterThan(0);
    expect(result.current.recentlyClosedCount).toBeGreaterThan(0);
    act(() => result.current.refetch());
  });

  it('covers anonymous, empty, loading, and restricted projection states', () => {
    const { result, rerender } = renderHook(() => useDecisionTerminal());

    mocks.user = null;
    rerender();
    expect(result.current.decisions).toHaveLength(12);

    mocks.user = { id: 'user-1' };
    mocks.types['election-overview'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);

    mocks.types['election-overview'] = 'complete';
    mocks.types['vote-overview'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);

    mocks.types['vote-overview'] = 'complete';
    mocks.types['election-manager'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);
    mocks.types['election-manager'] = 'complete';
    mocks.types['election-viewer'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);

    mocks.types['election-viewer'] = 'complete';
    mocks.types['vote-manager'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);
    mocks.types['vote-manager'] = 'complete';
    mocks.types['vote-viewer'] = 'unknown';
    rerender();
    expect(result.current.isLoading).toBe(true);

    mocks.types['vote-viewer'] = 'complete';
    mocks.agendaLoading = true;
    rerender();
    expect(result.current.isLoading).toBe(true);

    mocks.agendaLoading = false;
    mocks.data['election-overview'] = undefined;
    mocks.data['vote-overview'] = undefined;
    mocks.data['election-manager'] = undefined;
    mocks.data['election-viewer'] = undefined;
    mocks.data['vote-manager'] = undefined;
    mocks.data['vote-viewer'] = undefined;
    mocks.agendaItems = [];
    rerender();
    expect(result.current.decisions).toEqual([]);
    expect(result.current.activeCount).toBe(0);
  });
});
