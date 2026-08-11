/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSearchFilters } from '../useSearchFilters';

const tagged = { hashtags: [{ id: 'hashtag-1', tag: 'civic' }] };

function run(data: unknown, query = '', topics: string[] = []) {
  return renderHook(() => useSearchFilters(data as never, { query, topics, sortBy: 'relevance' }))
    .result.current;
}

describe('useSearchFilters decision table', () => {
  it('normalizes absent collections', () => {
    const current = run(undefined);
    expect(current.totalResults).toBe(0);
    expect(current.mosaicResults).toEqual([]);
    expect(Object.values(current.allResults).every(items => items.length === 0)).toBe(true);
  });

  it('keeps every supported type without a text or topic filter', () => {
    const current = run({
      $users: [{ id: 'user', first_name: 'Ada' }],
      groups: [{ id: 'group', name: 'Group' }],
      statements: [{ id: 'statement', title: 'Statement' }],
      todos: [{ id: 'todo', title: 'Todo', tags: null }],
      blogs: [{ id: 'blog', title: 'Blog', bloggers: null }],
      amendments: [{ id: 'amendment', title: 'Amendment', collaborators: null }],
      events: [{ id: 'event', title: 'Event', description: {} }],
      elections: [{ id: 'election', title: 'Election' }],
      eventVotingSessions: [{ id: 'vote' }],
      timelineEvents: [
        { id: 'video', content_type: 'video', title: 'Video' },
        { id: 'image', content_type: 'image', title: 'Image' },
        { id: 'other', content_type: 'text', title: 'Other' },
      ],
    });
    expect(current.totalResults).toBe(11);
    expect(current.mosaicResults.map(item => item._type)).toEqual([
      'user',
      'group',
      'statement',
      'todo',
      'blog',
      'amendment',
      'event',
      'election',
      'vote',
      'video',
      'image',
    ]);
  });

  it('requires both text and topic conditions for users and groups', () => {
    const data = {
      $users: [
        { id: 'user-match', first_name: 'Needle', ...tagged },
        { id: 'user-topic-miss', first_name: 'Needle' },
        { id: 'user-text-miss', first_name: 'Other', ...tagged },
      ],
      groups: [
        { id: 'group-match', name: 'Needle group', ...tagged },
        { id: 'group-topic-miss', name: 'Needle group' },
        { id: 'group-text-miss', name: null, ...tagged },
      ],
    };
    const current = run(data, 'needle', ['civic']);
    expect(current.allResults.users.map(item => item.id)).toEqual(['user-match']);
    expect(current.allResults.groups.map(item => item.id)).toEqual(['group-match']);
  });

  it('matches statements through title, text, hashtag, and both user names', () => {
    const statement = (id: string, value: Record<string, unknown>) => ({ id, ...tagged, ...value });
    const current = run(
      {
        statements: [
          statement('title', { title: 'Needle', text: null }),
          statement('text', { title: null, text: 'Needle' }),
          statement('hashtag', {
            title: 'Other',
            text: 'Other',
            statement_hashtags: [
              { hashtag: null },
              { hashtag: { tag: null } },
              { hashtag: { tag: 'NeedleTag' } },
            ],
          }),
          statement('first-name', {
            title: 'Other',
            text: 'Other',
            statement_hashtags: [],
            user: { first_name: 'Needle', last_name: 'Other' },
          }),
          statement('last-name', {
            title: 'Other',
            text: 'Other',
            statement_hashtags: [],
            user: { first_name: 'Other', last_name: 'Needle' },
          }),
          statement('miss', { title: 'Other', text: null, user: null }),
          { id: 'topic-miss', title: 'Needle' },
        ],
      },
      'needle',
      ['civic']
    );
    expect(current.allResults.statements.map(item => item.id)).toEqual([
      'title',
      'text',
      'hashtag',
      'first-name',
      'last-name',
    ]);
  });

  it('matches blogs and amendments through every searchable field', () => {
    const values = (prefix: string) => [
      { id: `${prefix}-title`, title: 'Needle', ...tagged },
      { id: `${prefix}-description`, title: 'Other', description: 'Needle', ...tagged },
      {
        id: `${prefix}-first`,
        title: 'Other',
        bloggers: [{ user: { first_name: 'Needle', last_name: 'Other' } }],
        collaborators: [{ user: { first_name: 'Needle', last_name: 'Other' } }],
        ...tagged,
      },
      {
        id: `${prefix}-last`,
        title: 'Other',
        bloggers: [{ user: { first_name: 'Other', last_name: 'Needle' } }],
        collaborators: [{ user: { first_name: 'Other', last_name: 'Needle' } }],
        ...tagged,
      },
      { id: `${prefix}-miss`, title: null, description: null, ...tagged },
      { id: `${prefix}-topic-miss`, title: 'Needle' },
    ];
    const amendments = [
      { id: 'amendment-title', title: 'Needle', ...tagged },
      { id: 'amendment-preamble', title: 'Other', preamble: 'Needle', ...tagged },
      { id: 'amendment-reason', title: 'Other', preamble: null, reason: 'Needle', ...tagged },
      ...values('amendment').slice(2),
    ];
    const current = run({ blogs: values('blog'), amendments }, 'needle', ['civic']);
    expect(current.allResults.blogs.map(item => item.id)).toEqual([
      'blog-title',
      'blog-description',
      'blog-first',
      'blog-last',
    ]);
    expect(current.allResults.amendments.map(item => item.id)).toEqual([
      'amendment-title',
      'amendment-preamble',
      'amendment-reason',
      'amendment-first',
      'amendment-last',
    ]);
  });

  it('matches events and todos through every searchable field', () => {
    const current = run(
      {
        events: [
          { id: 'event-title', title: 'Needle', ...tagged },
          { id: 'event-description', title: 'Other', description: 'Needle', ...tagged },
          {
            id: 'event-location',
            title: 'Other',
            description: null,
            location_name: 'Needle',
            ...tagged,
          },
          {
            id: 'event-creator-first',
            title: 'Other',
            creator: { first_name: 'Needle' },
            ...tagged,
          },
          {
            id: 'event-creator-last',
            title: 'Other',
            creator: { first_name: 'Other', last_name: 'Needle' },
            ...tagged,
          },
          {
            id: 'event-group',
            title: 'Other',
            creator: null,
            group: { name: 'Needle' },
            ...tagged,
          },
          { id: 'event-miss', title: null, description: {}, creator: null, group: null, ...tagged },
          { id: 'event-topic-miss', title: 'Needle' },
        ],
        todos: [
          { id: 'todo-title', title: 'Needle', tags: ['civic'] },
          { id: 'todo-description', title: 'Other', description: 'Needle', tags: ['civic'] },
          {
            id: 'todo-group',
            title: 'Other',
            description: null,
            group: { name: 'Needle' },
            tags: ['civic'],
          },
          {
            id: 'todo-creator-first',
            title: 'Other',
            creator: { first_name: 'Needle' },
            tags: ['civic'],
          },
          {
            id: 'todo-creator-last',
            title: 'Other',
            creator: { first_name: 'Other', last_name: 'Needle' },
            tags: ['civic'],
          },
          { id: 'todo-miss', title: null, creator: null, tags: ['civic'] },
          { id: 'todo-topic-miss', title: 'Needle', tags: null },
        ],
      },
      'needle',
      ['civic']
    );
    expect(current.allResults.events.map(item => item.id)).toEqual([
      'event-title',
      'event-description',
      'event-location',
      'event-creator-first',
      'event-creator-last',
      'event-group',
    ]);
    expect(current.allResults.todos.map(item => item.id)).toEqual([
      'todo-title',
      'todo-description',
      'todo-group',
      'todo-creator-first',
      'todo-creator-last',
    ]);
  });

  it('matches elections, videos, and images through every searchable field', () => {
    const timeline = (content_type: string, prefix: string) => [
      { id: `${prefix}-title`, content_type, title: 'Needle' },
      { id: `${prefix}-description`, content_type, title: 'Other', description: 'Needle' },
      { id: `${prefix}-group`, content_type, title: 'Other', group: { name: 'Needle' } },
      { id: `${prefix}-miss`, content_type, title: null, description: null, group: null },
    ];
    const current = run(
      {
        elections: [
          { id: 'election-title', title: 'Needle' },
          { id: 'election-description', title: 'Other', description: 'Needle' },
          { id: 'election-group', title: 'Other', role: { group: { name: 'Needle' } } },
          { id: 'election-role', title: 'Other', role: { group: null, name: 'Needle' } },
          { id: 'election-miss', title: null, role: null },
        ],
        timelineEvents: [
          ...timeline('video', 'video'),
          ...timeline('image', 'image'),
          { id: 'other', content_type: 'text', title: 'Needle' },
        ],
      },
      'needle'
    );
    expect(current.allResults.elections.map(item => item.id)).toEqual([
      'election-title',
      'election-description',
      'election-group',
      'election-role',
    ]);
    expect(current.allResults.videos.map(item => item.id)).toEqual([
      'video-title',
      'video-description',
      'video-group',
    ]);
    expect(current.allResults.images.map(item => item.id)).toEqual([
      'image-title',
      'image-description',
      'image-group',
    ]);
  });
});
