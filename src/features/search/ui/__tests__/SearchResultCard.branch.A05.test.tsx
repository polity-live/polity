/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  searchCardState: null as null | Record<string, any>,
  buildTimelineCardProps: vi.fn((item: { id: string; type: string }) =>
    item.id === 'null-card'
      ? { cardType: null, cardProps: null }
      : { cardType: item.type, cardProps: { extractedItem: item } }
  ),
}));

vi.mock('../../SearchCardStateProvider', () => ({
  useSearchCardState: () => mocks.searchCardState,
}));
vi.mock('../../logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: mocks.buildTimelineCardProps,
}));
vi.mock('@/features/timeline/ui/LazyCardComponents', () => ({
  DynamicTimelineCard: ({ cardType, cardProps }: any) => (
    <div data-testid="dynamic-card" data-card-type={String(cardType)}>
      {JSON.stringify(cardProps)}
    </div>
  ),
}));
vi.mock('@/features/timeline/ui/cards/TimelineCardBase', () => ({
  TimelineCardBase: ({ children, href }: any) => <a href={href}>{children}</a>,
  TimelineCardHeader: ({ title, subtitle, badge }: any) => (
    <header>
      {title} {subtitle} {badge}
    </header>
  ),
  TimelineCardContent: ({ children }: any) => <main>{children}</main>,
  TimelineCardBadge: ({ label }: any) => <span>{label}</span>,
}));

import { SearchResultCard } from '../SearchResultCard';
import type { SearchDocument } from '../../types/search-document.types';

function searchDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'search-1',
    entity_id: 'entity-1',
    entity_type: 'group',
    title: 'Title',
    subtitle: null,
    summary: null,
    search_text: '',
    visibility: null,
    image_url: null,
    created_at: null,
    updated_at: null,
    owner_user_id: null,
    group_id: null,
    card_payload: { type: 'group' },
    topics: [],
    group: null,
    tutorial_run_id: null,
    ...overrides,
  } as unknown as SearchDocument;
}

afterEach(cleanup);
beforeEach(() => {
  mocks.searchCardState = null;
  mocks.buildTimelineCardProps.mockClear();
});

