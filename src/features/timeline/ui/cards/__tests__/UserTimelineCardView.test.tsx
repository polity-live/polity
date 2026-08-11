/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  hashtagProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  getEntityGradientClasses: () => 'user-gradient',
  getEntityToneClasses: () => ({ text: 'user-text' }),
  getHashtagToneClasses: () => ({ badge: 'hashtag-badge' }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search: _search, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild, ...props }: any) =>
    asChild ? (
      children
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    ),
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: (props: Record<string, any>) => {
    mocks.hashtagProps = props;
    return <div>Hashtags</div>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ title, badge }: any) => (
    <header>
      {title}
      {badge}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { UserTimelineCardView } from '../UserTimelineCardView';

function props(overrides: Record<string, any> = {}) {
  return {
    user: { id: 'user-1', name: 'Ada Lovelace' },
    onFollow: undefined,
    onMessage: undefined,
    actions: undefined,
    href: undefined,
    className: undefined,
    t: (key: string) => key,
    subscription: {
      subscriberCount: undefined,
      isSubscribed: false,
      isLoading: false,
      toggleSubscribe: vi.fn(),
    },
    amendmentStyle: {},
    location: undefined,
    initials: 'AL',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtagProps = undefined;
});
afterEach(cleanup);

describe('UserTimelineCardView', () => {
  it('renders defaults and dispatches subscription without an optional callback', () => {
    const viewProps = props();
    const { container } = render(<UserTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(
      container.querySelector('[data-action-id="timeline.user.subscription.toggle"]')!
    );
    fireEvent.click(container.querySelector('[data-action-id="timeline.user.message.open"]')!);
    expect(viewProps.subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(mocks.baseProps?.href).toBe('/user/user-1');
    expect(container.textContent).toContain('0');
    expect(mocks.shareProps?.description).toBe('');
    expect(mocks.shareProps?.shareContextItem.tags).toEqual([]);
  });

  it('renders all rich metadata and invokes explicit callbacks', () => {
    const onFollow = vi.fn();
    const onMessage = vi.fn();
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      tag: `tag-${index}`,
    }));
    const viewProps = props({
      user: {
        id: 'user-1',
        name: 'Ada Lovelace',
        handle: 'ada',
        subtitle: 'Mathematician',
        avatarUrl: '/ada.jpg',
        bio: 'Analytical engine',
        groupCount: 2,
        amendmentCount: 4,
        hashtags,
      },
      onFollow,
      onMessage,
      href: '/people/ada',
      className: 'custom',
      location: 'London',
      subscription: {
        subscriberCount: 7,
        isSubscribed: true,
        isLoading: false,
        toggleSubscribe: vi.fn(),
      },
    });
    const { container } = render(<UserTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(
      container.querySelector('[data-action-id="timeline.user.subscription.toggle"]')!
    );
    fireEvent.click(container.querySelector('[data-action-id="timeline.user.message.open"]')!);
    expect(onFollow).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledOnce();
    expect(mocks.baseProps?.href).toBe('/people/ada');
    expect(mocks.hashtagProps?.hashtags).toEqual(hashtags.slice(0, 3));
    expect(container.textContent).toContain('London');
    expect(container.textContent).toContain('Analytical engine');
    expect(mocks.shareProps?.shareContextItem.tags).toEqual(hashtags.map(item => item.tag));
  });

  it('omits zero group and amendment counts', () => {
    const { container } = render(
      <UserTimelineCardView
        {...(props({
          user: { id: 'user-1', name: 'Ada', groupCount: 0, amendmentCount: 0 },
          subscription: {
            subscriberCount: 0,
            isSubscribed: false,
            isLoading: true,
            toggleSubscribe: vi.fn(),
          },
        }) as any)}
      />
    );
    expect(container.textContent).not.toContain('features.timeline.cards.groups');
    expect(container.textContent).not.toContain('features.timeline.contentTypes.amendment');
  });

  it('renders custom actions instead of default controls', () => {
    const { container } = render(
      <UserTimelineCardView
        {...(props({ actions: <button type="button">Custom action</button> }) as any)}
      />
    );
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="timeline.user.subscription.toggle"]')
    ).toBeNull();
  });
});
