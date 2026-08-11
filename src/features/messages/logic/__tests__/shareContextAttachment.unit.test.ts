import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildShareContextAttachment } from '../shareContextAttachment';

const mocks = vi.hoisted(() => ({
  buildAssistantAttachmentOption: vi.fn(),
}));

vi.mock('@/features/messages/logic/assistantComposer', () => ({
  buildAssistantAttachmentOption: (item: unknown) => mocks.buildAssistantAttachmentOption(item),
}));

describe('buildShareContextAttachment', () => {
  beforeEach(() => {
    mocks.buildAssistantAttachmentOption.mockReset();
  });

  it('prefers the attachment derived from a supplied context item', () => {
    const attachment = { entityType: 'group', entityId: 'context-group' };
    const contextItem = { id: 'item-1' };
    mocks.buildAssistantAttachmentOption.mockReturnValue({ attachment });

    expect(
      buildShareContextAttachment({
        shareUrl: '/event/url-event',
        shareTitle: 'Ignored',
        shareContextItem: contextItem as never,
      })
    ).toBe(attachment);
    expect(mocks.buildAssistantAttachmentOption).toHaveBeenCalledWith(contextItem);
  });

  it.each([
    ['/group/group-1/blog/blog-1', 'blog', 'blog-1'],
    ['/user/user-1/blog/blog-2', 'blog', 'blog-2'],
    ['/user/user-1', 'user', 'user-1'],
    ['/group/group-1', 'group', 'group-1'],
    ['/event/event-1?tab=agenda', 'event', 'event-1'],
    ['/amendment/amendment-1#text', 'amendment', 'amendment-1'],
    ['/blog/blog-3', 'blog', 'blog-3'],
    ['/statement/statement-1', 'statement', 'statement-1'],
    ['/todo/todo-1', 'todo', 'todo-1'],
    ['/todos/todo-2', 'todo', 'todo-2'],
    ['/vote/vote-1', 'vote', 'vote-1'],
    ['/election/election-1', 'election', 'election-1'],
  ] as const)('parses %s as a %s attachment', (shareUrl, entityType, entityId) => {
    expect(
      buildShareContextAttachment({
        shareUrl,
        shareTitle: ' Shared title ',
        shareDescription: ' Shared description ',
      })
    ).toEqual({
      entityType,
      entityId,
      title: 'Shared title',
      subtitle: null,
      prompt_context: 'Shared description',
      card_data_json: null,
    });
  });

  it('uses the entity id as title and omits a whitespace-only description', () => {
    expect(
      buildShareContextAttachment({
        shareUrl: 'https://www.polity.live/group/group-9',
        shareTitle: ' ',
        shareDescription: '   ',
      })
    ).toMatchObject({ title: 'group-9', prompt_context: null });
  });

  it('returns null for an unsupported route or an empty context conversion', () => {
    mocks.buildAssistantAttachmentOption.mockReturnValue(undefined);
    expect(
      buildShareContextAttachment({
        shareUrl: '/settings',
        shareTitle: 'Settings',
        shareContextItem: { id: 'unknown' } as never,
      })
    ).toBeNull();
    expect(
      buildShareContextAttachment({ shareUrl: '/event/', shareTitle: 'Missing id' })
    ).toBeNull();
  });
});
