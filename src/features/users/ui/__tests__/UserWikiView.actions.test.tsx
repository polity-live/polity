/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserWikiView } from '../UserWikiView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    typeof paramsOrFallback === 'string' ? paramsOrFallback : key,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: () => <button type="button">subscribe</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-testid="hashtags" data-badge-class-name={badgeClassName} />
  ),
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
}));

vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({
  InfoTabs: () => <div data-testid="info-tabs" />,
}));

vi.mock('../SocialBar', () => ({ SocialBar: () => <div data-testid="social-bar" /> }));
vi.mock('../UserWikiContentTabs', () => ({
  UserWikiContentTabs: () => <div data-testid="content-tabs" />,
}));

afterEach(cleanup);

function renderUserWiki(isAuthenticated: boolean, overrides: Record<string, unknown> = {}) {
  return render(
    <UserWikiView
      page={
        {
          status: 'ready',
          copy: { message: 'message' },
          user: {
            id: 'user-1',
            avatar: null,
            video_url: null,
            visibility: 'public',
            group_memberships: [],
          },
          userId: 'user-1',
          isOwnUser: false,
          isAuthenticated,
          fullName: 'Public User',
          supportTier: { label: 'Free', description: 'Free plan' },
          subscriberCount: 0,
          groupCount: 0,
          amendmentCount: 0,
          subscribed: false,
          subscribeLoading: false,
          hashtags: [],
          shareContextItem: {},
          searchTerms: {},
          onSearchChange: vi.fn(),
          onToggleSubscribe: vi.fn(),
          onMessage: vi.fn(),
          ...overrides,
        } as never
      }
    />
  );
}

describe('UserWikiView actions', () => {
  it('shows only share actions to unauthenticated visitors', () => {
    renderUserWiki(false);

    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'subscribe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'message' })).toBeNull();
  });

  it('keeps profile actions visible to authenticated visitors', () => {
    renderUserWiki(true);

    expect(screen.getByRole('button', { name: 'subscribe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'message' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
  });

  it('stacks the pricing tier and mobile hashtags below a constrained title', () => {
    renderUserWiki(true, {
      fullName: 'A very long public user name',
      supportTier: {
        label: 'A very long development pricing tier',
        description: 'Tier details',
      },
      hashtags: [{ id: 'tag-1', tag: 'a-very-long-hashtag' }],
    });

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'A very long public user name',
    });
    const titleGroup = title.parentElement;
    const pricingTier = title.nextElementSibling;
    const hashtagDisplays = screen.getAllByTestId('hashtags');

    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('break-words');
    expect(titleGroup?.className).toContain('flex-col');
    expect(titleGroup?.className).toContain('md:flex-row');
    expect(pricingTier?.className).toContain('max-w-full');
    expect(titleGroup?.nextElementSibling).toBe(hashtagDisplays[0]?.parentElement);
    expect(hashtagDisplays[0]?.parentElement?.className).toContain('md:hidden');
    expect(hashtagDisplays[0]?.getAttribute('data-badge-class-name')).toContain('break-all');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('hidden');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('md:block');
  });
});
