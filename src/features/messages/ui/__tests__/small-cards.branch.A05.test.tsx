// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiFindingsCardGroup } from '../AiFindingsCardGroup';
import { AssistantMessageView } from '../AssistantMessageView';
import { DeleteConversationDialog } from '../DeleteConversationDialog';
import { GroupMembersDialog } from '../GroupMembersDialog';
import { LinkPreviewCardView, LinkPreviewSkeleton } from '../LinkPreviewView';
import { BlogSearchCard } from '@/features/search/ui/BlogSearchCard';

const mocks = vi.hoisted(() => ({
  assistant: {} as any,
  assistantViewProps: null as any,
  blogProps: null as any,
  hashtags: [] as string[],
}));

vi.mock('@/features/messages/hooks/useAssistantChat', () => ({
  useAssistantChat: () => mocks.assistant,
}));
vi.mock('../AssistantMessageContentView', () => ({
  AssistantMessageContentView: (props: any) => {
    mocks.assistantViewProps = props;
    return <div>assistant-view</div>;
  },
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <>{children}</>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <i data-src={src} />,
  AvatarFallback: ({ children }: any) => <b>{children}</b>,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: any) => <a href={`/group/${params.id}`}>{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: any) =>
      key === 'features.messages.groupMembers.description'
        ? values?.name === '__GROUP_NAME__'
          ? 'Members of __GROUP_NAME__ are shown'
          : `Members of ${values?.name} are shown`
        : values?.count
          ? `${key}:${values.count}`
          : key,
  }),
}));
vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/users/ui/BlogsCard', () => ({
  BlogsCard: (props: any) => {
    mocks.blogProps = props;
    return <div>blog-card</div>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ hashtags }: any) => <div>{hashtags.join(',')}</div>,
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtags: () => mocks.hashtags,
}));

afterEach(cleanup);

