/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tables: [] as Record<string, any>[],
  dataTableProps: undefined as Record<string, any> | undefined,
  virtualProps: undefined as Record<string, any> | undefined,
  statsItems: [] as Record<string, any>[],
  profileProps: undefined as Record<string, any> | undefined,
  avatarSuccess: undefined as ((url: string) => void) | undefined,
  stripeOptions: undefined as Record<string, any> | undefined,
  activeSubscription: null as any,
  isLoading: false,
  user: { id: 'u1' } as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => key,
  getSemanticToneClasses: () => ({ text: 'success' }),
  getEntityGradientClasses: () => 'default-gradient',
  getMotionPreset: () => 'motion',
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, loading: _loading, loadingLabel: _loadingLabel, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/groups/ui/GroupConflictPanel', () => ({
  GroupConflictDialog: () => <div>conflict</div>,
}));
vi.mock('../MembershipStatusTable', () => ({
  MembershipStatusTable: (props: Record<string, any>) => {
    mocks.tables.push(props);
    return <div>{props.statusType}</div>;
  },
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: Record<string, any>) => {
    mocks.dataTableProps = props;
    return <div>data-table</div>;
  },
  VirtualDataTable: (props: Record<string, any>) => {
    mocks.virtualProps = props;
    return <div>virtual-table</div>;
  },
}));
vi.mock('@/features/shared/ui/form', () => ({
  ManagementSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/logic/contactLinkHelpers', () => ({
  buildContactLinkHref: (_kind: string, value?: string) => (value ? `link:${value}` : undefined),
}));
vi.mock('../SocialItem', () => ({
  SocialItem: ({ label, href }: { label: string; href: string }) => <a href={href}>{label}</a>,
}));
vi.mock('../StatsItem', () => ({
  StatsItem: (props: Record<string, any>) => {
    mocks.statsItems.push(props);
    return <div>{props.label}</div>;
  },
}));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatLocation: () => 'formatted-location',
}));
vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ user: mocks.user, isLoading: mocks.isLoading }),
}));
vi.mock('../../hooks/useUserProfileForm', () => ({
  useUserProfileForm: () => ({
    formData: {},
    isSubmitting: false,
    handleSubmit: vi.fn(),
    updateAboutContent: vi.fn(),
    updateField: vi.fn(),
  }),
}));
vi.mock('../../hooks/useAvatarUpload', () => ({
  useAvatarUpload: (options: Record<string, any>) => {
    mocks.avatarSuccess = options.onSuccess;
    return { uploadAvatar: vi.fn() };
  },
}));
vi.mock('@/features/payments/hooks/useSubscriptionManagement', () => ({
  useSubscriptionManagement: () => ({
    activeSubscription: mocks.activeSubscription,
    hasStripeCustomer: false,
    isPlanActive: vi.fn(),
    hasCustomPlan: vi.fn(() => false),
    getActivePlanAmount: vi.fn(() => 0),
    fetchSubscription: vi.fn(),
  }),
}));
vi.mock('@/features/payments/hooks/useStripeCheckout', () => ({
  useStripeCheckout: (options: Record<string, any>) => {
    mocks.stripeOptions = options;
    return {
      isCheckoutLoading: false,
      handleSubscribe: vi.fn(),
      handleCustomAmount: vi.fn(),
      handleCancelSubscription: vi.fn(),
      handleManageBilling: vi.fn(),
    };
  },
}));
vi.mock('../UserProfileEditForm', () => ({
  UserProfileEditForm: (props: Record<string, any>) => {
    mocks.profileProps = props;
    return (
      <div>
        <button onClick={props.onCancel}>cancel-edit</button>
        <button onClick={props.onCancelSubscription}>cancel-subscription</button>
      </div>
    );
  },
}));
vi.mock('../AccountEmailSectionView', () => ({
  AccountEmailSectionView: () => <div>account-email</div>,
}));
vi.mock('../VotingPasswordTabView', () => ({
  VotingPasswordTabView: () => <div>voting-password</div>,
}));
vi.mock('../CurrentPasswordConfirmationDialog', () => ({
  CurrentPasswordConfirmationDialog: () => <div>confirmation-dialog</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>page-skeleton</div>,
  ProfilePageSkeleton: () => <div>profile-loading</div>,
  ErrorState: () => <div>profile-error</div>,
  EmptyState: () => <div>profile-empty</div>,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantUser: (id: string) => id === 'assistant',
  resolveAssistantAvatar: (id: string, avatar: string | null) =>
    id === 'assistant' ? 'assistant-avatar' : avatar,
}));
vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: () => <button>subscribe</button>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button>share</button>,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveActionLabel: ({ full }: { full: string }) => <span>{full}</span>,
  StatsBar: () => <div>wiki-stats</div>,
  compactActionButtonClassName: 'compact',
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  VisibilityBadge: ({ children, ...props }: { children: ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagDisplay: () => <div>hashtags</div> }));
vi.mock('@/features/shared/ui/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: ReactNode }) => children,
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({ InfoTabs: () => <div>info-tabs</div> }));
vi.mock('@/features/shared/ui/wiki', () => ({ EntityWikiMedia: () => <div>wiki-media</div> }));
vi.mock('../UserWikiContentTabs', () => ({ UserWikiContentTabs: () => <div>content-tabs</div> }));
vi.mock('../WikiAvatar', () => ({ WikiAvatar: () => <div>wiki-avatar</div> }));

