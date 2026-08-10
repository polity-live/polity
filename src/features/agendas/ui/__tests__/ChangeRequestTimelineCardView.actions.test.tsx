/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeRequestTimelineCardViewProps } from '../ChangeRequestTimelineCardView';
import { ChangeRequestTimelineCardView } from '../ChangeRequestTimelineCardView';

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({ CREditorPreview: () => null }));
vi.mock('@/features/amendments/city-design/ui/CityDesignChangeRequestPreview', () => ({
  CityDesignChangeRequestPreview: () => null,
}));
vi.mock('@/features/editor/ui/SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => null,
}));
vi.mock('@/features/vote-cast/ui/VoteResultsDisplay', () => ({
  VoteResultsDisplay: () => null,
}));
vi.mock('@/features/change-requests/ui/ChangeRequestSummaryItem', () => ({
  ChangeRequestSummaryItem: ({ title }: { title: string }) => <span>{title}</span>,
}));
vi.mock('@/features/amendments/ui/AmendmentForwardingNotice', () => ({
  AmendmentForwardingNotice: () => null,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  useTranslation: () => ({
    t: (key: string, values?: unknown, fallback?: string) =>
      fallback ?? (typeof values === 'string' ? values : key),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string, values?: unknown, fallback?: string) =>
  fallback ?? (typeof values === 'string' ? values : key);

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    item: { id: 'item-1', status: 'pending', change_request_id: 'cr-1' },
    index: 0,
    isCurrent: true,
    hasUserVoted: false,
    userSelectedChoiceIds: [],
    canManage: true,
    canVote: true,
    diff: null,
    documentContent: null,
    cityDesigns: [],
    suggestionId: null,
    suggestionResolutions: null,
    agendaTitle: 'Agenda',
    forwardingPreview: null,
    crId: 'CR-1',
    displayCrId: 'CR-1',
    discussions: [],
    editingMode: 'event_final_closing_vote',
    amendmentId: 'amendment-1',
    userId: 'user-1',
    userRecord: null,
    agendaItemId: 'agenda-1',
    showEditorPreview: false,
    hideInlineVotingControls: false,
    allowInlineFinalVoteStart: false,
    showAgendaDetailsVoteActions: false,
    voteDisabledTooltip: null,
    isVotingActive: true,
    onOpenVoteDialog: vi.fn(),
    onStartFinal: vi.fn().mockResolvedValue(undefined),
    onCloseVoting: vi.fn().mockResolvedValue(undefined),
    t,
    votingLoading: false,
    setVotingLoading: vi.fn(),
    selectedCrIds: new Set(['CR-1']),
    setSelectedCrIds: vi.fn(),
    selectedSuggestionIds: new Set(),
    cr: { id: 'cr-1', title: 'Safer streets' },
    vote: { id: 'vote-1' },
    voteStepKind: null,
    isPlaceholder: false,
    placeholderDescription: null,
    title: 'Safer streets',
    isInternal: false,
    isClosed: false,
    isIndicative: true,
    isFinal: false,
    choices: [{ id: 'yes', label: 'yes' }],
    choiceStats: [],
    totalIndicative: 0,
    totalFinal: 0,
    totalVoters: 3,
    resolvedVoteResult: null,
    winningChoiceId: null,
    winningLabel: null,
    resolvedVoteSharePercent: null,
    currentPhaseVoteCount: 0,
    handleCastVote: vi.fn(),
    isLocked: false,
    ...overrides,
  } as unknown as ChangeRequestTimelineCardViewProps;
}

describe('ChangeRequestTimelineCardView actions', () => {
  it('toggles details and casts all internal vote choices through stable controls', () => {
    const handleCastVote = vi.fn();
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          editingMode: 'vote_internal',
          isInternal: true,
          handleCastVote,
        })}
      />
    );

    expect(
      document.querySelector('[data-action-id="agendas.change-request.details.toggle"]')
    ).toBeTruthy();
    for (const [variant, choiceId] of [
      ['accept', 'mock-choice-yes-cr-1'],
      ['reject', 'mock-choice-no-cr-1'],
      ['abstain', 'mock-choice-abstain-cr-1'],
    ]) {
      fireEvent.click(
        document.querySelector(
          `[data-action-id="agendas.change-request.internal-vote.${variant}"]`
        )!
      );
      expect(handleCastVote).toHaveBeenCalledWith(choiceId);
    }
  });

  it('casts a visible inline choice and opens the agenda-details vote dialog', () => {
    const handleCastVote = vi.fn();
    const onOpenVoteDialog = vi.fn();
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          showAgendaDetailsVoteActions: true,
          handleCastVote,
          onOpenVoteDialog,
        })}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="agendas.change-request.vote.cast-choice"]')!
    );
    expect(handleCastVote).toHaveBeenCalledWith('yes');

    fireEvent.click(
      document.querySelector('[data-action-id="agendas.change-request.vote-dialog.open"]')!
    );
    expect(onOpenVoteDialog).toHaveBeenCalledWith('item-1');
  });

  it('opens and confirms the final vote transition', () => {
    const onStartFinal = vi.fn().mockResolvedValue(undefined);
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({ allowInlineFinalVoteStart: true, onStartFinal })}
      />
    );

    fireEvent.click(
      document.querySelector(
        '[data-action-id="agendas.change-request.final-vote.confirmation.open"]'
      )!
    );
    fireEvent.click(
      document.querySelector(
        '[data-action-id="agendas.change-request.final-vote.confirmation.confirm"]'
      )!
    );
    expect(onStartFinal).toHaveBeenCalledWith('item-1');
  });

  it('jumps directly to the final vote for a placeholder step', () => {
    const onStartFinal = vi.fn().mockResolvedValue(undefined);
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          allowInlineFinalVoteStart: true,
          voteStepKind: 'change_request_votes_placeholder',
          onStartFinal,
        })}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="agendas.change-request.final-vote.jump"]')!
    );
    expect(onStartFinal).toHaveBeenCalledWith('item-1');
  });

  it('opens and confirms closing a final vote', () => {
    const onCloseVoting = vi.fn().mockResolvedValue(undefined);
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({ isIndicative: false, isFinal: true, onCloseVoting })}
      />
    );

    fireEvent.click(
      document.querySelector(
        '[data-action-id="agendas.change-request.close-vote.confirmation.open"]'
      )!
    );
    const confirm = document.querySelector(
      '[data-action-id="agendas.change-request.close-vote.confirmation.confirm"]'
    )!;
    fireEvent.click(confirm);
    expect(onCloseVoting).toHaveBeenCalledWith('item-1');
  });

  it('covers rejected status, identifier, choice-label, and final-start fallbacks', () => {
    const { rerender } = render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: { id: 'completed', status: 'completed' },
          index: 0,
          displayCrId: null,
          crId: null,
          cr: {},
          resolvedVoteResult: 'rejected',
          choiceStats: [
            {
              choice: { id: 'unlabelled', label: '' },
              finalCount: 0,
              finalPercentage: 0,
              indicativeCount: 0,
              indicativePercentage: 0,
            },
          ],
        })}
      />
    );
    expect(document.body.textContent).toContain('features.agendas.crTimeline.rejected');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: { id: 'fallback', status: 'voting' },
          index: -1,
          displayCrId: null,
          crId: null,
          cr: {},
          allowInlineFinalVoteStart: true,
          isIndicative: true,
        })}
      />
    );
    expect(
      document.querySelector(
        '[data-action-id="agendas.change-request.final-vote.confirmation.open"]'
      )
    ).toBeTruthy();
  });

  it('blocks an unavailable agenda vote and handles a missing final-start callback', () => {
    const onOpenVoteDialog = vi.fn();
    const { rerender } = render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          showAgendaDetailsVoteActions: true,
          canVote: false,
          voteDisabledTooltip: 'Voting unavailable',
          onOpenVoteDialog,
          cr: { id: 'cr-1', title: 'Safer streets', description: 'Detailed description' },
        })}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.change-request.vote-dialog.open"]')!
    );
    expect(onOpenVoteDialog).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Detailed description');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          allowInlineFinalVoteStart: true,
          voteStepKind: 'change_request_votes_placeholder',
          onStartFinal: undefined,
        })}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.change-request.final-vote.jump"]')!
    );
  });

  it('renders obsolete metadata and every diff presentation variant', () => {
    const richDiff = {
      changeType: 'update',
      originalText: 'Old text',
      newText: 'New text',
      properties: { weight: 'normal' },
      newProperties: { weight: 'bold' },
      justification: 'Clearer wording',
    };
    const { rerender } = render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: { id: 'obsolete', status: 'completed', change_request_id: 'obsolete-cr' },
          cr: {
            id: 'obsolete-cr',
            title: 'Obsolete CR',
            status: 'obsolete',
            obsolete_reason: 'suggestion_removed_in_collaborative_editing',
            obsolete_at: 1_700_000_000_000,
          },
          diff: richDiff,
        })}
      />
    );
    expect(document.body.textContent).toContain('Clearer wording');
    expect(document.body.textContent).toContain('Closed at');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: { id: 'obsolete-empty', status: 'completed' },
          cr: {
            id: 'obsolete-empty',
            status: 'obsolete',
            obsolete_reason: null,
            obsolete_at: null,
          },
          diff: { justification: 'Reason only' },
        })}
      />
    );
    expect(document.body.textContent).toContain('Reason only');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          diff: { newProperties: { color: 'blue' } },
        })}
      />
    );
    expect(document.body.textContent).not.toContain('color');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({ diff: richDiff, isClosed: true, isIndicative: false })}
      />
    );
    expect(document.body.textContent).toContain('generated.inline.0001_formatting_changed');

    for (const isClosed of [false, true]) {
      rerender(
        <ChangeRequestTimelineCardView
          {...makeProps({
            diff: { changeType: 'remove', originalText: 'Removed line' },
            isClosed,
            isIndicative: !isClosed,
          })}
        />
      );
      expect(document.body.textContent).toContain('Removed line');
      rerender(
        <ChangeRequestTimelineCardView
          {...makeProps({
            diff: { changeType: 'insert', newText: 'Inserted line' },
            isClosed,
            isIndicative: !isClosed,
          })}
        />
      );
      expect(document.body.textContent).toContain('Inserted line');
    }
  });

  it('distinguishes author and observer states for pending submissions', () => {
    const pendingItem = {
      id: 'pending',
      status: 'pending',
      change_request_id: 'pending-cr',
      _originalStatus: 'pending_submission',
      change_request: { id: 'pending-cr', status: 'pending_submission' },
    };
    const { rerender } = render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: pendingItem,
          cr: pendingItem.change_request,
          crId: 'CR-pending',
          suggestionId: 'suggestion-pending',
          discussions: [{ id: 'suggestion-pending', userId: 'user-1' }],
          showEditorPreview: true,
          documentContent: [],
        })}
      />
    );
    expect(document.body.textContent).toContain('Open the editor below');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: pendingItem,
          cr: pendingItem.change_request,
          crId: 'CR-pending',
          suggestionId: 'suggestion-pending',
          discussions: [{ id: 'suggestion-pending', userId: 'someone-else' }],
        })}
      />
    );
    expect(document.body.textContent).toContain('Waiting for the author');
  });

  it('renders preview controls, forwarding, indication, and direct resolution', () => {
    const { rerender } = render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          editingMode: 'view',
          showEditorPreview: true,
          documentContent: [],
          suggestionId: 'suggestion-1',
          discussions: [{ id: 'one' }, { id: 'two' }],
          hasUserVoted: true,
          isIndicative: true,
        })}
      />
    );
    expect(document.body.textContent).toContain('features.events.agenda.yourIndication');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({
          item: { id: 'closing', status: 'completed', is_closing_vote: true },
          forwardingPreview: { destination: 'next' },
          cr: { id: 'cr-1', resolution_method: 'direct_internal' },
          isClosed: true,
          isIndicative: false,
        })}
      />
    );
    expect(document.body.textContent).toContain(
      'features.agendas.crTimeline.directInternalResolution'
    );
  });

  it('renders deadline and selected internal vote states', () => {
    const common = {
      editingMode: 'vote_internal',
      isInternal: true,
      cr: {
        id: 'cr-1',
        close_trigger: 'after_minutes',
        voting_deadline: 1_700_000_000_000,
        votes_for: 1,
        votes_against: 1,
        votes_abstain: 1,
        user_vote: 'reject',
      },
      hasUserVoted: true,
    };
    const { rerender } = render(<ChangeRequestTimelineCardView {...makeProps(common)} />);
    expect(document.body.textContent).toContain('Deadline');
    expect(
      document.querySelector('[data-action-id="agendas.change-request.internal-vote.reject"]')
        ?.className
    ).toContain('ring-2');

    rerender(
      <ChangeRequestTimelineCardView
        {...makeProps({ ...common, cr: { ...common.cr, user_vote: 'abstain' } })}
      />
    );
    expect(
      document.querySelector('[data-action-id="agendas.change-request.internal-vote.abstain"]')
        ?.className
    ).toContain('ring-2');
  });

  it('casts yes, no, and neutral choices and marks selected choices', () => {
    const handleCastVote = vi.fn();
    render(
      <ChangeRequestTimelineCardView
        {...makeProps({
          choices: [
            { id: 'yes', label: 'yes' },
            { id: 'no', label: 'no' },
            { id: 'maybe', label: 'maybe' },
          ],
          userSelectedChoiceIds: ['no', 'maybe'],
          handleCastVote,
        })}
      />
    );
    const buttons = document.querySelectorAll(
      '[data-action-id="agendas.change-request.vote.cast-choice"]'
    );
    expect(buttons).toHaveLength(3);
    buttons.forEach(button => fireEvent.click(button));
    expect(handleCastVote).toHaveBeenCalledWith('yes');
    expect(handleCastVote).toHaveBeenCalledWith('no');
    expect(handleCastVote).toHaveBeenCalledWith('maybe');
  });
});
