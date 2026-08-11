/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recovery: null as any,
  page: {} as any,
  viewProps: null as any,
  resolveCalls: [] as any[],
}));

vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recovery,
}));
vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: () => <div>recovery</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>skeleton</div> }));
vi.mock('../hooks/useAmendmentWikiPage', () => ({ useAmendmentWikiPage: () => mocks.page }));
vi.mock('../ui/SupporterDirectorySection', () => ({
  SupporterDirectorySection: () => <div>supporter directory</div>,
}));
vi.mock('../AmendmentWikiView', () => ({
  AmendmentWikiView: (props: any) => {
    mocks.viewProps = props;
    return <div>wiki view</div>;
  },
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (value: any, options: any) => {
    mocks.resolveCalls.push([value, options]);
    return value;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

import { AmendmentWiki } from '../AmendmentWiki';

describe('AmendmentWiki A04 branch accountability', () => {
  beforeEach(() => {
    mocks.recovery = null;
    mocks.resolveCalls = [];
    mocks.viewProps = null;
    mocks.page = {
      user: { id: 'user' },
      canAccess: true,
      isSubscribed: false,
      subscriberCount: 0,
      toggleSubscribe: vi.fn(),
      isLoading: false,
      collaboration: {},
      amendment: { id: 'amendment', tutorial_run_id: 'tutorial' },
      roles: [],
      collaborators: [],
      supporterDirectoryItems: [],
      supportingGroupCount: 0,
      clones: [{ id: 'clone', tutorial_run_id: 'clone-tutorial' }],
      clonedFrom: { id: 'source', tutorial_run_id: 'source-tutorial' },
      totalSupportingMembers: 0,
      targetCollaborator: undefined,
      targetGroup: { id: 'target', tutorial_run_id: 'target-tutorial' },
      evaluationModeLabel: null,
      evaluationConfigurationSummary: null,
      implementationStatus: null,
      implementationDisplayStatus: null,
      evaluationEvent: { id: 'event', tutorial_run_id: 'event-tutorial' },
      evaluationAgendaItem: { id: 'agenda' },
      evaluationVoteOutcomeLabel: null,
      evaluationDueDateLabel: null,
      hasImplementationEvaluation: false,
      supporterMapItems: [],
      upvotes: 0,
      downvotes: 0,
      currentVoteValue: 0,
      handleVote: vi.fn(),
      cloneDialogOpen: false,
      setCloneDialogOpen: vi.fn(),
      isCloning: false,
      handleClone: vi.fn(),
      handleConfirmClone: vi.fn(),
    };
  });
  afterEach(() => cleanup());

  it('renders recovery before loading when an amendment is absent', () => {
    mocks.page.amendment = null;
    mocks.page.isLoading = true;
    mocks.recovery = { id: 'draft' };
    render(<AmendmentWiki amendmentId="amendment" />);
    expect(screen.getByText('recovery')).toBeTruthy();
    expect(screen.queryByText('skeleton')).toBeNull();
  });

  it('renders loading when neither amendment nor recovery exists', () => {
    mocks.page.amendment = null;
    mocks.page.isLoading = true;
    render(<AmendmentWiki amendmentId="amendment" />);
    expect(screen.getByText('skeleton')).toBeTruthy();
  });

  it.each([
    [-1, -1],
    [1, 1],
    [5, 0],
  ])('normalizes vote %s to %s and localizes nested tutorial entities', (vote, expected) => {
    mocks.page.currentVoteValue = vote;
    render(<AmendmentWiki amendmentId="amendment" />);
    expect(screen.getByText('wiki view')).toBeTruthy();
    expect(mocks.viewProps.normalizedVoteValue).toBe(expected);
    expect(mocks.resolveCalls).toEqual(
      expect.arrayContaining([
        [mocks.page.amendment, expect.objectContaining({ tutorialRunId: 'tutorial' })],
        [mocks.page.clones[0], expect.objectContaining({ tutorialRunId: 'clone-tutorial' })],
        [mocks.page.clonedFrom, expect.objectContaining({ tutorialRunId: 'source-tutorial' })],
        [mocks.page.targetGroup, expect.objectContaining({ tutorialRunId: 'target-tutorial' })],
        [mocks.page.evaluationEvent, expect.objectContaining({ tutorialRunId: 'event-tutorial' })],
      ])
    );
  });

  it('passes undefined tutorial ids for absent nested entities', () => {
    mocks.page.amendment = { id: 'amendment' };
    mocks.page.clones = [{ id: 'clone' }];
    mocks.page.clonedFrom = null;
    mocks.page.targetGroup = null;
    mocks.page.evaluationEvent = null;
    render(<AmendmentWiki amendmentId="amendment" />);
    expect(mocks.resolveCalls.some(([, options]) => options.tutorialRunId === undefined)).toBe(
      true
    );
  });
});
