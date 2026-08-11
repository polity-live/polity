import { describe, expect, it, vi } from 'vitest';

import {
  buildClosingVoteFromAgendaVote,
  buildVariantVoteFromAgendaVote,
} from '../buildClosingVoteFromAgendaVote';
import { createMockCRTimelineItems, getCRFilterStatus } from '../createMockCRTimelineItems';
import { buildOfflineTallyEntity } from '../offlineTallyEntity';
import { getOfflineTallyTooltip, resolveOfflineTallyMode } from '../offlineTallyToolbar';
import {
  getSelectableAgendaBranches,
  resolveSelectableAgendaBranchId,
} from '../selectableAgendaBranches';
import {
  getExpectedNextSpeakerGender,
  getSpeakerCreatedValue,
  getGenderQuotaErrorMessage,
  getGenderQuotaFeedbackMessage,
  getLastActiveSpeaker,
  getSpeakerGenderLabel,
  isSpeakerGender,
} from '../speakerListGenderQuota';
import {
  getStartableVoteSequencePhase,
  isStartableVoteSequenceItem,
  resolveVoteSequenceSelectionUpdate,
} from '../voteSequenceSelection';

describe('mock change-request timeline branches', () => {
  it('maps complete, sparse, accepted, rejected, and obsolete summaries', () => {
    const items = createMockCRTimelineItems([
      {
        id: 'full',
        changeRequestEntityId: 'persisted',
        crId: 'CR-1',
        displayCrId: 'B-CR-1',
        branchDisplayNumber: 1,
        branchScopedCrNumber: 2,
        branchSequenceNumber: 3,
        title: 'Full',
        description: 'Description',
        status: 'open',
        votesFor: 2,
        votesAgainst: 1,
        votesAbstain: 1,
        processBranchId: 'branch-1',
        changeType: 'text',
        text: 'old',
        newText: 'new',
        rawNewProperties: { value: 'new' },
        votingStatus: 'indicative',
        confirmationStatus: 'confirmed',
        changeRequestStatus: 'open',
      },
      {
        id: 'middle',
        crId: 'CR-2',
        title: '',
        description: '',
        status: 'accepted',
        branchScopedCrNumber: 4,
        type: 'property',
        newProperties: { value: 'fallback' },
      },
      { id: 'sparse', title: '', description: '', status: 'rejected' },
      { id: 'obsolete', title: 'Old', description: '', status: 'obsolete' },
      { id: 'invalid', title: '', description: '', status: undefined },
    ] as any);

    expect(items[0].change_request_id).toBe('persisted');
    expect(items[0].vote.voters).toHaveLength(4);
    expect(items[1].change_request.title).toBe('CR-2');
    expect(items[1].change_request.branch_sequence_number).toBe(4);
    expect(items[2].change_request.title).toBe('CR-3');
    expect(items[2].vote.status).toBe('closed');
    expect(items[3].status).toBe('completed');
    expect(items[4].change_request.status).toBeNull();
    expect(items[4].change_request.change_request_status).toBeNull();
  });

  it('resolves mock and persisted filter outcomes', () => {
    expect(getCRFilterStatus({ _originalStatus: 'approved' })).toBe('accepted');
    expect(getCRFilterStatus({ _originalStatus: 'declined' })).toBe('rejected');
    expect(getCRFilterStatus({ _originalStatus: 'open' })).toBe('open');
    expect(getCRFilterStatus({ status: 'completed' } as any, () => 'passed')).toBe('accepted');
    expect(getCRFilterStatus({ status: 'completed' } as any, () => 'rejected')).toBe('rejected');
    expect(getCRFilterStatus({ status: 'completed' } as any, () => 'other')).toBe('accepted');
    expect(getCRFilterStatus({ status: 'completed' } as any)).toBe('accepted');
    expect(getCRFilterStatus({ status: 'pending' } as any, vi.fn())).toBe('open');
  });
});

