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
  'features.agendas.crTimeline.acceptAmendment': 'Accept amendment as modified',
  'features.agendas.crTimeline.changeRequest': 'Change Request',
  'features.agendas.crTimeline.noCRs': 'No change requests',
  'features.agendas.crTimeline.noItemsInTab': 'No change requests in this category',
  'features.agendas.crTimeline.submittedVotePending': 'Submitted - vote pending',
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
  'features.amendments.voteControls.collaboratorsVoted':
    '{{voted}}/{{total}} collaborators with vote right voted',
  'features.events.agenda.noChoices': 'No choices',
  'features.events.voting.phases.closed': 'Closed',
  'features.events.voting.phases.finalVote': 'Final Vote',
  'features.events.voting.phases.indication': 'Indication',
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
  hideInlineVotingControls: false,
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

    expect(screen.getByText('3/5 collaborators with vote right voted')).toBeTruthy();
    expect(screen.queryByText('3/5 Collaborators with vote right voted')).toBeNull();
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

  it('shows an internal vote close action for managers in internal voting mode', () => {
    const handleFinalizeInternalVote = vi.fn(() => Promise.resolve());
    const item = {
      id: 'mock-cr-cr-row-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-row-1',
      is_final_vote: false,
      status: 'pending',
      change_request: {
        id: 'cr-row-1',
        title: 'Branch 1 CR-1',
        status: 'open',
        votes_for: 1,
        votes_against: 0,
        votes_abstain: 0,
      },
      vote: null,
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_internal"
        filteredItems={[item]}
        crItems={[item]}
        searchedItems={[item]}
        sequenceItems={[item]}
        categorized={{ accepted: [], open: [item], rejected: [] }}
        onFinalizeInternalVote={handleFinalizeInternalVote}
      />
    );

    expect(screen.queryByRole('button', { name: 'Start final vote' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Interne Abstimmung beenden' }));

    expect(screen.getByText('Interne Abstimmung beenden?')).toBeTruthy();

    const closeButtons = screen.getAllByRole('button', {
      name: 'Interne Abstimmung beenden',
    });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(handleFinalizeInternalVote).toHaveBeenCalledWith('cr-row-1');
  });

  it('does not show the internal vote close action without amendment manage permission', () => {
    const handleFinalizeInternalVote = vi.fn(() => Promise.resolve());
    const item = {
      id: 'mock-cr-cr-row-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-row-1',
      is_final_vote: false,
      status: 'pending',
      change_request: {
        id: 'cr-row-1',
        title: 'Branch 1 CR-1',
        status: 'open',
        votes_for: 1,
        votes_against: 0,
        votes_abstain: 0,
      },
      vote: null,
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage={false}
        editingMode="vote_internal"
        filteredItems={[item]}
        crItems={[item]}
        searchedItems={[item]}
        sequenceItems={[item]}
        categorized={{ accepted: [], open: [item], rejected: [] }}
        onFinalizeInternalVote={handleFinalizeInternalVote}
      />
    );

    expect(screen.queryByRole('button', { name: 'Interne Abstimmung beenden' })).toBeNull();
  });

  it('does not show the internal vote close action for completed or final change requests', () => {
    const handleFinalizeInternalVote = vi.fn(() => Promise.resolve());
    const items = [
      {
        id: 'mock-cr-completed',
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-completed',
        is_final_vote: false,
        status: 'pending',
        change_request: {
          id: 'cr-completed',
          title: 'Branch 1 CR-1',
          status: 'open',
          voting_status: 'completed',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
        vote: null,
      },
      {
        id: 'mock-cr-accepted',
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-accepted',
        is_final_vote: false,
        status: 'pending',
        change_request: {
          id: 'cr-accepted',
          title: 'Branch 1 CR-2',
          status: 'accepted',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
        vote: null,
      },
    ];

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_internal"
        filteredItems={items}
        crItems={items}
        searchedItems={items}
        sequenceItems={items}
        categorized={{ accepted: [items[1]], open: [items[0]], rejected: [] }}
        onFinalizeInternalVote={handleFinalizeInternalVote}
      />
    );

    expect(screen.queryByRole('button', { name: 'Interne Abstimmung beenden' })).toBeNull();
  });

  it('renders variant and final sequence votes when there are no change requests', () => {
    const now = 1;
    const createVote = (id: string, title: string, purpose: string) => ({
      id,
      agenda_item_id: 'agenda-1',
      amendment_id: 'amendment-1',
      title,
      description: null,
      status: 'indicative',
      purpose,
      majority_type: 'simple',
      closing_type: null,
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      ballot_visibility: 'named',
      created_at: now,
      updated_at: now,
      choices: [
        {
          id: `${id}-yes`,
          vote_id: id,
          label: 'Yes',
          order_index: 0,
          created_at: now,
          indicative_decisions: [],
          final_decisions: [],
        },
      ],
      voters: [],
      indicative_participations: [],
      indicative_decisions: [],
      offline_tallies: [],
      final_participations: [],
      final_decisions: [],
    });
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-variant', 'Variant Final Vote', 'variant_selection'),
    };
    const finalItem = {
      id: 'agenda-vote-final-vote-final',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-final',
      order_index: 1,
      is_final_vote: true,
      _voteStepKind: 'final_amendment',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-final', 'Amendment Final Vote', 'final_amendment'),
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalItem}
        variantVoteItem={variantItem}
        sequenceItems={[variantItem, finalItem]}
        hasCRCategoryItems={false}
      />
    );

    expect(screen.getByText('Variant Final Vote')).toBeTruthy();
    expect(screen.getByText('Amendment Final Vote')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('No change requests')).toBeNull();
    expect(screen.queryByText('No change requests in this category')).toBeNull();
    expect(screen.queryByRole('tab', { name: /Open/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Accepted/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Rejected/ })).toBeNull();
  });

  it('renders the sequence interstitial after the merge vote and before the closing vote', () => {
    const now = 1;
    const createVote = (id: string, title: string, purpose: string) => ({
      id,
      agenda_item_id: 'agenda-1',
      amendment_id: 'amendment-1',
      title,
      description: null,
      status: 'indicative',
      purpose,
      majority_type: 'simple',
      closing_type: null,
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      ballot_visibility: 'named',
      created_at: now,
      updated_at: now,
      choices: [],
      voters: [],
      indicative_participations: [],
      indicative_decisions: [],
      offline_tallies: [],
      final_participations: [],
      final_decisions: [],
    });
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-variant', 'Merge vote', 'variant_selection'),
    };
    const finalItem = {
      id: 'agenda-vote-final-vote-final',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-final',
      order_index: 1,
      is_final_vote: true,
      _voteStepKind: 'final_amendment',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-final', 'Closing vote', 'final_amendment'),
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalItem}
        variantVoteItem={variantItem}
        sequenceItems={[variantItem, finalItem]}
        hasCRCategoryItems={false}
        sequenceInterstitial={<div>Branch switcher</div>}
      />
    );

    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('Merge vote')).toBeLessThan(bodyText.indexOf('Branch switcher'));
    expect(bodyText.indexOf('Branch switcher')).toBeLessThan(bodyText.indexOf('Closing vote'));
  });

  it('renders locked placeholders while variant-dependent votes are not materialized yet', () => {
    const now = 1;
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: {
        id: 'vote-variant',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: 'Merge round 1',
        status: 'indicative',
        purpose: 'variant_selection',
        visibility: 'public',
        ballot_visibility: 'named',
        created_at: now,
        updated_at: now,
        choices: [],
        voters: [],
        indicative_participations: [],
        indicative_decisions: [],
        offline_tallies: [],
        final_participations: [],
        final_decisions: [],
      },
    };
    const changeRequestPlaceholder = {
      id: 'agenda-vote-placeholder-change_request_votes_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 1,
      is_final_vote: false,
      _voteStepKind: 'change_request_votes_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Change request votes',
      _placeholderDescription:
        'The exact change request votes will appear after the variant final vote is decided.',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };
    const finalPlaceholder = {
      id: 'agenda-vote-placeholder-final_amendment_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 2,
      is_final_vote: true,
      _voteStepKind: 'final_amendment_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Final vote',
      _placeholderDescription:
        'The exact final vote will appear after the variant final vote is decided.',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalPlaceholder}
        variantVoteItem={variantItem}
        sequenceItems={[variantItem, changeRequestPlaceholder, finalPlaceholder]}
        hasCRCategoryItems={false}
      />
    );

    expect(screen.getByText('Merge round 1')).toBeTruthy();
    expect(screen.getByText('Change request votes')).toBeTruthy();
    expect(screen.getByText('Final vote')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getAllByText('Locked')).toHaveLength(2);
    expect(screen.queryByText('No choices')).toBeNull();
  });

  it('hides jump to final vote on the no-CR placeholder because final starts live in the agenda toolbar', () => {
    const now = 1;
    const handleStartFinal = vi.fn();
    const createVote = (id: string, title: string, purpose: string, status = 'indicative') => ({
      id,
      agenda_item_id: 'agenda-1',
      amendment_id: 'amendment-1',
      title,
      description: null,
      status,
      purpose,
      majority_type: 'simple',
      closing_type: null,
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      ballot_visibility: 'named',
      created_at: now,
      updated_at: now,
      choices: [{ id: `${id}-yes`, vote_id: id, label: 'Yes', order_index: 0, created_at: now }],
      voters: [],
      indicative_participations: [],
      indicative_decisions: [],
      offline_tallies: [],
      final_participations: [],
      final_decisions: [],
    });
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'completed',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-variant', 'Variant Final Vote', 'variant_selection', 'closed'),
    };
    const changeRequestPlaceholder = {
      id: 'agenda-vote-placeholder-change_request_votes_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 1,
      is_final_vote: false,
      _voteStepKind: 'change_request_votes_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Change request votes',
      _placeholderDescription: 'No change request votes exist.',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };
    const finalItem = {
      id: 'agenda-vote-final-vote-final',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-final',
      order_index: 2,
      is_final_vote: true,
      _voteStepKind: 'final_amendment',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-final', 'Amendment Final Vote', 'final_amendment'),
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalItem}
        variantVoteItem={variantItem}
        currentItemId={changeRequestPlaceholder.id}
        onStartFinal={handleStartFinal}
        sequenceItems={[variantItem, changeRequestPlaceholder, finalItem]}
        hasCRCategoryItems={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Jump to final vote' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start final vote' })).toBeNull();
    expect(handleStartFinal).not.toHaveBeenCalled();
  });

  it('hides moderator start controls when inline voting controls are hidden', () => {
    const now = 1;
    const handleStartFinal = vi.fn();
    const item = {
      id: 'branch-2-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-cr-1',
      order_index: 0,
      is_final_vote: false,
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: {
        id: 'cr-1',
        title: 'Branch 2 CR-1',
      },
      vote: {
        id: 'vote-cr-1',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: 'Branch 2 CR-1',
        description: null,
        status: 'indicative',
        purpose: 'change_request',
        majority_type: 'simple',
        closing_type: null,
        closing_duration_seconds: null,
        closing_end_time: null,
        visibility: 'public',
        ballot_visibility: 'named',
        created_at: now,
        updated_at: now,
        choices: [
          {
            id: 'vote-cr-1-yes',
            vote_id: 'vote-cr-1',
            label: 'Yes',
            order_index: 0,
            created_at: now,
          },
        ],
        voters: [],
        indicative_participations: [],
        indicative_decisions: [],
        offline_tallies: [],
        final_participations: [],
        final_decisions: [],
      },
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_event"
        filteredItems={[item]}
        hideInlineVotingControls
        currentItemId={item.id}
        onStartFinal={handleStartFinal}
        sequenceItems={[item]}
        hasCRCategoryItems
      />
    );

    expect(screen.getAllByText('Branch 2 CR-1').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Start final vote' })).toBeNull();
  });

  it('hides jump to final vote on the no-CR placeholder when only the final placeholder exists', () => {
    const now = 1;
    const handleStartFinal = vi.fn();
    const createVote = (id: string, title: string, purpose: string, status = 'indicative') => ({
      id,
      agenda_item_id: 'agenda-1',
      amendment_id: 'amendment-1',
      title,
      description: null,
      status,
      purpose,
      majority_type: 'simple',
      closing_type: null,
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      ballot_visibility: 'named',
      created_at: now,
      updated_at: now,
      choices: [{ id: `${id}-yes`, vote_id: id, label: 'Yes', order_index: 0, created_at: now }],
      voters: [],
      indicative_participations: [],
      indicative_decisions: [],
      offline_tallies: [],
      final_participations: [],
      final_decisions: [],
    });
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'completed',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-variant', 'Variant Final Vote', 'variant_selection', 'closed'),
    };
    const changeRequestPlaceholder = {
      id: 'agenda-vote-placeholder-change_request_votes_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 1,
      is_final_vote: false,
      _voteStepKind: 'change_request_votes_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Change request votes',
      _placeholderDescription: 'No change request votes exist.',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };
    const finalPlaceholder = {
      id: 'agenda-vote-placeholder-final_amendment_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 2,
      is_final_vote: true,
      _voteStepKind: 'final_amendment_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Final vote',
      _placeholderDescription:
        'The exact final vote will appear after the variant final vote is decided.',
      status: 'pending',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalPlaceholder}
        variantVoteItem={variantItem}
        currentItemId={changeRequestPlaceholder.id}
        onStartFinal={handleStartFinal}
        sequenceItems={[variantItem, changeRequestPlaceholder, finalPlaceholder]}
        hasCRCategoryItems={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Jump to final vote' })).toBeNull();
    expect(handleStartFinal).not.toHaveBeenCalled();
  });

  it('marks no-CR placeholders as skipped after jumping to the final vote', () => {
    const now = Date.now();
    const createVote = (
      id: string,
      title: string,
      purpose: string,
      status: 'indicative' | 'final_vote' | 'closed' = 'indicative'
    ) => ({
      id,
      agenda_item_id: 'agenda-1',
      amendment_id: 'amendment-1',
      title,
      description: null,
      status,
      purpose,
      majority_type: 'simple',
      closing_type: 'manual',
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      ballot_visibility: 'named',
      created_at: now,
      updated_at: now,
      choices: [{ id: `${id}-yes`, vote_id: id, label: 'Yes', order_index: 0, created_at: now }],
      voters: [],
      indicative_participations: [],
      indicative_decisions: [],
      offline_tallies: [],
      final_participations: [],
      final_decisions: [],
    });
    const variantItem = {
      id: 'agenda-vote-variant-vote-variant',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-variant',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'completed',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-variant', 'Variant Final Vote', 'variant_selection', 'closed'),
    };
    const changeRequestPlaceholder = {
      id: 'agenda-vote-placeholder-change_request_votes_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 1,
      is_final_vote: false,
      _voteStepKind: 'change_request_votes_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Change request votes',
      _placeholderDescription:
        'Change request votes were skipped because there were no change requests to vote on.',
      status: 'completed',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: null,
    };
    const finalItem = {
      id: 'agenda-vote-final-vote-final',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: 'vote-final',
      order_index: 2,
      is_final_vote: true,
      _voteStepKind: 'final_amendment',
      status: 'voting',
      created_at: now,
      updated_at: now,
      change_request: null,
      vote: createVote('vote-final', 'Amendment Final Vote', 'final_amendment', 'final_vote'),
    };

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canManage
        editingMode="vote_event"
        filteredItems={[]}
        finalVoteItem={finalItem}
        variantVoteItem={variantItem}
        currentItemId={finalItem.id}
        sequenceItems={[variantItem, changeRequestPlaceholder, finalItem]}
        hasCRCategoryItems={false}
      />
    );

    expect(
      screen.getByText(
        'Change request votes were skipped because there were no change requests to vote on.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('Locked')).toBeNull();
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
    expect(screen.getByText('1/2 collaborators with vote right voted')).toBeTruthy();
    expect(screen.queryByText('Indication')).toBeNull();
    expect(screen.queryByText('Ja')).toBeNull();
    expect(screen.queryByText('Nein')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(handleCastVote).toHaveBeenCalledWith('mock-choice-no-cr-row-1');
  });

  it('labels submitted event suggestions as pending a vote instead of indication', () => {
    render(
      <ChangeRequestTimelineCardView
        item={{
          id: 'mock-cr-cr-row-1',
          change_request_id: 'cr-row-1',
          status: 'pending',
        }}
        index={0}
        isCurrent={false}
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote={false}
        isFinalVoteLocked={false}
        diff={{
          changeType: 'insert',
          newText: 'jfknjdfnjnfjkndfjknjkfdnk',
        }}
        documentContent={[]}
        suggestionId="suggestion-1"
        crId="CR-1"
        discussions={[]}
        editingMode="suggest_event"
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
        cr={{ id: 'cr-row-1', title: 'CR-1' }}
        vote={{ id: 'mock-vote-cr-row-1' }}
        title="CR-1"
        phase="indicative"
        isClosed={false}
        isIndicative
        isFinal={false}
        voteResult={null}
        choices={[]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        offlineTallies={[]}
        choiceStats={[]}
        totalIndicative={0}
        totalFinal={0}
        totalVoters={0}
        computedVoteSummary={null}
        resolvedVoteResult={null}
        leadingChoiceId={null}
        winningChoiceId={null}
        winningLabel={null}
        resolvedVoteSharePercent={0}
        currentPhaseVoteCount={0}
        handleCastVote={() => undefined}
        isLocked={false}
      />
    );

    expect(screen.getByText('Submitted - vote pending')).toBeTruthy();
    expect(screen.queryByText('Indication')).toBeNull();
  });

  it('keeps pending unconfirmed event suggestions labelled as indication', () => {
    render(
      <ChangeRequestTimelineCardView
        item={{
          id: 'mock-cr-suggestion-1',
          change_request_id: 'suggestion-1',
          status: 'pending',
        }}
        index={0}
        isCurrent={false}
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote={false}
        isFinalVoteLocked={false}
        diff={{
          changeType: 'insert',
          newText: 'Noch nicht eingereicht',
        }}
        documentContent={[]}
        suggestionId="suggestion-1"
        crId="CR-1"
        discussions={[]}
        editingMode="suggest_event"
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
          id: 'suggestion-1',
          title: 'CR-1',
          confirmation_status: 'pending',
        }}
        vote={{ id: 'mock-vote-suggestion-1' }}
        title="CR-1"
        phase="indicative"
        isClosed={false}
        isIndicative
        isFinal={false}
        voteResult={null}
        choices={[]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        offlineTallies={[]}
        choiceStats={[]}
        totalIndicative={0}
        totalFinal={0}
        totalVoters={0}
        computedVoteSummary={null}
        resolvedVoteResult={null}
        leadingChoiceId={null}
        winningChoiceId={null}
        winningLabel={null}
        resolvedVoteSharePercent={0}
        currentPhaseVoteCount={0}
        handleCastVote={() => undefined}
        isLocked={false}
      />
    );

    expect(screen.getByText('Indication')).toBeTruthy();
    expect(screen.queryByText('Submitted - vote pending')).toBeNull();
  });

  it('keeps all open internal change request votes unlocked in vote_internal', () => {
    const handleCastVote = vi.fn();
    const items = [
      {
        id: 'mock-cr-cr-row-1',
        change_request_id: 'cr-row-1',
        status: 'pending',
        is_final_vote: false,
        change_request: {
          id: 'cr-row-1',
          title: 'Replace first',
          display_cr_id: 'Branch 1 CR-1',
          close_trigger: 'all_collaborators_voted',
          eligible_voter_count: 2,
          voted_collaborator_count: 0,
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
          user_vote: null,
        },
        vote: { id: 'mock-vote-cr-row-1', choices: [] },
      },
      {
        id: 'mock-cr-cr-row-2',
        change_request_id: 'cr-row-2',
        status: 'pending',
        is_final_vote: false,
        change_request: {
          id: 'cr-row-2',
          title: 'Replace second',
          display_cr_id: 'Branch 1 CR-2',
          close_trigger: 'all_collaborators_voted',
          eligible_voter_count: 2,
          voted_collaborator_count: 0,
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
          user_vote: null,
        },
        vote: { id: 'mock-vote-cr-row-2', choices: [] },
      },
    ];

    render(
      <ChangeRequestCardsListView
        {...baseProps}
        canVote
        editingMode="vote_internal"
        filteredItems={items}
        searchedItems={items}
        crItems={items}
        sequenceItems={items}
        categorized={{ open: items, accepted: [], rejected: [] }}
        onCastVote={handleCastVote}
      />
    );

    expect(screen.getByText('Branch 1 CR-1')).toBeTruthy();
    expect(screen.getByText('Branch 1 CR-2')).toBeTruthy();
    expect(screen.queryByText('Locked')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[1]);
    expect(handleCastVote).toHaveBeenCalledWith(items[1], 'mock-choice-yes-cr-row-2');
  });

  it('keeps indicative voting controls available on locked event voting steps', () => {
    const handleCastVote = vi.fn();

    render(
      <ChangeRequestTimelineCardView
        item={{
          id: 'agenda-cr-1',
          change_request_id: 'cr-row-1',
          status: 'pending',
        }}
        index={0}
        isCurrent
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote
        isFinalVoteLocked
        diff={null}
        documentContent={[]}
        suggestionId="suggestion-1"
        crId="CR-1"
        discussions={[]}
        editingMode="vote_event"
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
        cr={{ id: 'cr-row-1', title: 'CR-1' }}
        vote={{ id: 'vote-1' }}
        title="CR-1"
        phase="indicative"
        isClosed={false}
        isIndicative
        isFinal={false}
        voteResult={null}
        choices={[{ id: 'choice-yes', label: 'yes' }]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        offlineTallies={[]}
        choiceStats={[
          {
            choice: { id: 'choice-yes', label: 'yes' },
            finalCount: 0,
            finalPercentage: 0,
            indicativeCount: 1,
            indicativePercentage: 100,
          },
        ]}
        totalIndicative={1}
        totalFinal={0}
        totalVoters={2}
        computedVoteSummary={null}
        resolvedVoteResult={null}
        leadingChoiceId="choice-yes"
        winningChoiceId="choice-yes"
        winningLabel="yes"
        resolvedVoteSharePercent={100}
        currentPhaseVoteCount={1}
        handleCastVote={handleCastVote}
        isLocked
      />
    );

    expect(screen.getByText('Locked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(handleCastVote).toHaveBeenCalledWith('choice-yes');
  });
});
