/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserWikiView } from '../UserWikiView';

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: ({ imageUrl, videoUrl }: { imageUrl?: string; videoUrl?: string }) => (
    <div data-testid="user-wiki-media" data-image={imageUrl} data-video={videoUrl} />
  ),
}));
vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({ InfoTabs: () => null }));
vi.mock('../SocialBar', () => ({ SocialBar: () => null }));
vi.mock('../UserWikiContentTabs', () => ({ UserWikiContentTabs: () => null }));
vi.mock('@/features/shared/ui/action-buttons', () => ({ SubscribeButton: () => null }));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({ ShareButton: () => null }));

afterEach(cleanup);

describe('UserWikiView title media', () => {
  it('passes the user video to the shared wiki media renderer', () => {
    render(
      <UserWikiView
        page={
          {
            status: 'ready',
            copy: { message: 'Message' },
            user: {
              id: 'user-id',
              avatar: null,
              video_url: 'https://example.test/profile.mp4',
              visibility: 'public',
              group_memberships: [],
            },
            userId: 'user-id',
            isOwnUser: true,
            isAuthenticated: true,
            fullName: 'Video User',
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
          } as never
        }
      />
    );

    const media = screen.getByTestId('user-wiki-media');
    expect(media.getAttribute('data-image')).toBeNull();
    expect(media.getAttribute('data-video')).toBe('https://example.test/profile.mp4');
  });
});
