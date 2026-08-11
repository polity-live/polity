/* @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { FixedAgendaToolbarView } from '@/features/agendas/ui/FixedAgendaToolbarView';
import { ModeSelectorView as AmendmentModeSelectorView } from '@/features/amendments/ui/ModeSelectorView';
import { BlogNotificationsView } from '@/features/blogs/ui/BlogNotificationsView';
import { ModeSelectorView as BlogModeSelectorView } from '@/features/blogs/ui/ModeSelectorView';
import { GroupsPageView } from '@/features/groups/GroupsPageView';
import { GroupBlogsAndStatementsPageView } from '@/features/groups/ui/GroupBlogsAndStatementsPageView';
import { NotificationSettingsPage } from '@/features/notifications/ui/NotificationSettingsPage';
import { PricingPageContainerView } from '@/features/payments/ui/PricingPageContainerView';
import { PWAInstallPromptView } from '@/features/pwa/ui/PWAInstallPromptView';
import { AmendmentSearchCard } from '@/features/search/ui/AmendmentSearchCard';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';

const mocks = vi.hoisted(() => ({
  props: new Map<string, Record<string, unknown>[]>(),
  amendmentController: vi.fn(({ amendment }: { amendment: { id: string } }) => ({
    cardId: `amendment:${amendment.id}`,
  })),
  groupController: vi.fn(({ group }: { group: { id: string } }) => ({
    cardId: `group:${group.id}`,
  })),
  translate: vi.fn((key: string) => `translated:${key}`),
}));

function capture(name: string, props: Record<string, unknown>) {
  const values = mocks.props.get(name) ?? [];
  values.push(props);
  mocks.props.set(name, values);
}

function captured(name: string) {
  return mocks.props.get(name)?.at(-1);
}

vi.mock('@/features/shared/ui/layout', () => ({
  Toolbar: ({ children, ...props }: { children?: ReactNode }) => {
    capture('Toolbar', props);
    return <div data-testid="toolbar">{children}</div>;
  },
  Panel: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  PageHeader: (props: Record<string, unknown>) => {
    capture('PageHeader', props);
    return <header />;
  },
}));

vi.mock('@/features/editor/ui/ModeSelector', () => ({
  ModeSelector: (props: Record<string, unknown>) => {
    capture('ModeSelector', props);
    return <div />;
  },
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children?: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/notifications/ui/EntityNotifications.tsx', () => ({
  EntityNotifications: (props: Record<string, unknown>) => {
    capture('EntityNotifications', props);
    return <div />;
  },
}));

vi.mock('@/features/groups/ui/GroupsHeader', () => ({ GroupsHeader: () => <header /> }));
vi.mock('@/features/groups/ui/GroupsFilters', () => ({
  GroupsFilters: (props: Record<string, unknown>) => {
    capture('GroupsFilters', props);
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/GroupsList', () => ({
  GroupsList: (props: Record<string, unknown>) => {
    capture('GroupsList', props);
    return <div />;
  },
}));

vi.mock('@/features/content/ui/BlogsAndStatementsView', () => ({
  BlogsAndStatementsView: (props: Record<string, unknown>) => {
    capture('BlogsAndStatementsView', props);
    return <div />;
  },
}));

vi.mock('@/features/notifications/ui/NotificationSettingsContent', () => ({
  NotificationSettingsContent: (props: Record<string, unknown>) => {
    capture('NotificationSettingsContent', props);
    return <div />;
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => mocks.translate(key),
}));

vi.mock('@/features/payments/ui/PricingPageView', () => ({
  PricingPageView: (props: Record<string, unknown>) => {
    capture('PricingPageView', props);
    return <div />;
  },
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('lucide-react', () => ({ X: () => <span /> }));

vi.mock('@/features/search/hooks/useAmendmentSearchCardController', () => ({
  useAmendmentSearchCardController: (input: { amendment: { id: string } }) =>
    mocks.amendmentController(input),
}));
vi.mock('@/features/search/ui/AmendmentSearchCardView', () => ({
  AmendmentSearchCardView: (props: Record<string, unknown>) => {
    capture('AmendmentSearchCardView', props);
    return <div />;
  },
}));
vi.mock('@/features/search/hooks/useGroupSearchCardController', () => ({
  useGroupSearchCardController: (input: { group: { id: string } }) => mocks.groupController(input),
}));
vi.mock('@/features/search/ui/GroupSearchCardView', () => ({
  GroupSearchCardView: (props: Record<string, unknown>) => {
    capture('GroupSearchCardView', props);
    return <div />;
  },
}));

describe('small adapter views', () => {
  beforeEach(() => mocks.props.clear());
  afterEach(cleanup);

  it('forwards toolbar props and children', () => {
    render(<FixedAgendaToolbarView className="fixed">Actions</FixedAgendaToolbarView>);
    expect(screen.getByTestId('toolbar').textContent).toBe('Actions');
    expect(captured('Toolbar')).toMatchObject({ className: 'fixed' });
  });

  it.each(['amendment', 'blog'] as const)('adapts editor mode selection for %s', entityType => {
    const onModeChange = vi.fn(async () => undefined);
    if (entityType === 'amendment') {
      render(
        <AmendmentModeSelectorView
          documentId="entity-1"
          currentMode="edit"
          isOwnerOrCollaborator
          onModeChange={onModeChange}
        />
      );
    } else {
      render(
        <BlogModeSelectorView
          blogId="entity-1"
          currentMode="edit"
          isOwnerOrCollaborator
          onModeChange={onModeChange}
        />
      );
    }
    expect(captured('ModeSelector')).toMatchObject({
      entityType,
      entityId: 'entity-1',
      currentMode: 'edit',
      isOwnerOrCollaborator: true,
      onModeChange,
    });
  });

  it('adapts blog notifications', () => {
    render(<BlogNotificationsView blogId="blog-1" entityName="News" />);
    expect(captured('EntityNotifications')).toEqual({
      entityId: 'blog-1',
      entityType: 'blog',
      entityName: 'News',
    });
  });

  it('splits group page state into filters and list props', () => {
    const gp = {
      searchTerm: 'climate',
      setSearchTerm: vi.fn(),
      selectedTags: ['green'],
      setSelectedTags: vi.fn(),
      toggleTag: vi.fn(),
      allTags: ['green'],
      hasActiveFilters: true,
      clearAllFilters: vi.fn(),
      filteredGroups: [{ id: 'group-1' }],
      isLoading: false,
    };
    render(<GroupsPageView gp={gp} />);
    expect(captured('GroupsFilters')).toMatchObject({
      searchTerm: 'climate',
      selectedTags: ['green'],
    });
    expect(captured('GroupsList')).toEqual({ groups: gp.filteredGroups, isLoading: false });
  });

  it('maps group content permissions and callbacks', () => {
    const onDelete = vi.fn();
    const getEditorUrl = vi.fn();
    const props = {
      groupId: 'group-1',
      t: vi.fn(),
      blogs: [],
      statements: [],
      filter: 'all',
      setFilter: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      canCreate: true,
      canManage: true,
      canManageBlogs: true,
      canCreateBlogs: false,
      canCreateStatements: true,
      deleteBlog: vi.fn(),
      handleDeleteBlog: onDelete,
      getEditorUrl,
    } as ComponentProps<typeof GroupBlogsAndStatementsPageView>;
    render(<GroupBlogsAndStatementsPageView {...props} />);
    expect(captured('BlogsAndStatementsView')).toMatchObject({
      groupId: 'group-1',
      canManage: true,
      canCreateBlog: false,
      canCreateStatement: true,
      onDeleteBlog: onDelete,
      getEditorUrl,
    });
  });

  it('builds translated notification settings', () => {
    render(<NotificationSettingsPage userId="user-1" />);
    expect(captured('PageHeader')).toMatchObject({
      title: 'translated:generated.inline.0805_notification_settings_e0a9fb92',
    });
    expect(captured('NotificationSettingsContent')).toEqual({ userId: 'user-1' });
  });

  it('maps all pricing translations and state', () => {
    const t = vi.fn((key: string) => `t:${key}`);
    const setCustomAmount = vi.fn();
    render(
      <PricingPageContainerView
        t={t}
        tArray={vi.fn()}
        customAmount="10"
        setCustomAmount={setCustomAmount}
        tiers={['free']}
      />
    );
    expect(t).toHaveBeenCalledTimes(10);
    expect(captured('PricingPageView')).toMatchObject({
      title: 't:pages.pricing.title',
      tiers: ['free'],
      customAmount: '10',
      onCustomAmountChange: setCustomAmount,
      enterpriseCta: 't:pages.pricing.enterprise.cta',
    });
  });

  it('supports both dismiss controls and installation', () => {
    const onDismiss = vi.fn();
    const onInstall = vi.fn();
    render(
      <PWAInstallPromptView
        installTitle="Install"
        installDescription="Offline"
        dismissLabel="Close"
        notNowLabel="Not now"
        installLabel="Install app"
        onDismiss={onDismiss}
        onInstall={onInstall}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onInstall).toHaveBeenCalledOnce();
    expect(
      document.querySelector('[data-action-id="pwa.install-prompt.dismiss.icon"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="pwa.install-prompt.dismiss.not-now"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-action-id="pwa.install-prompt.install"]')).toBeTruthy();
  });

  it('connects search cards to their controllers and views', () => {
    render(<AmendmentSearchCard amendment={{ id: 'amendment-1' } as never} />);
    render(<GroupSearchCard group={{ id: 'group-1' }} />);
    expect(captured('AmendmentSearchCardView')).toEqual({ cardId: 'amendment:amendment-1' });
    expect(captured('GroupSearchCardView')).toEqual({ cardId: 'group:group-1' });
  });
});
