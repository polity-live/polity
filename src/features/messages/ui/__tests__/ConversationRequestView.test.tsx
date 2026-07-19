/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationHeaderView } from '../ConversationHeaderView';
import { MessageListView } from '../MessageListView';

afterEach(cleanup);

const translate = (key: string, params?: { name?: string }) => {
  if (key.endsWith('waitingForAccept')) return `Waiting for ${params?.name}`;
  if (key.endsWith('wantsToStart')) return `${params?.name} wants to start`;
  if (key.endsWith('accept')) return 'Accept';
  if (key.endsWith('reject')) return 'Decline';
  if (key.endsWith('cancelRequest')) return 'Cancel request';
  if (key.endsWith('delete')) return 'Delete conversation';
  return key;
};

const pendingConversation = {
  id: 'conversation-1',
  type: 'direct',
  status: 'pending',
  requested_by_id: 'user-sender',
};

function renderRequest(currentUserId: string) {
  const props = {
    conversation: pendingConversation,
    currentUserId,
    onAcceptConversation: vi.fn(),
    onRejectConversation: vi.fn(),
    resolveAttachmentCardData: undefined,
    streamingAssistantMessage: undefined,
    t: translate,
    scrollRef: { current: null },
    hasNewMessages: false,
    displayMessages: [],
    otherUser: null,
    otherParticipantName: 'Mina Bauer',
    virtualRows: [{ type: 'conversation-request', key: 'conversation-request' }],
    spaceBefore: 0,
    spaceAfter: 0,
    rowsEmpty: false,
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
  };

  render(<MessageListView {...(props as any)} />);
}

describe('pending conversation request UI', () => {
  it('shows the waiting state without decision buttons to the sender', () => {
    renderRequest('user-sender');

    expect(screen.getByText('Waiting for Mina Bauer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
  });

  it('shows accept and decline to the recipient', () => {
    renderRequest('user-recipient');

    expect(screen.getByText('Mina Bauer wants to start')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('hides delete from the recipient but keeps cancel for the sender', () => {
    const props = {
      conversation: pendingConversation,
      onBack: vi.fn(),
      onTogglePin: vi.fn(),
      onDeleteClick: vi.fn(),
      t: translate,
      identityContent: <span>Mina Bauer</span>,
    };

    const { rerender } = render(
      <ConversationHeaderView {...(props as any)} currentUserId="user-recipient" />
    );
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();

    rerender(<ConversationHeaderView {...(props as any)} currentUserId="user-sender" />);
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeTruthy();
  });
});
