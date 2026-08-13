// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationHeader } from '../ConversationHeader';
import { ConversationItem } from '../ConversationItem';
import { ConversationList } from '../ConversationList';

const mocks = vi.hoisted(() => ({
  display: {} as any,
  other: null as any,
  unread: 0,
  assistant: false,
  headerProps: null as any,
  listProps: null as any,
  virtualOptions: null as any,
  virtual: { items: [], spaceBefore: 0, spaceAfter: 0, rowsEmpty: true } as any,
  mobile: false,
  page: vi.fn(),
  single: vi.fn(),
}));

vi.mock('../../logic/messageUtils', () => ({
  getConversationDisplay: () => mocks.display,
  getOtherParticipant: () => mocks.other,
  getUnreadCount: () => mocks.unread,
  formatTime: (value: unknown) => `time:${String(value)}`,
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (value: unknown) => value,
}));
vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantConversation: () => mocks.assistant,
}));
vi.mock('../ConversationHeaderView', () => ({
  ConversationHeaderView: (props: any) => {
    mocks.headerProps = props;
    return <div>{props.identityContent}</div>;
  },
}));
vi.mock('../ConversationListView', () => ({
  ConversationListView: (props: any) => {
    mocks.listProps = props;
    return <div>list-view</div>;
  },
}));
vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => mocks.mobile,
}));
vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroList: (options: any) => {
    mocks.virtualOptions = options;
    return mocks.virtual;
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    messages: {
      conversationPage: (...args: any[]) => mocks.page(...args),
      conversationById: (...args: any[]) => mocks.single(...args),
    },
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <i data-src={src} />,
  AvatarFallback: ({ children }: any) => <b>{children}</b>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
  StatusDotIndicator: () => <i data-testid="online" />,
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input aria-label="rename" {...props} />,
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children }: any) => <>{children}</>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation',
    type: 'direct',
    name: null,
    pinned: false,
    tutorial_run_id: null,
    messages: [],
    participants: [],
    ...overrides,
  } as any;
}

function listProps(overrides: Record<string, unknown> = {}) {
  return {
    conversations: [],
    conversationOnlineStatus: {},
    selectedConversationId: null,
    onSelectConversation: vi.fn(),
    searchQuery: ' query ',
    onSearchChange: vi.fn(),
    conversationFilter: 'all',
    onConversationFilterChange: vi.fn(),
    onNewConversationClick: vi.fn(),
    onNewAiConversationClick: vi.fn(),
    onDeleteConversationClick: vi.fn(),
    ...overrides,
  } as any;
}