import { AccountEmailSectionShellView } from '../AccountEmailSectionShellView';
import { BlogRelationsTab } from '../BlogRelationsTab';
import { BlogsCard } from '../BlogsCard';
import { InvitationActionsView } from '../InvitationActionsView';
import { MembershipStatusTableView } from '../MembershipStatusTableView';
import { SocialBar } from '../SocialBar';
import { StatsBar } from '../StatsBar';
import { UserContact } from '../UserContact';
import { UserEdit } from '../UserEdit';
import { UserEditView } from '../UserEditView';
import { UserWikiView } from '../UserWikiView';
import { VotingPasswordTabShellView } from '../VotingPasswordTabShellView';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tables = [];
  mocks.statsItems = [];
  mocks.activeSubscription = null;
  mocks.isLoading = false;
  mocks.user = { id: 'u1' };
});
afterEach(cleanup);

describe('remaining user surfaces A07', () => {
  it('shows confirmation dialogs only when initial passwords are not required', () => {
    const account = render(
      <AccountEmailSectionShellView
        accountEmailProps={{} as never}
        confirmationDialogProps={{} as never}
        requiresInitialPassword
      />
    );
    expect(account.container.textContent).not.toContain('securityConfirmation');
    account.rerender(
      <AccountEmailSectionShellView
        accountEmailProps={{} as never}
        confirmationDialogProps={{} as never}
        requiresInitialPassword={false}
      />
    );
    account.unmount();
    const voting = render(
      <VotingPasswordTabShellView
        votingPasswordProps={{} as never}
        confirmationDialogProps={{} as never}
        requiresInitialPassword
      />
    );
    voting.rerender(
      <VotingPasswordTabShellView
        votingPasswordProps={{} as never}
        confirmationDialogProps={{} as never}
        requiresInitialPassword={false}
      />
    );
  });

  it('resolves all blog relation href present/missing alternatives', () => {
    render(
      <BlogRelationsTab
        blogRelationsByStatus={{ invited: [], active: [], requested: [] } as never}
        onAcceptInvitation={vi.fn()}
        onDeclineInvitation={vi.fn()}
        onLeave={vi.fn()}
        onWithdrawRequest={vi.fn()}
        getBlogHref={id => `/blog/${id}`}
        userId="u1"
        searchQuery=""
      />
    );
    expect(mocks.tables).toHaveLength(3);
    for (const table of mocks.tables) {
      expect(table.getEntityHref({ id: 'b1' })).toBe('/blog/b1');
      expect(table.getEntityHref(null)).toBeNull();
    }
  });

  it('renders linked/plain blog cards with default/custom counters and gradient', () => {
    const blog = { id: 'b1', title: 'Blog', date: 'Today' };
    const view = render(<BlogsCard blog={blog} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.body.textContent).toContain('0');
    view.rerender(
      <BlogsCard
        blog={{ ...blog, supporters: 2, comments: 3 }}
        href="/blog/b1"
        gradientClass="custom"
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/blog/b1');
  });

  it('runs optional invitation actions and blocking conflict alternatives', () => {
    const accept = vi.fn();
    const decline = vi.fn();
    const labels = {
      accept: 'accept',
      decline: 'decline',
      why: 'why',
      checking: 'checking',
      blockedTitle: 'blocked',
    };
    const view = render(
      <InvitationActionsView
        item={{ id: 'i1' }}
        onAccept={accept}
        onDecline={decline}
        blocking={false}
        response={null}
        labels={labels}
      />
    );
    fireEvent.click(screen.getByText('accept'));
    fireEvent.click(screen.getByText('decline'));
    expect(accept).toHaveBeenCalledWith('i1');
    expect(decline).toHaveBeenCalledWith('i1');
    view.rerender(
      <InvitationActionsView item={{ id: 'i1' }} blocking response={{}} labels={labels} />
    );
    expect(screen.getByText('conflict')).toBeTruthy();
    fireEvent.click(screen.getByText('decline'));
  });

  it('covers hidden/active/requested and data/virtual membership tables', () => {
    const base = {
      title: 'title',
      description: 'desc',
      Icon: () => null,
      items: [],
      statusType: 'invited',
      entityKey: 'group',
      FallbackIcon: () => null,
      onAccept: null,
      onDecline: null,
      onLeave: null,
      onWithdraw: null,
      getEntityHref: null,
      getAcceptPreflightInput: null,
      getEntityData: null,
      getEntityName: null,
      getEntityImage: null,
      buildDefaultEntityHref: null,
      columns: [],
      virtualSource: null,
    } as any;
    const view = render(<MembershipStatusTableView {...base} />);
    expect(view.container.firstChild).toBeNull();
    view.rerender(<MembershipStatusTableView {...base} statusType="active" />);
    expect(screen.getByText('data-table')).toBeTruthy();
    expect(mocks.dataTableProps?.getRowId({ id: 'row' })).toBe('row');
    view.rerender(
      <MembershipStatusTableView
        {...base}
        statusType="requested"
        items={[{ id: 'r' }]}
        virtualSource={{}}
      />
    );
    expect(screen.getByText('virtual-table')).toBeTruthy();
    expect(
      document.querySelector('[data-tutorial-anchor]')?.getAttribute('data-tutorial-anchor')
    ).toBe('tutorial-membership-request');
  });

  it('filters empty social links and renders all present links', () => {
    const view = render(<SocialBar socialMedia={{}} />);
    expect(view.container.firstChild).toBeNull();
    view.rerender(
      <SocialBar
        socialMedia={{
          website: 'site',
          youtube: 'yt',
          linkedin: 'li',
          whatsapp: 'wa',
          instagram: 'ig',
          twitter: 'tw',
          facebook: 'fb',
          snapchat: 'sc',
          tiktok: 'tt',
        }}
      />
    );
    expect(screen.getAllByRole('link')).toHaveLength(9);
  });

  it('forwards subscriber and ordinary stat animation variants', () => {
    render(
      <StatsBar
        stats={[
          { label: 'Subscribers', value: 1, unit: 'k' },
          { label: 'Posts', value: 2 },
        ]}
        showAnimation
        animationText="+1"
      />
    );
    expect(mocks.statsItems[0]).toMatchObject({ showAnimation: true, animationText: '+1' });
    expect(mocks.statsItems[1]).toMatchObject({
      showAnimation: false,
      animationText: undefined,
      animationRef: undefined,
    });
  });

  it('prefers explicit contact location and falls back to formatted fields', () => {
    const contact = { email: 'e', twitter: 't', website: 'w' };
    const view = render(<UserContact contact={{ ...contact, location: 'Explicit' }} />);
    expect(screen.getByText('Explicit')).toBeTruthy();
    view.rerender(<UserContact contact={contact} />);
    expect(screen.getByText('formatted-location')).toBeTruthy();
  });

  it('builds pending subscription changes, avatar updates, and refresh callbacks', async () => {
    mocks.activeSubscription = { cancelAtPeriodEnd: true, currentPeriodEnd: 123, id: 's1' };
    const view = render(<UserEdit userId="u1" />);
    expect(mocks.profileProps?.pendingChange).toEqual({ target: 'free', effectiveAt: 123 });
    mocks.avatarSuccess?.('avatar');
    await act(() => mocks.stripeOptions?.onSubscriptionChange());
    view.unmount();
    mocks.activeSubscription = { cancelAtPeriodEnd: false, currentPeriodEnd: null };
    render(<UserEdit userId="u1" activeTab="ai" onTabChange={vi.fn()} />);
    expect(mocks.profileProps?.pendingChange).toBeNull();
  });

  it('renders edit loading and form states with history/cancel guards', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const cancel = vi.fn();
    const base = {
      userId: 'u1',
      activeTab: null,
      onTabChange: null,
      user: {},
      isLoading: true,
      formData: {},
      isSubmitting: false,
      handleSubmit: vi.fn(),
      updateAboutContent: vi.fn(),
      updateField: vi.fn(),
      uploadAvatar: vi.fn(),
      activeSubscription: null,
      pendingChange: null,
      hasStripeCustomer: false,
      subscriptionRefreshKey: 0,
      isPlanActive: vi.fn(),
      hasCustomPlan: vi.fn(() => false),
      getActivePlanAmount: vi.fn(() => 0),
      fetchSubscription: vi.fn(),
      isCheckoutLoading: false,
      handleSubscribe: vi.fn(),
      handleCustomAmount: vi.fn(),
      handleCancelSubscription: cancel,
      handleManageBilling: vi.fn(),
    } as any;
    const view = render(<UserEditView {...base} />);
    expect(screen.getByText('page-skeleton')).toBeTruthy();
    view.rerender(<UserEditView {...base} isLoading={false} />);
    fireEvent.click(screen.getByText('cancel-edit'));
    fireEvent.click(screen.getByText('cancel-subscription'));
    expect(back).toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    view.rerender(<UserEditView {...base} isLoading={false} activeSubscription={{ id: 's1' }} />);
    fireEvent.click(screen.getByText('cancel-subscription'));
    expect(cancel).toHaveBeenCalledWith('s1');
  });

  it('renders every wiki terminal state and ready profile alternatives', () => {
    const states = [
      { status: 'loading', copy: { loading: 'loading' } },
      { status: 'error', copy: { error: 'error' }, error: 'x' },
      { status: 'not-found', copy: { notFoundTitle: 'n', notFoundDescription: 'd' } },
    ];
    const view = render(<UserWikiView page={states[0] as never} />);
    for (const state of states.slice(1)) view.rerender(<UserWikiView page={state as never} />);
    const ready = {
      status: 'ready',
      user: { id: 'u1', avatar: null, video_url: null, email: '', twitter: null, x: null },
      fullName: 'Ada',
      supportTier: { label: 'Tier', description: 'Help' },
      hashtags: [],
      bioText: '',
      subscriberCount: 0,
      groupCount: 0,
      amendmentCount: 0,
      isOwnUser: true,
      isAuthenticated: false,
      userId: 'u1',
      subscribed: false,
      onToggleSubscribe: vi.fn(),
      subscribeLoading: false,
      onMessage: vi.fn(),
      copy: { message: 'message' },
      aboutText: '',
      shareContextItem: null,
      userLocation: '',
      searchTerms: {},
      onSearchChange: vi.fn(),
    } as any;
    view.rerender(<UserWikiView page={ready} />);
    expect(screen.queryByText('wiki-avatar')).toBeNull();
    view.rerender(
      <UserWikiView
        page={{
          ...ready,
          user: { ...ready.user, id: 'assistant', avatar: null },
          hashtags: ['x'],
          bioText: 'Bio',
          isOwnUser: false,
          isAuthenticated: true,
        }}
      />
    );
    expect(screen.getByText('wiki-avatar')).toBeTruthy();
    expect(screen.getByText('subscribe')).toBeTruthy();
    expect(screen.getAllByText('hashtags')).toHaveLength(2);
  });

  it.each([
    ['public', 'public'],
    ['authenticated', 'authenticated'],
    ['private', 'private'],
    [null, 'public'],
    ['unexpected', 'private'],
  ])('normalizes the %s profile visibility to one %s badge', (visibility, expected) => {
    const page = {
      status: 'ready',
      user: { id: 'u1', avatar: null, video_url: null, visibility },
      fullName: 'Ada',
      supportTier: { label: 'Tier', description: 'Help' },
      hashtags: [],
      bioText: '',
      subscriberCount: 0,
      groupCount: 0,
      amendmentCount: 0,
      isOwnUser: true,
      isAuthenticated: false,
      userId: 'u1',
      subscribed: false,
      onToggleSubscribe: vi.fn(),
      subscribeLoading: false,
      onMessage: vi.fn(),
      copy: { message: 'message' },
      aboutText: '',
      shareContextItem: null,
      userLocation: '',
      searchTerms: {},
      onSearchChange: vi.fn(),
    } as any;
    const { container } = render(<UserWikiView page={page} />);

    const badges = container.querySelectorAll('[data-entity-visibility]');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.getAttribute('data-entity-visibility')).toBe(expected);
    expect(badges[0]?.textContent).toBe(`common.visibility.${expected}`);
  });
});
