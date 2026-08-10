/* @vitest-environment jsdom */

import type { SearchContentItem } from '@/features/search/types/search.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildTimelineCardProps: vi.fn(),
  toDate: vi.fn((value: string) => new Date(value)),
  translate: vi.fn((key: string) => `translated:${key}`),
}));

vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: mocks.buildTimelineCardProps,
}));

vi.mock('@/features/search/logic/searchMappers', () => ({
  toDate: mocks.toDate,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: mocks.translate,
}));

import {
  ASSISTANT_ATTACHMENT_TYPE_OPTIONS,
  buildAssistantAttachmentOption,
  buildVoteSearchItem,
  getSuggestionAnchorPosition,
  parseActiveMentionQuery,
  parseActiveSkillCommand,
  parseActiveToolCommand,
  replaceTextRange,
  slugifySkillName,
} from '../assistantComposer';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function item(
  type: SearchContentItem['type'],
  overrides: Partial<SearchContentItem> = {}
): SearchContentItem {
  return {
    id: `${type}-1`,
    type,
    title: `${type} title`,
    createdAt,
    ...overrides,
  } as SearchContentItem;
}

describe('assistant attachment options', () => {
  beforeEach(() => {
    mocks.buildTimelineCardProps.mockReset();
    mocks.buildTimelineCardProps.mockReturnValue({
      cardType: 'group',
      cardProps: { stable: true },
    });
  });

  it('publishes all supported attachment tokens with translated labels', () => {
    expect(ASSISTANT_ATTACHMENT_TYPE_OPTIONS.map(option => option.entityType)).toEqual([
      'user',
      'group',
      'statement',
      'event',
      'amendment',
      'blog',
      'todo',
      'vote',
      'election',
    ]);
    expect(
      ASSISTANT_ATTACHMENT_TYPE_OPTIONS.every(option => option.label.startsWith('translated:'))
    ).toBe(true);
  });

  it.each([
    item('user', {
      description: 'User description',
      handle: 'alice',
      location: 'Berlin',
      groupCount: 2,
      amendmentCount: 3,
      tags: ['organizer'],
    }),
    item('group', {
      description: 'Group description',
      memberCount: 12,
      eventCount: 2,
      amendmentCount: 4,
      tags: ['local'],
    }),
    item('statement', {
      description: 'Statement description',
      authorName: 'Ada',
      groupName: 'Council',
      surveyQuestion: 'Agree?',
      tags: ['policy'],
    }),
    item('event', {
      description: 'Event description',
      groupName: 'Council',
      startDate: new Date('2026-02-02T10:00:00.000Z'),
      location: 'Hall',
      electionsCount: 1,
      amendmentsCount: 2,
      tags: ['meeting'],
    }),
    item('amendment', {
      description: 'Amendment description',
      groupName: 'Council',
      status: 'open',
      collaboratorCount: 5,
      changeRequestCount: 2,
      tags: ['motion'],
    }),
    item('blog', {
      description: 'Blog description',
      authorName: 'Grace',
      groupName: 'Council',
      tags: ['news'],
    }),
    item('todo', {
      description: 'Todo description',
      groupName: 'Council',
      dueDate: ' 2026-03-01 ' as unknown as Date,
      assigneeCount: 3,
      tags: ['work'],
    }),
    item('vote', {
      description: 'Vote description',
      status: 'running',
      stats: { reactions: 6, comments: 2 },
      tags: ['decision'],
    }),
    item('election', {
      description: 'Election description',
      groupName: 'Council',
      status: 'nominations',
      totalCandidates: 4,
      tags: ['office'],
    }),
  ])('builds a rich $type option and serializable card payload', candidate => {
    const result = buildAssistantAttachmentOption(candidate);

    expect(result).toMatchObject({
      key: `${candidate.type}:${candidate.id}`,
      entityType: candidate.type,
      label: candidate.title,
    });
    expect(result?.searchText).toContain(candidate.title.toLowerCase());
    expect(result?.searchText).toContain(candidate.description!.toLowerCase());
    expect(JSON.parse(result!.attachment.card_data_json!)).toEqual({
      cardType: 'group',
      cardProps: { stable: true },
    });
    expect(result?.attachment.prompt_context).toContain(String(candidate.description));
  });

  it.each([
    item('user'),
    item('group'),
    item('statement'),
    item('event'),
    item('amendment'),
    item('blog'),
    item('todo'),
    item('vote'),
    item('election'),
  ])('builds a minimal $type option without optional context', candidate => {
    const result = buildAssistantAttachmentOption(candidate);

    expect(result?.attachment.prompt_context).toBeNull();
    expect(result?.searchText).toBe(candidate.title.toLowerCase());
  });

  it('uses fallback subtitle fields and count sources', () => {
    expect(
      buildAssistantAttachmentOption(
        item('user', { handle: null, location: 'Leipzig', description: '', tags: [] })
      )?.subtitle
    ).toBe('Leipzig');
    expect(
      buildAssistantAttachmentOption(
        item('group', { memberCount: undefined, stats: { members: 9 } })
      )?.subtitle
    ).toBe('9 members');
  });

  it('rejects unsupported search results and unusable card mappings', () => {
    expect(buildAssistantAttachmentOption(item('video'))).toBeNull();
    expect(buildAssistantAttachmentOption(item('image'))).toBeNull();

    mocks.buildTimelineCardProps.mockReturnValueOnce({
      cardType: null,
      cardProps: { stable: true },
    });
    expect(buildAssistantAttachmentOption(item('group'))).toBeNull();

    mocks.buildTimelineCardProps.mockReturnValueOnce({
      cardType: 'group',
      cardProps: null,
    });
    expect(buildAssistantAttachmentOption(item('group'))).toBeNull();
  });
});

