'use client';

import type { Value } from 'platejs';
import { Link } from '@tanstack/react-router';
import { BookOpen, Calendar, Edit, Trash2 } from 'lucide-react';

import { PageWrapper } from '@/layout/page-wrapper';
import { ScrollableAlertDialogContent } from '@/features/shared/ui/dialog';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { SubscribeButton } from '@/features/shared/ui/action-buttons';
import { ActionBar } from '@/features/shared/ui/layout';
import { StatsBar } from '@/features/shared/ui/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { VoteButtons, type VoteValue } from '@/features/shared/ui/voting';
import { CommentThread, type CommentData } from '@/features/shared/ui/comments';
import { RichTextPreview } from '@/features/shared/ui/rich-text';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import {
  getWikiParticipationName,
  isVisibleWikiParticipationStatus,
  normalizeWikiParticipationRole,
  WikiParticipationDirectory,
  type WikiParticipationItem,
  type WikiParticipationRole,
} from '@/features/shared/ui/wiki';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface BlogDetailAuthor {
  id?: string;
  avatar?: string | null;
  firstName?: string | null;
  handle?: string | null;
  name: string;
}

interface BlogDetailShareContextItem {
  id: string;
  type: 'blog';
  title: string;
  createdAt: Date;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  groupId?: string;
  commentCount: number;
}

interface BlogDetailViewProps {
  author?: BlogDetailAuthor;
  blogId: string;
  bloggers: readonly any[];
  canAccess: boolean;
  canDelete: boolean;
  canEdit: boolean;
  commentCount: number;
  comments: CommentData[];
  content?: Value | null;
  currentUserId?: string;
  currentVoteValue: VoteValue;
  date?: string | null;
  deleteOpen: boolean;
  downvotes: number;
  editorUrl: string;
  hashtags: { id: string; tag: string }[];
  isLoaded: boolean;
  isSubscribed: boolean;
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  onConfirmDelete: () => Promise<void>;
  onDeleteOpenChange: (open: boolean) => void;
  onSubscribeToggle: () => Promise<void> | void;
  onVote: (vote: VoteValue) => Promise<void>;
  onCommentVote: (commentId: string, voteValue: number) => Promise<void>;
  shareContextItem: BlogDetailShareContextItem;
  subscriberCount: number;
  subscribeLoading: boolean;
  supporterCount: number;
  title?: string | null;
  upvotes: number;
  viewUrl: string;
}

