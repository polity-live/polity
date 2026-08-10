import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import {
  formatTime,
  getConversationDisplay,
  getOtherParticipant,
  getUnreadCount,
  getUnreadMessageCount,
  hasUnreadConversationRequest,
} from '../logic/messageUtils';

const emptyConversation = () => ({
  type: 'direct',
  status: 'accepted',
  requested_by_id: null as string | null,
  created_at: null as number | null,
  messages: [] as { is_read: boolean; sender?: { id?: string | null } | null }[],
  participants: [] as {
    id?: string;
    user_id?: string | null;
    last_read_at?: number | null;
    unread_count?: number | null;
    user?: { id?: string | null; first_name?: string | null; last_name?: string | null } | null;
  }[],
});

describe('message display branch remainder', () => {
  it('covers collective display fallback chains and avatars', () => {
    expect(
      getConversationDisplay({
        type: 'group',
        group: { name: 'Group', image_url: '/g' },
        participants: [],
      })
    ).toMatchObject({ name: 'Group', avatar: '/g', participantCount: 0 });
    expect(
      getConversationDisplay({ type: 'group', name: 'Named group', group: null, participants: [] })
    ).toMatchObject({ name: 'Named group', avatar: null });
    expect(getConversationDisplay({ type: 'group', participants: [] }).name).toBe(
      'features.messages.fallbacks.groupChat'
    );
    expect(
      getConversationDisplay({ type: 'event', event: null, name: 'Named event', participants: [] })
    ).toMatchObject({ name: 'Named event', avatar: null });
    expect(getConversationDisplay({ type: 'event', participants: [] }).name).toBe(
      'features.messages.fallbacks.eventChat'
    );
  });

  it('detects assistants through scalar and nested participants and covers name fallbacks', () => {
    const scalar = getConversationDisplay(
      {
        type: 'direct',
        assistant_for_user_id: 'current',
        name: '  Custom assistant  ',
        participants: [
          { user: { id: 'current' } },
          { user: { id: 'assistant', first_name: 'Aria', last_name: 'Kai', avatar: '/avatar' } },
        ],
      },
      'current'
    );
    expect(scalar.name).toBe('Custom assistant');
    expect(scalar.avatar).toContain('aria-kai-avatar');

    const byUserId = getConversationDisplay(
      { type: 'direct', participants: [{ user_id: ARIA_KAI_USER_ID }] },
      'current'
    );
    expect(byUserId.name).toBe('Assistent Aria & Kai');

    const nested = getConversationDisplay(
      {
        type: 'direct',
        name: '   ',
        participants: [{ user: { id: ARIA_KAI_USER_ID, first_name: 'Aria' } }],
      },
      'current'
    );
    expect(nested.name).toBe('Aria');
  });

  it('covers regular-user display and participant lookup fallbacks', () => {
    const named = {
      user: { id: 'other', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
    };
    expect(
      getConversationDisplay({ participants: [{ user: { id: 'current' } }, named] }, 'current')
    ).toMatchObject({
      name: 'Ada Lovelace',
      handle: 'ada',
    });
    expect(getConversationDisplay({ name: 'Fallback', participants: [] }, 'current').name).toBe(
      'Fallback'
    );
    expect(getConversationDisplay({ participants: [] }, 'current').name).toBe('common.unknownUser');
    expect(getOtherParticipant({ type: 'group', participants: [named] }, 'current')).toBeNull();
    expect(getOtherParticipant({ type: 'event', participants: [named] }, 'current')).toBeNull();
    expect(getOtherParticipant({ type: 'direct', participants: [named] }, 'current')).toEqual(
      named.user
    );
    expect(getOtherParticipant({ type: 'direct', participants: [] }, 'current')).toBeUndefined();
  });

  it('formats current and historic timestamps through both locale paths', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
    expect(formatTime('2026-08-09T10:30:00Z')).toMatch(/12:30/);
    expect(formatTime('2026-08-08T10:30:00Z')).toMatch(/Aug 8/);
    vi.useRealTimers();
  });
});

describe('unread branch remainder', () => {
  it('uses participant unread_count, nested user lookup, and message fallbacks', () => {
    const explicit = emptyConversation();
    explicit.participants = [{ user_id: 'current', unread_count: 0 }];
    expect(getUnreadMessageCount(explicit, 'current')).toBe(0);

    const nested = emptyConversation();
    nested.participants = [{ user: { id: 'current' }, unread_count: 4 }];
    expect(getUnreadMessageCount(nested, 'current')).toBe(4);

    const messages = emptyConversation();
    messages.messages = [
      { is_read: false, sender: null },
      { is_read: false, sender: { id: 'other' } },
      { is_read: false, sender: { id: 'current' } },
      { is_read: true, sender: { id: 'other' } },
    ];
    expect(getUnreadMessageCount(messages)).toBe(2);
    expect(getUnreadMessageCount(messages, 'current')).toBe(2);
  });

  it.each([
    ['missing user', emptyConversation(), undefined],
    ['group', { ...emptyConversation(), type: 'group' }, 'current'],
    ['event', { ...emptyConversation(), type: 'event' }, 'current'],
    ['accepted', emptyConversation(), 'current'],
    [
      'requester',
      { ...emptyConversation(), status: 'pending', requested_by_id: 'current' },
      'current',
    ],
    [
      'missing participant',
      { ...emptyConversation(), status: 'pending', requested_by_id: 'other' },
      'current',
    ],
  ])('rejects request badge for %s', (_name, conversation, userId) => {
    expect(hasUnreadConversationRequest(conversation, userId)).toBe(false);
  });

  it('covers default timestamps and both final request outcomes', () => {
    const request = emptyConversation();
    request.status = 'pending';
    request.requested_by_id = 'other';
    request.participants = [{ user: { id: 'current' }, last_read_at: null }];
    expect(hasUnreadConversationRequest(request, 'current')).toBe(false);

    request.created_at = 100;
    expect(hasUnreadConversationRequest(request, 'current')).toBe(true);
    expect(getUnreadCount(request, 'current')).toBe(1);

    request.participants[0].last_read_at = 100;
    expect(hasUnreadConversationRequest(request, 'current')).toBe(false);
    expect(getUnreadCount(request, 'current')).toBe(0);
  });
});
