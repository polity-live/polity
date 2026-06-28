/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { Users } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={typeof to === 'string' ? to : ''} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({ children, containerClassName, contentClassName }: any) => (
    <div className={containerClassName}>
      <div className={contentClassName}>{children}</div>
    </div>
  ),
}));

vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href ?? ''} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

import { AmendmentTimelineCardView } from '../AmendmentTimelineCardView';
import { BlogTimelineCardView } from '../BlogTimelineCardView';
import { GroupTimelineCardView } from '../GroupTimelineCardView';

afterEach(cleanup);

const t = (key: string) =>
  (
    ({
      'common.checks.subscription': 'Checking subscription...',
      'features.timeline.contentTypes.amendment': 'Amendment',
      'features.timeline.contentTypes.blog': 'Blog',
      'features.timeline.contentTypes.group': 'Group',
      'features.timeline.cards.discuss': 'Discuss',
      'features.timeline.cards.by': 'by',
    }) as Record<string, string>
  )[key] ?? key;

describe('timeline card loading feedback', () => {
  it('shows loading feedback for group membership checks', () => {
    const { container } = render(
      <GroupTimelineCardView
        group={{ id: 'group-1', name: 'Working Group' }}
        onRequestMembership={undefined}
        onLeave={undefined}
        onAcceptInvitation={undefined}
        onWithdrawRequest={undefined}
        onToggleSubscription={undefined}
        isMembershipLoading
        isSubscriptionLoading={false}
        href={undefined}
        className=""
        t={t}
        membershipOpen={false}
        setMembershipOpen={vi.fn()}
        membership={{ isLoading: false, isMember: false, isInvited: false, hasRequested: false }}
        subscription={{ isLoading: false, isSubscribed: false }}
        groupHashtags={[]}
        groupDescription=""
        isMember={false}
        isInvited={false}
        hasRequested={false}
        requestMembershipDisabled={false}
        getMembershipLabel={() => 'Join'}
        getMembershipVariant={() => 'default'}
        MembershipIcon={Users}
        stats={[]}
      />
    );

    const loadingButton = container.querySelector('[data-loading="true"]');

    expect(loadingButton).not.toBeNull();
    expect(loadingButton?.textContent).toContain('Join');
  });

  it('shows loading feedback for amendment collaboration checks', () => {
    const { container } = render(
      <AmendmentTimelineCardView
        amendment={{ id: 'amendment-1', title: 'Amend rules', status: 'pending' }}
        onRequestCollaboration={undefined}
        onLeaveCollaboration={undefined}
        onAcceptInvitation={undefined}
        onWithdrawRequest={undefined}
        onToggleSubscription={undefined}
        isCollaborationLoading
        isSubscriptionLoading={false}
        href={undefined}
        className=""
        t={t}
        collaborationOpen={false}
        setCollaborationOpen={vi.fn()}
        collaboration={{ isLoading: false, isCollaborator: false, isInvited: false }}
        subscription={{ isLoading: false, isSubscribed: false }}
        amendmentDescription=""
        statusConfig={{ variant: 'outline' }}
        statusLabel="Pending"
        isVoting={false}
        isCompleted={false}
        isCollaborator={false}
        isInvited={false}
        hasRequested={false}
        getCollaborationLabel={() => 'Collaborate'}
        getCollaborationVariant={() => 'default'}
        CollaborationIcon={Users}
        stats={[]}
      />
    );

    const loadingButton = container.querySelector('[data-loading="true"]');

    expect(loadingButton).not.toBeNull();
    expect(loadingButton?.textContent).toContain('Collaborate');
  });

  it('shows loading feedback for subscription checks', () => {
    const { container } = render(
      <BlogTimelineCardView
        blog={{ id: 'blog-1', title: 'Update', authorName: 'Ada' }}
        className=""
        t={t}
        gradient={null}
        subscription={{ isLoading: true, isSubscribed: false, toggleSubscribe: vi.fn() }}
        blogUrl="/blog/blog-1"
        stats={[]}
      />
    );

    const loadingButton = container.querySelector('[data-loading="true"]');

    expect(loadingButton).not.toBeNull();
    expect(loadingButton?.textContent).toContain('Checking subscription...');
  });
});
