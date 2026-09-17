import { describe, expect, it } from 'vitest';
import {
  changeWorkspaceFavorite,
  readWorkspacePreferences,
  workspaceFavoriteSchema,
} from '../workspace-schema';

describe('personal workspace preferences', () => {
  it('keeps display choices and other favorites when adding, renaming or removing a favorite', () => {
    const group = { kind: 'group' as const, href: '/group/one', title: 'Local group' };
    const view = {
      kind: 'view' as const,
      href: '/search?types=amendment&view=compact',
      title: 'My amendments',
    };
    const initial = { favorites: [group], display: { timelineMapVisible: true } };
    const added = changeWorkspaceFavorite(initial, view, true);
    expect(added.favorites).toEqual([group, view]);
    expect(added.display).toEqual(initial.display);
    const renamed = changeWorkspaceFavorite(added, { ...view, title: 'Saved view' }, true);
    expect(renamed.favorites).toHaveLength(2);
    expect(changeWorkspaceFavorite(renamed, view, false).favorites).toEqual([group]);
    expect(initial.favorites).toEqual([group]);
  });

  it.each([
    'https://example.com',
    '//example.com',
    '/auth/sign-in',
    '/group/one?redirect=evil',
    '/search#preview=event:one',
  ])('rejects unsupported destinations: %s', href => {
    expect(workspaceFavoriteSchema.safeParse({ kind: 'view', title: 'Saved', href }).success).toBe(
      false
    );
  });

  it('rejects mismatched entities and falls back for legacy preferences', () => {
    expect(
      workspaceFavoriteSchema.safeParse({ kind: 'event', href: '/group/one', title: 'Wrong type' })
        .success
    ).toBe(false);
    expect(readWorkspacePreferences(undefined)).toEqual({ favorites: [], display: {} });
    expect(
      readWorkspacePreferences({ display: { searchView: 'compact' } }).display.searchView
    ).toBe('compact');
  });
});
