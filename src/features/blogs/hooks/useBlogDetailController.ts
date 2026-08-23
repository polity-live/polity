import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useZero } from '@rocicorp/zero/react';
import type { Value } from 'platejs';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useCreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import type { CommentData } from '@/features/shared/ui/comments';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { VoteValue } from '@/features/shared/ui/voting';
import { useAuth } from '@/providers/auth-provider';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { mutators } from '@/zero/mutators';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { useSubscribeBlog } from './useSubscribeBlog';
import { useBlogPermissions } from './useBlogPermissions';

interface UseBlogDetailControllerOptions {
  blogId: string;
}

function mapBlogComments(commentsRows: NonNullable<ReturnType<typeof useBlogState>['comments']>) {
  return commentsRows.map<CommentData>(comment => ({
    id: comment.id,
    text: comment.content ?? '',
    createdAt: comment.created_at ?? 0,
    upvotes: comment.upvotes ?? 0,
    downvotes: comment.downvotes ?? 0,
    creator: comment.user
      ? {
          id: comment.user.id,
          name:
            [comment.user.first_name, comment.user.last_name].filter(Boolean).join(' ') ||
            undefined,
          handle: comment.user.handle ?? undefined,
          avatar: comment.user.avatar ?? undefined,
        }
      : undefined,
    votes: (comment.votes ?? []).map(vote => ({
      id: vote.id,
      vote: vote.vote ?? 0,
      user: vote.user ? { id: vote.user.id } : undefined,
    })),
    replies: (comment.replies ?? []).map(reply => ({
      id: reply.id,
      text: reply.content ?? '',
      createdAt: reply.created_at ?? 0,
      upvotes: reply.upvotes ?? 0,
      downvotes: reply.downvotes ?? 0,
      creator: reply.user
        ? {
            id: reply.user.id,
            name:
              [reply.user.first_name, reply.user.last_name].filter(Boolean).join(' ') || undefined,
            handle: reply.user.handle ?? undefined,
            avatar: reply.user.avatar ?? undefined,
          }
        : undefined,
      votes: (reply.votes ?? []).map(vote => ({
        id: vote.id,
        vote: vote.vote ?? 0,
        user: vote.user ? { id: vote.user.id } : undefined,
      })),
    })),
  }));
}