export function BlogDetailView({
  author,
  blogId,
  bloggers,
  canAccess,
  canDelete,
  canEdit,
  commentCount,
  comments,
  content,
  currentUserId,
  currentVoteValue,
  date,
  deleteOpen,
  downvotes,
  editorUrl,
  hashtags,
  isLoaded,
  isSubscribed,
  onAddComment,
  onCommentVote,
  onConfirmDelete,
  onDeleteOpenChange,
  onSubscribeToggle,
  onVote,
  shareContextItem,
  subscriberCount,
  subscribeLoading,
  supporterCount,
  title,
  upvotes,
  viewUrl,
}: BlogDetailViewProps) {
  const { t } = useTranslation();

  if (!isLoaded) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">{t('features.blogs.detail.loading')}</div>
      </PageWrapper>
    );
  }

  if (!title) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">{t('features.blogs.detail.notFound')}</h1>
          <p className="text-muted-foreground">{t('features.blogs.detail.notFoundDescription')}</p>
        </div>
      </PageWrapper>
    );
  }

  if (!canAccess) {
    return (
      <PageWrapper>
        <AccessDenied />
      </PageWrapper>
    );
  }

  const bloggerDirectoryItems: WikiParticipationItem[] = (bloggers ?? [])
    .filter(blogger => isVisibleWikiParticipationStatus(blogger.status))
    .filter(blogger => blogger.user?.id)
    .map(blogger => {
      const fallbackRole: WikiParticipationRole =
        blogger.status === 'owner'
          ? { id: 'owner', name: translateText('features.blogs.bloggers.ownerRole') }
          : {
              id: 'blogger',
              name: translateText('generated.inline.0032_blogger_9b156370', 'Blogger'),
            };
      const role = normalizeWikiParticipationRole(blogger.role) ?? fallbackRole;

      return {
        id: blogger.id ?? `blogger-${blogger.user.id}`,
        userId: blogger.user.id,
        name: getWikiParticipationName(blogger.user),
        handle: blogger.user.handle ?? null,
        email: blogger.user.email ?? null,
        avatar: blogger.user.avatar ?? null,
        status: blogger.status ?? null,
        roles: [role],
      };
    });
  const bloggerRoles = bloggerDirectoryItems
    .flatMap(item => item.roles ?? [])
    .filter(
      (role, index, allRoles) => allRoles.findIndex(candidate => candidate.id === role.id) === index
    );

  return (
    <PageWrapper>
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <BookOpen className="h-8 w-8" />
          <h1 className="text-4xl font-bold">{title}</h1>
        </div>

        {author ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={author.avatar ?? undefined} />
              <AvatarFallback>{author.firstName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-medium">
                {t
                  ? t('components.labels.createdBy')
                  : translateText('generated.inline.0037_created_by_5d73cc30')}{' '}
                {author.name || translateText('generated.inline.0031_unknown_bc7819b3')}
              </p>
              {author.handle ? (
                <p className="text-muted-foreground text-xs">@{author.handle}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {date ? (
          <div className="text-muted-foreground mt-2 flex items-center justify-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
        ) : null}
      </div>

      <StatsBar
        items={[
          { value: subscriberCount, label: t('components.labels.subscribers') },
          { value: supporterCount, label: t('components.labels.supporters') },
          { value: commentCount, label: t('components.labels.comments') },
        ]}
      />

      <ActionBar>
        <SubscribeButton
          entityType="blog"
          entityId={blogId}
          isSubscribed={isSubscribed}
          onToggleSubscribe={onSubscribeToggle}
          isLoading={subscribeLoading}
        />
        <VoteButtons
          upvotes={upvotes}
          downvotes={downvotes}
          userVote={currentVoteValue}
          onVote={onVote}
          orientation="horizontal"
        />
        <ShareButton
          url={viewUrl}
          title={title}
          description=""
          shareContextItem={shareContextItem}
        />
      </ActionBar>

      {hashtags.length > 0 ? (
        <div className="mb-6">
          <HashtagDisplay hashtags={hashtags} centered />
        </div>
      ) : null}

      <WikiParticipationDirectory
        title={translateText('generated.inline.0250_bloggers_4e649307', 'Bloggers')}
        description={translateText('features.blogs.wiki.bloggersDescription')}
        items={bloggerDirectoryItems}
        roles={bloggerRoles}
        entityType="blog"
        searchPlaceholder={translateText('generated.inline.0244_search_bloggers_98b779c5')}
        emptyLabel={translateText('generated.inline.0035_no_active_bloggers_yet_f9a61b2d')}
        noResultsLabel={translateText(
          'generated.inline.0036_no_active_bloggers_match_your_search_eae577bf'
        )}
      />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('features.blogs.detail.blogContent')}</CardTitle>
            <CardDescription>
              {content
                ? t('features.blogs.detail.latestVersion')
                : t('features.blogs.detail.noContentYet')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <Link to={editorUrl}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('features.blogs.detail.editContent')}
                </Button>
              </Link>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" size="sm" onClick={() => onDeleteOpenChange(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('features.blogs.delete')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent prose className="max-w-none">
          {content && Array.isArray(content) && content.length > 0 ? (
            <RichTextPreview content={content} />
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <p>{t('features.blogs.detail.noContentAvailable')}</p>
              {canEdit ? (
                <Link to={editorUrl}>
                  <Button variant="outline" className="mt-4">
                    <Edit className="mr-2 h-4 w-4" />
                    {t('features.blogs.detail.startWriting')}
                  </Button>
                </Link>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <CommentThread
        comments={comments}
        currentUserId={currentUserId}
        onAddComment={onAddComment}
        onVote={onCommentVote}
        className="mt-6"
      />

      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('features.blogs.detail.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('features.blogs.detail.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                onDeleteOpenChange(false);
                await onConfirmDelete();
              }}
            >
              {t('common.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
