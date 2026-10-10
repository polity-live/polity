import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { UserWikiContentTabs } from '../UserWikiContentTabs';
import '@/styles.css';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@rocicorp/zero/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@rocicorp/zero/react')>()),
  useQuery: () => [[], { type: 'complete' }],
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { byOwner: (args: unknown) => args } } }));
vi.mock('@/features/shared/ui/collections/CollectionToolbar', () => ({
  CollectionToolbar: () => <span>Collection controls</span>,
}));
vi.mock('@/features/shared/ui/navigation', async () => ({
  ScrollableTabsList: (await import('@/features/shared/ui/navigation/ScrollableTabs'))
    .ScrollableTabsList,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: () => <span>Search controls</span>,
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: () => <p>All profile content</p>,
}));
vi.mock('@/features/search/ui/SearchResultCard', () => ({ SearchResultCard: () => null }));
vi.mock('@/features/search/ui/CompactSearchRow', () => ({ CompactSearchRow: () => null }));
vi.mock('@/features/statements/ui/StatementStoryCarousel', () => ({
  StatementStoryCarousel: () => null,
}));
vi.mock('../BlogListTab', () => ({ BlogListTab: () => <p>Profile blogs</p> }));
vi.mock('../GroupListTab', () => ({ GroupsListTab: () => <p>Profile groups</p> }));
vi.mock('../AmendmentListTab', () => ({ AmendmentListTab: () => <p>Profile amendments</p> }));
vi.mock('../StatementListTab', () => ({ StatementListTab: () => <p>Profile statements</p> }));

it('selects and leaves the Studio profile tab with native keyboard navigation and retained focus', async () => {
  render(
    <UserWikiContentTabs
      user={{ id: 'profile-owner' } as any}
      authorName="Profile owner"
      authorAvatar=""
      searchTerms={{ all: '', blogs: '', groups: '', amendments: '', statements: '' }}
      handleSearchChange={vi.fn()}
    />
  );
  const all = screen.getByRole('tab', { name: 'pages.user.all.title' });
  const studio = screen.getByRole('tab', { name: 'features.studio.projects' });
  expect(studio.getAttribute('data-action-id')).toBe('users.content-tab.studio');
  expect(all.getAttribute('aria-selected')).toBe('true');
  expect(studio.getAttribute('aria-selected')).toBe('false');
  all.focus();
  await userEvent.keyboard('{End}');
  await waitFor(() => expect(studio.getAttribute('aria-selected')).toBe('true'));
  expect(document.activeElement).toBe(studio);
  expect(screen.getByRole('tabpanel').textContent).toBe('features.studio.empty');
  await userEvent.keyboard('{Home}');
  await waitFor(() => expect(all.getAttribute('aria-selected')).toBe('true'));
  expect(studio.getAttribute('aria-selected')).toBe('false');
  expect(document.activeElement).toBe(all);
  expect(screen.getByRole('tabpanel').textContent).toContain('All profile content');
});