export function useBlogDetailController({ blogId }: UseBlogDetailControllerOptions) {
  const navigate = useNavigate();
  const zero = useZero();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const recoveryDraft = useCreateRecoveryDraft('blog', blogId);

  const { canEdit: blogCanEdit, canDelete: blogCanDelete } = useBlogPermissions(blogId);
  const blogActions = useBlogActions();
  const { addComment: addCommentAction, voteComment } = useDocumentActions();
  const {
    isSubscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
  } = useSubscribeBlog(blogId);

  const {
    blogWithDetails,
    comments: commentsRows,
    blogThread,
  } = useBlogState({
    blogId,
    includeDetails: true,
    includeComments: true,
  });

  const blog = blogWithDetails;
  const comments = useMemo(() => mapBlogComments(commentsRows || []), [commentsRows]);

  const { can: canGroup } = usePermissions({ groupId: blog?.group_id ?? undefined });
  const groupCanManage = blog?.group_id ? canGroup('manage', 'groups') : false;
  const canEdit = blogCanEdit || groupCanManage;
  const canDelete = blogCanDelete || groupCanManage;

  const score = (blog?.upvotes || 0) - (blog?.downvotes || 0);
  const userVote = blog?.support_votes?.find(vote => vote.user?.id === user?.id);
  const currentVoteValue: VoteValue = userVote ? (userVote.vote === 1 ? 1 : -1) : 0;

  const handleVote = async (voteValue: VoteValue) => {
    if (!user?.id) {
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }
    if (!blog) return;

    try {
      if (userVote) {
        if (userVote.vote === voteValue) {
          await Promise.all([
            waitForClientApply(blogActions.deleteSupportVote(userVote.id)),
            waitForClientApply(
              blogActions.updateBlog({
                id: blogId,
                upvotes: voteValue === 1 ? (blog.upvotes || 1) - 1 : blog.upvotes,
                downvotes: voteValue === -1 ? (blog.downvotes || 1) - 1 : blog.downvotes,
              })
            ),
          ]);
        } else {
          await Promise.all([
            waitForClientApply(blogActions.updateSupportVote({ id: userVote.id, vote: voteValue })),
            waitForClientApply(
              blogActions.updateBlog({
                id: blogId,
                upvotes:
                  voteValue === 1 ? (blog.upvotes || 0) + 1 : Math.max(0, (blog.upvotes || 1) - 1),
                downvotes:
                  voteValue === -1
                    ? (blog.downvotes || 0) + 1
                    : Math.max(0, (blog.downvotes || 1) - 1),
              })
            ),
          ]);
        }
      } else {
        await Promise.all([
          waitForClientApply(
            blogActions.createSupportVote({
              id: crypto.randomUUID(),
              vote: voteValue,
              blog_id: blogId,
            })
          ),
          waitForClientApply(
            blogActions.updateBlog({
              id: blogId,
              upvotes: voteValue === 1 ? (blog.upvotes || 0) + 1 : blog.upvotes,
              downvotes: voteValue === -1 ? (blog.downvotes || 0) + 1 : blog.downvotes,
            })
          ),
        ]);
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(translateText('generated.inline.0140_failed_to_vote_68d9f4e2'));
    }
  };

  const handleAddComment = async (text: string, parentId?: string) => {
    if (!text.trim() || !user?.id) return;
    try {
      if (!blogThread) {
        await waitForClientApply(
          zero.mutate(
            mutators.documents.createThread({
              id: blogId,
              document_id: null,
              amendment_id: null,
              statement_id: null,
              blog_id: blogId,
              todo_id: null,
              content: null,
              status: 'open',
              resolved_at: null,
              position: null,
              user_id: user.id,
              upvotes: 0,
              downvotes: 0,
            })
          )
        );
      }

      await waitForClientApply(
        addCommentAction({
          id: crypto.randomUUID(),
          thread_id: blogId,
          parent_id: parentId || null,
          content: text,
          upvotes: 0,
          downvotes: 0,
          user_id: user.id,
        })
      );
      toast.success(translateText('generated.inline.0263_comment_posted_successfully_eb634c77'));
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error(translateText('generated.inline.0264_failed_to_post_comment_9008b631'));
    }
  };

  const handleCommentVote = async (commentId: string, voteValue: number) => {
    if (!user?.id) return;
    try {
      await waitForClientApply(
        voteComment({
          id: crypto.randomUUID(),
          comment_id: commentId,
          user_id: user.id,
          vote: voteValue,
        })
      );
    } catch (error) {
      console.error('Error voting on comment:', error);
    }
  };

  const handleDeleteBlog = async () => {
    try {
      await waitForClientApply(blogActions.deleteBlog(blogId));
      toast.success(t('features.blogs.detail.blogDeleted'));
      const groupId = blog?.group_id;
      if (groupId) {
        navigate({ to: '/group/$id/blogs-and-statements', params: { id: groupId } });
      } else {
        navigate({ to: '/' });
      }
    } catch (error) {
      console.error('Error deleting blog:', error);
      toast.error(t('features.blogs.detail.blogDeleteFailed'));
    }
  };

  const author =
    blog?.bloggers?.find(blogger => blogger.status === 'owner')?.user || blog?.bloggers?.[0]?.user;
  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(' ') ||
    translateText('generated.inline.0031_unknown_bc7819b3');
  const editorUrl = blog?.group_id
    ? `/group/${blog.group_id}/blog/${blogId}/editor`
    : `/user/${author?.id || user?.id}/blog/${blogId}/editor`;
  const blogViewUrl = blog?.group_id
    ? `/group/${blog.group_id}/blog/${blogId}`
    : `/user/${author?.id || user?.id}/blog/${blogId}`;
  const commentCount = blog?.comment_count ?? comments.length;

  return {
    author: author
      ? {
          id: author.id,
          avatar: author.avatar,
          firstName: author.first_name,
          handle: author.handle,
          name: authorName,
        }
      : undefined,
    blogId,
    recoveryDraft: blog ? null : recoveryDraft,
    bloggers: blog?.bloggers ?? [],
    canDelete,
    canEdit,
    commentCount,
    comments,
    content: blog?.content as Value | null | undefined,
    currentUserId: user?.id,
    currentVoteValue,
    date: blog?.date,
    deleteOpen,
    downvotes: blog?.downvotes ?? 0,
    editorUrl,
    hashtags: blog?.blog_hashtags ? extractHashtags([...blog.blog_hashtags]) : [],
    imageUrl: blog?.image_url,
    isLoaded: Boolean(blogWithDetails),
    isSubscribed,
    onAddComment: handleAddComment,
    onCommentVote: handleCommentVote,
    onConfirmDelete: handleDeleteBlog,
    onDeleteOpenChange: setDeleteOpen,
    onSubscribeToggle: toggleSubscribe,
    onVote: handleVote,
    shareContextItem: {
      id: blogId,
      type: 'blog' as const,
      title: blog?.title ?? '',
      createdAt: new Date(),
      authorId: author?.id,
      authorName,
      authorAvatar: author?.avatar ?? undefined,
      groupId: blog?.group_id ?? undefined,
      commentCount,
    },
    subscriberCount,
    subscribeLoading,
    supporterCount: blog?.supporter_count ?? score,
    title: blog?.title,
    visibility: blog?.visibility,
    upvotes: blog?.upvotes ?? 0,
    videoUrl: blog?.video_url,
    viewUrl: blogViewUrl,
  };
}