describe('assistant composer token helpers', () => {
  it('replaces only the selected text range', () => {
    expect(replaceTextRange('hello world', 6, 11, 'Polity')).toBe('hello Polity');
  });

  it('parses plain, typed, unknown, and invalid mention tokens', () => {
    const plainMention = 'Ask @Alice';
    expect(parseActiveMentionQuery(plainMention, plainMention.length)).toEqual({
      start: 4,
      end: plainMention.length,
      raw: '@Alice',
      searchText: 'alice',
    });
    const groupMention = 'Ask @group@Council';
    expect(parseActiveMentionQuery(groupMention, groupMention.length)).toEqual({
      start: 4,
      end: groupMention.length,
      raw: '@group@Council',
      entityType: 'group',
      searchText: 'council',
    });
    const unknownMention = 'Ask @unknown@Test';
    expect(parseActiveMentionQuery(unknownMention, unknownMention.length)).toEqual({
      start: 4,
      end: unknownMention.length,
      raw: '@unknown@Test',
      entityType: undefined,
      searchText: 'test',
    });
    expect(parseActiveMentionQuery('mail@example.org', 16)).toBeNull();
  });

  it('parses skill commands only at the beginning and before arguments', () => {
    const command = '/Create-Event';
    expect(parseActiveSkillCommand(command, command.length)).toEqual({
      start: 0,
      end: command.length,
      raw: command,
      searchText: 'create-event',
    });
    expect(parseActiveSkillCommand(' /create', 8)).toBeNull();
    expect(parseActiveSkillCommand('/create event', 13)).toBeNull();
  });

  it('parses tool tokens after supported boundaries', () => {
    const command = '(#CREATE';
    expect(parseActiveToolCommand(command, command.length)).toEqual({
      start: 1,
      end: command.length,
      raw: '#CREATE',
      searchText: 'create',
    });
    expect(parseActiveToolCommand('abc#tool', 8)).toBeNull();
  });

  it('normalizes skill names and strips surrounding separators', () => {
    expect(slugifySkillName('  --Create Event!  ')).toBe('create-event');
    expect(slugifySkillName('***')).toBe('');
  });
});

