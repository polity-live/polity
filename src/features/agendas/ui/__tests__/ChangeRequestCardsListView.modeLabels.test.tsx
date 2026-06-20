/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({
  CREditorPreview: () => null,
}));

vi.mock('@/features/editor/ui/SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => null,
}));

import { ChangeRequestCardsListView } from '../ChangeRequestCardsListView';
import { ChangeRequestTimelineCardView } from '../ChangeRequestTimelineCardView';

const translations: Record<string, string> = {
  'features.agendas.crTimeline.activeEventVoting': 'Event voting mode active',
  'features.agendas.crTimeline.activeInternalVoting': 'Internal voting mode active',
  'features.agendas.crTimeline.allCompleted': 'All Completed',
  'features.agendas.crTimeline.tabAccepted': 'Accepted',
  'features.agendas.crTimeline.tabAll': 'All',
  'features.agendas.crTimeline.tabOpen': 'Open',
  'features.agendas.crTimeline.tabRejected': 'Rejected',
  'features.agendas.crTimeline.title': 'Change Request Votes',
  'features.agendas.crTimeline.voteRecorded': 'Vote recorded',
  'features.agendas.crTimeline.voted': 'Voted',
  'features.agendas.crTimeline.voting': 'Voting',
  'features.amendments.workflow.eventVoting': 'Event Voting Mode',
  'features.amendments.workflow.internalVoting': 'Internal Voting Mode',
  'features.amendments.workflowDescriptions.eventVoting': 'The event votes sequentially on changes',
  'features.amendments.workflowDescriptions.internalVoting':
    'Collaborators vote on change requests',
  'features.amendments.voteControls.collaboratorsVoted': '{{voted}}/{{total}} collaborators voted',
  'features.events.agenda.noChoices': 'No choices',
};

