/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChangeRequestsPageContainerView } from '../ChangeRequestsPageContainerView';

const mocks = vi.hoisted(() => ({
  changeRequestsProps: null as Record<string, any> | null,
  voteDialogProps: null as Record<string, any> | null,
  project: vi.fn((value: unknown, context: unknown) => ({ projected: value, context })),
}));

vi.mock('../ChangeRequestsView', () => ({
  ChangeRequestsView: (props: Record<string, any>) => {
    mocks.changeRequestsProps = props;
    return <div data-testid="change-requests-view" />;
  },
}));

vi.mock('@/features/vote-cast/ui/VoteCastDialog', () => ({
  VoteCastDialog: (props: Record<string, any>) => {
    mocks.voteDialogProps = props;
    return <div data-testid="vote-dialog" />;
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'de' }),
}));

vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: mocks.project,
}));

const baseProps = {
  amendmentId: 'amendment-1',
  userId: 'user-1',
  amendment: { id: 'amendment-1', tutorial_run_id: 'tutorial-1' },
  document: { content: [{ type: 'p', children: [{ text: 'Content' }] }] },
  openChangeRequests: [{ id: 'open' }],
  approvedChangeRequests: [{ id: 'approved' }],
  declinedChangeRequests: [{ id: 'declined' }],
  isLoading: false,
  agendaItemId: 'agenda-1',
  isInVotingStage: true,
  allChangeRequests: [{ id: 'all-1' }, { id: 'all-2' }],
  timelineItems: ['timeline'],
  diffMap: { diff: true },
  discussions: ['discussion'],
  branchSections: ['branch'],
  obsoleteBranchSections: ['obsolete-branch'],
  obsoleteTimelineItems: ['obsolete-timeline'],
  obsoleteDiffMap: { obsolete: true },
  branchSelectorBranches: ['selector'],
  selectedBranchId: 'branch-1',
  selectedBranchEditingMode: 'suggest_event' as const,
  branchDiffCandidates: ['candidate'],
  defaultBranchDiffRightCandidateId: 'candidate-1',
  onBranchChange: vi.fn(),
  canManageInternalVotes: true,
  canVoteInternal: true,
  canVoteEvent: true,
  hasUserVotedOnEventCR: vi.fn(),
  getEventCRSelectedChoiceIds: vi.fn(),
  onCastEventCRVote: vi.fn(),
  onOpenEventCRVoteDialog: vi.fn(),
  eventVoteDialogOpen: true,
  setEventVoteDialogOpen: vi.fn(),
  selectedEventVoteTitle: 'Vote title',
  selectedEventVoteChoices: ['choice'],
  selectedEventVotePhase: 'open',
  onCastEventVoteFromDialog: vi.fn(),
  onSubmitVotingPassword: vi.fn(),
  passwordError: null,
  isPasswordVerifying: false,
  onCastInternalVote: vi.fn(),
  onFinalizeInternalVote: vi.fn(),
};

beforeEach(() => {
  mocks.changeRequestsProps = null;
  mocks.voteDialogProps = null;
  mocks.project.mockClear();
});

afterEach(cleanup);

describe('ChangeRequestsPageContainerView', () => {
  it('projects tutorial fixture data and forwards the complete active state', () => {
    render(<ChangeRequestsPageContainerView {...baseProps} cityDesigns={['design']} />);

    expect(mocks.changeRequestsProps).toMatchObject({
      virtualize: true,
      amendmentId: 'amendment-1',
      approvedCount: 1,
      declinedCount: 1,
      openCount: 1,
      allChangeRequestsCount: 2,
      agendaItemId: 'agenda-1',
      cityDesigns: ['design'],
      hasAmendment: true,
    });
    expect(mocks.changeRequestsProps?.documentContent).toMatchObject({
      projected: baseProps.document.content,
      context: { tutorialRunId: 'tutorial-1', language: 'de' },
    });
    expect(mocks.voteDialogProps).toMatchObject({
      open: true,
      requirePassword: true,
      noVotingPasswordSettingsHref: '/user/user-1/settings?tab=passwords',
    });
    expect(mocks.project).toHaveBeenCalledTimes(10);
  });

  it('uses optional fallbacks without an amendment, document, agenda item, user, or dialog', () => {
    render(
      <ChangeRequestsPageContainerView
        {...baseProps}
        amendment={null}
        document={null}
        userId={null}
        agendaItemId={null}
        eventVoteDialogOpen={0}
      />
    );

    expect(mocks.changeRequestsProps).toMatchObject({
      agendaItemId: undefined,
      cityDesigns: [],
      hasAmendment: false,
    });
    expect(mocks.changeRequestsProps?.documentContent).toMatchObject({
      projected: undefined,
      context: { tutorialRunId: undefined, language: 'de' },
    });
    expect(mocks.voteDialogProps).toMatchObject({
      open: false,
      noVotingPasswordSettingsHref: undefined,
    });
  });
});