describe('SearchResultCard remaining branches', () => {
  it('renders complete and empty previews from record, array, tag, stat, and text fallbacks', () => {
    const rich = searchDocument({
      title: '',
      entity_type: '',
      subtitle: null,
      group: { id: 'group-1', name: 'Fallback group' },
      summary: '',
      search_text: 'Indexed excerpt',
      topics: [{ topic: 'topic' }, { topic: '' }],
      card_payload: {
        type: '',
        tags: ['payload', '', 'topic'],
        stats: { number: 1, string: '2', ignored: false, ignoredObject: {} },
      },
    });
    const rendered = render(<SearchResultCard mode="preview" document={rich} />);
    expect(screen.getByText('Fallback group')).toBeTruthy();
    expect(screen.getByText('Indexed excerpt')).toBeTruthy();
    expect(screen.getByText('#payload')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    rendered.rerender(
      <SearchResultCard
        mode="preview"
        document={searchDocument({
          entity_type: '',
          title: '',
          card_payload: [],
          topics: undefined,
        })}
      />
    );
    expect(screen.getByRole('link', { name: 'Result' })).toBeTruthy();
  });

  it('normalizes rich content values, dates, metadata, handles, and every numeric stat shape', () => {
    render(
      <SearchResultCard
        document={searchDocument({
          entity_id: 'statement-1',
          entity_type: 'statement',
          title: 'Statement',
          subtitle: '@author',
          summary: '',
          search_text: 'Statement text',
          created_at: null,
          updated_at: 'not-a-date',
          owner_user_id: null,
          group: { id: 'group-1', name: 'Group' },
          topics: null,
          card_payload: {
            type: 'statement',
            metadata: [],
            handle: null,
            agendaEventId: '   ',
            due_at: '2026-01-01T00:00:00.000Z',
            starts_at: new Date('2026-01-02T00:00:00.000Z'),
            ends_at: '',
            stats: {
              reactions: Number.POSITIVE_INFINITY,
              likes: ' 12 ',
              comments: 'not-a-number',
              views: '',
              members: null,
              participants: 4,
              elections: 1,
              amendments: 2,
              groups: 3,
              collaborators: 5,
              subscribers: 6,
              supporting_groups: 7,
              change_requests: 8,
              upvotes: 9,
              downvotes: 10,
              assignees: 11,
              candidates: 12,
            },
          },
        })}
      />
    );
    const payload = JSON.parse(screen.getByTestId('dynamic-card').textContent || '{}');
    expect(payload.extractedItem).toEqual(
      expect.objectContaining({
        type: 'statement',
        handle: 'author',
        authorName: '@author',
        stats: expect.objectContaining({ reactions: 12 }),
      })
    );
  });

  it('covers blog, user, image, video and invalid-card specialization branches', () => {
    const documents = [
      searchDocument({ entity_id: 'blog', entity_type: 'blog', card_payload: { type: 'blog' } }),
      searchDocument({
        entity_id: 'user',
        entity_type: 'user',
        card_payload: { type: 'user' },
      }),
      searchDocument({
        entity_id: 'image',
        entity_type: 'image',
        card_payload: { type: 'image' },
      }),
      searchDocument({
        entity_id: 'video',
        entity_type: 'video',
        subtitle: null,
        group: { id: 'g', name: 'Media group' },
        card_payload: { type: 'video' },
      }),
      searchDocument({
        entity_id: 'statement-owner',
        entity_type: 'statement',
        subtitle: null,
        owner_user_id: 'owner-1',
        card_payload: { type: 'statement' },
      }),
      searchDocument({
        entity_id: 'statement-empty',
        entity_type: 'statement',
        subtitle: null,
        owner_user_id: null,
        card_payload: { type: 'statement' },
      }),
      searchDocument({
        entity_id: 'null-card',
        entity_type: 'group',
        card_payload: { type: 'group' },
      }),
    ];
    const rendered = render(<SearchResultCard document={documents[0]} />);
    for (const document of documents.slice(1)) {
      rendered.rerender(<SearchResultCard document={document} />);
    }
    expect(mocks.buildTimelineCardProps).toHaveBeenCalledTimes(7);
  });

  it('projects subscription, membership, participation and collaboration state with count fallbacks', () => {
    mocks.searchCardState = {
      getSubscriptionState: vi.fn(() => 'subscription'),
      getGroupState: vi.fn(() => 'membership'),
      getEventState: vi.fn(() => 'participation'),
      getAmendmentState: vi.fn(() => 'collaboration'),
    };
    const documents = [
      searchDocument({
        entity_id: 'group-with-id',
        entity_type: 'group',
        group_id: 'group-projected',
        card_payload: { type: 'group', stats: { members: 4, subscribers: 5 } },
      }),
      searchDocument({
        entity_id: 'group-fallback',
        entity_type: 'group',
        group_id: null,
        card_payload: { type: 'group' },
      }),
      searchDocument({
        entity_id: 'event',
        entity_type: 'event',
        visibility: null,
        card_payload: { type: 'event' },
      }),
      searchDocument({
        entity_id: 'amendment',
        entity_type: 'amendment',
        card_payload: { type: 'amendment' },
      }),
      searchDocument({ entity_id: 'blog', entity_type: 'blog', card_payload: { type: 'blog' } }),
      searchDocument({ entity_id: 'user', entity_type: 'user', card_payload: { type: 'user' } }),
      searchDocument({ entity_id: 'todo', entity_type: 'todo', card_payload: { type: 'todo' } }),
    ];
    const rendered = render(
      <>
        {documents.map(document => (
          <SearchResultCard key={document.entity_id} document={document} />
        ))}
      </>
    );
    expect(rendered.container.querySelectorAll('[data-testid="dynamic-card"]')).toHaveLength(7);
    expect(mocks.searchCardState.getSubscriptionState).toHaveBeenCalledTimes(6);
    expect(mocks.searchCardState.getGroupState).toHaveBeenCalledTimes(2);
    expect(mocks.searchCardState.getEventState).toHaveBeenCalledOnce();
    expect(mocks.searchCardState.getAmendmentState).toHaveBeenCalledOnce();
  });

  it('hits both weak-map caches and fallback-card content and tag variants', () => {
    const shared = searchDocument({
      entity_id: 'shared',
      entity_type: 'group',
      summary: 'Summary',
      topics: [{ topic: 'tag' }],
      card_payload: { type: 'group' },
    });
    render(
      <>
        <SearchResultCard document={shared} />
        <SearchResultCard document={shared} />
      </>
    );

    cleanup();
    const unsupported = searchDocument({
      entity_id: 'unsupported',
      entity_type: 'unsupported',
      title: '',
      subtitle: null,
      group: null,
      summary: '',
      search_text: 'Fallback search text',
      topics: [{ topic: 'fallback' }],
      card_payload: { type: 'unsupported' },
    });
    const fallback = render(<SearchResultCard document={unsupported} />);
    expect(fallback.container.textContent).toContain('Fallback search text');
    expect(fallback.container.textContent).toContain('#fallback');

    fallback.rerender(
      <SearchResultCard
        document={searchDocument({
          entity_id: 'unsupported-empty',
          entity_type: '',
          title: '',
          card_payload: null,
        })}
      />
    );
  });
});