describe('conversation item, header and list branches', () => {
  beforeEach(() => {
    mocks.display = {
      name: '',
      avatar: '',
      isCollective: false,
      isEvent: false,
      isGroup: false,
      participantCount: 0,
      handle: null,
    };
    mocks.other = null;
    mocks.unread = 0;
    mocks.assistant = false;
    mocks.mobile = false;
    mocks.virtual = { items: [], spaceBefore: 0, spaceAfter: 0, rowsEmpty: true };
    mocks.page.mockReset().mockReturnValue('page');
    mocks.single.mockReset().mockReturnValue('single');
  });
  afterEach(cleanup);

  it('covers conversation-item optional status, preview, unread and deletion variants', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const rendered = render(
      <ConversationItem
        conversation={conversation()}
        isOnline={false}
        isSelected={false}
        onSelect={onSelect}
      />
    );
    expect(document.body.textContent).toContain('U');

    mocks.display = {
      name: 'Event',
      avatar: '/avatar',
      isCollective: false,
      isEvent: true,
      participantCount: 4,
    };
    mocks.unread = 120;
    rendered.rerender(
      <ConversationItem
        conversation={conversation({
          pinned: true,
          tutorial_run_id: 'run',
          messages: [{ created_at: 1, content: 'x'.repeat(41) }],
        })}
        currentUserId="viewer"
        isOnline
        isSelected
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );
    expect(document.body.textContent).toContain('99+');
    expect(document.body.textContent).toContain('...');
    expect(screen.getByTestId('online')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="messages.conversation.select"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.open"]')!
    );
    expect(onSelect).toHaveBeenCalledWith('conversation');
    expect(onDelete).toHaveBeenCalledWith('conversation');

    mocks.display = { name: 'Collective', isCollective: true, isEvent: false };
    mocks.unread = 1;
    rendered.rerender(
      <ConversationItem
        conversation={conversation({ type: 'group', messages: [{ created_at: 2, content: null }] })}
        isOnline
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );
    expect(document.body.textContent).toContain('1');
    expect(screen.queryByTestId('online')).toBeNull();
    expect(
      document.querySelector('[data-action-id="messages.conversation.delete.open"]')
    ).toBeNull();
    rendered.rerender(
      <ConversationItem
        conversation={conversation({ type: 'event' })}
        isOnline={false}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );
    rendered.rerender(
      <ConversationItem
        conversation={conversation()}
        isOnline={false}
        isSelected={false}
        onSelect={onSelect}
        onDelete={undefined}
      />
    );
  });

  it('configures virtual conversation paging and mobile permalink behavior', () => {
    const rendered = render(
      <ConversationList {...listProps({ selectedConversationId: 'selected' })} />
    );
    expect(mocks.listProps.isLoading).toBe(false);
    expect(mocks.virtualOptions.permalinkID).toBe('selected');
    expect(mocks.virtualOptions.getScrollElement()).toBeNull();
    expect(mocks.virtualOptions.estimateSize()).toBe(92);
    expect(mocks.virtualOptions.getRowKey({ id: 'row' })).toBe('row');
    expect(
      mocks.virtualOptions.toStartRow({ id: 'row', pinned: null, last_message_at: null })
    ).toEqual({ id: 'row', pinned: null, last_message_at: null });
    expect(
      mocks.virtualOptions.getPageQuery({ limit: 5, start: null, dir: 'older', settled: true })
    ).toEqual({ query: 'page', options: { ttl: '5m' } });
    expect(
      mocks.virtualOptions.getPageQuery({ limit: 5, start: null, dir: 'older', settled: false })
    ).toEqual({ query: 'page', options: { ttl: 'none' } });
    expect(mocks.virtualOptions.getSingleQuery({ id: 'row', settled: true })).toEqual({
      query: 'single',
      options: { ttl: '5m' },
    });
    expect(mocks.virtualOptions.getSingleQuery({ id: 'row', settled: false })).toEqual({
      query: 'single',
      options: { ttl: 'none' },
    });

    mocks.mobile = true;
    rendered.rerender(
      <ConversationList {...listProps({ selectedConversationId: 'selected', isLoading: true })} />
    );
    expect(mocks.virtualOptions.permalinkID).toBeUndefined();
    mocks.mobile = false;
    rendered.rerender(<ConversationList {...listProps({ selectedConversationId: null })} />);
    expect(mocks.virtualOptions.permalinkID).toBeUndefined();
  });

  it('derives direct, group, event and AI header state and completes rename flows', async () => {
    const rename = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    mocks.display = {
      name: 'Direct',
      avatar: '',
      isCollective: false,
      isGroup: false,
      isEvent: false,
      handle: 'direct',
    };
    mocks.other = { id: 'other' };
    const rendered = render(
      <ConversationHeader
        conversation={conversation()}
        currentUserId="viewer"
        isOnline
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={rename}
      />
    );
    expect(mocks.headerProps.userHref).toBe('/user/other');
    expect(screen.getAllByRole('link')).toHaveLength(2);

    mocks.assistant = true;
    mocks.display = {
      name: 'AI',
      avatar: '',
      isCollective: false,
      isGroup: false,
      isEvent: false,
      handle: null,
    };
    rendered.rerender(
      <ConversationHeader
        conversation={conversation({ name: '  Custom  ' })}
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={rename}
      />
    );
    expect(mocks.headerProps.userHref).toBeNull();
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.open"]')!
    );
    const input = screen.getByLabelText('rename');
    fireEvent.change(input, { target: { value: ' New name ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => undefined);
    expect(rename).toHaveBeenCalledWith('conversation', 'New name');
    fireEvent.keyDown(screen.getByLabelText('rename'), { key: 'Escape' });

    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.open"]')!
    );
    fireEvent.change(screen.getByLabelText('rename'), { target: { value: '   ' } });
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.save"]')!
    );
    await act(async () => undefined);
    expect(rename).toHaveBeenCalledWith('conversation', null);

    mocks.assistant = false;
    mocks.display = {
      name: 'Group',
      isCollective: true,
      isGroup: true,
      isEvent: false,
      participantCount: 2,
    };
    rendered.rerender(
      <ConversationHeader
        conversation={conversation({ id: 'group-conversation', group: { id: 'group' } })}
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={rename}
      />
    );
    expect(mocks.headerProps.groupHref).toBe('/group/group');
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.members.open"]')!
    );
    mocks.display = {
      name: 'Event',
      isCollective: true,
      isGroup: false,
      isEvent: true,
      participantCount: 1,
    };
    rendered.rerender(
      <ConversationHeader
        conversation={conversation({ id: 'event-conversation', event: { id: 'event' } })}
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={rename}
      />
    );
    expect(mocks.headerProps.eventHref).toBe('/event/event');

    rendered.unmount();
    mocks.assistant = true;
    mocks.display = { name: '', isCollective: false, isGroup: false, isEvent: false };
    render(
      <ConversationHeader
        conversation={conversation({ name: '   ' })}
        isOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={rename}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.open"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.rename.cancel"]')!
    );
  });
});
