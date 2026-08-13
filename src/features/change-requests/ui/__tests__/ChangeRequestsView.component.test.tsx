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
const branchSelectorMock = vi.hoisted(() =>
  vi.fn((_props: Record<string, unknown>) => (
    <div data-testid="amendment-branch-selector-section" />
  ))
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
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
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
  AmendmentBranchSelectorSection: branchSelectorMock,
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
  it('uses the shell spacing without a hidden-heading gap or additional mobile inset', () => {
    const { container } = render(<ChangeRequestsView {...baseProps()} />);
    const content = container.querySelector('[data-slot="change-requests-page-content"]');
    const heading = container.querySelector('h1.sr-only');
    const visibleContent = heading?.nextElementSibling;

    expect(content?.className).not.toContain('md:px-8');
    expect(visibleContent?.className).toContain('space-y-6');
    expect(visibleContent?.className).not.toContain('pt-5');
    expect(visibleContent?.contains(heading ?? null)).toBe(false);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        containerVariant: 'frameless',
      })
    );

    const listProps = changeRequestCardsListMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(listProps.hasUserVoted({ change_request: null })).toBe(false);
    expect(listProps.hasUserVoted({ change_request: { id: 'without-vote' } })).toBe(false);
    expect(listProps.hasUserVoted({ change_request: { user_vote: 'accept' } })).toBe(true);
    expect(
      listProps.getUserSelectedChoiceIds({
        change_request_id: 'cr-accept',
        change_request: { user_vote: 'accept' },
      })
    ).toEqual(['mock-choice-yes-cr-accept']);
    expect(
      listProps.getUserSelectedChoiceIds({
        change_request_id: 'cr-reject',
        change_request: { user_vote: 'reject' },
      })
    ).toEqual(['mock-choice-no-cr-reject']);
    expect(
      listProps.getUserSelectedChoiceIds({
        change_request_id: 'cr-abstain',
        change_request: { user_vote: 'abstain' },
      })
    ).toEqual(['mock-choice-abstain-cr-abstain']);
    expect(listProps.getUserSelectedChoiceIds({ change_request: null })).toEqual([]);
    expect(listProps.getUserSelectedChoiceIds({ change_request: { user_vote: 'accept' } })).toEqual(
      []
    );
  });

  it('keeps a signed-out viewer read-only while rendering the change requests', () => {
    render(
      <ChangeRequestsView
        {...baseProps()}
        userId={undefined}
        canManageInternalVotes={false}
        canVoteInternal={false}
        canVoteEvent={false}
      />
    );

    expect(screen.getByTestId('change-request-cards-list')).toBeTruthy();
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId: undefined,
        canManage: false,
        canVote: false,
      })
    );
  });

  it('renders a page skeleton while change requests load', () => {
    render(<ChangeRequestsView {...baseProps()} isLoading />);

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.0283_loading_change_requests_83649539')).toBeNull();
  });

  it('renders the not-found state when the amendment is absent', () => {
    render(<ChangeRequestsView {...baseProps()} hasAmendment={false} />);

    expect(screen.getByText('generated.inline.0066_amendment_not_found_3cea3d4d')).toBeTruthy();
    expect(screen.queryByTestId('change-request-cards-list')).toBeNull();
  });

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
        containerVariant: 'frameless',
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
        containerVariant: 'frameless',
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

    render(<ChangeRequestsView {...baseProps()} branchSections={branchSections} virtualize />);

    expect(screen.getAllByTestId('change-request-branch-section')).toHaveLength(2);
    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(2);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[0].timelineItems,
        editingMode: 'vote_internal',
        isVotingActive: true,
        virtualize: true,
      })
    );
    expect(changeRequestCardsListMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        items: branchSections[1].timelineItems,
        editingMode: 'suggest_event',
        isVotingActive: true,
        virtualize: true,
        hideInlineVotingControls: true,
        showAgendaDetailsVoteActions: true,
      })
    );
  });

  it('uses non-voting and final-event contracts plus editing-mode fallbacks', () => {
    const onBranchChange = vi.fn();
    const branches = [{ id: 'branch-1', created_at: 1 }] as any;
    const sections: ChangeRequestBranchSection[] = [
      {
        id: 'event-final',
        branchId: 'branch-event',
        title: 'Event final',
        editingMode: 'event_final_closing_vote',
        totalCount: 1,
        openCount: 1,
        approvedCount: 0,
        declinedCount: 0,
        timelineItems: [timelineItem('event-final-cr')],
        diffMap: {},
        discussions: [],
      },
      {
        id: 'plain',
        branchId: null,
        title: 'Plain',
        editingMode: 'view',
        totalCount: 1,
        openCount: 1,
        approvedCount: 0,
        declinedCount: 0,
        timelineItems: [timelineItem('plain-cr')],
        diffMap: {},
        discussions: [],
      },
    ];

    render(
      <ChangeRequestsView
        {...baseProps()}
        editingMode={undefined}
        branchSections={sections}
        branchSelectorBranches={branches}
        branchDiffCandidates={[]}
        defaultBranchDiffRightCandidateId={undefined}
        onBranchChange={onBranchChange}
        canVoteEvent
        hasUserVotedOnEventCR={vi.fn()}
        getEventCRSelectedChoiceIds={vi.fn()}
        onCastEventCRVote={vi.fn()}
        onOpenEventCRVoteDialog={vi.fn()}
      />
    );

    expect(screen.getByTestId('amendment-branch-selector-section')).toBeTruthy();
    expect(branchSelectorMock.mock.calls.at(-1)?.[0]).toMatchObject({
      defaultDiffRightCandidateId: null,
      onBranchChange,
    });
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toMatchObject({
      editingMode: 'event_final_closing_vote',
      canVote: true,
      hideInlineVotingControls: true,
    });
    expect(changeRequestCardsListMock.mock.calls[1]?.[0]).toMatchObject({
      editingMode: 'view',
      canVote: false,
      hasUserVoted: undefined,
      getUserSelectedChoiceIds: undefined,
      onCastVote: undefined,
      onOpenVoteDialog: undefined,
      onFinalizeInternalVote: undefined,
    });
    expect(screen.getAllByTestId('change-request-branch-section')[1].dataset.branchId).toBe('main');
  });

  it('falls back to edit mode when neither a section nor the page provides a mode', () => {
    render(<ChangeRequestsView {...baseProps()} editingMode={undefined} />);

    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toMatchObject({
      editingMode: 'edit',
      isVotingActive: false,
    });
  });

  it('does not render the selector when branches exist without a change handler', () => {
    render(
      <ChangeRequestsView
        {...baseProps()}
        branchSelectorBranches={[{ id: 'branch-1' }] as any}
        onBranchChange={undefined}
      />
    );

    expect(screen.queryByTestId('amendment-branch-selector-section')).toBeNull();
  });

  it('merges obsolete-only branches, skips duplicates, and renders obsolete data', () => {
    const current: ChangeRequestBranchSection = {
      id: 'current',
      branchId: 'branch-current',
      title: 'Current',
      editingMode: null,
      totalCount: 0,
      openCount: 0,
      approvedCount: 0,
      declinedCount: 0,
      timelineItems: [],
      diffMap: {},
      discussions: [],
    };
    const obsoleteItem = timelineItem('obsolete-cr');
    const obsoleteDuplicate: ChangeRequestBranchSection = {
      ...current,
      id: 'obsolete-duplicate',
      timelineItems: [obsoleteItem],
      diffMap: { obsolete: { changeType: 'remove' } },
    };
    const obsoleteOnly: ChangeRequestBranchSection = {
      ...obsoleteDuplicate,
      id: 'obsolete-only',
      branchId: 'branch-obsolete',
      title: 'Obsolete only',
    };

    render(
      <ChangeRequestsView
        {...baseProps()}
        branchSections={[current]}
        obsoleteBranchSections={[obsoleteDuplicate, obsoleteOnly]}
        selectedBranchId="missing-branch"
      />
    );

    expect(screen.getAllByTestId('change-request-branch-section')).toHaveLength(2);
    expect(changeRequestCardsListMock).toHaveBeenCalledTimes(2);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toMatchObject({
      items: [],
      obsoleteItems: [obsoleteItem],
      diffMap: { obsolete: { changeType: 'remove' } },
      documentContent: baseProps().documentContent,
      discussions: baseProps().discussions,
    });
  });

  it('renders an empty branch message when neither current nor obsolete requests exist', () => {
    const emptySection: ChangeRequestBranchSection = {
      id: 'empty',
      branchId: 'empty-branch',
      title: 'Empty',
      totalCount: 0,
      openCount: 0,
      approvedCount: 0,
      declinedCount: 0,
      timelineItems: [],
      diffMap: {},
      discussions: [],
    };
    render(
      <ChangeRequestsView
        {...baseProps()}
        branchSections={[emptySection]}
        obsoleteBranchSections={[]}
      />
    );

    expect(
      screen.getByText('generated.inline.0290_no_change_requests_for_this_branch_4fd98d30')
    ).toBeTruthy();
    expect(screen.queryByTestId('change-request-cards-list')).toBeNull();
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
        containerVariant: 'frameless',
      })
    );
  });

  it('passes the complete list to one frameless virtualized list shell', () => {
    const props = baseProps();
    const secondItem = timelineItem('flat-cr-2');
    render(
      <ChangeRequestsView
        {...props}
        timelineItems={[...props.timelineItems, secondItem]}
        virtualize
      />
    );

    expect(screen.getAllByTestId('change-request-cards-list')).toHaveLength(1);
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        containerVariant: 'frameless',
        virtualize: true,
        items: [...props.timelineItems, secondItem],
      })
    );
  });

  it('renders the complete change request list shell when the amendment has no change requests', () => {
    render(<ChangeRequestsView {...baseProps()} branchSections={[]} timelineItems={[]} />);

    expect(screen.queryByTestId('change-request-branch-sections')).toBeNull();
    expect(screen.getByTestId('change-request-cards-list').getAttribute('data-item-count')).toBe(
      '0'
    );
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: [],
      })
    );
  });

  it('passes obsolete change requests into the regular list for its dedicated tab', () => {
    const obsoleteItem = timelineItem('obsolete-cr');
    const obsoleteDiff = {
      changeType: 'replace',
      originalText: 'Before',
      newText: 'After',
    };

    render(
      <ChangeRequestsView
        {...baseProps()}
        obsoleteTimelineItems={[obsoleteItem]}
        obsoleteDiffMap={{ 'obsolete-cr': obsoleteDiff }}
      />
    );

    expect(screen.queryByTestId('obsolete-change-requests-section')).toBeNull();
    expect(changeRequestCardsListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: baseProps().timelineItems,
        obsoleteItems: [obsoleteItem],
        diffMap: {
          'obsolete-cr': obsoleteDiff,
        },
      })
    );
  });
});