describe('small message-card branch coverage', () => {
  beforeEach(() => {
    mocks.assistant = {
      streamingText: '',
      isThinking: false,
      isToolCalling: false,
      streamError: null,
      activeToolCall: null,
    };
    mocks.assistantViewProps = null;
    mocks.blogProps = null;
    mocks.hashtags = [];
  });

  it('projects absent and every active assistant streaming state', () => {
    const conversation = { id: 'conversation' } as any;
    const rendered = render(
      <AssistantMessageView
        conversation={conversation}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={vi.fn(async () => true)}
        onAcceptConversation={vi.fn()}
        onRejectConversation={vi.fn()}
      />
    );
    expect(mocks.assistantViewProps.streamingAssistantMessage).toBeUndefined();

    for (const state of [
      { streamingText: 'stream' },
      { isThinking: true },
      { isToolCalling: true, activeToolCall: { preview: 'preview' } },
      { streamError: 'failed', activeToolCall: {} },
    ]) {
      mocks.assistant = { ...mocks.assistant, ...state };
      rendered.rerender(
        <AssistantMessageView
          conversation={conversation}
          onBack={vi.fn()}
          onTogglePin={vi.fn()}
          onDeleteClick={vi.fn()}
          onMembersClick={vi.fn()}
          onRenameConversation={vi.fn(async () => true)}
          onAcceptConversation={vi.fn()}
          onRejectConversation={vi.fn()}
        />
      );
      expect(mocks.assistantViewProps.streamingAssistantMessage).toBeTruthy();
    }
    expect(mocks.assistantViewProps.streamingAssistantMessage.toolPreview).toBeNull();
  });

  it('renders group, event, named, fallback and absent participant variants', () => {
    const onOpenChange = vi.fn();
    const rendered = render(
      <GroupMembersDialog
        open
        onOpenChange={onOpenChange}
        conversation={
          {
            group: { id: 'group', name: 'Group' },
            participants: [
              {
                id: 'one',
                user: { first_name: 'alice', last_name: 'Example', handle: 'alice', avatar: null },
              },
              { id: 'two', user: { first_name: null, last_name: null, handle: null } },
            ],
          } as any
        }
      />
    );
    expect(screen.getByRole('link', { name: 'Group' })).toBeTruthy();
    expect(document.body.textContent).toContain('alice Example');
    expect(document.body.textContent).toContain('common.labels.unspecifiedUser');

    for (const conversation of [
      { event: { title: 'Event' }, participants: [] },
      { name: 'Named', participants: [] },
      { participants: [] },
      undefined,
    ]) {
      rendered.rerender(
        <GroupMembersDialog open onOpenChange={onOpenChange} conversation={conversation as any} />
      );
    }
    expect(document.body.textContent).toContain('features.messages.groupMembers.defaultGroupName');
  });

  it('renders all optional link-preview slots and their absent variants', () => {
    const rendered = render(<LinkPreviewCardView href="/one" icon="icon" title="Title" />);
    expect(screen.queryByText('Subtitle')).toBeNull();
    rendered.rerender(
      <LinkPreviewCardView
        href="/two"
        icon="icon"
        title="Title"
        avatar={{ src: '/avatar', fallback: 'A' }}
        subtitle="Subtitle"
        description="Description"
        meta="Meta"
        badgeLabel="Badge"
      />
    );
    expect(screen.getByText('Subtitle')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Badge')).toBeTruthy();
    rendered.rerender(<LinkPreviewSkeleton />);
  });

  it('selects each blog URL/date/count fallback and optional hashtag display', () => {
    const rendered = render(
      <BlogSearchCard
        blog={
          {
            id: 'blog',
            title: null,
            date: 'today',
            created_at: 0,
            upvotes: 3,
            downvotes: 1,
            comment_count: 2,
            group_id: 'group',
            bloggers: [],
            blog_hashtags: [],
          } as any
        }
      />
    );
    expect(mocks.blogProps.href).toBe('/group/group/blog/blog');
    expect(mocks.blogProps.blog).toMatchObject({
      title: '',
      date: 'today',
      supporters: 2,
      comments: 2,
    });

    mocks.hashtags = ['tag'];
    rendered.rerender(
      <BlogSearchCard
        blog={
          {
            id: 'blog',
            title: 'Blog',
            created_at: 0,
            bloggers: [{ status: 'owner', user_id: 'owner' }],
          } as any
        }
      />
    );
    expect(mocks.blogProps.href).toBe('/user/owner/blog/blog');
    expect(document.body.textContent).toContain('tag');
    rendered.rerender(
      <BlogSearchCard
        blog={
          {
            id: 'blog',
            title: 'Blog',
            date: '',
            created_at: 0,
            bloggers: [{ status: 'reader' }, { status: 'writer', user_id: 'writer' }],
          } as any
        }
      />
    );
    expect(mocks.blogProps.href).toBe('/user/writer/blog/blog');
    rendered.rerender(
      <BlogSearchCard blog={{ id: 'blog', title: 'Blog', created_at: 0, bloggers: [] } as any} />
    );
    expect(mocks.blogProps.href).toBe('/blog/blog');
  });

  it('expands and collapses findings and renders optional summary and badges', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      title: `Finding ${index}`,
      description: 'Description',
      tone: 'neutral',
      badge: index === 0 ? 'Badge' : undefined,
    }));
    const rendered = render(
      <AiFindingsCardGroup presentation={{ title: 'Findings', summary: 'Summary', items } as any} />
    );
    expect(screen.queryByText('Finding 4')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Finding 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Finding 4')).toBeNull();
    rendered.rerender(
      <AiFindingsCardGroup presentation={{ title: 'Short', items: items.slice(0, 1) } as any} />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders both delete modes and dispatches cancel and confirm', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const rendered = render(
      <DeleteConversationDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.cancel"]')!
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rendered.rerender(
      <DeleteConversationDialog
        open
        isCancelRequest
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.delete.confirm"]')!
    );
    expect(onConfirm).toHaveBeenCalled();
  });
});
