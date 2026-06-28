import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

type ZeroMutationResult = ReturnType<ReturnType<typeof useZero>['mutate']>;

type BlogFullMutationArgs = Parameters<typeof mutators.blogs.createFull>[0];

interface BlogFullMutationResult {
  blogResult: ZeroMutationResult;
}

/**
 * Action hook for blog mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useBlogActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createBlog = useCallback(
    (args: Parameters<typeof mutators.blogs.create>[0]) => {
      const result = zero.mutate(mutators.blogs.create(args));
      toast.success(t('features.blogs.toasts.created'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.createFailed')));
    },
    [zero]
  );

  const updateBlog = useCallback(
    (args: Parameters<typeof mutators.blogs.update>[0]) => {
      const result = zero.mutate(mutators.blogs.update(args));
      onServerError(result, () => toast.error(t('features.blogs.toasts.updateFailed')));
    },
    [zero]
  );

  const deleteBlog = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.delete({ id }));
      toast.success(t('features.blogs.toasts.deleted'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.deleteFailed')));
    },
    [zero]
  );

  // ── Entries ────────────────────────────────────────────────────────
  const createEntry = useCallback(
    (args: Parameters<typeof mutators.blogs.createEntry>[0]) => {
      const result = zero.mutate(mutators.blogs.createEntry(args));
      toast.success(t('features.blogs.toasts.entryCreated'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryCreateFailed')));
    },
    [zero]
  );

  const updateEntry = useCallback(
    (args: Parameters<typeof mutators.blogs.updateEntry>[0]) => {
      const result = zero.mutate(mutators.blogs.updateEntry(args));
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryUpdateFailed')));
    },
    [zero]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.deleteEntry({ id }));
      toast.success(t('features.blogs.toasts.entryDeleted'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryDeleteFailed')));
    },
    [zero]
  );

  // ── Support Votes ──────────────────────────────────────────────────
  const createSupportVote = useCallback(
    (args: Parameters<typeof mutators.blogs.createSupportVote>[0]) => {
      const result = zero.mutate(mutators.blogs.createSupportVote(args));
      toast.success(t('features.blogs.toasts.supportVoteAdded'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteAddFailed')));
    },
    [zero]
  );

  const updateSupportVote = useCallback(
    (args: Parameters<typeof mutators.blogs.updateSupportVote>[0]) => {
      const result = zero.mutate(mutators.blogs.updateSupportVote(args));
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteUpdateFailed')));
    },
    [zero]
  );

  const deleteSupportVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.deleteSupportVote({ id }));
      toast.success(t('features.blogs.toasts.supportVoteRemoved'));
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteRemoveFailed')));
    },
    [zero]
  );

  // ── Silent Operations (no toasts) ─────────────────────────────────

  /** Update blog without toast — for auto-save scenarios */
  const updateBlogSilent = useCallback(
    (args: Parameters<typeof mutators.blogs.update>[0]) => {
      const result = zero.mutate(mutators.blogs.update(args));
      onServerError(result, msg => console.error('Silent blog update failed:', msg));
    },
    [zero]
  );

  /** Full blog creation. The server-side create mutator bootstraps roles, rights, and owner entry. */
  const createBlogFull = useCallback(
    (args: BlogFullMutationArgs) => {
      const blogResult = zero.mutate(mutators.blogs.createFull(args));

      return {
        blogResult,
      } satisfies BlogFullMutationResult;
    },
    [zero]
  );

  /** Subscribe to a blog without toast (caller manages UX) */
  const subscribeToBlog = useCallback(
    (args: Parameters<typeof mutators.common.subscribe>[0]) => {
      const result = zero.mutate(mutators.common.subscribe(args));
      onServerError(result, msg => console.error('Failed to subscribe to blog:', msg));
    },
    [zero]
  );

  /** Unsubscribe from a blog without toast (caller manages UX) */
  const unsubscribeFromBlog = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.common.unsubscribe({ id }));
      onServerError(result, msg => console.error('Failed to unsubscribe from blog:', msg));
    },
    [zero]
  );

  return {
    // CRUD
    createBlog,
    updateBlog,
    deleteBlog,

    // Entries
    createEntry,
    updateEntry,
    deleteEntry,

    // Support Votes
    createSupportVote,
    updateSupportVote,
    deleteSupportVote,

    // Silent Operations
    updateBlogSilent,
    createBlogFull,
    subscribeToBlog,
    unsubscribeFromBlog,
  };
}
