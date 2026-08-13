/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const Card = ({ name = 'card' }: { name?: string }) => <div>{name}</div>;

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({ GroupTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({ EventTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/AmendmentTimelineCard', () => ({
  AmendmentTimelineCard: Card,
}));
vi.mock('@/features/timeline/ui/cards/AgendaItemTimelineCard', () => ({
  AgendaItemTimelineCard: Card,
}));
vi.mock('@/features/timeline/ui/cards/VideoTimelineCard', () => ({ VideoTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/ImageTimelineCard', () => ({ ImageTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/StatementTimelineCard', () => ({
  StatementTimelineCard: Card,
}));
vi.mock('@/features/timeline/ui/cards/TodoTimelineCard', () => ({ TodoTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/BlogTimelineCard', () => ({ BlogTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/PaymentTimelineCard', () => ({ PaymentTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/VoteTimelineCard', () => ({ VoteTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/ElectionTimelineCard', () => ({
  ElectionTimelineCard: Card,
}));
vi.mock('@/features/timeline/ui/cards/ActionTimelineCard', () => ({ ActionTimelineCard: Card }));
vi.mock('@/features/timeline/ui/cards/UserTimelineCard', () => ({ UserTimelineCard: Card }));

import {
  DynamicTimelineCard,
  LAZY_CARD_COMPONENTS,
  preloadAllCards,
  preloadCard,
  withLazyLoading,
  type CardType,
} from '../LazyCardComponents';

afterEach(cleanup);

describe('lazy timeline card module contracts', () => {
  it('loads and renders every card module through its lazy adapter', async () => {
    for (const cardType of Object.keys(LAZY_CARD_COMPONENTS) as CardType[]) {
      const { unmount } = render(
        <DynamicTimelineCard
          cardType={cardType}
          cardProps={{ name: `loaded-${cardType}` }}
          className="loading"
        />
      );
      await screen.findByText(`loaded-${cardType}`);
      unmount();
    }
  }, 30_000);

  it('preloads individual, unknown, and all registered card types', async () => {
    for (const cardType of Object.keys(LAZY_CARD_COMPONENTS) as CardType[]) {
      preloadCard(cardType);
    }
    preloadCard('unknown' as CardType);
    preloadAllCards();
    await vi.dynamicImportSettled();
    await waitFor(() => expect(Object.keys(LAZY_CARD_COMPONENTS)).toHaveLength(14));
  }, 30_000);

  it('renders lazy HOC wrappers with default and custom fallbacks', async () => {
    const loader = vi.fn(async () => ({ default: Card }));
    const DefaultWrapper = withLazyLoading(loader);
    const CustomWrapper = withLazyLoading(loader, <div>custom fallback</div>);
    const first = render(<DefaultWrapper name="default wrapper" />);
    await screen.findByText('default wrapper');
    first.unmount();
    render(<CustomWrapper name="custom wrapper" />);
    await screen.findByText('custom wrapper');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown dynamic card without rendering', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(
      <DynamicTimelineCard cardType={'unknown' as CardType} cardProps={{}} />
    );
    expect(container.innerHTML).toBe('');
    expect(warn).toHaveBeenCalledWith('Unknown card type: unknown');
  });
});
