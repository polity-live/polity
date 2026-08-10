/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gridProps: undefined as Record<string, any> | undefined,
  emptyProps: undefined as Record<string, any> | undefined,
  controller: { loadMoreTriggerRef: { current: null }, skeletonIndexes: [0] },
  emptyController: { labels: { title: 'Empty', hint: 'Hint', discoverContent: 'Discover' } },
}));

vi.mock('@/features/timeline/hooks/useMasonryGridController', () => ({
  useMasonryGridController: () => mocks.controller,
}));
vi.mock('@/features/timeline/hooks/useMasonryGridEmptyController', () => ({
  useMasonryGridEmptyController: () => mocks.emptyController,
}));
vi.mock('../MasonryGridView', () => ({
  MasonryGridView: (props: Record<string, any>) => {
    mocks.gridProps = props;
    return <div>Grid</div>;
  },
  MasonryGridEmptyView: (props: Record<string, any>) => {
    mocks.emptyProps = props;
    return <div>Empty</div>;
  },
}));

import { MasonryGrid, MasonryGridEmpty } from '../MasonryGrid';

beforeEach(() => {
  mocks.gridProps = undefined;
  mocks.emptyProps = undefined;
});
afterEach(cleanup);

describe('MasonryGrid', () => {
  it('applies all defaults and controller projections', () => {
    const renderItem = (item: string) => item;
    const keyExtractor = (item: string) => item;
    render(<MasonryGrid items={['one']} renderItem={renderItem} keyExtractor={keyExtractor} />);
    expect(mocks.gridProps).toMatchObject({
      items: ['one'],
      renderItem,
      keyExtractor,
      isLoading: false,
      hasMore: false,
      gap: 'md',
      itemMotion: 'none',
      emptyLabels: mocks.emptyController.labels,
      skeletonIndexes: [0],
    });
  });

  it('forwards explicit display and loading options', () => {
    const onLoadMore = vi.fn();
    render(
      <MasonryGrid
        items={[]}
        renderItem={() => null}
        keyExtractor={() => 'key'}
        isLoading
        hasMore
        onLoadMore={onLoadMore}
        loadingSkeletonCount={3}
        className="custom"
        gap="lg"
        itemMotion="reveal"
      />
    );
    expect(mocks.gridProps).toMatchObject({
      isLoading: true,
      hasMore: true,
      onLoadMore,
      className: 'custom',
      gap: 'lg',
      itemMotion: 'reveal',
    });
  });

  it('projects the empty controller', () => {
    render(<MasonryGridEmpty />);
    expect(mocks.emptyProps).toEqual(mocks.emptyController);
  });
});