function t(
  key: string,
  paramsOrFallback?: string | Record<string, string | number | undefined | null>,
  fallback?: string
) {
  const template =
    translations[key] ??
    (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ??
    key;
  const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined;

  return Object.entries(params ?? {}).reduce(
    (result, [paramKey, value]) => result.replace(`{{${paramKey}}}`, String(value ?? '')),
    template
  );
}

const baseProps = {
  activeTab: 'all',
  agendaItemId: 'agenda-1',
  allCRsProcessed: false,
  amendmentId: 'amendment-1',
  availablePreviewCrIds: [],
  canManage: false,
  canVote: false,
  categorized: {
    accepted: [],
    open: [],
    rejected: [],
  },
  completedCount: 0,
  crIdToDiscussionId: new Map(),
  crItems: [],
  currentItemId: null,
  defaultPreviewCrId: null,
  diffMap: {},
  discussions: [],
  documentContent: [],
  effectivePreviewCrIds: [],
  filteredItems: [],
  finalVoteItem: null,
  getFilteredItems: () => [],
  getPreviewCrId: () => null,
  getUserSelectedChoiceIds: () => [],
  hasUserVoted: () => false,
  isTimelineComplete: false,
  isVotingActive: true,
  items: [],
  normalizedPreviewCrIds: [],
  onCastVote: undefined,
  onCloseVoting: undefined,
  onFinalizeInternalVote: undefined,
  onStartFinal: undefined,
  onStartIndicative: undefined,
  progress: 0,
  progressPercent: 0,
  searchedItems: [],
  searchQuery: '',
  selectedPreviewCrIds: [],
  selectedPreviewSuggestionIds: [],
  setActiveTab: () => undefined,
  setSearchQuery: () => undefined,
  setSelectedPreviewCrIds: () => undefined,
  sharedPreviewEnabled: false,
  t,
  userId: 'user-1',
};

afterEach(() => {
  cleanup();
});

describe('ChangeRequestCardsListView mode labels', () => {
  it('uses localized labels instead of raw internal voting mode tags', () => {
    const { rerender } = render(
      <ChangeRequestCardsListView {...baseProps} editingMode="vote_internal" />
    );

    expect(screen.getByText('Internal voting mode active')).toBeTruthy();
    expect(screen.getByText('Internal Voting Mode')).toBeTruthy();
    expect(screen.queryByText('vote_internal')).toBeNull();

    rerender(<ChangeRequestCardsListView {...baseProps} editingMode="vote_event" />);

    expect(screen.getByText('Event voting mode active')).toBeTruthy();
    expect(screen.getByText('Event Voting Mode')).toBeTruthy();
    expect(screen.queryByText('vote_event')).toBeNull();
  });

  it('uses localized collaborator voting progress text', () => {
    render(
      <ChangeRequestTimelineCardView
        item={{ id: 'timeline-1', status: 'pending' }}
        index={0}
        isCurrent
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote={false}
        isFinalVoteLocked={false}
        diff={null}
        documentContent={[]}
        suggestionId={null}
        crId="CR-1"
        discussions={[]}
        editingMode="vote_internal"
        amendmentId="amendment-1"
        userId="user-1"
        agendaItemId="agenda-1"
        showEditorPreview={false}
        onCastVote={undefined}
        onStartIndicative={undefined}
        onStartFinal={undefined}
        onCloseVoting={undefined}
        t={t}
        votingLoading={false}
        setVotingLoading={() => undefined}
        selectedCrIds={new Set()}
        setSelectedCrIds={() => undefined}
        crIdToDiscussionId={new Map()}
        selectedSuggestionIds={[]}
        cr={{
          close_trigger: 'all_collaborators_voted',
          eligible_voter_count: 5,
          voted_collaborator_count: 3,
        }}
        vote={{ id: 'vote-1' }}
        title="CR title"
        phase={null}
        isClosed={false}
        isIndicative={false}
        isFinal={false}
        voteResult={null}
        choices={[]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        offlineTallies={[]}
        choiceStats={[]}
        totalIndicative={0}
        totalFinal={0}
        totalVoters={5}
        computedVoteSummary={null}
        resolvedVoteResult={null}
        leadingChoiceId={null}
        winningChoiceId={null}
        winningLabel={null}
        resolvedVoteSharePercent={0}
        currentPhaseVoteCount={3}
        handleCastVote={() => undefined}
        isLocked={false}
      />
    );

    expect(screen.getByText('3/5 collaborators voted')).toBeTruthy();
    expect(screen.queryByText('3/5 Collaborators voted')).toBeNull();
  });

  it('uses the preview id resolver supplied by the list controller', () => {
    const getPreviewCrId = vi.fn(() => 'suggestion-1');
    const item = {
      id: 'mock-cr-cr-row-1',
      change_request_id: 'cr-row-1',
      is_final_vote: false,
      status: 'pending',
      change_request: {
        id: 'cr-row-1',
        cr_id: 'CR-1',
        suggestion_id: 'suggestion-1',
        title: 'Replace dieser',
        status: 'open',
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
      },
      vote: null,
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        editingMode="vote_internal"
        filteredItems={[item]}
        crItems={[item]}
        searchedItems={[item]}
        categorized={{ accepted: [], open: [item], rejected: [] }}
        crIdToDiscussionId={new Map([['suggestion-1', 'suggestion-1']])}
        diffMap={{
          'cr-row-1': {
            changeType: 'replace',
            originalText: 'der',
            newText: 'dieser',
          },
        }}
        getPreviewCrId={getPreviewCrId}
      />
    );

    expect(getPreviewCrId).toHaveBeenCalledWith(item);
    expect(screen.getAllByText('Replace dieser').length).toBeGreaterThan(0);
  });

  it('renders internal CR voting controls without event voting result labels', () => {
    const handleCastVote = vi.fn();

    render(
      <ChangeRequestTimelineCardView
        item={{
          id: 'mock-cr-cr-row-1',
          change_request_id: 'cr-row-1',
          status: 'pending',
        }}
        index={0}
        isCurrent
        hasUserVoted
        userSelectedChoiceIds={['mock-choice-yes-cr-row-1']}
        canManage={false}
        canVote
        isFinalVoteLocked={false}
        diff={null}
        documentContent={[]}
        suggestionId="suggestion-1"
        crId="CR-1"
        discussions={[]}
        editingMode="vote_internal"
        amendmentId="amendment-1"
        userId="user-1"
        agendaItemId="agenda-1"
        showEditorPreview={false}
        onCastVote={undefined}
        onStartIndicative={undefined}
        onStartFinal={undefined}
        onCloseVoting={undefined}
        t={t}
        votingLoading={false}
        setVotingLoading={() => undefined}
        selectedCrIds={new Set()}
        setSelectedCrIds={() => undefined}
        crIdToDiscussionId={new Map()}
        selectedSuggestionIds={[]}
        cr={{
          id: 'cr-row-1',
          close_trigger: 'all_collaborators_voted',
          eligible_voter_count: 2,
          voted_collaborator_count: 1,
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
          user_vote: 'accept',
        }}
        vote={{ id: 'mock-vote-cr-row-1' }}
        title="Replace dieser"
        phase={null}
        isClosed={false}
        isIndicative={false}
        isFinal={false}
        voteResult={null}
        choices={[
          { id: 'mock-choice-yes-cr-row-1', label: 'Ja' },
          { id: 'mock-choice-no-cr-row-1', label: 'Nein' },
          { id: 'mock-choice-abstain-cr-row-1', label: 'Enthaltung' },
        ]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        offlineTallies={[]}
        choiceStats={[
          {
            choice: { id: 'mock-choice-yes-cr-row-1', label: 'Ja' },
            finalCount: 0,
            finalPercentage: 0,
            indicativeCount: 0,
            indicativePercentage: 0,
          },
        ]}
        totalIndicative={0}
        totalFinal={0}
        totalVoters={2}
        computedVoteSummary={null}
        resolvedVoteResult={null}
        leadingChoiceId={null}
        winningChoiceId={null}
        winningLabel={null}
        resolvedVoteSharePercent={0}
        currentPhaseVoteCount={1}
        handleCastVote={handleCastVote}
        isLocked={false}
      />
    );

    expect(screen.getByText('Vote recorded')).toBeTruthy();
    expect(screen.getByText('1/2 collaborators voted')).toBeTruthy();
    expect(screen.queryByText('Indication')).toBeNull();
    expect(screen.queryByText('Ja')).toBeNull();
    expect(screen.queryByText('Nein')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(handleCastVote).toHaveBeenCalledWith('mock-choice-no-cr-row-1');
  });
});
