/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchResultCard } from '../SearchResultCard';
import type { SearchDocument } from '../../types/search-document.types';

vi.mock('@/features/timeline/ui/LazyCardComponents', () => ({
  DynamicTimelineCard: ({
    cardProps,
    cardType,
    className,
  }: {
    cardProps: Record<string, unknown>;
    cardType: string;
    className?: string;
  }) => (
    <div data-testid="dynamic-card" data-card-type={cardType} data-card-class={className ?? ''}>
      {JSON.stringify(cardProps)}
    </div>
  ),
}));

describe('SearchResultCard', () => {
  it('passes compact search card classes without stretching cards to the virtual row height', () => {
    render(
      <SearchResultCard
        document={
          {
            id: 'search-doc-1',
            entity_id: 'group-1',
            entity_type: 'group',
            title: 'Civic Assembly',
            subtitle: null,
            summary: 'A group for civic work.',
            search_text: '',
            image_url: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            owner_user_id: null,
            group_id: null,
            card_payload: {
              type: 'group',
              stats: { members: 12 },
              tags: ['planning'],
            },
            topics: [],
            group: null,
          } as SearchDocument
        }
      />
    );

    const card = screen.getByTestId('dynamic-card');

    expect(card.getAttribute('data-card-type')).toBe('group');
    expect(card.getAttribute('data-card-class')).not.toContain('h-full');
    expect(card.getAttribute('data-card-class')).toContain('bg-transparent');
    expect(card.getAttribute('data-card-class')).toContain('shadow-none');
    expect(card.getAttribute('data-card-class')).toContain('[data-timeline-card-media]');
    expect(card.getAttribute('data-card-class')).toContain(
      '[data-timeline-card-content]]:rounded-b-2xl'
    );
    expect(card.getAttribute('data-card-class')).toContain('[data-timeline-card-content]]:bg-card');
    expect(card.getAttribute('data-card-class')).toContain(
      '[data-timeline-card-actions]]:bg-transparent'
    );
    expect(card.getAttribute('data-card-class')).toContain(
      '[data-timeline-card-actions]]:border-0'
    );
  });
});