describe('speaker gender quota branch helpers', () => {
  it('normalizes genders, ordering, timestamps, labels, and messages', () => {
    expect(isSpeakerGender('male')).toBe(true);
    expect(isSpeakerGender('unknown')).toBe(false);
    expect(isSpeakerGender(1)).toBe(false);
    expect(getSpeakerCreatedValue({ created_at: 4 })).toBe(4);
    expect(getSpeakerCreatedValue({ created_at: '2026-01-01T00:00:00.000Z' })).toBeGreaterThan(0);
    expect(getSpeakerCreatedValue({ created_at: 'invalid' })).toBe(0);
    expect(getSpeakerCreatedValue({ created_at: null })).toBe(0);
    expect(getLastActiveSpeaker([])).toBeNull();
    const last = getLastActiveSpeaker([
      { order_index: 1, created_at: 2, completed: true, user: { gender: 'male' } },
      { order_index: 1, created_at: 'invalid', user: { gender: 'female' } },
      { order: 1, created_at: '2026-01-02T00:00:00.000Z', user: { gender: 'male' } },
      { order: 1, created_at: 3, user: { gender: 'female' } },
      { created_at: null, user: { gender: 'female' } },
    ]);
    expect(last?.user?.gender).toBe('male');
    expect(getExpectedNextSpeakerGender([{ user: { gender: 'diverse' } }])).toBeNull();
    expect(getExpectedNextSpeakerGender([{ user: { gender: 'male' } }])).toBe('female');

    for (const gender of ['male', 'female', 'diverse', 'unknown']) {
      expect(getSpeakerGenderLabel(gender)).toBeTruthy();
    }
    const reasons = [
      'missing-gender',
      'unsupported-gender',
      'expected-male',
      'expected-female',
      undefined,
    ] as const;
    for (const reason of reasons) {
      const result = { allowed: false, reason } as any;
      expect(getGenderQuotaErrorMessage(result)).toBeTruthy();
      expect(getGenderQuotaFeedbackMessage(result, key => key)).toBeTruthy();
    }
  });
});

describe('offline tally entity and toolbar branches', () => {
  it('uses every election candidate and tally fallback', () => {
    const election = buildOfflineTallyEntity({
      phase: 'final',
      agendaTitle: 'Agenda election',
      participantCount: 3,
      election: {
        id: 'election-1',
        max_votes: null,
        candidates: null,
        offline_tallies: [
          { phase: 'final', candidate_id: 'candidate-1', count: null },
          { phase: 'indicative', candidate_id: 'ignored', count: 1 },
          { phase: 'final', candidate_id: null, count: 1 },
        ],
      },
      electionCandidates: [
        { id: 'candidate-1', name: '', user: null },
        { id: 'candidate-2', name: 'Name', user: { first_name: '', last_name: '', email: 'mail' } },
        { id: 'candidate-3', name: 'Fallback', user: { first_name: null, last_name: null } },
        { id: 'candidate-4', name: '', user: { first_name: null, last_name: null } },
        { id: 'withdrawn', status: 'withdrawn', name: 'Withdrawn' },
      ],
    });
    expect(election?.kind).toBe('election');
    expect(election?.choices).toHaveLength(4);
    expect(election?.votesPerParticipant).toBe(1);

    expect(
      buildOfflineTallyEntity({
        phase: 'final',
        participantCount: 2,
        election: { id: 'election-2', title: 'Election', max_votes: 2, candidates: [] },
      })?.votesPerParticipant
    ).toBe(2);
    expect(
      buildOfflineTallyEntity({
        phase: 'final',
        participantCount: 0,
        election: { id: 'election-3', candidates: null },
      })?.choices
    ).toEqual([]);
  });

  it('uses vote overrides, empty fallbacks, and toolbar copy variants', () => {
    expect(
      buildOfflineTallyEntity({ phase: null, participantCount: 0, vote: { id: 'vote-1' } })
    ).toBeNull();
    const vote = buildOfflineTallyEntity({
      phase: 'final',
      agendaTitle: 'Agenda vote',
      participantCount: 2,
      vote: {
        id: 'vote-1',
        choices: null,
        offline_tallies: [{ phase: 'final', choice_id: 'choice-1', count: null }],
      },
      voteChoices: [{ id: 'choice-1', label: '' }],
    });
    expect(vote?.kind).toBe('vote');
    expect(vote?.choices[0].label).toBeTruthy();
    expect(
      buildOfflineTallyEntity({
        phase: 'final',
        participantCount: 0,
        vote: { id: 'vote-empty', choices: null },
      })?.choices
    ).toEqual([]);
    expect(buildOfflineTallyEntity({ phase: 'final', participantCount: 0 })).toBeNull();
    expect(resolveOfflineTallyMode([])).toBe('create');
    expect(resolveOfflineTallyMode([{}])).toBe('edit');
    for (const phase of ['indicative', 'final'] as const) {
      expect(getOfflineTallyTooltip({ phase, mode: 'create' })).toBeTruthy();
      expect(getOfflineTallyTooltip({ phase, mode: 'edit' })).toBeTruthy();
    }
    expect(getOfflineTallyTooltip({ phase: null, mode: 'create' })).toBeUndefined();
  });
});

