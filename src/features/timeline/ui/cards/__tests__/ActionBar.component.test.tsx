/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (name: string) => name }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { ActionBar, ActionBarCompact } from '../ActionBar';

function action(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

afterEach(cleanup);

describe('ActionBar', () => {
  it('renders default inactive actions and tolerates absent reaction callbacks', () => {
    const { container } = render(<ActionBar entityId="event-1" entityType="event" />);
    fireEvent.click(action(container, 'timeline.action-bar.reaction.support'));
    fireEvent.click(action(container, 'timeline.action-bar.reaction.oppose'));
    expect(container.textContent).toContain('features.timeline.cards.follow');
    expect(container.textContent).toContain('generated.inline.0118_follow_66587a7a');
    expect(
      action(container, 'timeline.action-bar.bookmark.toggle').getAttribute('aria-label')
    ).toBe('features.timeline.cards.bookmark');
    expect(
      action(container, 'timeline.action-bar.discussion.open').querySelector('span')
    ).toBeNull();
    expect(
      action(container, 'timeline.action-bar.reaction.support').querySelector('span')
    ).toBeNull();
  });

  it('renders followed, bookmarked support state and dispatches every callback', () => {
    const onFollow = vi.fn();
    const onDiscuss = vi.fn();
    const onReact = vi.fn();
    const onShare = vi.fn();
    const onBookmark = vi.fn();
    const { container } = render(
      <ActionBar
        entityId="amendment-1"
        entityType="amendment"
        isFollowing
        isBookmarked
        userReaction="support"
        reactionCounts={{ support: 7, oppose: 3, interested: 2 }}
        commentCount={4}
        onFollow={onFollow}
        onDiscuss={onDiscuss}
        onReact={onReact}
        onShare={onShare}
        onBookmark={onBookmark}
        className="custom"
      />
    );
    fireEvent.click(action(container, 'timeline.action-bar.follow.toggle'));
    fireEvent.click(action(container, 'timeline.action-bar.discussion.open'));
    fireEvent.click(action(container, 'timeline.action-bar.reaction.support'));
    fireEvent.click(action(container, 'timeline.action-bar.reaction.oppose'));
    fireEvent.click(action(container, 'timeline.action-bar.share'));
    fireEvent.click(action(container, 'timeline.action-bar.bookmark.toggle'));
    fireEvent.click(action(container, 'timeline.action-bar.menu.copy-link'));
    fireEvent.click(action(container, 'timeline.action-bar.menu.discussion.open'));
    expect(onFollow).toHaveBeenCalledOnce();
    expect(onDiscuss).toHaveBeenCalledTimes(2);
    expect(onReact).toHaveBeenNthCalledWith(1, 'support');
    expect(onReact).toHaveBeenNthCalledWith(2, 'oppose');
    expect(onShare).toHaveBeenCalledTimes(2);
    expect(onBookmark).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('features.timeline.cards.following');
    expect(container.textContent).toContain('generated.inline.0144_unfollow_e3a6fe56');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('4');
  });

  it('renders the active oppose state', () => {
    const { container } = render(
      <ActionBar
        entityId="statement-1"
        entityType="statement"
        userReaction="oppose"
        reactionCounts={{ support: 0, oppose: 2, interested: 0 }}
      />
    );
    expect(action(container, 'timeline.action-bar.reaction.oppose').className).toContain(
      'decisionterminalDecisionStatusDangerTextAlpha'
    );
    expect(container.textContent).toContain('2');
  });

  it('renders active and inactive like variants without follow controls', () => {
    const onReact = vi.fn();
    const { container, rerender } = render(
      <ActionBar
        entityId="image-1"
        entityType="image"
        showReactions={false}
        showFollow={false}
        userReaction="support"
        reactionCounts={{ support: 5, oppose: 0, interested: 0 }}
        onReact={onReact}
      />
    );
    expect(
      container.querySelector('[data-action-id="timeline.action-bar.follow.toggle"]')
    ).toBeNull();
    expect(action(container, 'timeline.action-bar.reaction.like').getAttribute('aria-label')).toBe(
      'features.timeline.cards.liked'
    );
    fireEvent.click(action(container, 'timeline.action-bar.reaction.like'));
    expect(onReact).toHaveBeenCalledWith('support');

    rerender(
      <ActionBar
        entityId="image-1"
        entityType="image"
        showReactions={false}
        userReaction="interested"
        compact
      />
    );
    expect(action(container, 'timeline.action-bar.reaction.like').getAttribute('aria-label')).toBe(
      'features.timeline.cards.like'
    );
  });

  it('hides labels and counts in compact mode', () => {
    const { container } = render(
      <ActionBar
        entityId="blog-1"
        entityType="blog"
        compact
        commentCount={9}
        reactionCounts={{ support: 8, oppose: 7, interested: 0 }}
      />
    );
    expect(action(container, 'timeline.action-bar.follow.toggle').className).toContain('px-2');
    expect(
      action(container, 'timeline.action-bar.discussion.open').querySelector('span')
    ).toBeNull();
    expect(
      action(container, 'timeline.action-bar.reaction.support').querySelector('span')
    ).toBeNull();
    expect(
      action(container, 'timeline.action-bar.reaction.oppose').querySelector('span')
    ).toBeNull();
  });
});

describe('ActionBarCompact', () => {
  it('renders positive counts and dispatches callbacks', () => {
    const onReact = vi.fn();
    const onDiscuss = vi.fn();
    const { container } = render(
      <ActionBarCompact
        reactionCount={3}
        commentCount={2}
        onReact={onReact}
        onDiscuss={onDiscuss}
        className="custom"
      />
    );
    fireEvent.click(action(container, 'timeline.action-bar.compact.reaction.toggle'));
    fireEvent.click(action(container, 'timeline.action-bar.compact.discussion.open'));
    expect(onReact).toHaveBeenCalledOnce();
    expect(onDiscuss).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('2');
  });

  it('uses zero defaults without rendering count labels', () => {
    const { container } = render(<ActionBarCompact />);
    expect(container.textContent).not.toContain('0');
    expect(container.querySelector('.timelineActionBarNeutralText')).toBeTruthy();
  });
});
