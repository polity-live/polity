/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { MasonryGridEmptyView, MasonryGridView } from '../MasonryGridView';

const labels = { title: 'Nothing here', hint: 'Try discovering', discoverContent: 'Discover' };
const loadMoreTriggerRef = { current: null };
function props(overrides: Record<string, any> = {}) {
  return {
    items: [],
    renderItem: (item: string) => <span>{item}</span>,
    keyExtractor: (item: string) => item,
    isLoading: false,
    hasMore: false,
    onLoadMore: undefined,
    className: undefined,
    gap: 'md',
    itemMotion: 'none',
    loadMoreTriggerRef,
    skeletonIndexes: [0, 1],
    emptyLabels: labels,
    ...overrides,
  };
}

afterEach(cleanup);

describe('MasonryGridView', () => {
  it('renders initial skeletons and every gap size', () => {
    const { container, rerender } = render(
      <MasonryGridView {...(props({ isLoading: true, gap: 'sm' }) as any)} />
    );
    expect(container.firstElementChild?.className).toContain('gap-2');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    rerender(<MasonryGridView {...(props({ isLoading: true, gap: 'lg' }) as any)} />);
    expect(container.firstElementChild?.className).toContain('gap-6');
  });

  it('renders the empty view and discover link', () => {
    render(<MasonryGridView {...(props() as any)} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/search');
  });

  it('renders items with reveal motion, append skeletons, and a load trigger', () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <MasonryGridView
        {...(props({
          items: ['one', 'two'],
          isLoading: true,
          hasMore: true,
          onLoadMore,
          itemMotion: 'reveal',
          className: 'custom',
        }) as any)}
      />
    );
    expect(screen.getByText('one').parentElement?.className).toContain('civic-load-card-reveal');
    expect(screen.getByText('one').parentElement?.getAttribute('style')).toContain(
      '--civic-load-index'
    );
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    expect(container.querySelector('.h-px')).toBeTruthy();
  });

  it('renders static items without loading or a trigger', () => {
    const { container } = render(
      <MasonryGridView {...(props({ items: ['one'], hasMore: true }) as any)} />
    );
    expect(screen.getByText('one').parentElement?.className).not.toContain(
      'civic-load-card-reveal'
    );
    expect(screen.getByText('one').parentElement?.getAttribute('style')).toBeNull();
    expect(container.querySelector('.h-px')).toBeNull();
  });

  it('renders the empty view directly', () => {
    render(<MasonryGridEmptyView labels={labels} />);
    expect(screen.getByText('Try discovering')).toBeTruthy();
  });
});
