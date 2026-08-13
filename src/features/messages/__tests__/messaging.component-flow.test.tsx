/* @vitest-environment jsdom */

import { createRef, useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { ConversationListView } from '../ui/ConversationListView';
import { MessageInputView } from '../ui/MessageInputView';

const t = (key: string) =>
  ({
    'features.messages.title': 'Messages',
    'features.messages.searchConversations': 'Search conversations',
    'features.messages.compose.startNewChat': 'New conversation',
    'features.messages.compose.startNewAi': 'New AI conversation',
    'features.messages.filters.all': 'All',
    'features.messages.noConversations': 'No conversations',
    'features.messages.noConversationsFound': 'No conversations found',
    'features.messages.compose.messagePlaceholder': 'Write a message',
    'features.messages.compose.uploadFiles': 'Upload files',
    'features.messages.compose.attachmentHelperText': 'Add context',
    'common.send': 'Send',
  })[key] ?? key;

function MessageComposerFlow({ onSend }: { onSend: (message: string) => void }) {
  const [messageText, setMessageText] = useState('');
  const textareaRef = createRef<HTMLTextAreaElement>();
  return (
    <MessageInputView
      conversation={{ status: 'active' }}
      currentUserId="user-current"
      onSendMessage={onSend}
      t={t}
      textareaRef={textareaRef}
      attachments={{
        selectedAttachments: [],
        isUploadingAttachments: false,
        uploadingAttachmentName: null,
        removeAttachment: vi.fn(),
        addUploadedFiles: vi.fn(),
      }}
      messageText={messageText}
      setMessageText={setMessageText}
      caretPosition={0}
      setCaretPosition={vi.fn()}
      suggestionAnchorPosition={null}
      setSuggestionAnchorPosition={vi.fn()}
      textareaScrollVersion={0}
      setTextareaScrollVersion={vi.fn()}
      mentionQuery={null}
      selectedAttachmentKeys={new Set()}
      attachmentTypeSuggestions={[]}
      attachmentSuggestions={[]}
      hasSuggestionPanel={false}
      updateCaretPosition={vi.fn()}
      moveCaret={vi.fn()}
      applyMessageReplacement={vi.fn()}
      handleAttachmentTypeSelect={vi.fn()}
      handleAttachmentSelect={vi.fn()}
      handleSendMessage={() => {
        onSend(messageText.trim());
        setMessageText('');
      }}
      otherUser={null}
      otherParticipantName="Other"
      isPendingDirectConversation={false}
      isConversationRequester={false}
    />
  );
}

function ConversationFlow() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const conversation = {
    id: 'conversation-1',
    type: 'direct',
    status: 'active',
    created_at: 1,
    pinned: false,
    messages: [{ content: 'Persisted hello', created_at: 1, is_read: true }],
    participants: [
      { user_id: 'user-current', user: { id: 'user-current' }, unread_count: 0 },
      {
        user_id: 'user-other',
        user: { id: 'user-other', first_name: 'Ada', last_name: 'Lovelace' },
      },
    ],
  };
  const visible =
    searchQuery && !'Ada Lovelace'.toLowerCase().includes(searchQuery.toLowerCase())
      ? []
      : [conversation];
  return (
    <>
      <ConversationListView
        className=""
        conversationFilter="all"
        conversationOnlineStatus={{ 'conversation-1': true }}
        conversations={visible}
        currentUserId="user-current"
        filterButtons={['all']}
        onConversationFilterChange={vi.fn()}
        onDeleteConversationClick={vi.fn()}
        onNewAiConversationClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onSearchChange={setSearchQuery}
        onSelectConversation={setSelectedConversationId}
        virtualItems={visible.map((row, index) => ({ key: row.id, index, row }))}
        spaceBefore={0}
        spaceAfter={0}
        rowsEmpty={visible.length === 0}
        scrollRef={createRef<HTMLDivElement>()}
        searchQuery={searchQuery}
        selectedConversationId={selectedConversationId}
        t={t}
      />
      <output aria-label="selected conversation">{selectedConversationId ?? 'none'}</output>
    </>
  );
}

afterEach(cleanup);

describe('messaging component flow', () => {
  it('sends a composed message and resets the composer', () => {
    const onSend = vi.fn();
    renderComponentFlow(<MessageComposerFlow onSend={onSend} />);
    fireEvent.change(screen.getByPlaceholderText('Write a message'), {
      target: { value: '  Hello across components  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Hello across components');
    expect((screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement).value).toBe('');
  });

  it('switches to a selected thread through the rendered conversation row', () => {
    renderComponentFlow(<ConversationFlow />);
    fireEvent.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
    expect(screen.getByLabelText('selected conversation').textContent).toBe('conversation-1');
  });

  it('filters conversations and renders the observable empty result', () => {
    renderComponentFlow(<ConversationFlow />);
    fireEvent.change(screen.getByPlaceholderText('Search conversations'), {
      target: { value: 'missing' },
    });
    expect(screen.getByText('No conversations found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ada Lovelace/ })).toBeNull();
  });
});
