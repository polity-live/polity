/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const timelineMock = vi.hoisted(() => vi.fn(() => <div data-testid="civic-motion-timeline" />));
const directoryMock = vi.hoisted(() =>
  vi.fn(() => <div data-testid="wiki-participation-directory" />)
);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    translations[key as keyof typeof translations] ??
    (typeof paramsOrFallback === 'string' ? paramsOrFallback : key),
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
      translations[key as keyof typeof translations] ??
      (typeof paramsOrFallback === 'string' ? paramsOrFallback : key),
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: () => <span data-testid="editing-mode-badge" />,
  getEditingModeOption: (mode: string | null | undefined) => ({ value: mode ?? 'view' }),
}));

vi.mock('@/features/shared/ui/timeline/CivicMotionTimeline', () => ({
  CivicMotionTimeline: timelineMock,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: ({
    'data-action-id': actionId,
    onRequest,
  }: {
    'data-action-id': string;
    onRequest: () => void;
  }) => (
    <button type="button" data-action-id={actionId} onClick={onRequest}>
      Membership
    </button>
  ),
  SubscribeButton: ({
    'data-action-id': actionId,
    onToggleSubscribe,
  }: {
    'data-action-id': string;
    onToggleSubscribe: () => void;
  }) => (
    <button type="button" data-action-id={actionId} onClick={onToggleSubscribe}>
      Subscribe
    </button>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id': string }) => (
    <button type="button" data-action-id={actionId}>
      Share
    </button>
  ),
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-testid="hashtags" data-badge-class-name={badgeClassName} />
  ),
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteButtons: ({ presentation }: { presentation?: string }) => (
    <div data-testid="vote-buttons" data-presentation={presentation} />
  ),
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
  InfoTabs: () => <div data-testid="info-tabs" />,
  WikiParticipationDirectory: directoryMock,
  getWikiParticipationName: (user: any) => user?.name ?? user?.handle ?? 'Collaborator',
  isVisibleWikiParticipationStatus: (status: string) => status !== 'hidden',
  normalizeWikiParticipationRole: (role: any) =>
    role?.id ? { id: role.id, name: role.name ?? role.id } : null,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params?.id ? `${to}/${params.id}` : to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: any) => <div data-testid="supporter-card">{group.name}</div>,
}));

vi.mock('@/features/amendments/ui/SupporterStatusBadge', () => ({
  SupporterStatusBadge: ({ status }: any) => <span>{status}</span>,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      collaboratorPage: (args: any) => args,
      collaboratorById: (args: any) => args,
    },
  },
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
    normalizedVoteValue: 0,
    supporterDirectorySection: <div data-testid="supporter-directory-section" />,
  };
}

function valueForStat(label: string) {
  const labelNode = screen.getByText(label);
  return labelNode.previousElementSibling?.textContent;
}

