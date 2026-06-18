/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
});

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
            visibility: 'public',
            image_url: null,
            location_latitude: null,
            location_longitude: null,
            location_label: null,
            location_source: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            owner_user_id: null,
            group_id: null,
            card_payload: {
              type: 'group',
              stats: { members: 12 },
              tags: ['planning'],
            },
            engagement_score: 0,
            trending_score: 0,
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
    expect(card.getAttribute('data-card-class')).toContain('entity-search-card-no-spotlight');
    expect(card.getAttribute('data-card-class')).not.toContain('search-card-no-background-motion');
    expect(card.getAttribute('data-card-class')).toContain('[data-timeline-card-media]');
    expect(card.getAttribute('data-card-class')).not.toContain(
      '[data-timeline-card-header]]:border-border/70'
    );
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

  it('passes election agenda navigation context from indexed search payloads', () => {
    render(
      <SearchResultCard
        document={
          {
            id: 'election:election-1',
            entity_id: 'election-1',
            entity_type: 'election',
            title: 'Board election',
            subtitle: 'open',
            summary: 'Elect a board member.',
            search_text: '',
            visibility: 'public',
            image_url: null,
            location_latitude: null,
            location_longitude: null,
            location_label: null,
            location_source: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            owner_user_id: null,
            group_id: 'group-1',
            card_payload: {
              type: 'election',
              status: 'open',
              metadata: {
                event_id: 'event-1',
                agenda_item_id: 'agenda-1',
              },
            },
            engagement_score: 0,
            trending_score: 0,
            topics: [],
            group: { id: 'group-1', name: 'Civic Assembly' },
          } as SearchDocument
        }
      />
    );

    const card = screen.getByTestId('dynamic-card');
    const props = JSON.parse(card.textContent || '{}') as {
      election?: { agendaEventId?: string; agendaItemId?: string; groupId?: string };
    };

    expect(card.getAttribute('data-card-type')).toBe('election');
    expect(props.election).toMatchObject({
      agendaEventId: 'event-1',
      agendaItemId: 'agenda-1',
      groupId: 'group-1',
    });
  });
});
