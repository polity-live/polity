/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChangeRequestBranchSection } from '../../logic/changeRequestsViewModel';
import { ChangeRequestsView } from '../ChangeRequestsView';

const changeRequestCardsListMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    const items = props.items as unknown[];

    return (
      <div data-testid="change-request-cards-list" data-item-count={items.length}>
        Change request cards
      </div>
    );
  })
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/agendas/ui/AgendaCRVoteTimeline', () => ({
  AgendaCRVoteTimeline: () => <div data-testid="agenda-cr-vote-timeline" />,
}));

vi.mock('@/features/agendas/ui/ChangeRequestCardsList', () => ({
  ChangeRequestCardsList: changeRequestCardsListMock,
}));

vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: () => <div data-testid="amendment-branch-selector-section" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function timelineItem(id: string) {
  return {
    id,
    agenda_item_id: 'agenda-1',
    change_request_id: id,
    status: 'pending',
    is_closing_vote: false,
    change_request: {
      id,
      title: id,
      user_vote: null,
    },
    vote: null,
  } as never;
}

function baseProps() {
  const flatDocumentContent = [{ type: 'p', children: [{ text: 'Flat document' }] }];

  return {
    agendaItemId: 'agenda-1',
    allChangeRequestsCount: 3,
    amendmentId: 'amendment-1',
    approvedCount: 1,
    declinedCount: 0,
    diffMap: {},
    discussions: [],
    documentContent: flatDocumentContent as never,
    editingMode: 'vote_internal' as const,
    hasAmendment: true,
    isInVotingStage: false,
    isLoading: false,
    openCount: 2,
    timelineItems: [timelineItem('flat-cr')],
    userId: 'user-1',
    canManageInternalVotes: true,
    canVoteInternal: true,
    onCastInternalVote: vi.fn(),
    onFinalizeInternalVote: vi.fn(),
  };
}

describe('ChangeRequestsView branch sections', () => {
  it('renders the selected process branch and passes branch-specific data when switching', () => {
    const branchOneDocument = [{ type: 'p', children: [{ text: 'Branch one document' }] }];
    const branchTwoDocument = [{ type: 'p', children: [{ text: 'Branch two document' }] }];
    const branchOneDiscussions = [
      {
        id: 'discussion-branch-1',
        crId: 'CR-1',
        userId: 'user-1',
        comments: [],
        createdAt: new Date(1),
        isResolved: false,
        processBranchId: 'branch-1',
      },
    ];
    const branchOneDiffMap = {
      'branch-1-cr': {
        changeType: 'replace',
        originalText: 'Before',
        newText: 'After',
      },
    };
    const branchSections: ChangeRequestBranchSection[] = [
      {
        id: 'branch-1-section',
        branchId: 'branch-1',
        title: 'Branch one',
        description: 'First path',
        status: 'in_vote',
        editingMode: 'vote_internal',
        resolution: null,
        eventTitle: 'First event',
        totalCount: 1,
        openCount: 1,
        approvedCount: 0,
        declinedCount: 0,
        timelineItems: [timelineItem('branch-1-cr')],
        diffMap: branchOneDiffMap,
        discussions: branchOneDiscussions,
        documentContent: branchOneDocument as never,
      },
      {
        id: 'branch-2-section',
        branchId: 'branch-2',
        title: 'Branch two',
        status: 'completed',
        editingMode: 'suggest_event',
        resolution: 'winner',
        totalCount: 1,
        openCount: 0,
        approvedCount: 1,
        declinedCount: 0,
        timelineItems: [timelineItem('branch-2-cr')],
        diffMap: {},
        discussions: [],
        documentContent: branchTwoDocument as never,
      },
    ];

    const { rerender } = render(
      <ChangeRequestsView
        {...baseProps()}
        branchSections={branchSections}
        selectedBranchId="branch-1"
      />
    );

    expect(screen.getAllByTestId('change-request-branch-section')).toHaveLength(1);
    expect(screen.getByTestId('change-request-branch-section').dataset.branchId).toBe('branch-1');
    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(1);

    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[0].timelineItems,
        editingMode: 'vote_internal',
        isVotingActive: true,
        diffMap: branchOneDiffMap,
        discussions: branchOneDiscussions,
        documentContent: branchOneDocument,
      })
    );

    rerender(
      <ChangeRequestsView
        {...baseProps()}
        branchSections={branchSections}
        selectedBranchId="branch-2"
      />
    );

    expect(screen.getAllByTestId('change-request-branch-section')).toHaveLength(1);
    expect(screen.getByTestId('change-request-branch-section').dataset.branchId).toBe('branch-2');
    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(1);

    expect(changeRequestCardsListMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[1].timelineItems,
        editingMode: 'suggest_event',
        isVotingActive: true,
        hideInlineVotingControls: true,
        showAgendaDetailsVoteActions: true,
        documentContent: branchTwoDocument,
      })
    );
  });

  it('renders every process branch when no branch is selected', () => {
    const branchSections: ChangeRequestBranchSection[] = [
      {
        id: 'branch-1-section',
        branchId: 'branch-1',
        title: 'Branch one',
        editingMode: 'vote_internal',
        totalCount: 1,
        openCount: 1,
        approvedCount: 0,
        declinedCount: 0,
        timelineItems: [timelineItem('branch-1-cr')],
        diffMap: {},
        discussions: [],
      },
      {
        id: 'branch-2-section',
        branchId: 'branch-2',
        title: 'Branch two',
        editingMode: 'suggest_event',
        totalCount: 1,
        openCount: 1,
        approvedCount: 0,
        declinedCount: 0,
        timelineItems: [timelineItem('branch-2-cr')],
        diffMap: {},
        discussions: [],
      },
    ];

    render(<ChangeRequestsView {...baseProps()} branchSections={branchSections} />);

    expect(screen.getAllByTestId('change-request-branch-section')).toHaveLength(2);
    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(2);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[0].timelineItems,
        editingMode: 'vote_internal',
        isVotingActive: true,
      })
    );
    expect(changeRequestCardsListMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[1].timelineItems,
        editingMode: 'suggest_event',
        isVotingActive: true,
        hideInlineVotingControls: true,
        showAgendaDetailsVoteActions: true,
      })
    );
  });

  it('falls back to the original flat list when there are no process branches', () => {
    const props = baseProps();

    render(<ChangeRequestsView {...props} branchSections={[]} />);

    expect(screen.queryByTestId('change-request-branch-sections')).toBeNull();
    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(1);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: props.timelineItems,
        diffMap: props.diffMap,
        discussions: props.discussions,
        documentContent: props.documentContent,
      })
    );
  });
});
