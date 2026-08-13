/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  hashtagProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: () => ({ text: 'group-text' }),
  getHashtagToneClasses: () => ({ badge: 'hashtag-badge' }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: (props: Record<string, any>) => {
    mocks.hashtagProps = props;
    return <div>Hashtags</div>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ title, badge }: any) => (
    <header>
      {title}
      {badge}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { GroupTimelineCardView } from '../GroupTimelineCardView';

const Icon = () => <span>Icon</span>;

function props(overrides: Record<string, any> = {}) {
  return {
    group: { id: 'group-1', name: 'Civic Group' },
    onRequestMembership: undefined,
    onLeave: undefined,
    onAcceptInvitation: undefined,
    onWithdrawRequest: undefined,
    onToggleSubscription: undefined,
    isMembershipLoading: false,
    isSubscriptionLoading: false,
    href: undefined,
    className: undefined,
    t: (key: string) => key,
    membershipOpen: false,
    setMembershipOpen: vi.fn(),
    membership: {
      isLoading: false,
      isMember: false,
      canRequestJoin: true,
      requestJoinDisabledReason: undefined,
      requestJoin: vi.fn(),
      leaveGroup: vi.fn(),
      acceptInvitation: vi.fn(),
    },
    subscription: { isLoading: false, isSubscribed: false, toggleSubscribe: vi.fn() },
    groupHashtags: undefined,
    groupDescription: undefined,
    isMember: false,
    isInvited: false,
    hasRequested: false,
    requestMembershipDisabled: false,
    getMembershipLabel: () => 'Join',
    getMembershipVariant: () => 'default',
    MembershipIcon: Icon,
    stats: [],
    ...overrides,
  };
}

function action(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtagProps = undefined;
});
afterEach(cleanup);

describe('GroupTimelineCardView', () => {
  it('renders defaults and dispatches request/subscription hook fallbacks', () => {
    const viewProps = props();
    const { container } = render(<GroupTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps?.href).toBe('/group/group-1');
    fireEvent.click(action(container, 'timeline.group.membership.request'));
    fireEvent.click(action(container, 'timeline.group.subscription.toggle'));
    expect(viewProps.membership.requestJoin).toHaveBeenCalledOnce();
    expect(viewProps.subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.description).toBe('');
    expect(mocks.shareProps?.shareContextItem.tags).toEqual([]);
  });

  it('renders rich metadata and prefers explicit request/subscription callbacks', () => {
    const onRequestMembership = vi.fn();
    const onToggleSubscription = vi.fn();
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      tag: `tag-${index}`,
    }));
    const viewProps = props({
      group: {
        id: 'group-1',
        name: 'Civic Group',
        isSubscribed: true,
        memberCount: 9,
        eventCount: 2,
        amendmentCount: 3,
      },
      href: '/custom',
      className: 'custom',
      onRequestMembership,
      onToggleSubscription,
      isMembershipLoading: true,
      isSubscriptionLoading: true,
      groupDescription: 'Description',
      groupHashtags: hashtags,
      stats: [{ icon: Icon, value: 9, label: 'members' }],
    });
    const { container } = render(<GroupTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps).toMatchObject({ href: '/custom', className: 'custom' });
    expect(container.textContent).toContain('Description');
    expect(container.textContent).toContain('9 members');
    expect(mocks.hashtagProps?.hashtags).toEqual(hashtags.slice(0, 3));
    fireEvent.click(action(container, 'timeline.group.membership.request'));
    fireEvent.click(action(container, 'timeline.group.subscription.toggle'));
    expect(onRequestMembership).toHaveBeenCalledOnce();
    expect(onToggleSubscription).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.shareContextItem.tags).toEqual(hashtags.map(tag => tag.tag));
  });

  it('exposes disabled request reasons only outside loading state', () => {
    let view = render(
      <GroupTimelineCardView
        {...(props({
          requestMembershipDisabled: true,
          membership: { ...props().membership, requestJoinDisabledReason: 'Private group' },
        }) as any)}
      />
    );
    expect(
      action(view.container, 'timeline.group.membership.menu.open').hasAttribute('disabled')
    ).toBe(true);
    expect(
      action(view.container, 'timeline.group.membership.menu.open').getAttribute('title')
    ).toBe('Private group');
    cleanup();

    view = render(
      <GroupTimelineCardView
        {...(props({
          requestMembershipDisabled: true,
          isMembershipLoading: true,
          membership: { ...props().membership, requestJoinDisabledReason: 'Private group' },
        }) as any)}
      />
    );
    expect(
      action(view.container, 'timeline.group.membership.menu.open').hasAttribute('disabled')
    ).toBe(false);
  });

  it('handles member leave with explicit and hook callbacks', () => {
    const onLeave = vi.fn();
    let viewProps = props({ isMember: true, onLeave });
    let view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.membership.leave'));
    expect(onLeave).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({ isMember: true, membership: { ...props().membership, isLoading: true } });
    view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.membership.leave'));
    expect(viewProps.membership.leaveGroup).toHaveBeenCalledOnce();
  });

  it('handles invitation accept/reject callback priorities', () => {
    const onAcceptInvitation = vi.fn();
    const onLeave = vi.fn();
    let viewProps = props({ isInvited: true, onAcceptInvitation, onLeave });
    let view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.group.invitation.reject'));
    expect(onAcceptInvitation).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({ isInvited: true });
    view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.group.invitation.reject'));
    expect(viewProps.membership.acceptInvitation).toHaveBeenCalledOnce();
    expect(viewProps.membership.leaveGroup).toHaveBeenCalledOnce();
  });

  it('handles requested withdrawal with explicit and hook callbacks', () => {
    const onWithdrawRequest = vi.fn();
    let viewProps = props({ hasRequested: true, onWithdrawRequest });
    let view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.request.withdraw'));
    expect(onWithdrawRequest).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({
      hasRequested: true,
      subscription: { ...props().subscription, isLoading: true, isSubscribed: true },
    });
    view = render(<GroupTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.group.request.withdraw'));
    expect(viewProps.membership.leaveGroup).toHaveBeenCalledOnce();
  });
});