describe('selectable branch and vote sequence branches', () => {
  const branches = [
    { id: 'a', order_index: 1 },
    { id: 'b', order_index: 2 },
    { id: 'c', order_index: 3 },
  ] as any;

  it('sorts merge steps across numeric, date, invalid, and fallback timestamps', () => {
    const result = getSelectableAgendaBranches({
      branches,
      vote: { purpose: 'merge_variant', choices: [{ process_branch_id: 'a', order_index: null }] },
      agendaStepRuns: [
        { step_kind: 'merge_vote', branch_id: 'c', created_at: Number.NaN, order_index: null },
        {
          step_kind: 'merge_variant',
          branch: { id: 'b', created_at: '2026-01-02' },
          order_index: 2,
        },
        { step_kind: 'merge_vote', branch_id: 'a', created_at: 'invalid', order_index: 1 },
        { step_kind: 'merge_vote', branch_id: 'b', created_at: null, order_index: undefined },
      ],
    });
    expect(result.isMergeAgendaItem).toBe(true);
    expect(result.branches.map((branch: any) => branch.id)).toEqual(['c', 'b', 'a']);

    const fromVotes = getSelectableAgendaBranches({
      branches,
      votes: [
        {
          purpose: 'merge_variant',
          choices: [
            { process_branch_id: 'b', order_index: 2 },
            { process_branch_id: 'a', order_index: undefined },
            { process_branch_id: 'c', order_index: undefined },
          ],
        },
      ],
    });
    expect(fromVotes.branches.map((branch: any) => branch.id)).toEqual(['a', 'c', 'b']);
    expect(
      getSelectableAgendaBranches({
        branches,
        vote: {
          purpose: 'merge_variant',
          choices: [{ process_branch_id: 'a' }, { process_branch_id: 'b' }],
        },
      }).branches
    ).toHaveLength(2);
    expect(resolveSelectableAgendaBranchId({ branches: [], requestedBranchId: null })).toBeNull();
  });

  it('covers startable sequence guards and selection fallback semantics', () => {
    expect(getStartableVoteSequencePhase({ id: 'a', vote: { id: 'v', status: 'final' } })).toBe(
      'final'
    );
    expect(
      getStartableVoteSequencePhase({ id: 'a', vote: { id: 'v', status: 'indicative' } })
    ).toBe('indication');
    expect(
      getStartableVoteSequencePhase({ id: 'a', vote: { id: 'v', status: 'unexpected' } })
    ).toBeNull();
    expect(
      isStartableVoteSequenceItem({ id: 'a', vote: { id: 'v' }, _votePlaceholder: true })
    ).toBe(false);
    expect(isStartableVoteSequenceItem({ id: 'mock-cr-a', vote: { id: 'v' } })).toBe(false);
    expect(isStartableVoteSequenceItem({ id: 'a', vote: { id: 'mock-vote-a' } })).toBe(false);
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'missing',
        sequenceItems: [],
        fallbackItemId: null,
      })
    ).toBeNull();
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: null,
        sequenceItems: [],
        fallbackItemId: null,
      })
    ).toBeUndefined();
  });
});

describe('closing and variant vote sparse branches', () => {
  it('returns null without votes and applies sparse defaults', () => {
    expect(buildClosingVoteFromAgendaVote(null, 0)).toBeNull();
    expect(buildVariantVoteFromAgendaVote(undefined, 0)).toBeNull();
    const sparse = { id: 'vote-1', visibility: 'public', created_at: 1, updated_at: 2 } as any;
    expect(buildClosingVoteFromAgendaVote(sparse, 1)?.vote).toMatchObject({
      status: null,
      choices: [],
      purpose: 'closing',
    });
    expect(buildVariantVoteFromAgendaVote(sparse, 1)?.vote).toMatchObject({
      status: null,
      purpose: 'merge_variant',
    });
  });
});
