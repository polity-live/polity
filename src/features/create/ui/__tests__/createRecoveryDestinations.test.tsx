/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateRecoveryDraft } from '../../logic/createFinalization';

const testState = vi.hoisted(() => ({
  recoveryDraft: null as CreateRecoveryDraft | null,
  groupPage: vi.fn(),
  eventPage: vi.fn(),
  amendmentPage: vi.fn(),
  blogDetail: vi.fn(),
}));

vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => testState.recoveryDraft,
}));

vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: ({ draft }: { draft: CreateRecoveryDraft }) => (
    <div data-testid={`${draft.entityType}-${draft.status}-recovery`} />
  ),
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  GlobalLoadingAnimation: () => <div data-testid="global-loading-animation" />,
}));

vi.mock('@/features/groups/hooks/useGroupWikiPage', () => ({
  useGroupWikiPage: () => testState.groupPage(),
}));

vi.mock('@/features/events/hooks/useEventWikiPage', () => ({
  useEventWikiPage: () => testState.eventPage(),
}));

vi.mock('@/features/amendments/hooks/useAmendmentWikiPage', () => ({
  useAmendmentWikiPage: () => testState.amendmentPage(),
}));

vi.mock('@/features/blogs/hooks/useBlogDetailController', () => ({
  useBlogDetailController: () => testState.blogDetail(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import { GroupWiki } from '@/features/groups/GroupWiki';
import { EventWiki } from '@/features/events/EventWiki';
import { AmendmentWiki } from '@/features/amendments/AmendmentWiki';
import { BlogDetail } from '@/features/blogs/ui/BlogDetail';

function draft(
  entityType: CreateRecoveryDraft['entityType'],
  entityId: string,
  status: CreateRecoveryDraft['status']
): CreateRecoveryDraft {
  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    createPath: `/create/${entityType}`,
    formState: {},
    mutationPayload: {},
    target: {
      kind: 'route',
      entityType,
      to: `/${entityType}/$id`,
      params: { id: entityId },
    },
    submittedAt: Date.now(),
    status,
    errorMessage: status === 'failed' ? 'Server rejected create' : undefined,
  };
}

function emptyGroupPage() {
  return {
    group: null,
    isLoading: false,
    canAccess: true,
    memberCount: 0,
    eventsCount: 0,
    amendmentsCount: 0,
    subscriberCount: 0,
    isSubscribed: false,
    subscribeLoading: false,
    toggleSubscribe: vi.fn(),
    status: null,
    isMember: false,
    hasRequested: false,
    isInvited: false,
    isBase: true,
    isHierarchical: false,
    isSibling: false,
    membershipLoading: false,
    canRequestJoin: false,
    canAcceptInvitation: false,
    requestJoinDisabledReason: null,
    requestJoinConflictResponse: null,
    acceptInvitationConflictResponse: null,
    requestJoin: vi.fn(),
    leaveGroup: vi.fn(),
    acceptInvitation: vi.fn(),
  };
}

function emptyEventPage() {
  return {
    user: null,
    canAccess: true,
    isSubscribed: false,
    subscriberCount: 0,
    toggleSubscribe: vi.fn(),
    isLoading: false,
    participation: {},
    event: null,
    agendaStats: {},
    elections: [],
    electionsDialogOpen: false,
    setElectionsDialogOpen: vi.fn(),
    confirmDialogOpen: false,
    setConfirmDialogOpen: vi.fn(),
    selectedElection: null,
    isSubmitting: false,
    candidacyPasswordError: null,
    getUserCandidacy: vi.fn(),
    handleElectionClick: vi.fn(),
    handleConfirmCandidacy: vi.fn(),
  };
}

function emptyAmendmentPage() {
  return {
    user: null,
    canAccess: true,
    isSubscribed: false,
    subscriberCount: 0,
    toggleSubscribe: vi.fn(),
    isLoading: false,
    collaboration: {},
    amendment: null,
    roles: [],
    collaborators: [],
    supporterDirectoryItems: [],
    supportingGroupCount: 0,
    clones: [],
    clonedFrom: null,
    totalSupportingMembers: 0,
    targetCollaborator: undefined,
    targetGroup: null,
    evaluationModeLabel: null,
    evaluationConfigurationSummary: null,
    implementationStatus: null,
    implementationDisplayStatus: null,
    evaluationEvent: null,
    evaluationAgendaItem: null,
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
    usersData: { $users: [] },
  };
}

describe('created entity recovery destination states', () => {
  beforeEach(() => {
    testState.recoveryDraft = null;
    testState.groupPage.mockReturnValue(emptyGroupPage());
    testState.eventPage.mockReturnValue(emptyEventPage());
    testState.amendmentPage.mockReturnValue(emptyAmendmentPage());
    testState.blogDetail.mockReturnValue({ isLoaded: false, recoveryDraft: null });
  });

  afterEach(cleanup);

  it('renders group recovery while the optimistic group page is catching up', () => {
    testState.recoveryDraft = draft('group', 'group-1', 'pending');

    render(<GroupWiki groupId="group-1" />);

    expect(screen.getByTestId('group-pending-recovery')).toBeTruthy();
  });

  it('renders event recovery while the optimistic event page is catching up', () => {
    testState.recoveryDraft = draft('event', 'event-1', 'pending');

    render(<EventWiki eventId="event-1" />);

    expect(screen.getByTestId('event-pending-recovery')).toBeTruthy();
  });

  it('renders amendment recovery when the server rejected creation', () => {
    testState.recoveryDraft = draft('amendment', 'amendment-1', 'failed');

    render(<AmendmentWiki amendmentId="amendment-1" />);

    expect(screen.getByTestId('amendment-failed-recovery')).toBeTruthy();
  });

  it('renders blog recovery on the detail route when the optimistic blog is missing', () => {
    const blogDraft = draft('blog', 'blog-1', 'failed');
    testState.blogDetail.mockReturnValue({ isLoaded: false, recoveryDraft: blogDraft });

    render(<BlogDetail blogId="blog-1" />);

    expect(screen.getByTestId('blog-failed-recovery')).toBeTruthy();
  });
});
