/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { UserWikiView } from '../UserWikiView';

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: ({ imageUrl, videoUrl }: { imageUrl?: string; videoUrl?: string }) => (
    <div data-testid="user-wiki-media" data-image={imageUrl} data-video={videoUrl} />
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} {...props} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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

  it('renders a square assistant avatar without duplicating it as wide profile media', () => {
    render(
      <UserWikiView
        page={
          {
            status: 'ready',
            copy: { message: 'Message' },
            user: {
              id: ARIA_KAI_USER_ID,
              avatar: null,
              video_url: 'https://example.test/assistant-profile.mp4',
              visibility: 'public',
              group_memberships: [],
            },
            userId: ARIA_KAI_USER_ID,
            isOwnUser: false,
            isAuthenticated: true,
            fullName: 'Assistent Aria & Kai',
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

    expect(screen.getByRole('img', { name: 'Assistent Aria & Kai' }).getAttribute('src')).toBe(
      ARIA_KAI_AVATAR_URL
    );

    const media = screen.getByTestId('user-wiki-media');
    expect(media.getAttribute('data-image')).toBeNull();
    expect(media.getAttribute('data-video')).toBe('https://example.test/assistant-profile.mp4');
  });
});
