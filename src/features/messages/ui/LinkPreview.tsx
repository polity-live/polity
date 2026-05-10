'use client';

import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { EditingModeBadge } from '@/features/shared/ui/ui/editing-mode.tsx';
import {
  Users,
  Calendar,
  FileText,
  User,
  MessageSquare,
  CheckSquare,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useUserState } from '@/zero/users/useUserState.ts';
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import { useEventState } from '@/zero/events/useEventState.ts';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState.ts';
import { useBlogState } from '@/zero/blogs/useBlogState.ts';
import { useStatementState } from '@/zero/statements/useStatementState.ts';
import { useTodoState } from '@/zero/todos/useTodoState.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { normalizeMessagePreviewText } from '../logic/normalizeMessagePreviewText';
import { isPolityLink, parsePolityUrl, type PolityLinkEntityType } from '../utils/url-utils';

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export function LinkPreview({ url, className = '' }: LinkPreviewProps) {
  const { t } = useTranslation();
  const isPolity = isPolityLink(url);
  const polityLink = isPolity ? parsePolityUrl(url) : null;

  if (!polityLink) {
    // Generic external link preview
    return (
      <Link to={url} target="_blank" rel="noopener noreferrer">
        <Card className={`hover:bg-accent ${className}`}>
          <CardContent className="flex items-center gap-3 p-3">
            <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
              <ExternalLink className="text-muted-foreground h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{url}</p>
              <p className="text-muted-foreground text-xs">
                {t('components.linkPreview.externalLink')}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Polity-specific preview
  return <PolityLinkPreview type={polityLink.type} id={polityLink.id} className={className} />;
}

interface PolityLinkPreviewProps {
  type: PolityLinkEntityType;
  id: string;
  className?: string;
}

function PolityLinkPreview({ type, id, className }: PolityLinkPreviewProps) {
  switch (type) {
    case 'user':
      return <UserPreview userId={id} className={className} />;
    case 'group':
      return <GroupPreview groupId={id} className={className} />;
    case 'event':
      return <EventPreview eventId={id} className={className} />;
    case 'amendment':
      return <AmendmentPreview amendmentId={id} className={className} />;
    case 'blog':
      return <BlogPreview blogId={id} className={className} />;
    case 'statement':
      return <StatementPreview statementId={id} className={className} />;
    case 'todo':
      return <TodoPreview todoId={id} className={className} />;
    default:
      return null;
  }
}

function UserPreview({ userId, className }: { userId: string; className?: string }) {
  const { t } = useTranslation();
  const { user } = useUserState({ userId });

  if (!user) {
    return <PreviewSkeleton />;
  }

  const userBio = normalizeMessagePreviewText(user.bio);

  return (
    <Link to="/user/$id" params={{ id: userId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-blue-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <User className="h-5 w-5 flex-shrink-0 text-blue-500" />
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={user.avatar ?? undefined} />
            <AvatarFallback>
              {(user.first_name || user.handle)?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {`${user.first_name || ''} ${user.last_name || ''}`.trim() ||
                t('components.linkPreview.unspecifiedUser')}
            </p>
            {user.handle && (
              <p className="text-muted-foreground truncate text-sm">@{user.handle}</p>
            )}
            {userBio && <p className="text-muted-foreground truncate text-xs">{userBio}</p>}
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.user')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function GroupPreview({ groupId, className }: { groupId: string; className?: string }) {
  const { t } = useTranslation();
  const { group } = useGroupState({ groupId });

  if (!group) {
    return <PreviewSkeleton />;
  }

  const groupDescription = normalizeMessagePreviewText(group.description);

  return (
    <Link to="/group/$id" params={{ id: groupId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-purple-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <Users className="h-5 w-5 flex-shrink-0 text-purple-500" />
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={undefined} />
            <AvatarFallback>{group.name?.[0]?.toUpperCase() || 'G'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{group.name}</p>
            {groupDescription && (
              <p className="text-muted-foreground line-clamp-1 text-xs">{groupDescription}</p>
            )}
            <p className="text-muted-foreground text-xs">
              {group.member_count || 0} {t('components.linkPreview.members')}
            </p>
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.group')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function EventPreview({ eventId, className }: { eventId: string; className?: string }) {
  const { t } = useTranslation();
  const { event } = useEventState({ eventId });

  if (!event) {
    return <PreviewSkeleton />;
  }

  return (
    <Link to="/event/$id" params={{ id: eventId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-green-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <Calendar className="h-5 w-5 flex-shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{event.title}</p>
            {event.start_date && (
              <p className="text-muted-foreground text-xs">
                {new Date(event.start_date).toLocaleDateString()}
              </p>
            )}
            {event.location_name && (
              <p className="text-muted-foreground truncate text-xs">{event.location_name}</p>
            )}
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.event')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function AmendmentPreview({ amendmentId, className }: { amendmentId: string; className?: string }) {
  const { t } = useTranslation();
  const { amendment } = useAmendmentState({ amendmentId });

  if (!amendment) {
    return <PreviewSkeleton />;
  }

  const amendmentReason = normalizeMessagePreviewText(amendment.reason);

  return (
    <Link to="/amendment/$id" params={{ id: amendmentId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-orange-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <FileText className="h-5 w-5 flex-shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{amendment.title}</p>
            {amendmentReason && (
              <p className="text-muted-foreground truncate text-xs">{amendmentReason}</p>
            )}
            {amendment.editing_mode && (
              <EditingModeBadge
                mode={amendment.editing_mode}
                variant="secondary"
                className="mt-1 text-xs"
              />
            )}
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.amendment')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function BlogPreview({ blogId, className }: { blogId: string; className?: string }) {
  const { t } = useTranslation();
  const { blogWithBloggers } = useBlogState({ blogId, includeBloggers: true });
  const blog = blogWithBloggers;

  if (!blog) {
    return <PreviewSkeleton />;
  }

  const blogOwner = blog.bloggers?.find(b => b.status === 'owner')?.user;
  const blogViewUrl = blog.group_id
    ? `/group/${blog.group_id}/blog/${blogId}`
    : `/user/${blogOwner?.id || ''}/blog/${blogId}`;

  return (
    <Link to={blogViewUrl}>
      <Card className={`hover:bg-accent border-l-4 border-l-pink-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <MessageSquare className="h-5 w-5 flex-shrink-0 text-pink-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{blog.title}</p>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
              <span>
                {blog.like_count || 0} {t('components.linkPreview.likes')}
              </span>
              <span>•</span>
              <span>
                {blog.comment_count || 0} {t('components.linkPreview.comments')}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.blog')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatementPreview({ statementId, className }: { statementId: string; className?: string }) {
  const { t } = useTranslation();
  const { statement } = useStatementState({ id: statementId });

  if (!statement) {
    return <PreviewSkeleton />;
  }

  if (!statement) {
    return null;
  }

  const statementText = normalizeMessagePreviewText(statement.text);

  return (
    <Link to="/statement/$id" params={{ id: statementId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-cyan-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <FileText className="h-5 w-5 flex-shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm">{statementText ?? ''}</p>
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.statement')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function TodoPreview({ todoId, className }: { todoId: string; className?: string }) {
  const { t } = useTranslation();
  const { todo } = useTodoState({ todoId });

  if (!todo) {
    return <PreviewSkeleton />;
  }

  const todoDescription = normalizeMessagePreviewText(todo.description);

  return (
    <Link to="/todos/$id" params={{ id: todoId }}>
      <Card className={`hover:bg-accent border-l-4 border-l-indigo-500 ${className}`}>
        <CardContent className="flex items-center gap-3 p-3">
          <CheckSquare className="h-5 w-5 flex-shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{todo.title}</p>
            {todoDescription && (
              <p className="text-muted-foreground line-clamp-1 text-xs">{todoDescription}</p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {todo.status?.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {todo.priority}
              </Badge>
            </div>
          </div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {t('components.linkPreview.todo')}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function PreviewSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="bg-muted h-10 w-10 flex-shrink-0 rounded-full"></div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="bg-muted h-4 w-3/4 rounded"></div>
          <div className="bg-muted h-3 w-1/2 rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}
