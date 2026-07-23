/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

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

function makeSearchDocument(overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
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
    location_kind: null,
    location_place_id: null,
    location_boundary_source: null,
    location_geometry: null,
    location_bounds: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    owner_user_id: null,
    group_id: null,
    card_payload: { type: 'group' },
    engagement_score: 0,
    trending_score: 0,
    topics: [],
    group: null,
    ...overrides,
  } as SearchDocument;
}

function readDynamicCardProps() {
  const card = screen.getByTestId('dynamic-card');
  return {
    card,
    props: JSON.parse(card.textContent || '{}') as Record<string, unknown>,
  };
}

describe('SearchResultCard', () => {
  it('passes compact search card classes without stretching cards to the virtual row height', () => {
    render(
      <SearchResultCard
        document={makeSearchDocument({
          card_payload: {
            type: 'group',
            stats: { members: 12 },
            tags: ['planning'],
          },
        })}
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

  it('does not expose indexed user search text as the card bio', () => {
    render(
      <SearchResultCard
        document={makeSearchDocument({
          id: 'user:user-1',
          entity_id: 'user-1',
          entity_type: 'user',
          title: 'Vyb Shetty',
          summary: null,
          search_text: 'Vyb Shetty vyb.shetty@example.com',
          owner_user_id: 'user-1',
          card_payload: {
            type: 'user',
            handle: 'vyb',
          },
        })}
      />
    );

    const { card, props } = readDynamicCardProps() as {
      card: HTMLElement;
      props: { user?: { bio?: string } };
    };

    expect(card.getAttribute('data-card-type')).toBe('user');
    expect(props.user?.bio).toBeUndefined();
    expect(card.textContent).not.toContain('vyb.shetty@example.com');
  });

  it('keeps an explicit user bio from the search document summary', () => {
    render(
      <SearchResultCard
        document={makeSearchDocument({
          id: 'user:user-1',
          entity_id: 'user-1',
          entity_type: 'user',
          title: 'Vyb Shetty',
          summary: 'Community organizer',
          search_text: 'Vyb Shetty vyb.shetty@example.com Community organizer',
          owner_user_id: 'user-1',
          card_payload: {
            type: 'user',
            handle: 'vyb',
          },
        })}
      />
    );

    const { props } = readDynamicCardProps() as {
      card: HTMLElement;
      props: { user?: { bio?: string } };
    };

    expect(props.user?.bio).toBe('Community organizer');
  });

  it.each([
    {
      name: 'group',
      expectedCardType: 'group',
      expectedHref: '/group/group-1',
      document: makeSearchDocument(),
    },
    {
      name: 'blog',
      expectedCardType: 'blog',
      expectedHref: '/group/group-1/blog/blog-1',
      document: makeSearchDocument({
        id: 'blog:blog-1',
        entity_id: 'blog-1',
        entity_type: 'blog',
        group_id: 'group-1',
        owner_user_id: 'user-1',
        title: 'Budget Notes',
        card_payload: { type: 'blog' },
      }),
    },
    {
      name: 'todo',
      expectedCardType: 'todo',
      expectedHref: '/todos/todo-1',
      document: makeSearchDocument({
        id: 'todo:todo-1',
        entity_id: 'todo-1',
        entity_type: 'todo',
        title: 'Prepare agenda',
        card_payload: { type: 'todo' },
      }),
    },
    {
      name: 'video source entity',
      expectedCardType: 'video',
      expectedHref: '/statement/statement-1',
      expectedNestedProps: {
        video: {
          sourceId: 'statement-1',
          sourceType: 'statement',
        },
      },
      document: makeSearchDocument({
        id: 'timeline-event:video-1',
        entity_id: 'video-1',
        entity_type: 'video',
        title: 'Statement clip',
        image_url: 'https://example.com/thumb.jpg',
        card_payload: {
          type: 'video',
          entity_type: 'statement',
          entity_id: 'statement-1',
        },
      }),
    },
    {
      name: 'image permalink fallback',
      expectedCardType: 'image',
      expectedHref: '/search?result=timeline-event%3Aimage-1',
      document: makeSearchDocument({
        id: 'timeline-event:image-1',
        entity_id: 'image-1',
        entity_type: 'image',
        title: 'Photo',
        image_url: 'https://example.com/photo.jpg',
        card_payload: { type: 'image' },
      }),
    },
  ])('passes a canonical native href for $name search cards', testCase => {
    const view = render(<SearchResultCard document={testCase.document} />);

    const { card, props } = readDynamicCardProps();

    expect(card.getAttribute('data-card-type')).toBe(testCase.expectedCardType);
    expect(props.href).toBe(testCase.expectedHref);
    if ('expectedNestedProps' in testCase && testCase.expectedNestedProps) {
      expect(props).toMatchObject(testCase.expectedNestedProps);
    }

    view.unmount();
  });

  it('links unsupported fallback cards to their search result permalink', () => {
    render(
      <SearchResultCard
        document={makeSearchDocument({
          id: 'unknown:result-1',
          entity_id: 'result-1',
          entity_type: 'unknown',
          title: 'Loose result',
          card_payload: { type: 'unknown' },
        })}
      />
    );

    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));

    expect(hrefs).toContain('/search?result=unknown%3Aresult-1');
  });

  it('passes election agenda navigation context from indexed search payloads', () => {
    render(
      <SearchResultCard
        document={makeSearchDocument({
          id: 'election:election-1',
          entity_id: 'election-1',
          entity_type: 'election',
          title: 'Board election',
          subtitle: 'open',
          summary: 'Elect a board member.',
          group_id: 'group-1',
          card_payload: {
            type: 'election',
            status: 'open',
            metadata: {
              event_id: 'event-1',
              agenda_item_id: 'agenda-1',
            },
          },
          group: { id: 'group-1', name: 'Civic Assembly' },
        })}
      />
    );

    const { card, props } = readDynamicCardProps() as {
      card: HTMLElement;
      props: {
        href?: string;
        election?: { agendaEventId?: string; agendaItemId?: string; groupId?: string };
      };
    };

    expect(card.getAttribute('data-card-type')).toBe('election');
    expect(props.href).toBe('/event/event-1/agenda/agenda-1');
    expect(props.election).toMatchObject({
      agendaEventId: 'event-1',
      agendaItemId: 'agenda-1',
      groupId: 'group-1',
    });
  });
});
