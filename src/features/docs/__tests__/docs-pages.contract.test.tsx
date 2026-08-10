/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
const registry = vi.hoisted(() => ({
  getDocsPage: vi.fn(),
  getDocsPages: vi.fn(),
  getDocsNavigation: vi.fn(),
}));
const docsSearch = vi.hoisted(() => ({ searchDocs: vi.fn() }));
const topics = vi.hoisted(() => ({ isDocsTopicSlug: vi.fn() }));
const topicPage = vi.hoisted(() => ({ useDocsTopicPage: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));
vi.mock('@/features/navigation/nav-items/icon-map', () => ({
  getIconComponent: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, values?: { count?: number }, fallback?: string) =>
      fallback ?? (values?.count === undefined ? key : `${key}:${values.count}`),
  }),
}));
vi.mock('@/features/shared/ui/feedback', () => ({ NotFound: () => <p>Not found</p> }));
vi.mock('../logic/docsRegistry', () => registry);
vi.mock('../logic/docsSearch', () => docsSearch);
vi.mock('../logic/docsTopics', () => topics);
vi.mock('../hooks/useDocsPage', () => topicPage);
vi.mock('../ui/DocsArticle', () => ({
  DocsArticle: ({ page }: { page: { title: string } }) => <article>{page.title}</article>,
}));
vi.mock('../ui/DocsSearch', () => ({
  DocsSearchTrigger: ({ 'data-action-id': actionId }: any) => (
    <button type="button" data-action-id={actionId}>
      Open search
    </button>
  ),
  DocsSearchField: ({ onSearch }: { onSearch: (value: string) => void }) => (
    <button type="button" onClick={() => onSearch(' changed ')}>
      Change query
    </button>
  ),
}));
vi.mock('../ui/DocsTopicView', () => ({
  DocsTopicView: (props: { title: string; copy: { perspective: string } }) => (
    <output>{`${props.title}:${props.copy.perspective}`}</output>
  ),
}));
import { DocsContentPage } from '../DocsContentPage';
import { DocsLandingPage } from '../DocsLandingPage';
import { DocsSearchPage } from '../DocsSearchPage';
import { DocsTopicPage } from '../DocsTopicPage';
import { DocsTopicPageContainer } from '../DocsTopicPageContainer';

const page = {
  slug: 'welcome',
  route: '/docs/getting-started/welcome',
  title: 'Welcome',
  description: 'Start here',
  icon: 'BookOpen',
  kind: 'getting-started',
  featured: false,
};
const guide = {
  ...page,
  slug: 'groups',
  route: '/docs/guides/groups',
  title: 'Groups',
  kind: 'guide',
  featured: true,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  registry.getDocsPages.mockReturnValue([page, guide]);
  registry.getDocsNavigation.mockReturnValue([
    { id: 'getting-started', title: 'Start', description: 'Start', pages: [page] },
    { id: 'collaboration', title: 'Collaborate', description: 'Together', pages: [guide] },
  ]);
  docsSearch.searchDocs.mockReturnValue([]);
  topics.isDocsTopicSlug.mockImplementation(value => value === 'groups');
  topicPage.useDocsTopicPage.mockReturnValue({
    topic: { slug: 'groups' },
    baseKey: 'pages.docs.topics.groups',
    title: 'Groups',
    summary: 'Summary',
    audience: 'Everyone',
    entry: 'Create one',
    actions: ['Create'],
    concepts: ['Role'],
    watchFor: ['Rights'],
    states: ['Active'],
    relatedTopics: [{ slug: 'users' }],
  });
});

describe('docs page adapters', () => {
  it('renders a content article and the not-found boundary from registry results', () => {
    registry.getDocsPage.mockReturnValueOnce({ title: 'Article' }).mockReturnValueOnce(undefined);
    const { rerender } = render(<DocsContentPage kind="guide" slug="groups" />);
    expect(screen.getByText('Article')).toBeTruthy();
    expect(registry.getDocsPage).toHaveBeenCalledWith('groups', 'en', 'guide');

    rerender(<DocsContentPage kind="guide" slug="missing" />);
    expect(screen.getByText('Not found')).toBeTruthy();
  });

  it('builds landing sections from localized pages and navigation groups', () => {
    render(<DocsLandingPage />);

    expect(screen.getByRole('heading', { name: 'pages.docs.overview.title' })).toBeTruthy();
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getAllByText('Groups').length).toBeGreaterThan(0);
    expect(registry.getDocsPages).toHaveBeenCalledWith('en');
    expect(registry.getDocsNavigation).toHaveBeenCalledWith('en');
    expect(document.querySelector('[data-action-id="docs.landing.search.open"]')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="docs.landing.getting-started.open"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="docs.landing.featured-guide.open"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="docs.landing.catalog-page.open"]')
    ).toBeTruthy();
  });

  it('renders empty and matching search states and synchronizes trimmed queries', () => {
    const match = {
      page: { ...guide, title: 'Groups guide' },
      section: { id: 'roles', title: 'Roles' },
      route: '/docs/guides/groups#roles',
      excerpt: 'Manage roles',
    };
    docsSearch.searchDocs.mockReturnValue([match]);
    const { unmount } = render(<DocsSearchPage initialQuery="groups" />);
    expect(screen.getByText('Roles')).toBeTruthy();
    expect(screen.getByText('Groups guide')).toBeTruthy();
    expect(screen.getByText('Manage roles')).toBeTruthy();
    expect(document.querySelector('[data-action-id="docs.search-page.result.open"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change query' }));
    expect(navigate).toHaveBeenCalledWith({
      to: '/docs/search',
      search: { q: 'changed' },
      replace: true,
    });

    unmount();
    docsSearch.searchDocs.mockReturnValue([]);
    render(<DocsSearchPage initialQuery="missing" />);
    expect(screen.getByText('pages.docs.hub.noResults')).toBeTruthy();
  });

  it('rejects invalid topic slugs and delegates valid slugs to the container', () => {
    const { rerender } = render(<DocsTopicPage topic="invalid" />);
    expect(screen.getByText('Not found')).toBeTruthy();
    rerender(<DocsTopicPage topic="groups" />);
    expect(screen.getByText('Groups:pages.docs.topics.groups.perspective')).toBeTruthy();
  });

  it('translates and maps a topic controller model into view props', () => {
    render(<DocsTopicPageContainer topic="groups" />);

    expect(topicPage.useDocsTopicPage).toHaveBeenCalledWith('groups');
    expect(screen.getByText('Groups:pages.docs.topics.groups.perspective')).toBeTruthy();
  });
});
