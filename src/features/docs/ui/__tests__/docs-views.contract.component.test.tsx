/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() => ({
  getDocsNavigation: vi.fn(),
  getRelatedDocsPages: vi.fn(),
  getDocsPages: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    onClick?: () => void;
  }) => (
    <a
      href={params?.topic ? to.replace('$topic', params.topic) : to}
      onClick={event => {
        event.preventDefault();
        onClick?.();
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/docs/groups' } }),
}));
vi.mock('@/features/navigation/nav-items/icon-map', () => ({
  getIconComponent: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, unknown>) =>
      values?.value === undefined ? key : `${key}:${values.value}`,
  }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('../../logic/docsRegistry', () => registry);
vi.mock('../DocsSearch', () => ({
  DocsSearchProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DocsSearchTrigger: ({ 'data-action-id': actionId }: any) => (
    <button type="button" data-action-id={actionId}>
      Search docs
    </button>
  ),
}));

import type { DocsPage, DocsTopicDefinition } from '../../types/docs.types';
import { DocsArticle } from '../DocsArticle';
import { DocsLandingView } from '../DocsLandingView';
import { DocsShell } from '../DocsShell';
import { DocsSidebar } from '../DocsSidebar';
import { DocsTopicCard } from '../DocsTopicCard';
import { DocsTopicView } from '../DocsTopicView';
import { ProcessDiagram } from '../ProcessDiagram';

const groupsTopic: DocsTopicDefinition = {
  slug: 'groups',
  icon: 'Users',
  category: 'collaboration',
  featured: true,
  related: ['users'],
  process: {
    kind: 'timeline',
    steps: [
      { id: 'create', tone: 'entry' },
      { id: 'decide', tone: 'decision' },
    ],
  },
};
const usersTopic: DocsTopicDefinition = {
  ...groupsTopic,
  slug: 'users',
  icon: 'User',
  category: 'people',
  featured: false,
  related: ['groups'],
};

const page = {
  audience: 'Members',
  category: 'collaboration',
  description: 'How groups work',
  featured: true,
  icon: 'Users',
  keywords: ['groups'],
  kind: 'guide',
  order: 1,
  related: ['users'],
  route: '/docs/guides/groups',
  sections: [
    {
      id: 'overview',
      title: 'Overview section',
      markdown:
        '[Internal](/groups) [External](https://example.test) [Unsafe](javascript:alert(1))\n\n| A | B |\n| - | - |\n| 1 | 2 |',
    },
  ],
  slug: 'groups',
  title: 'Groups guide',
  primaryAction: {
    label: 'Create group',
    route: '/create/group',
    requiresAuth: true,
    signedOutLabel: 'Sign in to create',
    signedOutRoute: '/auth/sign-in',
  },
} satisfies DocsPage;

class IntersectionObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  registry.getDocsNavigation.mockReturnValue([
    {
      id: 'collaboration',
      title: 'Collaboration',
      description: 'Work together',
      pages: [{ ...page, route: '/docs/groups' }],
    },
  ]);
  registry.getRelatedDocsPages.mockReturnValue([
    { ...page, slug: 'users', title: 'Users guide', route: '/docs/users' },
  ]);
  registry.getDocsPages.mockReturnValue([
    { ...page, slug: 'welcome', title: 'Welcome', route: '/docs/welcome' },
    page,
    { ...page, slug: 'events', title: 'Events', route: '/docs/events' },
  ]);
});

