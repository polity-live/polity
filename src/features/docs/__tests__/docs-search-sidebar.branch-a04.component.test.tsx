/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  matches: [] as any[],
  navigate: vi.fn(),
  onSearch: undefined as undefined | ((value: string) => void),
  pathname: '/docs',
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => state.navigate,
  useRouterState: ({ select }: any) => select({ location: { pathname: state.pathname } }),
}));
vi.mock('@/features/navigation/nav-items/icon-map', () => ({
  getIconComponent: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, _values?: unknown, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('../logic/docsSearch', () => ({ searchDocs: () => state.matches }));
vi.mock('../logic/docsRegistry', () => ({
  getDocsNavigation: () => [
    {
      id: 'systems',
      title: 'Systems',
      description: 'Systems',
      pages: [{ slug: 'groups', title: 'Groups', route: '/docs/groups', icon: 'BookOpen' }],
    },
  ],
}));
vi.mock('../ui/DocsSearch', () => ({
  DocsSearchField: ({ onSearch }: { onSearch: (value: string) => void }) => {
    state.onSearch = onSearch;
    return <div data-testid="search-field" />;
  },
}));

import { DocsSearchPage } from '../DocsSearchPage';
import { DocsSidebar } from '../ui/DocsSidebar';

beforeEach(() => {
  vi.clearAllMocks();
  state.matches = [];
  state.onSearch = undefined;
  state.pathname = '/docs';
});
afterEach(cleanup);

describe('docs search page and sidebar remaining branches', () => {
  it('renders an empty query and removes a blank URL search value', () => {
    render(<DocsSearchPage initialQuery="" />);
    expect(screen.getByTestId('search-field')).toBeTruthy();
    state.onSearch?.('   ');
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/docs/search',
      search: { q: undefined },
      replace: true,
    });
  });

  it('renders a page-level result without section fallbacks', () => {
    state.matches = [
      {
        excerpt: 'Excerpt',
        route: '/docs/groups',
        page: { slug: 'groups', title: 'Groups', description: 'Description', icon: 'BookOpen' },
      },
    ];
    render(<DocsSearchPage initialQuery="groups" />);
    expect(screen.getByRole('link', { name: /Groups/ }).getAttribute('href')).toBe('/docs/groups');
  });

  it('marks the docs home active and a nonmatching page inactive', () => {
    render(<DocsSidebar />);
    expect(screen.getByRole('link', { name: 'pages.docs.hub.overview' }).className).toContain(
      'bg-accent'
    );
    expect(screen.getByRole('link', { name: 'Groups' }).getAttribute('aria-current')).toBeNull();
  });
});
