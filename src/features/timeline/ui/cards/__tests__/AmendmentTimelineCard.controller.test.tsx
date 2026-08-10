/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collaboration: {} as Record<string, unknown>,
  subscription: {} as Record<string, unknown>,
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) =>
      typeof values === 'string'
        ? `${key}:${values}`
        : values
          ? `${key}:${JSON.stringify(values)}`
          : key,
  }),
}));

vi.mock('@/features/amendments/hooks/useAmendmentCollaboration', () => ({
  useAmendmentCollaboration: () => mocks.collaboration,
}));

vi.mock('@/features/amendments/hooks/useSubscribeAmendment', () => ({
  useSubscribeAmendment: () => mocks.subscription,
}));

vi.mock('../AmendmentTimelineCardView', () => ({
  AmendmentTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div data-testid="amendment-view" />;
  },
}));

import { AmendmentTimelineCard, type AmendmentTimelineCardProps } from '../AmendmentTimelineCard';

const baseAmendment: AmendmentTimelineCardProps['amendment'] = {
  id: 'amendment-1',
  title: 'Transparent Budget',
  status: 'view',
};

function renderCard(amendment: Partial<AmendmentTimelineCardProps['amendment']> = {}, props = {}) {
  render(<AmendmentTimelineCard amendment={{ ...baseAmendment, ...amendment }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  mocks.collaboration = {
    status: null,
    isCollaborator: false,
    isInvited: false,
    hasRequested: false,
    collaboratorCount: undefined,
  };
  mocks.subscription = { isSubscribed: false };
  mocks.viewProps = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AmendmentTimelineCard controller', () => {
  it('derives the default view state and empty stats', () => {
    const props = renderCard();

    expect(props.amendmentDescription).toBeUndefined();
    expect(props.statusConfig).toEqual({ variant: 'outline' });
    expect(props.statusLabel).toBeTruthy();
    expect(props.isVoting).toBe(false);
    expect(props.isCompleted).toBe(false);
    expect(props.isCollaborator).toBe(false);
    expect(props.isInvited).toBe(false);
    expect(props.hasRequested).toBe(false);
    expect(props.getCollaborationLabel()).toBe('features.timeline.cards.amendment.collaborate');
    expect(props.getCollaborationVariant()).toBe('default');
    expect(props.CollaborationIcon.displayName ?? props.CollaborationIcon.name).toMatch(/UserPlus/);
    expect(props.stats).toEqual([]);
  });

  it.each([
    ['accepted', 'features.groups.common.status.accepted:Accepted'],
    ['approved', 'features.groups.common.status.approved:Approved'],
    ['pending', 'features.groups.common.status.pending:Pending'],
    ['withdrawn', 'features.groups.common.status.withdrawn:Withdrawn'],
  ] as const)('translates the %s legacy status', (status, label) => {
    expect(renderCard({ status }).statusLabel).toBe(label);
  });

  it('uses editing-mode labels and safely falls back for unknown runtime statuses', () => {
    expect(renderCard({ status: 'edit' }).statusLabel).toBeTruthy();

    cleanup();
    const props = renderCard({ status: 'runtime-unknown' as any });
    expect(props.statusConfig).toEqual({ variant: 'outline' });
    expect(props.statusLabel).toBe('runtime-unknown');
  });

  it.each(['vote_internal', 'event_final_closing_vote'] as const)('marks %s as voting', status => {
    expect(renderCard({ status }).isVoting).toBe(true);
  });

  it.each(['passed', 'accepted', 'approved', 'rejected', 'withdrawn'] as const)(
    'marks %s as completed',
    status => {
      expect(renderCard({ status }).isCompleted).toBe(true);
    }
  );

  it.each([
    ['member', 'collaborator', 'secondary', 'UserMinus'],
    ['admin', 'collaborator', 'secondary', 'UserMinus'],
    ['invited', 'invited', 'default', 'Check'],
    ['requested', 'pending', 'outline', 'Clock'],
  ] as const)(
    'maps %s collaboration to its action presentation',
    (status, label, variant, icon) => {
      const props = renderCard({ collaborationStatus: status });

      expect(props.getCollaborationLabel()).toBe(`features.timeline.cards.amendment.${label}`);
      expect(props.getCollaborationVariant()).toBe(variant);
      expect(props.CollaborationIcon.displayName ?? props.CollaborationIcon.name).toMatch(
        new RegExp(icon, 'i')
      );
    }
  );

  it('falls back independently to hook collaboration flags', () => {
    mocks.collaboration = { ...mocks.collaboration, status: 'hook', isCollaborator: true };
    let props = renderCard();
    expect(props.isCollaborator).toBe(true);

    cleanup();
    mocks.collaboration = { ...mocks.collaboration, isCollaborator: false, isInvited: true };
    props = renderCard();
    expect(props.isInvited).toBe(true);

    cleanup();
    mocks.collaboration = { ...mocks.collaboration, isInvited: false, hasRequested: true };
    props = renderCard();
    expect(props.hasRequested).toBe(true);
  });

  it('prefers an explicit collaborator count and builds every positive stat', () => {
    const props = renderCard({
      description: '  Public draft  ',
      collaboratorCount: 8,
      supportingGroupsCount: 2,
      changeRequestCount: 3,
    });

    expect(props.amendmentDescription).toBe('Public draft');
    expect(props.stats.map((stat: any) => stat.value)).toEqual([8, 2, 3]);
    expect(props.stats.map((stat: any) => stat.label)).toEqual([
      'features.timeline.cards.amendment.collaborators:{"count":8}',
      'features.timeline.cards.amendment.supportingGroups:{"count":2}',
      'features.timeline.cards.amendment.changeRequests:{"count":3}',
    ]);
  });

  it('uses the hook collaborator count and omits absent or non-positive stats', () => {
    mocks.collaboration = { ...mocks.collaboration, collaboratorCount: 5 };
    let props = renderCard({
      collaboratorCount: 0,
      supportingGroupsCount: 0,
      changeRequestCount: 0,
    });
    expect(props.stats.map((stat: any) => stat.value)).toEqual([5]);

    cleanup();
    mocks.collaboration = { ...mocks.collaboration, collaboratorCount: undefined };
    props = renderCard();
    expect(props.stats).toEqual([]);
  });

  it('forwards callbacks, overrides, loading state, and class names', () => {
    const callback = vi.fn();
    const props = renderCard(
      {},
      {
        href: '/amendments/custom',
        className: 'custom',
        onRequestCollaboration: callback,
        onLeaveCollaboration: callback,
        onAcceptInvitation: callback,
        onWithdrawRequest: callback,
        onToggleSubscription: callback,
        isCollaborationLoading: true,
        isSubscriptionLoading: true,
      }
    );

    expect(props).toMatchObject({
      href: '/amendments/custom',
      className: 'custom',
      onRequestCollaboration: callback,
      onLeaveCollaboration: callback,
      onAcceptInvitation: callback,
      onWithdrawRequest: callback,
      onToggleSubscription: callback,
      isCollaborationLoading: true,
      isSubscriptionLoading: true,
    });
  });
});
