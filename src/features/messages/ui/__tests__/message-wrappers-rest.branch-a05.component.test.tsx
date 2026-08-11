/* @vitest-environment jsdom */

import React, { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  inputController: null as any,
  listController: {} as any,
  dialogController: {} as any,
  inputArgs: vi.fn(),
  listArgs: vi.fn(),
  dialogArgs: vi.fn(),
  messageViewProps: null as any,
}));

vi.mock('../useMessageInputController', () => ({
  useMessageInputController: (args: any) => {
    state.inputArgs(args);
    return state.inputController;
  },
}));
vi.mock('../MessageInputView', () => ({
  MessageInputView: (props: any) => <div data-testid="message-input-view">{props.label}</div>,
}));
vi.mock('../useMessageListController', () => ({
  useMessageListController: (args: any) => {
    state.listArgs(args);
    return state.listController;
  },
}));
vi.mock('../MessageListView', () => ({
  MessageListView: (props: any) => <div data-testid="message-list-view">{props.label}</div>,
}));
vi.mock('../../hooks/useNewConversationDialogController', () => ({
  useNewConversationDialogController: (args: any) => {
    state.dialogArgs(args);
    return state.dialogController;
  },
}));
vi.mock('../NewConversationDialogView', () => ({
  NewConversationDialogView: (props: any) => (
    <div data-testid="new-dialog-view">{String(props.open)}</div>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  CardContent: ({ children, separator: _separator, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/shared/ui/feed', () => ({
  FeedSplitLayout: ({ children, ...props }: any) => (
    <div data-testid="feed" {...props}>
      {children}
    </div>
  ),
}));
vi.mock('../ConversationList', () => ({ ConversationList: () => <div>conversation-list</div> }));
vi.mock('../MessageView', () => ({
  MessageView: (props: any) => {
    state.messageViewProps = props;
    return <div>message-view</div>;
  },
}));
vi.mock('../GroupMembersDialog', () => ({ GroupMembersDialog: () => <div>members-dialog</div> }));
vi.mock('../DeleteConversationDialog', () => ({
  DeleteConversationDialog: () => <div>delete-dialog</div>,
}));

import { ChatComposer } from '../ChatComposer';
import { MessageInput } from '../MessageInput';
import { MessageList } from '../MessageList';
import { MessagesPageView, type MessagesPageViewProps } from '../MessagesPageView';
import { NewConversationDialog } from '../NewConversationDialog';

beforeEach(() => {
  vi.clearAllMocks();
  state.inputController = null;
  state.listController = { label: 'list' };
  state.dialogController = { users: [] };
  state.messageViewProps = null;
});
afterEach(cleanup);

describe('message wrapper branches', () => {
  it('sizes a mounted composer and covers all optional regions/defaults', () => {
    const absentRef = createRef<HTMLTextAreaElement>();
    const absent = render(
      <ChatComposer value="" textareaRef={absentRef} onSubmit={vi.fn()}>
        <span>no textarea</span>
      </ChatComposer>
    );
    absent.unmount();
    const ref = createRef<HTMLTextAreaElement>();
    const view = render(
      <ChatComposer value="" textareaRef={ref} onSubmit={vi.fn()}>
        <textarea ref={ref} />
      </ChatComposer>
    );
    Object.defineProperty(ref.current!, 'scrollHeight', { configurable: true, value: 200 });
    view.rerender(
      <ChatComposer
        value="large"
        textareaRef={ref}
        onSubmit={vi.fn()}
        chips={<span>chips</span>}
        toolbar={<span>toolbar</span>}
        helper={<span>helper</span>}
        className="custom"
        minTextareaHeight={20}
      >
        <textarea ref={ref} />
      </ChatComposer>
    );
    expect(ref.current?.style.height).toBe('176px');
    expect(ref.current?.style.overflowY).toBe('auto');
    expect(screen.getByText('chips')).toBeTruthy();
    Object.defineProperty(ref.current!, 'scrollHeight', { configurable: true, value: 10 });
    view.rerender(
      <ChatComposer value="small" textareaRef={ref} onSubmit={vi.fn()} minTextareaHeight={44}>
        <textarea ref={ref} />
      </ChatComposer>
    );
    expect(ref.current?.style.height).toBe('44px');
    expect(ref.current?.style.overflowY).toBe('hidden');
  });

  it('returns null or the input view and forwards list defaults/overrides', () => {
    const conversation = { id: 'conversation' } as never;
    const view = render(<MessageInput conversation={conversation} onSendMessage={vi.fn()} />);
    expect(view.container.textContent).toBe('');
    state.inputController = { label: 'input' };
    view.rerender(
      <MessageInput conversation={conversation} currentUserId="user" onSendMessage={vi.fn()} />
    );
    expect(screen.getByTestId('message-input-view').textContent).toBe('input');

    view.rerender(
      <MessageList
        conversation={conversation}
        onAcceptConversation={vi.fn()}
        onRejectConversation={vi.fn()}
      />
    );
    expect(state.listArgs.mock.calls.at(-1)?.[0].hasMoreOlderMessages).toBe(false);
    view.rerender(
      <MessageList
        conversation={conversation}
        hasMoreOlderMessages
        onAcceptConversation={vi.fn()}
        onRejectConversation={vi.fn()}
      />
    );
    expect(state.listArgs.mock.calls.at(-1)?.[0].hasMoreOlderMessages).toBe(true);
  });

  it('forwards dialog defaults and explicit exclusions', () => {
    const view = render(
      <NewConversationDialog open onOpenChange={vi.fn()} onUserSelect={vi.fn()} />
    );
    expect(state.dialogArgs.mock.calls.at(-1)?.[0].existingConversationUserIds).toEqual([]);
    view.rerender(
      <NewConversationDialog
        open={false}
        onOpenChange={vi.fn()}
        onUserSelect={vi.fn()}
        existingConversationUserIds={['user']}
      />
    );
    expect(state.dialogArgs.mock.calls.at(-1)?.[0].existingConversationUserIds).toEqual(['user']);
  });

  it('toggles all page dialogs and executes inline MessageView actions', () => {
    const props: MessagesPageViewProps = {
      isLoading: false,
      filteredConversations: [],
      conversationOnlineStatus: {},
      selectedConversationId: null,
      onSelectConversation: vi.fn(),
      selectedMessages: [],
      hasMoreOlderMessages: false,
      onLoadOlderMessages: vi.fn(),
      onAtEndChange: vi.fn(),
      selectedConversationUserOnline: false,
      searchQuery: '',
      onSearchChange: vi.fn(),
      conversationFilter: 'all' as never,
      onConversationFilterChange: vi.fn(),
      conversationSwipeHandlers: {} as never,
      existingConversationUserIds: [],
      userSearchDialogOpen: false,
      onUserSearchDialogOpenChange: vi.fn(),
      newConversationSearch: '',
      memberListDialogOpen: false,
      onMemberListDialogOpenChange: vi.fn(),
      deleteDialogOpen: false,
      onDeleteDialogOpenChange: vi.fn(),
      isCancelRequest: false,
      onTogglePin: vi.fn(),
      onCreateConversationRequest: vi.fn(),
      onDeleteConversation: vi.fn(),
      onAcceptConversation: vi.fn(),
      onRejectConversation: vi.fn(),
      onSendMessage: vi.fn(),
      onNewConversationClick: vi.fn(),
      onNewAiConversationClick: vi.fn(),
      onDeleteConversationClick: vi.fn(),
      onRenameConversation: vi.fn(),
    };
    const view = render(<MessagesPageView {...props} />);
    expect(screen.queryByTestId('new-dialog-view')).toBeNull();
    state.messageViewProps.onBack();
    state.messageViewProps.onMembersClick();
    expect(props.onSelectConversation).toHaveBeenCalledWith(null);
    expect(props.onMemberListDialogOpenChange).toHaveBeenCalledWith(true);
    view.rerender(
      <MessagesPageView {...props} userSearchDialogOpen memberListDialogOpen deleteDialogOpen />
    );
    expect(screen.getByTestId('new-dialog-view')).toBeTruthy();
    expect(screen.getByText('members-dialog')).toBeTruthy();
    expect(screen.getByText('delete-dialog')).toBeTruthy();
  });
});
