/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationHeader } from '../ConversationHeader';
import { ConversationHeaderView } from '../ConversationHeaderView';
import { ConversationItem } from '../ConversationItem';
import { DeleteConversationDialog } from '../DeleteConversationDialog';
import { LinkPreviewCardView } from '../LinkPreviewView';
import { NewConversationDialogView } from '../NewConversationDialogView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const user = {
  id: 'user-2',
  first_name: 'Ada',
  last_name: 'Lovelace',
  handle: 'ada',
  avatar: null,
};

const directConversation = {
  id: 'conversation-1',
  type: 'direct',
  status: 'accepted',
  pinned: false,
  name: null,
  messages: [],
  participants: [
    { user_id: 'user-1', user: { id: 'user-1', first_name: 'Current' } },
    { user_id: user.id, user },
  ],
};

describe('message conversation action contracts', () => {
  it('renames an assistant conversation and exposes information through stable actions', async () => {
    const onRenameConversation = vi.fn().mockResolvedValue(true);
    render(
      <ConversationHeader
        conversation={
          {
            ...directConversation,
            assistant_for_user_id: 'user-1',
            name: 'Research helper',
          } as any
        }
        currentUserId="user-1"
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={onRenameConversation}
      />
    );

    const information = document.querySelector(
      '[data-action-id="messages.conversation.ai-information.open"]'
    ) as HTMLElement;
    expect(information).toBeTruthy();
    information.focus();
    expect(document.activeElement).toBe(information);

    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.open"]')!
    );
    const renameInput = screen.getByDisplayValue('Research helper');
    fireEvent.change(renameInput, { target: { value: 'Policy research' } });
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.save"]')!
    );
    await waitFor(() =>
      expect(onRenameConversation).toHaveBeenCalledWith('conversation-1', 'Policy research')
    );

    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.open"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.cancel"]')!
    );
    expect(screen.queryByDisplayValue('Research helper')).toBeNull();
  });

  it('navigates to conversation entities and opens collective members explicitly', () => {
    const onMembersClick = vi.fn();
    const { rerender } = render(
      <ConversationHeader
        conversation={directConversation as any}
        currentUserId="user-1"
        isOnline
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={onMembersClick}
        onRenameConversation={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(
      document
        .querySelector('[data-action-id="messages.conversation.entity-title.open"]')
        ?.getAttribute('href')
    ).toBe('/user/user-2');
    expect(
      document
        .querySelector('[data-action-id="messages.conversation.entity-avatar.open"]')
        ?.getAttribute('href')
    ).toBe('/user/user-2');

    rerender(
      <ConversationHeader
        conversation={
          {
            ...directConversation,
            type: 'group',
            group: { id: 'group-1', name: 'Council' },
          } as any
        }
        currentUserId="user-1"
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={onMembersClick}
        onRenameConversation={vi.fn().mockResolvedValue(true)}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.members.open"]')!
    );
    expect(onMembersClick).toHaveBeenCalledOnce();
  });

  it('runs header and list-item selection, pin, delete, and back effects', () => {
    const onBack = vi.fn();
    const onTogglePin = vi.fn();
    const onDeleteClick = vi.fn();
    const { rerender } = render(
      <ConversationHeaderView
        {...({
          conversation: directConversation,
          currentUserId: 'user-1',
          onBack,
          onTogglePin,
          onDeleteClick,
          t: (key: string) => key,
          identityContent: <span>Ada</span>,
        } as any)}
      />
    );

    for (const id of ['back', 'pin.toggle', 'delete.open']) {
      const action = document.querySelector(
        `[data-action-id="messages.conversation.${id}"]`
      ) as HTMLElement;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
    }
    expect(onBack).toHaveBeenCalledOnce();
    expect(onTogglePin).toHaveBeenCalledWith('conversation-1', false);
    expect(onDeleteClick).toHaveBeenCalledWith('conversation-1');

    rerender(
      <ConversationHeaderView
        {...({
          conversation: { ...directConversation, pinned: true },
          currentUserId: 'user-1',
          onBack,
          onTogglePin,
          onDeleteClick,
          t: (key: string) => key,
          identityContent: <span>Ada</span>,
        } as any)}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="messages.conversation.pin.toggle"]')!);
    expect(onTogglePin).toHaveBeenLastCalledWith('conversation-1', true);

    const onSelect = vi.fn();
    const onDelete = vi.fn();
    rerender(
      <ConversationItem
        conversation={directConversation as any}
        currentUserId="user-1"
        isOnline={false}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="messages.conversation.select"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.open"]')!
    );
    expect(onSelect).toHaveBeenCalledWith('conversation-1');
    expect(onDelete).toHaveBeenCalledWith('conversation-1');
  });

  it('confirms and cancels deletion without conflating dialog effects', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteConversationDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.cancel"]')!
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<DeleteConversationDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.confirm"]')!
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('selects new-conversation users and preserves link-preview navigation', () => {
    const onUserSelect = vi.fn();
    render(
      <NewConversationDialogView
        open
        onOpenChange={vi.fn()}
        onUserSelect={onUserSelect}
        userSearchQuery="Ada"
        onUserSearchQueryChange={vi.fn()}
        filteredUsers={[user] as any}
        isTargetedSearch
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.new-conversation.user.select"]')!
    );
    expect(onUserSelect).toHaveBeenCalledWith('user-2');

    cleanup();
    render(<LinkPreviewCardView href="/group/group-1" icon={<span>G</span>} title="Council" />);
    const preview = document.querySelector(
      '[data-action-id="messages.link-preview.open"]'
    ) as HTMLAnchorElement;
    expect(preview.getAttribute('href')).toBe('/group/group-1');
    preview.focus();
    expect(document.activeElement).toBe(preview);
  });
});
