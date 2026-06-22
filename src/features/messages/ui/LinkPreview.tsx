'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  FileText,
  MessageSquare,
  User,
  Users,
} from 'lucide-react';

import { BadgeControl, EditingModeBadge } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState.ts';
import { useBlogState } from '@/zero/blogs/useBlogState.ts';
import { useEventState } from '@/zero/events/useEventState.ts';
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import { useStatementState } from '@/zero/statements/useStatementState.ts';
import { useTodoState } from '@/zero/todos/useTodoState.ts';
import { useUserState } from '@/zero/users/useUserState.ts';
import {
  getBranchEditingMode,
  getOrderedBranches,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { normalizeMessagePreviewText } from '../logic/normalizeMessagePreviewText';
import { isPolityLink, parsePolityUrl, type PolityLinkEntityType } from '../utils/url-utils';
import {
  LinkPreviewCardView,
  LinkPreviewSkeleton as LinkPreviewSkeletonView,
} from './LinkPreviewView';

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export function LinkPreview({ url, className = '' }: LinkPreviewProps) {
  const { t } = useTranslation();
  const polityLink = isPolityLink(url) ? parsePolityUrl(url) : null;

  if (!polityLink) {
    return (
      <LinkPreviewCardView
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        icon={<ExternalLink className="text-muted-foreground h-5 w-5" />}
        iconContainerClassName="bg-muted flex h-10 w-10 items-center justify-center rounded-lg"
        title={url}
        subtitle={t('components.linkPreview.externalLink')}
      />
    );
  }

  return (
    <PolityLinkPreviewContainer type={polityLink.type} id={polityLink.id} className={className} />
  );
}

interface PolityLinkPreviewContainerProps {
  type: PolityLinkEntityType;
  id: string;
  className?: string;
}

function PolityLinkPreviewContainer({ type, id, className }: PolityLinkPreviewContainerProps) {
  switch (type) {
    case 'user':
      return <UserPreviewContainer userId={id} className={className} />;
    case 'group':
      return <GroupPreviewContainer groupId={id} className={className} />;
    case 'event':
      return <EventPreviewContainer eventId={id} className={className} />;
    case 'amendment':
      return <AmendmentPreviewContainer amendmentId={id} className={className} />;
    case 'blog':
      return <BlogPreviewContainer blogId={id} className={className} />;
    case 'statement':
      return <StatementPreviewContainer statementId={id} className={className} />;
    case 'todo':
      return <TodoPreviewContainer todoId={id} className={className} />;
    default:
      return null;
  }
}

export function UserPreviewContainer({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { user } = useUserState({ userId });

  if (!user) {
    return <LinkPreviewSkeletonView />;
  }

  const userName =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    t('components.linkPreview.unspecifiedUser');

  return (
    <LinkPreviewCardView
      href={`/user/${userId}`}
      className={className}
      accentClassName="border-l-4 border-l-blue-500"
      icon={<User className={featureThemeClassName('messageLinkPreviewInfoIcon')} />}
      avatar={{
        src: user.avatar ?? undefined,
        fallback: (user.first_name || user.handle)?.[0]?.toUpperCase() || 'U',
      }}
      title={userName}
      subtitle={user.handle ? `@${user.handle}` : undefined}
      description={normalizeMessagePreviewText(user.bio)}
      badgeLabel={t('components.linkPreview.user')}
    />
  );
}

export function GroupPreviewContainer({
  groupId,
  className,
}: {
  groupId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { group } = useGroupState({ groupId });

  if (!group) {
    return <LinkPreviewSkeletonView />;
  }

  return (
    <LinkPreviewCardView
      href={`/group/${groupId}`}
      className={className}
      accentClassName="border-l-4 border-l-purple-500"
      icon={<Users className={featureThemeClassName('messageLinkPreviewAccentIcon')} />}
      avatar={{ fallback: group.name?.[0]?.toUpperCase() || 'G' }}
      title={group.name}
      description={normalizeMessagePreviewText(group.description)}
      meta={
        <p className="text-muted-foreground text-xs">
          {group.member_count || 0} {t('components.linkPreview.members')}
        </p>
      }
      badgeLabel={t('components.linkPreview.group')}
    />
  );
}

export function EventPreviewContainer({
  eventId,
  className,
}: {
  eventId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { event } = useEventState({ eventId });

  if (!event) {
    return <LinkPreviewSkeletonView />;
  }

  return (
    <LinkPreviewCardView
      href={`/event/${eventId}`}
      className={className}
      accentClassName="border-l-4 border-l-green-500"
      icon={
        <Calendar className={featureThemeClassName('agendaChangeRequestTimelineCardSuccessIcon')} />
      }
      title={event.title}
      subtitle={event.start_date ? new Date(event.start_date).toLocaleDateString() : undefined}
      description={event.location_name}
      badgeLabel={t('components.linkPreview.event')}
    />
  );
}

export function AmendmentPreviewContainer({
  amendmentId,
  className,
}: {
  amendmentId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { amendment } = useAmendmentState({ amendmentId });

  if (!amendment) {
    return <LinkPreviewSkeletonView />;
  }
  const firstBranch = getOrderedBranches(amendment.current_process_run?.branches ?? [])[0] ?? null;

  return (
    <LinkPreviewCardView
      href={`/amendment/${amendmentId}`}
      className={className}
      accentClassName="border-l-4 border-l-orange-500"
      icon={<FileText className={featureThemeClassName('messageLinkPreviewWarningIcon')} />}
      title={amendment.title}
      description={normalizeMessagePreviewText(amendment.reason)}
      meta={
        firstBranch ? (
          <EditingModeBadge
            mode={getBranchEditingMode(firstBranch)}
            variant="secondary"
            className="mt-1 text-xs"
          />
        ) : null
      }
      badgeLabel={t('components.linkPreview.amendment')}
    />
  );
}

export function BlogPreviewContainer({
  blogId,
  className,
}: {
  blogId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { blogWithBloggers } = useBlogState({ blogId, includeBloggers: true });
  const blog = blogWithBloggers;

  if (!blog) {
    return <LinkPreviewSkeletonView />;
  }

  const blogOwner = blog.bloggers?.find(blogger => blogger.status === 'owner')?.user;
  const blogViewUrl = blog.group_id
    ? `/group/${blog.group_id}/blog/${blogId}`
    : `/user/${blogOwner?.id || ''}/blog/${blogId}`;

  return (
    <LinkPreviewCardView
      href={blogViewUrl}
      className={className}
      accentClassName="border-l-4 border-l-pink-500"
      icon={
        <MessageSquare className={featureThemeClassName('messageLinkPreviewAccentIconAlpha')} />
      }
      title={blog.title}
      meta={
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <span>
            {blog.supporter_count || 0} {t('components.labels.supporters')}
          </span>
          <span>•</span>
          <span>
            {blog.comment_count || 0} {t('components.linkPreview.comments')}
          </span>
        </div>
      }
      badgeLabel={t('components.linkPreview.blog')}
    />
  );
}

export function StatementPreviewContainer({
  statementId,
  className,
}: {
  statementId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { statement } = useStatementState({ id: statementId });

  if (!statement) {
    return <LinkPreviewSkeletonView />;
  }

  return (
    <LinkPreviewCardView
      href={`/statement/${statementId}`}
      className={className}
      accentClassName="border-l-4 border-l-cyan-500"
      icon={<FileText className={featureThemeClassName('messageLinkPreviewInfoIconAlpha')} />}
      title={normalizeMessagePreviewText(statement.text) ?? ''}
      titleClassName="line-clamp-2 text-sm font-normal"
      badgeLabel={t('components.linkPreview.statement')}
    />
  );
}

export function TodoPreviewContainer({
  todoId,
  className,
}: {
  todoId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { todo } = useTodoState({ todoId });

  if (!todo) {
    return <LinkPreviewSkeletonView />;
  }

  return (
    <LinkPreviewCardView
      href={`/todos/${todoId}`}
      className={className}
      accentClassName="border-l-4 border-l-indigo-500"
      icon={<CheckSquare className={featureThemeClassName('messageLinkPreviewAccentIconBeta')} />}
      title={todo.title}
      description={normalizeMessagePreviewText(todo.description)}
      meta={
        <div className="mt-1 flex items-center gap-2">
          <BadgeControl variant="secondary" size="xs" textTransform="capitalize">
            {todo.status?.replace('_', ' ')}
          </BadgeControl>
          <BadgeControl variant="outline" size="xs" textTransform="capitalize">
            {todo.priority}
          </BadgeControl>
        </div>
      }
      badgeLabel={t('components.linkPreview.todo')}
    />
  );
}
