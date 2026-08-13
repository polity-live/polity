/* @vitest-environment jsdom */

import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerSearch = vi.hoisted(() => ({
  value: {} as Record<string, string>,
}));
const wikiPage = vi.hoisted(() => ({
  useUserWikiPage: vi.fn(() => ({ status: 'ready', userId: 'ada' })),
}));

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => routerSearch.value,
}));
vi.mock('../../hooks/useUserWikiPage', () => wikiPage);
vi.mock('../../ui/UserWikiView', () => ({
  UserWikiView: ({ page }: { page: { userId: string } }) => <output>{page.userId}</output>,
}));

import { BADGE_COLORS } from '../badgeColors';
import { GRADIENTS } from '../gradientColors';
import { useUserWikiContentSearch } from '../useUserWikiContentSearch';
import { UserWiki } from '../../wiki';

afterEach(cleanup);

beforeEach(() => {
  routerSearch.value = {};
  wikiPage.useUserWikiPage.mockClear();
  window.history.replaceState({}, '', '/people/ada#activity');
});

describe('user state contracts', () => {
  it('publishes the complete semantic badge and gradient palettes', () => {
    expect(BADGE_COLORS).toHaveLength(7);
    expect(BADGE_COLORS.every(color => color.bg && color.text)).toBe(true);
    expect(new Set(BADGE_COLORS.map(color => `${color.bg}:${color.text}`)).size).toBeGreaterThan(4);

    expect(GRADIENTS).toHaveLength(15);
    expect(GRADIENTS.every(gradient => typeof gradient === 'string' && gradient.length > 0)).toBe(
      true
    );
    expect(new Set(GRADIENTS).size).toBeGreaterThan(8);
  });

  it('hydrates per-tab terms and synchronizes additions and removals to the URL', () => {
    routerSearch.value = { all: 'democracy', groups: 'Berlin', keep: '1' };
    const { result } = renderHook(() => useUserWikiContentSearch());

    expect(result.current.searchTerms).toEqual({
      all: 'democracy',
      blogs: '',
      groups: 'Berlin',
      amendments: '',
      statements: '',
    });

    act(() => result.current.handleSearchChange('blogs', 'energy'));
    expect(result.current.searchTerms.blogs).toBe('energy');
    expect(window.location.href).toContain('?all=democracy&groups=Berlin&keep=1&blogs=energy');
    expect(window.location.hash).toBe('#activity');

    routerSearch.value = { all: 'democracy', groups: 'Berlin', keep: '1', blogs: 'energy' };
    act(() => result.current.handleSearchChange('groups', ''));
    expect(result.current.searchTerms.groups).toBe('');
    expect(window.location.search).not.toContain('groups=');
  });

  it('connects the user wiki page controller to its view', () => {
    render(<UserWiki userId="ada" searchFilters={{ blogs: 'energy' }} />);

    expect(wikiPage.useUserWikiPage).toHaveBeenCalledWith({
      userId: 'ada',
      searchFilters: { blogs: 'energy' },
    });
    expect(screen.getByText('ada')).toBeTruthy();
  });
});
