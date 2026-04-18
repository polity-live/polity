import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

type EntityType = 'user' | 'group' | 'amendment' | 'event' | 'blog' | 'statement'

/**
 * Action hook for common cross-domain mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useCommonActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── Subscribers ────────────────────────────────────────────────────
  const subscribe = useCallback(
    (args: Parameters<typeof mutators.common.subscribe>[0]) => {
      const result = zero.mutate(mutators.common.subscribe(args))
      toast.success(t('common.toasts.subscribed'))
      onServerError(result, () => toast.error(t('common.toasts.subscribeFailed')))
    },
    [zero]
  )

  const unsubscribe = useCallback(
    (args: Parameters<typeof mutators.common.unsubscribe>[0]) => {
      const result = zero.mutate(mutators.common.unsubscribe(args))
      toast.success(t('common.toasts.unsubscribed'))
      onServerError(result, () => toast.error(t('common.toasts.unsubscribeFailed')))
    },
    [zero]
  )

  // ── Hashtags ───────────────────────────────────────────────────────
  const addHashtag = useCallback(
    (args: Parameters<typeof mutators.common.addHashtag>[0]) => {
      const result = zero.mutate(mutators.common.addHashtag(args))
      onServerError(result, (msg) => console.error('Failed to add hashtag:', msg))
    },
    [zero]
  )

  const deleteHashtag = useCallback(
    (args: Parameters<typeof mutators.common.deleteHashtag>[0]) => {
      const result = zero.mutate(mutators.common.deleteHashtag(args))
      onServerError(result, (msg) => console.error('Failed to delete hashtag:', msg))
    },
    [zero]
  )

  // ── Junction link/unlink helpers ───────────────────────────────────
  const linkHashtag = useCallback(
    (entityType: EntityType, args: { id: string; hashtag_id: string } & Record<string, string>) => {
      const mutatorMap = {
        user: mutators.common.linkUserHashtag,
        group: mutators.common.linkGroupHashtag,
        amendment: mutators.common.linkAmendmentHashtag,
        event: mutators.common.linkEventHashtag,
        blog: mutators.common.linkBlogHashtag,
        statement: mutators.common.linkStatementHashtag,
      } as const
      // Each mutator expects a specific FK field (user_id, group_id, etc.)
      // which is included in args via Record<string, string>.
      // Cast through unknown: mutators have specific FK arg types but caller
      // provides a generic Record keyed by entity type.
      const mutator = mutatorMap[entityType] as unknown as (a: Record<string, string>) => ReturnType<(typeof mutatorMap)[EntityType]>
      const result = zero.mutate(mutator(args))
      onServerError(result, (msg) => console.error(`Failed to link ${entityType} hashtag:`, msg))
    },
    [zero]
  )

  const unlinkHashtag = useCallback(
    (entityType: EntityType, args: { id: string }) => {
      const mutatorMap = {
        user: mutators.common.unlinkUserHashtag,
        group: mutators.common.unlinkGroupHashtag,
        amendment: mutators.common.unlinkAmendmentHashtag,
        event: mutators.common.unlinkEventHashtag,
        blog: mutators.common.unlinkBlogHashtag,
        statement: mutators.common.unlinkStatementHashtag,
      } as const
      const result = zero.mutate(mutatorMap[entityType](args))
      onServerError(result, (msg) => console.error(`Failed to unlink ${entityType} hashtag:`, msg))
    },
    [zero]
  )

  /**
   * Sync entity hashtags: computes diff between existing junction rows and desired tags,
   * then creates/removes canonical hashtags + junction rows as needed.
   *
   * @param entityType - 'user' | 'group' | 'amendment' | 'event' | 'blog'
   * @param entityId - The entity's ID
   * @param desiredTags - Array of tag strings the entity should have after sync
   * @param existingJunctions - Current junction rows (with nested hashtag) from the query
   * @param allHashtags - All canonical hashtags (for reuse lookup)
   */
  const syncEntityHashtags = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      desiredTags: string[],
      existingJunctions: Array<{ id: string; hashtag_id: string; hashtag?: { id: string; tag: string } | undefined }>,
      allHashtags: Array<{ id: string; tag: string }>
    ) => {
      // Build lookup of current tags from junctions
      const currentTagMap = new Map<string, string>() // tag → junction_id
      for (const j of existingJunctions) {
        const tag = j.hashtag?.tag
        if (tag) currentTagMap.set(tag, j.id)
      }

      const desiredSet = new Set(desiredTags)
      const existingTagLookup = new Map(allHashtags.map(h => [h.tag, h.id]))
      const entityField = `${entityType}_id`

      // Remove junctions for tags no longer desired
      for (const [tag, junctionId] of currentTagMap) {
        if (!desiredSet.has(tag)) {
          unlinkHashtag(entityType, { id: junctionId })
        }
      }

      // Add junctions for new tags
      for (const tag of desiredTags) {
        if (currentTagMap.has(tag)) continue // already linked

        // Ensure canonical hashtag exists
        let hashtagId = existingTagLookup.get(tag)
        if (!hashtagId) {
          hashtagId = crypto.randomUUID()
          addHashtag({ id: hashtagId, tag })
        }

        // Create junction
        linkHashtag(entityType, {
          id: crypto.randomUUID(),
          hashtag_id: hashtagId,
          [entityField]: entityId,
        })
      }

      toast.success(t('common.toasts.hashtagsSynced'))
    },
    [addHashtag, unlinkHashtag, linkHashtag, t]
  )

  // ── Links ──────────────────────────────────────────────────────────
  const createLink = useCallback(
    (args: Parameters<typeof mutators.common.createLink>[0]) => {
      const result = zero.mutate(mutators.common.createLink(args))
      toast.success(t('common.toasts.linkCreated'))
      onServerError(result, () => toast.error(t('common.toasts.linkCreateFailed')))
    },
    [zero]
  )

  const deleteLink = useCallback(
    (args: Parameters<typeof mutators.common.deleteLink>[0]) => {
      const result = zero.mutate(mutators.common.deleteLink(args))
      toast.success(t('common.toasts.linkDeleted'))
      onServerError(result, () => toast.error(t('common.toasts.linkDeleteFailed')))
    },
    [zero]
  )

  // ── Reactions ──────────────────────────────────────────────────────
  const createReaction = useCallback(
    (args: Parameters<typeof mutators.common.createReaction>[0]) => {
      const result = zero.mutate(mutators.common.createReaction(args))
      toast.success(t('common.toasts.reactionAdded'))
      onServerError(result, () => toast.error(t('common.toasts.reactionAddFailed')))
    },
    [zero]
  )

  const deleteReaction = useCallback(
    (args: Parameters<typeof mutators.common.deleteReaction>[0]) => {
      const result = zero.mutate(mutators.common.deleteReaction(args))
      toast.success(t('common.toasts.reactionRemoved'))
      onServerError(result, () => toast.error(t('common.toasts.reactionRemoveFailed')))
    },
    [zero]
  )

  // ── Timeline ───────────────────────────────────────────────────────
  const createTimelineEvent = useCallback(
    (
      args: Parameters<typeof mutators.common.createTimelineEvent>[0]
    ) => {
      const result = zero.mutate(mutators.common.createTimelineEvent(args))
      toast.success(t('common.toasts.timelineEventCreated'))
      onServerError(result, () => toast.error(t('common.toasts.timelineEventCreateFailed')))
    },
    [zero]
  )

  return {
    // Subscribers
    subscribe,
    unsubscribe,

    // Hashtags
    addHashtag,
    deleteHashtag,
    linkHashtag,
    unlinkHashtag,
    syncEntityHashtags,

    // Links
    createLink,
    deleteLink,

    // Reactions
    createReaction,
    deleteReaction,

    // Timeline
    createTimelineEvent,
  }
}