describe('assistant suggestion anchor', () => {
  const mirrorRect = { left: 100, top: 50 };
  let markerRect = { left: 110, top: 70 };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const rect = this.tagName === 'SPAN' ? markerRect : mirrorRect;
      return {
        ...rect,
        right: rect.left,
        bottom: rect.top,
        width: 0,
        height: 0,
        x: rect.left,
        y: rect.top,
        toJSON: () => rect,
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function textarea(clientWidth: number): HTMLTextAreaElement {
    const element = document.createElement('textarea');
    Object.defineProperties(element, {
      offsetWidth: { configurable: true, value: clientWidth },
      clientWidth: { configurable: true, value: clientWidth },
      scrollLeft: { configurable: true, value: 2 },
      scrollTop: { configurable: true, value: 3 },
    });
    return element;
  }

  it('rejects indexes outside the current value', () => {
    const element = textarea(400);
    expect(getSuggestionAnchorPosition(element, 'abc', -1)).toBeNull();
    expect(getSuggestionAnchorPosition(element, 'abc', 4)).toBeNull();
  });

  it('returns null when no panel width is available', () => {
    expect(getSuggestionAnchorPosition(textarea(16), '@', 0)).toBeNull();
  });

  it('uses the available width and clamps the left edge', () => {
    markerRect = { left: 90, top: 70 };
    expect(getSuggestionAnchorPosition(textarea(200), '@alice', 1)).toEqual({
      left: 8,
      top: 17,
      width: 184,
    });
  });

  it('caps the panel width and clamps the right edge at an end anchor', () => {
    markerRect = { left: 700, top: 80 };
    expect(getSuggestionAnchorPosition(textarea(500), '@alice', 6)).toEqual({
      left: 132,
      top: 27,
      width: 360,
    });
  });
});

describe('vote search mapping', () => {
  it('uses final decisions, primary text, dates, and voter count', () => {
    const result = buildVoteSearchItem({
      id: 'vote-1',
      title: 'Budget',
      description: 'Approve it',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      closing_end_time: '2026-01-03T00:00:00.000Z',
      status: 'closed',
      choices: [{ id: 'yes' }, { id: 'no' }],
      final_decisions: [
        { choice: { id: 'yes' } },
        { choice_id: 'no' },
        { choice: null, choice_id: 'other' },
      ],
      indicative_decisions: [{ choice_id: 'yes' }, { choice_id: 'no' }],
      amendment: null,
      agenda_item: { id: 'agenda-1', event: { id: 'event-1' } },
      voters: [{ id: 'user-1' }, { id: 'user-2' }],
    } as never);

    expect(result).toMatchObject({
      id: 'vote-1',
      title: 'Budget',
      description: 'Approve it',
      status: 'closed',
      agendaEventId: 'event-1',
      agendaItemId: 'agenda-1',
      stats: { reactions: 1, comments: 1, members: 2 },
    });
    expect(result.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(result.endDate).toEqual(new Date('2026-01-03T00:00:00.000Z'));
  });

  it('falls back to indicative decisions and amendment text', () => {
    const result = buildVoteSearchItem({
      id: 'vote-2',
      title: '',
      description: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: null,
      closing_end_time: null,
      status: null,
      choices: [{ id: 'yes' }, { id: 'no' }],
      final_decisions: [],
      indicative_decisions: [
        { choice_id: 'yes' },
        { choice: { id: 'no' } },
        { choice: { id: 'different' }, choice_id: 'different' },
      ],
      amendment: { title: 'Amendment title', reason: 'Because', preamble: 'Whereas' },
      agenda_item: null,
      voters: null,
    } as never);

    expect(result).toMatchObject({
      title: 'Amendment title',
      description: 'Because',
      updatedAt: undefined,
      endDate: undefined,
      agendaEventId: undefined,
      agendaItemId: undefined,
      stats: { reactions: 1, comments: 1, members: undefined },
    });
  });

  it('uses translated and preamble fallbacks when choices and decisions are absent', () => {
    const result = buildVoteSearchItem({
      id: 'vote-3',
      title: null,
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: null,
      closing_end_time: null,
      status: null,
      choices: undefined,
      final_decisions: undefined,
      indicative_decisions: undefined,
      amendment: { title: '', reason: '', preamble: 'Preamble' },
      agenda_item: { id: 'agenda-3', event: null },
      voters: undefined,
    } as never);

    expect(result.title).toBe('translated:common.entities.vote');
    expect(result.description).toBe('Preamble');
    expect(result.stats).toEqual({ reactions: 0, comments: 0, members: undefined });
  });
});