describe('AmendmentWikiView stats', () => {
  it('stacks the editing mode below the title on mobile and restores the row on desktop', () => {
    render(<AmendmentWikiView {...baseProps()} />);

    const title = screen.getByRole('heading', { level: 1, name: 'A1' });
    const titleGroup = title.parentElement;

    expect(titleGroup?.className).toContain('flex-col');
    expect(titleGroup?.className).toContain('md:flex-row');
    expect(titleGroup?.className).toContain('gap-1');
    expect(titleGroup?.className).toContain('md:gap-3');
    expect(title.nextElementSibling).toBe(screen.getByTestId('editing-mode-badge'));

    const header = titleGroup?.parentElement;
    expect(header?.className).toContain('mb-4');
    expect(header?.className).toContain('md:mb-8');
  });

  it('places mobile hashtags after the editing mode and keeps the desktop position', () => {
    render(
      <AmendmentWikiView
        {...baseProps({
          title: 'A very long amendment title',
          amendment_hashtags: [
            {
              id: 'amendment-tag-1',
              hashtag: { id: 'tag-1', tag: 'a-very-long-hashtag' },
            },
          ],
        })}
      />
    );

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'A very long amendment title',
    });
    const titleGroup = title.parentElement;
    const hashtagDisplays = screen.getAllByTestId('hashtags');

    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('break-words');
    expect(titleGroup?.nextElementSibling).toBe(hashtagDisplays[0]?.parentElement);
    expect(hashtagDisplays[0]?.parentElement?.className).toContain('md:hidden');
    expect(hashtagDisplays[0]?.getAttribute('data-badge-class-name')).toContain('break-all');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('hidden');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('md:block');
  });

  it('shows only share actions to unauthenticated visitors', () => {
    render(<AmendmentWikiView {...baseProps()} user={null} />);

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Membership' })).toBeNull();
    expect(screen.queryByTestId('vote-buttons')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'generated.inline.0071_clone_d8cdb573' })
    ).toBeNull();
  });

  it('keeps amendment actions visible to authenticated users', () => {
    render(<AmendmentWikiView {...baseProps()} />);

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Membership' })).toBeTruthy();
    expect(screen.getByTestId('vote-buttons').getAttribute('data-presentation')).toBe('surface');
    expect(
      screen.getByRole('button', { name: 'generated.inline.0071_clone_d8cdb573' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('dispatches wiki participation and clone actions through stable intents', () => {
    const props = baseProps();
    const { container } = render(<AmendmentWikiView {...props} />);

    for (const actionId of [
      'amendments.wiki.toggle.subscription',
      'amendments.wiki.manage.collaboration',
      'amendments.wiki.clone.current',
    ]) {
      fireEvent.click(container.querySelector(`[data-action-id="${actionId}"]`)!);
    }
    expect(props.toggleSubscribe).toHaveBeenCalledOnce();
    expect(props.collaboration.requestCollaboration).toHaveBeenCalledOnce();
    expect(props.handleClone).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-action-id="amendments.wiki.open.share"]')).toBeTruthy();
  });

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

  it('renders not-found and access-denied terminal states', () => {
    const missing = render(<AmendmentWikiView {...baseProps()} amendment={null} />);
    expect(missing.container.textContent).toContain(
      'generated.inline.0066_amendment_not_found_3cea3d4d'
    );
    missing.unmount();
    render(<AmendmentWikiView {...baseProps()} canAccess={false} />);
    expect(screen.getByTestId('access-denied')).toBeTruthy();
  });

  it('renders creation, accepted, and rejected workflow phase variants', () => {
    for (const mode of ['edit', 'passed', 'rejected']) {
      const current = render(
        <AmendmentWikiView
          {...baseProps({
            current_process_run: {
              active_branch_id: 'branch',
              branches: [
                {
                  id: 'branch',
                  editing_mode: mode,
                  status: 'scheduled',
                  resolution: null,
                  created_at: 1,
                  step_runs: [],
                },
              ],
            },
          })}
        />
      );
      expect(timelineMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          activeIndex: mode === 'edit' ? 0 : 1,
          branches: expect.any(Array),
          items: expect.any(Array),
        }),
        undefined
      );
      current.unmount();
    }
  });

  it('renders rich participation, targets, supporters, evaluation, clones, and virtual rows', () => {
    const props = baseProps({
      title: null,
      preamble: null,
      code: 'CODE',
      collaborator_count: null,
      clone_count: null,
      country: 'DE',
      region: 'BE',
      post_code: '10115',
      city: 'Berlin',
      street: 'Street',
      house_number: '1',
      latitude: 1,
      longitude: 2,
      location_kind: 'address',
      location_place_id: 'place',
      location_boundary_source: 'source',
      location_geometry: { type: 'Point' },
      location_bounds: [1, 2],
      youtube: 'https://video.example/embed',
      amendment_hashtags: [
        { hashtag: { tag: 'valid' } },
        { hashtag: null },
        { hashtag: { tag: null } },
      ],
    });
    render(
      <AmendmentWikiView
        {...props}
        virtualizeParticipationDirectory
        targetCollaborator={{ name: null, imageURL: null }}
        targetGroup={{ name: null, image_url: null }}
        clonedFrom={{ id: 'source', title: 'Source amendment', image_url: null }}
        roles={[{ id: 'role-1', name: 'Editor' }, { name: 'invalid' }]}
        collaborators={[
          { id: 'hidden', status: 'hidden', user: { id: 'hidden-user' } },
          { id: 'no-user', status: 'active', user: null },
          {
            id: null,
            status: null,
            role: { id: 'role-direct', name: 'Direct' },
            user: { id: 'user-direct', name: null, handle: 'direct', email: null, avatar: null },
          },
          {
            id: 'fallback-role',
            status: 'active',
            role: null,
            role_id: 'role-1',
            user: { id: 'user-role', name: 'Role user', handle: null, email: 'a@b', avatar: 'a' },
          },
        ]}
        collaboration={{ ...props.collaboration, collaboratorCount: 7 }}
        subscriberCount={2}
        clones={[
          {
            id: 'clone-rich',
            title: 'Rich clone',
            preamble: 'Clone preamble',
            code: 'CLONE',
            created_at: 1,
            current_process_run: {
              branches: [
                {
                  id: 'clone-branch',
                  editing_mode: 'view',
                  status: 'scheduled',
                  created_at: 1,
                  step_runs: [],
                },
              ],
            },
          },
          {
            id: 'clone-sparse',
            title: 'Sparse clone',
            preamble: null,
            code: null,
            created_at: null,
            current_process_run: null,
          },
        ]}
        supporterDirectoryItems={[
          {
            groupId: 'support-1',
            name: null,
            locationLabel: 'Berlin',
            memberCount: 2,
            supportStatus: 'accepted',
          },
          {
            groupId: 'support-2',
            name: 'Support Two',
            locationLabel: 'features.amendments.wiki.locationNotSet',
            memberCount: 3,
            supportStatus: 'pending',
          },
        ]}
        supportingGroupCount={2}
        totalSupportingMembers={5}
        hasImplementationEvaluation
        implementationDisplayStatus="Displayed"
        implementationStatus="implemented"
        evaluationModeLabel="Mode"
        evaluationConfigurationSummary="Config"
        evaluationDueDateLabel={null}
        evaluationVoteOutcomeLabel={null}
        evaluationEvent={{ id: 'event', title: null }}
        evaluationAgendaItem={{ id: 'agenda', title: null }}
      />
    );

    expect(screen.getAllByTestId('supporter-card')).toHaveLength(2);
    expect(screen.getByText('Rich clone')).toBeTruthy();
    expect(screen.getByText('Displayed')).toBeTruthy();
    const directoryProps = (directoryMock.mock.calls.at(-1) as any)?.[0];
    expect(directoryProps.items).toHaveLength(2);
    expect(directoryProps.roles).toHaveLength(1);
    const virtual = directoryProps.virtualSource;
    expect(
      virtual.getPageQuery({ limit: 10, start: null, dir: 'next', settled: true })
    ).toBeTruthy();
    expect(
      virtual.getPageQuery({ limit: 10, start: null, dir: 'next', settled: false })
    ).toBeTruthy();
    expect(virtual.getSingleQuery({ id: 'collaborator', settled: true })).toBeTruthy();
    expect(virtual.getSingleQuery({ id: 'collaborator', settled: false })).toBeTruthy();
    expect(virtual.getRowKey({ id: 'row' })).toBe('row');
    expect(
      virtual.mapRow({
        id: 'virtual-direct',
        user_id: 'fallback-user',
        user: null,
        role: { id: 'role-direct', name: 'Direct' },
        status: null,
      })
    ).toMatchObject({ id: 'virtual-direct', userId: 'fallback-user' });
    expect(
      virtual.mapRow({
        id: 'virtual-fallback',
        user_id: 'user-role',
        user: { id: 'user-role', handle: null, email: null, avatar: null },
        role: null,
        role_id: 'role-1',
        status: 'active',
      }).roles
    ).toHaveLength(1);
  });

  it('renders null collection, share-copy, role, hashtag, and evaluation fallbacks', () => {
    render(
      <AmendmentWikiView
        {...baseProps({
          preamble: null,
          code: null,
          amendment_hashtags: undefined,
        })}
        roles={null}
        collaborators={null}
        hasImplementationEvaluation
        implementationDisplayStatus={null}
        implementationStatus={null}
        evaluationEvent={null}
        evaluationAgendaItem={null}
        virtualizeParticipationDirectory
      />
    );
    const directoryProps = (directoryMock.mock.calls.at(-1) as any)?.[0];
    expect(directoryProps.items).toEqual([]);
    expect(directoryProps.roles).toEqual([]);
    expect(
      directoryProps.virtualSource.mapRow({
        id: 'no-role',
        user_id: 'user',
        user: { id: 'user' },
        role: null,
        role_id: null,
        status: null,
      }).roles
    ).toEqual([]);

    cleanup();
    render(
      <AmendmentWikiView
        {...baseProps()}
        collaborators={[
          {
            id: 'no-role',
            status: 'active',
            role: null,
            role_id: null,
            user: { id: 'user', handle: null, email: null, avatar: null },
          },
        ]}
        hasImplementationEvaluation
        implementationDisplayStatus={null}
        implementationStatus={null}
        evaluationEvent={{ id: 'event', title: 'Event' }}
        evaluationAgendaItem={null}
      />
    );
    expect((directoryMock.mock.calls.at(-1) as any)?.[0].items[0].roles).toEqual([]);
  });
});
