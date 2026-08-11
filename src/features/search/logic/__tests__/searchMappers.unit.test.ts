import { describe, it, expect } from 'vitest';
import { toTags, toDate, mapMosaicToContentItems } from '../searchMappers';
import type { SearchResultItem } from '../../types/search.types';

describe('searchMappers', () => {
  describe('toTags', () => {
    it('should return empty array for undefined', () => {
      expect(toTags(undefined)).toEqual([]);
    });

    it('should extract tag strings from hashtag objects', () => {
      const hashtags = [{ tag: 'politics' }, { tag: 'climate' }];
      expect(toTags(hashtags)).toEqual(['politics', 'climate']);
    });

    it('should filter out null or undefined tags', () => {
      const hashtags = [{ tag: 'politics' }, { tag: null }, { tag: undefined }];
      expect(toTags(hashtags)).toEqual(['politics']);
    });
  });

  describe('toDate', () => {
    it('should return current date for null/undefined', () => {
      const result = toDate(null);
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse ISO string to Date', () => {
      const result = toDate('2024-06-01T00:00:00Z');
      expect(result.getFullYear()).toBe(2024);
    });

    it('should return Date input as-is', () => {
      const d = new Date('2024-01-01');
      expect(toDate(d)).toBe(d);
    });

    it('should preserve the Unix epoch instead of treating zero as absent', () => {
      expect(toDate(0).getTime()).toBe(0);
    });
  });

  describe('mapMosaicToContentItems — hashtag extraction', () => {
    const emptyAgendaMap = new Map();

    it('should map searchableUsers payload into user cards with full name and avatar', () => {
      const items = [
        {
          _type: 'user' as const,
          id: 'u-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          handle: 'ada',
          bio: 'Computing pioneer',
          avatar: 'https://example.com/ada.png',
          location: 'London',
          created_at: 1717200000000,
          group_count: 3,
          amendment_count: 5,
          user_hashtags: [{ hashtag: { tag: 'math' } }],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'u-1',
        type: 'user',
        title: 'Ada Lovelace',
        authorName: 'Ada Lovelace',
        authorAvatar: 'https://example.com/ada.png',
        handle: 'ada',
        description: 'Computing pioneer',
        location: 'London',
        groupCount: 3,
        amendmentCount: 5,
        tags: ['math'],
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should extract tags from group_hashtags junctions', () => {
      const items = [
        {
          _type: 'group' as const,
          id: 'g1',
          name: 'Test Group',
          group_hashtags: [{ hashtag: { tag: 'politics' } }, { hashtag: { tag: 'education' } }],
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['politics', 'education']);
    });

    it('should extract tags from event_hashtags junctions', () => {
      const items = [
        {
          _type: 'event' as const,
          id: 'e1',
          title: 'Test Event',
          event_hashtags: [{ hashtag: { tag: 'summit' } }],
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['summit']);
    });

    it('should preserve event group route context', () => {
      const items = [
        {
          _type: 'event' as const,
          id: 'e-group',
          title: 'Neighborhood Assembly',
          created_at: 1717200000000,
          creator: { id: 'u-1', first_name: 'Alex', last_name: 'Organizer' },
          group: { id: 'g-1', name: 'City Circle' },
          agenda_items: [],
          participants: [],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe('g-1');
      expect(result[0].groupName).toBe('City Circle');
      expect(result[0].authorId).toBe('u-1');
      expect(result[0].authorName).toBe('Alex Organizer');
    });

    it('should normalize rich-text descriptions to plain text', () => {
      const items = [
        {
          _type: 'group' as const,
          id: 'g-rich',
          name: 'Rich Group',
          description: [
            {
              type: 'p',
              children: [{ text: 'Line one' }],
            },
            {
              type: 'p',
              children: [{ text: 'Line two' }],
            },
          ],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Line one\nLine two');
    });

    it('should extract tags from amendment_hashtags junctions', () => {
      const items = [
        {
          _type: 'amendment' as const,
          id: 'a1',
          title: 'Test Amendment',
          amendment_hashtags: [{ hashtag: { tag: 'reform' } }, { hashtag: { tag: 'climate' } }],
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['reform', 'climate']);
    });

    it('should extract tags from blog_hashtags junctions', () => {
      const items = [
        {
          _type: 'blog' as const,
          id: 'b1',
          title: 'Test Blog',
          blog_hashtags: [{ hashtag: { tag: 'opinion' } }],
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['opinion']);
    });

    it('should preserve a group-owned blog route context', () => {
      const items = [
        {
          _type: 'blog' as const,
          id: 'b-group',
          title: 'Group Blog',
          group_id: 'g-1',
          bloggers: [
            {
              status: 'owner',
              user_id: 'u-1',
              user: { id: 'u-1', name: 'Owner' },
            },
          ],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe('g-1');
      expect(result[0].authorId).toBe('u-1');
    });

    it('should preserve a user-owned blog route context', () => {
      const items = [
        {
          _type: 'blog' as const,
          id: 'b-user',
          title: 'User Blog',
          bloggers: [
            {
              status: 'owner',
              user_id: 'u-2',
              user: { id: 'u-2', name: 'Owner' },
            },
          ],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBeUndefined();
      expect(result[0].authorId).toBe('u-2');
    });

    it('should support the searchableBlogs snake_case payload', () => {
      const items = [
        {
          _type: 'blog' as const,
          id: 'b-snake',
          title: 'Snake Blog',
          created_at: 1717200000000,
          image_url: 'https://example.com/cover.png',
          comment_count: 4,
          support_votes: [{ id: 'v-1' }],
          bloggers: [
            {
              status: 'owner',
              user_id: 'u-3',
              user: { id: 'u-3', name: 'Snake Owner', avatar: 'https://example.com/avatar.png' },
            },
          ],
        },
      ];

      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(result).toHaveLength(1);
      expect(result[0].authorId).toBe('u-3');
      expect(result[0].authorAvatar).toBe('https://example.com/avatar.png');
      expect(result[0].commentCount).toBe(4);
      expect(result[0].stats?.reactions).toBe(1);
    });

    it('should return empty tags when no junctions exist', () => {
      const items = [
        {
          _type: 'group' as const,
          id: 'g1',
          name: 'No Tags Group',
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual([]);
    });

    it('should filter out null hashtags from junctions', () => {
      const items = [
        {
          _type: 'group' as const,
          id: 'g1',
          name: 'Partial Tags',
          group_hashtags: [
            { hashtag: { tag: 'valid' } },
            { hashtag: null },
            { hashtag: { tag: null } },
          ],
        },
      ];
      const result = mapMosaicToContentItems(
        items as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );
      expect(result[0].tags).toEqual(['valid']);
    });

    it('should return empty array for empty input', () => {
      expect(mapMosaicToContentItems([], emptyAgendaMap)).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(mapMosaicToContentItems(null as any, emptyAgendaMap)).toEqual([]);
    });

    it('maps rich results for every searchable entity type', () => {
      const results = mapMosaicToContentItems(
        [
          {
            _type: 'group',
            id: 'group-rich',
            name: 'Group',
            description: null,
            created_at: 0,
            member_count: 4,
            memberships: [{ id: 'ignored' }],
            events: [{ id: 'event' }],
            amendments: [{ id: 'amendment' }],
            group_hashtags: [],
          },
          {
            _type: 'event',
            id: 'event-rich',
            title: 'Event',
            description: '',
            created_at: 0,
            start_date: '2026-01-01T10:00:00.000Z',
            end_date: '2026-01-01T12:00:00.000Z',
            participants: [{ id: 'participant' }],
            creator: { id: 'creator', first_name: 'Event', last_name: 'Owner' },
            agenda_items: [
              { election: { id: 'election' }, amendment: null },
              { election: null, amendment: { id: 'amendment' } },
            ],
            event_hashtags: [],
            group: { id: 'group', name: 'Group' },
            is_recurring: true,
            recurrence_pattern: 'weekly',
          },
          {
            _type: 'amendment',
            id: 'amendment-rich',
            title: 'Amendment',
            reason: 'Reason',
            preamble: 'Preamble',
            created_at: 0,
            current_process_run: {
              branches: [{ id: 'branch', editing_mode: 'vote', branch_sequence: 1 }],
            },
            amendment_hashtags: [],
            group: { id: 'group', name: 'Group' },
            collaborators: [{ id: 'collaborator' }],
            change_requests: [{ id: 'change-request' }],
            vote_entries: [{ id: 'vote' }],
            comment_count: 2,
          },
          {
            _type: 'blog',
            id: 'blog-rich',
            title: 'Blog',
            description: 'Blog description',
            created_at: 0,
            image_url: 'cover.png',
            bloggers: [
              {
                status: 'owner',
                user_id: 'blog-owner',
                user: { id: 'blog-owner', first_name: 'Blog', last_name: 'Owner', avatar: 'a.png' },
              },
            ],
            blog_hashtags: [],
            support_votes: [{ id: 'support' }],
            comment_count: 3,
          },
          {
            _type: 'statement',
            id: 'statement-rich',
            title: 'Statement',
            text: 'Statement body',
            created_at: 0,
            user: {
              id: 'statement-owner',
              first_name: 'Statement',
              last_name: 'Owner',
              handle: 'owner',
              avatar: 'owner.png',
            },
            group: { id: 'group', name: 'Group', image_url: 'group.png' },
            support_votes: [{ vote: 1 }, { vote: -1 }, { vote: 0 }],
            upvotes: 8,
            downvotes: 7,
            surveys: [
              {
                question: 'Question?',
                options: [
                  { label: 'A', votes: [{ id: 'vote' }] },
                  { label: 'B', votes: undefined },
                ],
              },
            ],
            statement_hashtags: [],
            comment_count: 5,
          },
          {
            _type: 'todo',
            id: 'todo-rich',
            title: 'Todo',
            description: 'Todo description',
            created_at: 0,
            updated_at: '2026-01-02T00:00:00.000Z',
            due_date: '2026-01-03T00:00:00.000Z',
            status: 'completed',
            archived_at: 1,
            group: { id: 'group', name: 'Group' },
            creator: { id: 'todo-owner', first_name: 'Todo', last_name: 'Owner', avatar: 't.png' },
            assignments: [{ id: 'assignment' }],
            tags: ['work'],
          },
          {
            _type: 'user',
            id: 'user-rich',
            first_name: 'User',
            last_name: 'Name',
            bio: 'Biography',
            created_at: 0,
            location: 'Hamburg',
            group_count: 2,
            amendment_count: 3,
            group_memberships: [],
            amendment_collaborations: [],
            user_hashtags: [],
          },
          {
            _type: 'election',
            id: 'election-rich',
            title: 'Election',
            description: 'Election description',
            created_at: '2026-02-01T00:00:00.000Z',
            updated_at: '2026-02-02T00:00:00.000Z',
            closing_end_time: '2026-02-03T00:00:00.000Z',
            status: 'running',
            role: { group: { id: 'group', name: 'Group' } },
            candidates: [{ id: 'candidate' }],
            agenda_item: { id: 'agenda', event: { id: 'event' } },
          },
          { _type: 'vote', id: 'vote-rich' },
          {
            _type: 'video',
            id: 'video-rich',
            title: 'Video',
            description: 'Video description',
            created_at: 0,
            video_thumbnail_url: 'thumbnail.png',
            image_url: 'fallback.png',
            video_url: 'video.mp4',
            actor: { id: 'actor', first_name: 'Video', last_name: 'Owner', avatar: 'v.png' },
            group: { id: 'group', name: 'Group' },
          },
          {
            _type: 'image',
            id: 'image-rich',
            title: 'Image',
            description: 'Image description',
            created_at: 0,
            image_url: 'image.png',
            actor: { id: 'actor', first_name: 'Image', last_name: 'Owner', avatar: 'i.png' },
            group: { id: 'group', name: 'Group' },
          },
        ] as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(results.map(result => result.type)).toEqual([
        'group',
        'event',
        'amendment',
        'blog',
        'statement',
        'todo',
        'user',
        'election',
        'vote',
        'video',
        'image',
      ]);
      expect(results.find(result => result.type === 'statement')).toMatchObject({
        upvotes: 1,
        downvotes: 1,
        surveyOptions: [
          { label: 'A', voteCount: 1 },
          { label: 'B', voteCount: 0 },
        ],
      });
      expect(results.find(result => result.type === 'amendment')?.description).toBe('Reason');
    });

    it('uses event agenda-map and zero fallbacks when inline agenda items are absent', () => {
      const agendaMap = new Map([
        [
          'event-map',
          [{ election: { id: 'yes' } }, { election: null }, { amendment: { id: 'a' } }],
        ],
      ]);
      const results = mapMosaicToContentItems(
        [
          { _type: 'event', id: 'event-map', title: null, agenda_items: undefined },
          { _type: 'event', id: 'event-zero', title: null, agenda_items: undefined },
        ] as unknown as readonly SearchResultItem[],
        agendaMap
      );

      expect(results.map(result => result.electionsCount)).toEqual([1, 0]);
      expect(
        results.every(result => result.startDate === undefined && result.endDate === undefined)
      ).toBe(true);
    });

    it('maps minimal results through every optional fallback', () => {
      const results = mapMosaicToContentItems(
        [
          {
            _type: 'group',
            id: 'group-minimal',
            name: null,
            member_count: undefined,
            memberships: [{ id: 'member' }],
          },
          {
            _type: 'amendment',
            id: 'amendment-minimal',
            title: null,
            reason: '',
            preamble: 'Fallback preamble',
            current_process_run: null,
          },
          {
            _type: 'blog',
            id: 'blog-minimal',
            title: null,
            bloggers: [
              { status: 'writer', user: null, user_id: null },
              { status: 'writer', user: { id: 'writer', first_name: 'Writer' }, user_id: 'writer' },
            ],
          },
          {
            _type: 'statement',
            id: 'statement-minimal',
            text: null,
            user: { id: 'handle-user', first_name: '', last_name: '', handle: 'fallback-handle' },
            support_votes: undefined,
            upvotes: 4,
            downvotes: undefined,
            surveys: undefined,
          },
          {
            _type: 'statement',
            id: 'statement-missing-names',
            text: '',
            user: { id: 'nameless-user', handle: 'nameless' },
            support_votes: undefined,
            upvotes: undefined,
            downvotes: undefined,
          },
          {
            _type: 'statement',
            id: 'statement-no-user',
            text: '',
            user: null,
            support_votes: undefined,
            upvotes: undefined,
            downvotes: undefined,
          },
          {
            _type: 'todo',
            id: 'todo-minimal',
            title: null,
            status: 'open',
            archived_at: null,
            tags: null,
          },
          {
            _type: 'user',
            id: 'user-derived-location',
            first_name: 'Derived',
            location: { id: 'not-a-string' },
            group_count: undefined,
            group_memberships: [{ id: 'membership' }],
            amendment_count: undefined,
            amendment_collaborations: [{ id: 'collaboration' }],
          },
          {
            _type: 'user',
            id: 'user-no-location-key',
            first_name: 'No Location',
          },
          {
            _type: 'election',
            id: 'election-minimal',
            title: '',
            created_at: null,
            updated_at: null,
            closing_end_time: null,
            candidates: undefined,
            agenda_item: null,
          },
          {
            _type: 'video',
            id: 'video-minimal',
            title: '',
            video_thumbnail_url: '',
            image_url: 'fallback.png',
            actor: null,
            group: null,
          },
          {
            _type: 'image',
            id: 'image-minimal',
            title: '',
            actor: null,
            group: null,
          },
        ] as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(results.find(result => result.id === 'group-minimal')?.memberCount).toBe(1);
      expect(results.find(result => result.id === 'amendment-minimal')?.description).toBe(
        'Fallback preamble'
      );
      expect(results.find(result => result.id === 'blog-minimal')?.authorId).toBe('writer');
      expect(results.find(result => result.id === 'statement-minimal')).toMatchObject({
        authorName: 'fallback-handle',
        upvotes: 4,
        downvotes: 0,
      });
      expect(results.find(result => result.id === 'todo-minimal')?.tags).toEqual([]);
      expect(results.find(result => result.id === 'election-minimal')?.totalCandidates).toBe(0);
      expect(results.find(result => result.id === 'video-minimal')?.imageUrl).toBe('fallback.png');
    });

    it('falls back from a blog owner without a joined user and preserves undefined descriptions', () => {
      const [blog, group] = mapMosaicToContentItems(
        [
          {
            _type: 'blog',
            id: 'blog-owner-id',
            title: 'Blog',
            description: undefined,
            bloggers: [{ status: 'owner', user: null, user_id: 'owner-id' }],
          },
          {
            _type: 'group',
            id: 'group-empty-description',
            name: 'Group',
            description: [],
            member_count: undefined,
            memberships: undefined,
          },
        ] as unknown as readonly SearchResultItem[],
        emptyAgendaMap
      );

      expect(blog.authorId).toBe('owner-id');
      expect(blog.description).toBeUndefined();
      expect(group.description).toBeNull();
      expect(group.memberCount).toBeUndefined();
    });
  });
});
