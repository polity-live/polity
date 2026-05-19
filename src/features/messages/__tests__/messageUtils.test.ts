import { describe, expect, it } from 'vitest';
import {
  getConversationDisplay,
  getUnreadCount,
  hasUnreadConversationRequest,
} from '../logic/messageUtils';

const createConversation = (overrides: Partial<Parameters<typeof getUnreadCount>[0]> = {}) => ({
  type: 'direct',
  status: 'accepted',
  requested_by_id: 'user-b',
  created_at: 100,
  participants: [
    {
      user_id: 'user-a',
      last_read_at: 0,
      user: { id: 'user-a' },
    },
    {
      user_id: 'user-b',
      last_read_at: 0,
      user: { id: 'user-b' },
    },
  ],
  messages: [],
  ...overrides,
});

describe('getUnreadCount', () => {
  it('counts unread messages from other users', () => {
    expect(
      getUnreadCount(
        createConversation({
          messages: [
            { is_read: false, sender: { id: 'user-b' } },
            { is_read: false, sender: { id: 'user-a' } },
            { is_read: true, sender: { id: 'user-b' } },
          ],
        }),
        'user-a'
      )
    ).toBe(1);
  });

  it('adds one unread badge for an incoming pending conversation request', () => {
    const conversation = createConversation({
      status: 'pending',
      requested_by_id: 'user-b',
      created_at: 200,
      participants: [
        {
          user_id: 'user-a',
          last_read_at: 100,
          user: { id: 'user-a' },
        },
        {
          user_id: 'user-b',
          last_read_at: 0,
          user: { id: 'user-b' },
        },
      ],
    });

    expect(hasUnreadConversationRequest(conversation, 'user-a')).toBe(true);
    expect(getUnreadCount(conversation, 'user-a')).toBe(1);
  });

  it('clears the request badge after the recipient read timestamp passes the request', () => {
    const conversation = createConversation({
      status: 'pending',
      requested_by_id: 'user-b',
      created_at: 200,
      participants: [
        {
          user_id: 'user-a',
          last_read_at: 250,
          user: { id: 'user-a' },
        },
        {
          user_id: 'user-b',
          last_read_at: 0,
          user: { id: 'user-b' },
        },
      ],
    });

    expect(hasUnreadConversationRequest(conversation, 'user-a')).toBe(false);
    expect(getUnreadCount(conversation, 'user-a')).toBe(0);
  });

  it('returns collective display details for event conversations', () => {
    const display = getConversationDisplay(
      createConversation({
        type: 'event',
        name: null,
        event: {
          id: 'event-1',
          title: 'Town Hall',
          image_url: 'https://example.com/town-hall.png',
        },
      }),
      'user-a'
    );

    expect(display.name).toBe('Town Hall');
    expect(display.avatar).toBe('https://example.com/town-hall.png');
    expect(display.isEvent).toBe(true);
    expect(display.isCollective).toBe(true);
    expect(display.participantCount).toBe(2);
  });
});