describe('docs view contracts', () => {
  it('renders landing pathways, categories, and topic cards with stable destinations', () => {
    const { rerender } = render(
      <DocsLandingView
        featuredTopics={[groupsTopic]}
        categorySections={[
          {
            category: 'collaboration',
            title: 'Collaboration',
            description: 'Work together',
            topics: [groupsTopic],
          },
        ]}
        copy={{
          featuredDescription: 'Featured description',
          featuredTitle: 'Featured',
          libraryDescription: 'Library description',
          libraryTitle: 'Library',
          pathways: ['Create', 'Decide'],
          pathwaysTitle: 'Pathways',
          primaryCta: 'Start onboarding',
          secondaryCta: 'Create something',
          subtitle: 'Learn Polity',
          title: 'Documentation',
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Documentation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start onboarding' }).getAttribute('href')).toBe(
      '/docs/auth-and-onboarding'
    );
    expect(screen.getByRole('link', { name: 'Start onboarding' }).dataset.actionId).toBe(
      'docs.landing-view.onboarding.open'
    );
    expect(screen.getByRole('link', { name: 'Create something' }).dataset.actionId).toBe(
      'docs.landing-view.workflows.open'
    );
    expect(screen.getAllByText('pages.docs.topics.groups.title').length).toBe(2);

    rerender(<DocsTopicCard topic={groupsTopic} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/docs/groups');
    expect(screen.getByRole('link').dataset.actionId).toBe('docs.topic-card.open');
    expect(screen.getByText('pages.docs.topics.groups.entry')).toBeTruthy();
  });

  it('renders topic facts, process, lists, related links, and empty lists safely', () => {
    const props = {
      actions: ['Create a group'],
      audience: 'Organizers',
      baseKey: 'pages.docs.topics.groups',
      concepts: ['Roles'],
      copy: {
        actionsLabel: 'Actions',
        audienceLabel: 'Audience',
        conceptsLabel: 'Concepts',
        entryLabel: 'Entry',
        exploreMore: 'Explore',
        libraryDescription: 'More guides',
        navLabel: 'Docs',
        outcome: 'A working group',
        perspective: 'As an organizer',
        quickView: 'Quick view',
        relatedTopicLabels: { users: 'Users' },
        relatedTopics: 'Related',
        statesLabel: 'States',
        userPerspective: 'Perspective',
        watchFor: 'Watch for',
      },
      entry: 'Create',
      relatedTopics: [usersTopic],
      states: ['Active'],
      summary: 'Group summary',
      title: 'Groups',
      topic: groupsTopic,
      watchFor: ['Permissions'],
    };
    const { rerender } = render(<DocsTopicView {...props} />);

    expect(screen.getByRole('heading', { name: 'Groups' })).toBeTruthy();
    expect(screen.getByText('Create a group')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Users' }).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-action-id="docs.topic-view.home.open"]')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="docs.topic-view.watch-for.toggle"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.topic-view.states.toggle"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.topic-view.related.open"]')).toBeTruthy();

    rerender(
      <DocsTopicView
        {...props}
        actions={[]}
        concepts={[]}
        relatedTopics={[]}
        states={[]}
        watchFor={[]}
      />
    );
    expect(screen.getByRole('heading', { name: 'Groups' })).toBeTruthy();
  });

  it('renders both timeline and lane process diagrams with legends', () => {
    const { rerender } = render(
      <ProcessDiagram baseKey="pages.docs.topics.groups" process={groupsTopic.process} />
    );
    expect(screen.getAllByText('pages.docs.topics.groups.diagram.steps.create.title').length).toBe(
      2
    );

    rerender(
      <ProcessDiagram
        baseKey="pages.docs.topics.workflow"
        process={{
          kind: 'lanes',
          lanes: ['proposal', 'decision'],
          steps: [
            { id: 'propose', lane: 'proposal', tone: 'entry' },
            { id: 'accept', lane: 'decision', tone: 'result' },
          ],
        }}
      />
    );
    expect(screen.getByText('pages.docs.topics.workflow.diagram.lanes.proposal')).toBeTruthy();
    expect(screen.getByText('pages.docs.topics.workflow.diagram.lanes.decision')).toBeTruthy();
  });

  it('marks sidebar routes active and opens and closes shell mobile navigation', async () => {
    const onNavigate = vi.fn();
    const { unmount } = render(<DocsSidebar onNavigate={onNavigate} />);
    const active = screen.getByRole('link', { name: 'Groups guide' });
    expect(active.dataset.actionId).toBe('docs.sidebar.page.open');
    expect(document.querySelector('[data-action-id="docs.sidebar.home.open"]')).toBeTruthy();
    expect(active.getAttribute('aria-current')).toBe('page');
    fireEvent.click(active);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    unmount();

    render(
      <DocsShell>
        <p>Article body</p>
      </DocsShell>
    );
    const mobileNavigation = screen.getByRole('button', { name: 'pages.docs.hub.openNavigation' });
    expect(mobileNavigation.dataset.actionId).toBe('docs.shell.mobile-navigation.open');
    expect(document.querySelectorAll('[data-action-id="docs.shell.home.open"]')).toHaveLength(2);
    expect(document.querySelector('[data-action-id="docs.shell.search.open"]')).toBeTruthy();
    fireEvent.click(mobileNavigation);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Article body')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: 'Groups guide' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('renders safe markdown, auth-aware actions, relations, pagination, and contents', () => {
    const { rerender } = render(<DocsArticle page={page} />);

    expect(screen.getByRole('heading', { name: 'Groups guide' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sign in to create/ }).getAttribute('href')).toBe(
      '/auth/sign-in'
    );
    expect(screen.getByRole('link', { name: /Sign in to create/ }).dataset.actionId).toBe(
      'docs.article.primary-action.open'
    );
    expect(screen.getByRole('link', { name: 'External' }).getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Unsafe').closest('a')?.getAttribute('href')).toBe('');
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Users guide')).toBeTruthy();
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.home.open"]')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="docs.article.markdown-link.open"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.toc.jump"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.section.jump"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.related.open"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.previous.open"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.article.next.open"]')).toBeTruthy();

    auth.user = { id: 'ada' };
    rerender(<DocsArticle page={page} />);
    expect(screen.getByRole('link', { name: /Create group/ }).getAttribute('href')).toBe(
      '/create/group'
    );

    registry.getDocsPages.mockReturnValue([{ ...page, primaryAction: undefined }]);
    registry.getRelatedDocsPages.mockReturnValue([]);
    rerender(<DocsArticle page={{ ...page, primaryAction: undefined }} />);
    expect(
      document.querySelector('[data-action-id="docs.article.primary-action.open"]')
    ).toBeNull();
    expect(document.querySelector('[data-action-id="docs.article.previous.open"]')).toBeNull();
    expect(document.querySelector('[data-action-id="docs.article.next.open"]')).toBeNull();
  });
});
