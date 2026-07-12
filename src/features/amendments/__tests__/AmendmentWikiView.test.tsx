/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentWikiView, type AmendmentWikiViewProps } from '../AmendmentWikiView';

const translations = vi.hoisted(() => ({
  'components.labels.branches': 'Branchen',
  'components.labels.changeRequests': 'Änderungsanträge',
  'components.labels.clones': 'Klone',
  'components.labels.collaborators': 'Mitarbeiter',
  'components.labels.subscribers': 'Abonnenten',
  'components.labels.supportingGroups': 'Unterstützende Gruppen',
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) =>
    translations[key as keyof typeof translations] ?? fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      translations[key as keyof typeof translations] ?? fallback ?? key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: () => <span data-testid="editing-mode-badge" />,
  getEditingModeOption: (mode: string | null | undefined) => ({ value: mode ?? 'view' }),
}));

vi.mock('@/features/shared/ui/timeline/CivicMotionTimeline', () => ({
  CivicMotionTimeline: () => <div data-testid="civic-motion-timeline" />,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: () => <button type="button">Membership</button>,
  SubscribeButton: () => <button type="button">Subscribe</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteButtons: () => <div data-testid="vote-buttons" />,
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
  InfoTabs: () => <div data-testid="info-tabs" />,
  WikiParticipationDirectory: () => <div data-testid="wiki-participation-directory" />,
  getWikiParticipationName: () => 'Collaborator',
  isVisibleWikiParticipationStatus: () => true,
  normalizeWikiParticipationRole: () => null,
}));

vi.mock('@/features/amendments/ui/TargetSelectionDialog', () => ({
  TargetSelectionDialog: () => <div data-testid="target-selection-dialog" />,
}));

vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function t(key: string, fallback?: string) {
  return translations[key as keyof typeof translations] ?? fallback ?? key;
}

function changeRequests(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `cr-${index + 1}` }));
}

function branches(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `branch-${index + 1}` }));
}

function baseProps(amendmentOverrides: Record<string, unknown> = {}): AmendmentWikiViewProps {
  const amendment = {
    id: 'amendment-1',
    title: 'A1',
    preamble: 'A1 fixture preamble.',
    code: null,
    editing_mode: 'suggest_event',
    collaborator_count: 4,
    clone_count: 0,
    change_request_count: 58,
    change_requests: changeRequests(3),
    current_process_run: {
      branches: branches(2),
    },
    amendment_hashtags: [],
    image_url: null,
    video_url: null,
    youtube: null,
    ...amendmentOverrides,
  };

  return {
    amendmentId: 'amendment-1',
    t,
    user: { id: 'user-1' },
    canAccess: true,
    isSubscribed: false,
    subscriberCount: 0,
    toggleSubscribe: vi.fn(),
    subscribeLoading: false,
    collaboration: {
      acceptInvitation: vi.fn(),
      collaboratorCount: 4,
      hasInvited: false,
      hasRequested: false,
      isCollaborator: false,
      isInvited: false,
      isLoading: false,
      leaveCollaboration: vi.fn(),
      requestCollaboration: vi.fn(),
      status: null,
    },
    amendment,
    roles: [],
    collaborators: [],
    supporterDirectoryItems: [],
    supportingGroupCount: 0,
    clones: [],
    clonedFrom: null,
    totalSupportingMembers: 0,
    targetCollaborator: null,
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
    normalizedVoteValue: 0,
    supporterDirectorySection: <div data-testid="supporter-directory-section" />,
  };
}

function valueForStat(label: string) {
  const labelNode = screen.getByText(label);
  return labelNode.previousElementSibling?.textContent;
}

describe('AmendmentWikiView stats', () => {
  it('shows the number of current process branches', () => {
    render(<AmendmentWikiView {...baseProps()} />);

    expect(valueForStat('Branchen')).toBe('2');
  });

  it('uses the loaded visible change request relation before the denormalized counter', () => {
    render(<AmendmentWikiView {...baseProps()} />);

    expect(valueForStat('Änderungsanträge')).toBe('3');
    expect(screen.queryByText('58')).toBeNull();
  });

  it('falls back to zero when branch and change request relations are missing', () => {
    render(
      <AmendmentWikiView
        {...baseProps({
          change_request_count: undefined,
          change_requests: undefined,
          current_process_run: undefined,
        })}
      />
    );

    expect(valueForStat('Branchen')).toBe('0');
    expect(valueForStat('Änderungsanträge')).toBe('0');
  });
});
