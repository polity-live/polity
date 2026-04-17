import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for blog mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useBlogActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── CRUD ───────────────────────────────────────────────────────────
  const createBlog = useCallback(
    (args: Parameters<typeof mutators.blogs.create>[0]) => {
      const result = zero.mutate(mutators.blogs.create(args))
      toast.success(t('features.blogs.toasts.created'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.createFailed', 'Failed to create blog')))
    },
    [zero]
  )

  const updateBlog = useCallback(
    (args: Parameters<typeof mutators.blogs.update>[0]) => {
      const result = zero.mutate(mutators.blogs.update(args))
      onServerError(result, () => toast.error(t('features.blogs.toasts.updateFailed')))
    },
    [zero]
  )

  const deleteBlog = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.delete({ id }))
      toast.success(t('features.blogs.toasts.deleted'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.deleteFailed')))
    },
    [zero]
  )

  // ── Entries ────────────────────────────────────────────────────────
  const createEntry = useCallback(
    (args: Parameters<typeof mutators.blogs.createEntry>[0]) => {
      const result = zero.mutate(mutators.blogs.createEntry(args))
      toast.success(t('features.blogs.toasts.entryCreated'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryCreateFailed')))
    },
    [zero]
  )

  const updateEntry = useCallback(
    (args: Parameters<typeof mutators.blogs.updateEntry>[0]) => {
      const result = zero.mutate(mutators.blogs.updateEntry(args))
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryUpdateFailed')))
    },
    [zero]
  )

  const deleteEntry = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.deleteEntry({ id }))
      toast.success(t('features.blogs.toasts.entryDeleted'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.entryDeleteFailed')))
    },
    [zero]
  )

  // ── Support Votes ──────────────────────────────────────────────────
  const createSupportVote = useCallback(
    (args: Parameters<typeof mutators.blogs.createSupportVote>[0]) => {
      const result = zero.mutate(mutators.blogs.createSupportVote(args))
      toast.success(t('features.blogs.toasts.supportVoteAdded'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteAddFailed')))
    },
    [zero]
  )

  const updateSupportVote = useCallback(
    (args: Parameters<typeof mutators.blogs.updateSupportVote>[0]) => {
      const result = zero.mutate(mutators.blogs.updateSupportVote(args))
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteUpdateFailed')))
    },
    [zero]
  )

  const deleteSupportVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.blogs.deleteSupportVote({ id }))
      toast.success(t('features.blogs.toasts.supportVoteRemoved'))
      onServerError(result, () => toast.error(t('features.blogs.toasts.supportVoteRemoveFailed')))
    },
    [zero]
  )

  // ── Silent Operations (no toasts) ─────────────────────────────────

  /** Update blog without toast — for auto-save scenarios */
  const updateBlogSilent = useCallback(
    (args: Parameters<typeof mutators.blogs.update>[0]) => {
      const result = zero.mutate(mutators.blogs.update(args))
      onServerError(result, (msg) => console.error('Silent blog update failed:', msg))
    },
    [zero]
  )

  /** Full blog creation orchestration (blog + roles + action rights + entry) */
  const createBlogFull = useCallback(
    (args: {
      blog: Parameters<typeof mutators.blogs.create>[0]
      roles: Array<Parameters<typeof mutators.blogs.createRole>[0]>
      actionRights: Array<Parameters<typeof mutators.blogs.assignActionRight>[0]>
      entry: Parameters<typeof mutators.blogs.createEntry>[0]
    }) => {
      const result1 = zero.mutate(mutators.blogs.create(args.blog))
      onServerError(result1, (msg) => console.error('Failed to create blog:', msg))
      for (const role of args.roles) {
        const result2 = zero.mutate(mutators.blogs.createRole(role))
        onServerError(result2, (msg) => console.error('Failed to create blog role:', msg))
      }
      for (const right of args.actionRights) {
        const result3 = zero.mutate(mutators.blogs.assignActionRight(right))
        onServerError(result3, (msg) => console.error('Failed to assign blog action right:', msg))
      }
      const result4 = zero.mutate(mutators.blogs.createEntry(args.entry))
      onServerError(result4, (msg) => console.error('Failed to create blog entry:', msg))
    },
    [zero]
  )

  /** Subscribe to a blog without toast (caller manages UX) */
  const subscribeToBlog = useCallback(
    (args: Parameters<typeof mutators.common.subscribe>[0]) => {
      const result = zero.mutate(mutators.common.subscribe(args))
      onServerError(result, (msg) => console.error('Failed to subscribe to blog:', msg))
    },
    [zero]
  )

  /** Unsubscribe from a blog without toast (caller manages UX) */
  const unsubscribeFromBlog = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.common.unsubscribe({ id }))
      onServerError(result, (msg) => console.error('Failed to unsubscribe from blog:', msg))
    },
    [zero]
  )

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
  }
}
