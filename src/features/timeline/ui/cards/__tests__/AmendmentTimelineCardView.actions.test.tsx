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
  getEntityToneClasses: () => ({ text: 'amendment-text' }),
  getHashtagToneClasses: () => ({ badge: 'hashtag-badge' }),
  getMotionPreset: () => 'attention-motion',
  getSemanticToneClasses: (tone: string) => ({ text: `${tone}-text` }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children, variant, className }: any) => (
    <span data-badge-variant={variant} className={className}>
      {children}
    </span>
  ),
  getEditingModeOption: (mode: string) => ({ label: `mode:${mode}` }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, ...props }: any) => (
    <a href={to} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild, ...props }: any) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    ),
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  TimelineCardHeader: ({ children, title, badge }: any) => (
    <header>
      {title}
      {badge}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { AmendmentTimelineCardView } from '../AmendmentTimelineCardView';

const Icon = () => <span>Icon</span>;

function props(overrides: Record<string, any> = {}) {
  return {
    amendment: { id: 'amendment-1', title: 'Draft', status: 'view' },
    onRequestCollaboration: undefined,
    onLeaveCollaboration: undefined,
    onAcceptInvitation: undefined,
    onWithdrawRequest: undefined,
    onToggleSubscription: undefined,
    isCollaborationLoading: false,
    isSubscriptionLoading: false,
    href: undefined,
    className: undefined,
    t: (key: string) => key,
    collaborationOpen: false,
    setCollaborationOpen: vi.fn(),
    collaboration: {
      isLoading: false,
      requestCollaboration: vi.fn(),
      leaveCollaboration: vi.fn(),
      acceptInvitation: vi.fn(),
    },
    subscription: { isLoading: false, isSubscribed: false, toggleSubscribe: vi.fn() },
    amendmentDescription: undefined,
    statusConfig: { variant: 'outline' },
    statusLabel: 'View',
    isVoting: false,
    isCompleted: false,
    isCollaborator: false,
    isInvited: false,
    hasRequested: false,
    getCollaborationLabel: () => 'Collaborate',
    getCollaborationVariant: () => 'default',
    CollaborationIcon: Icon,
    stats: [],
    ...overrides,
  };
}

function action(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing action ${id}`);
  return element;
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtagProps = undefined;
});

afterEach(cleanup);

describe('AmendmentTimelineCardView', () => {
  it('renders empty defaults and dispatches request/subscription hook fallbacks', () => {
    const viewProps = props();
    const { container } = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps?.href).toBe('/amendment/amendment-1');
    expect(container.textContent).toContain('View');
    expect(container.querySelector('[data-testid="progress"]')).toBeNull();
    fireEvent.click(action(container, 'timeline.amendment.collaboration.request'));
    fireEvent.click(action(container, 'timeline.amendment.subscription.toggle'));
    expect(viewProps.collaboration.requestCollaboration).toHaveBeenCalledOnce();
    expect(viewProps.subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(viewProps.setCollaborationOpen).toHaveBeenCalledWith(false);
    expect(mocks.shareProps?.description).toBe('');
    expect(mocks.shareProps?.shareContextItem.tags).toEqual([]);
  });

  it('prefers explicit request/subscription callbacks and renders content metadata', () => {
    const onRequestCollaboration = vi.fn();
    const onToggleSubscription = vi.fn();
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      tag: `tag-${index}`,
    }));
    const viewProps = props({
      amendment: {
        id: 'amendment-1',
        title: 'Draft',
        status: 'view',
        groupId: 'group-1',
        isSubscribed: true,
        hashtags,
      },
      href: '/custom',
      className: 'custom',
      amendmentDescription: 'Description',
      onRequestCollaboration,
      onToggleSubscription,
      isCollaborationLoading: true,
      isSubscriptionLoading: true,
      stats: [{ icon: Icon, value: 3, label: 'collaborators' }],
    });
    const { container } = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps).toMatchObject({ href: '/custom', className: 'custom' });
    expect(mocks.hashtagProps?.hashtags).toEqual(hashtags.slice(0, 3));
    expect(container.textContent).toContain('Description');
    expect(container.textContent).toContain('3 collaborators');
    fireEvent.click(action(container, 'timeline.amendment.collaboration.request'));
    fireEvent.click(action(container, 'timeline.amendment.subscription.toggle'));
    expect(onRequestCollaboration).toHaveBeenCalledOnce();
    expect(onToggleSubscription).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.shareContextItem.tags).toEqual(hashtags.map(tag => tag.tag));
  });

  it('renders every branch chip variant, attention mode, and hidden status tooltip', () => {
    const branchStatuses = [
      { branchId: '1', label: 'One', editingMode: 'vote_internal' },
      { branchId: '2', label: 'Two', editingMode: 'event_final_closing_vote' },
      { branchId: '3', label: 'Three', editingMode: 'rejected' },
      { branchId: '4', label: 'Four', editingMode: 'passed' },
    ];
    let view = render(
      <AmendmentTimelineCardView
        {...(props({ amendment: { ...props().amendment, branchStatuses } }) as any)}
      />
    );
    expect(view.container.querySelectorAll('[data-badge-variant="destructive"]')).toHaveLength(3);
    expect(view.container.textContent).toContain('+1');
    expect(view.container.textContent).toContain('Four: mode:passed');
    cleanup();

    view = render(
      <AmendmentTimelineCardView
        {...(props({
          amendment: {
            ...props().amendment,
            branchStatuses: [
              { branchId: '1', label: 'Passed', editingMode: 'passed' },
              { branchId: '2', label: 'View', editingMode: 'view' },
              { branchId: '3', label: 'Edit', editingMode: 'edit' },
            ],
          },
        }) as any)}
      />
    );
    expect(view.container.querySelector('[data-badge-variant="default"]')).toBeTruthy();
    expect(view.container.querySelector('[data-badge-variant="outline"]')).toBeTruthy();
    expect(view.container.querySelector('[data-badge-variant="secondary"]')).toBeTruthy();
  });

  it.each([
    ['passed', 60],
    ['accepted', 60],
    ['approved', 60],
    ['rejected', 40],
    ['vote_internal', 49],
  ] as const)('renders %s progress and vote counts', (status, supportPercentage) => {
    const { container } = render(
      <AmendmentTimelineCardView
        {...(props({
          amendment: {
            ...props().amendment,
            status,
            supportPercentage,
            supportCount: 5,
            opposeCount: 2,
          },
          isVoting: status === 'vote_internal',
          isCompleted: status !== 'vote_internal',
        }) as any)}
      />
    );
    expect(container.querySelector('[data-testid="progress"]')).toBeTruthy();
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('2');
  });

  it('omits progress without a percentage while still rendering completed vote counts', () => {
    const { container } = render(
      <AmendmentTimelineCardView
        {...(props({
          amendment: { ...props().amendment, supportCount: 0, opposeCount: 0 },
          isCompleted: true,
        }) as any)}
      />
    );
    expect(container.querySelector('[data-testid="progress"]')).toBeNull();
    expect(container.textContent).toContain('0');
  });

  it('handles collaborator leave with explicit and hook callbacks', () => {
    const onLeaveCollaboration = vi.fn();
    let viewProps = props({ isCollaborator: true, onLeaveCollaboration });
    let view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.collaboration.leave'));
    expect(onLeaveCollaboration).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({
      isCollaborator: true,
      collaboration: { ...props().collaboration, isLoading: true },
    });
    view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.collaboration.leave'));
    expect(viewProps.collaboration.leaveCollaboration).toHaveBeenCalledOnce();
  });

  it('handles invitation acceptance and rejection callback priorities', () => {
    const onAcceptInvitation = vi.fn();
    const onLeaveCollaboration = vi.fn();
    let viewProps = props({ isInvited: true, onAcceptInvitation, onLeaveCollaboration });
    let view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.amendment.invitation.reject'));
    expect(onAcceptInvitation).toHaveBeenCalledOnce();
    expect(onLeaveCollaboration).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({ isInvited: true });
    view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.invitation.accept'));
    fireEvent.click(action(view.container, 'timeline.amendment.invitation.reject'));
    expect(viewProps.collaboration.acceptInvitation).toHaveBeenCalledOnce();
    expect(viewProps.collaboration.leaveCollaboration).toHaveBeenCalledOnce();
  });

  it('handles requested withdrawal with explicit and hook callbacks', () => {
    const onWithdrawRequest = vi.fn();
    let viewProps = props({ hasRequested: true, onWithdrawRequest });
    let view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.request.withdraw'));
    expect(onWithdrawRequest).toHaveBeenCalledOnce();
    cleanup();

    viewProps = props({
      hasRequested: true,
      subscription: { ...props().subscription, isLoading: true, isSubscribed: true },
    });
    view = render(<AmendmentTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(action(view.container, 'timeline.amendment.request.withdraw'));
    expect(viewProps.collaboration.leaveCollaboration).toHaveBeenCalledOnce();
  });
});
