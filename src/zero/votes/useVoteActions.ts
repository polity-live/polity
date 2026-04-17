import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for vote mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useVoteActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── Votes ──────────────────────────────────────────────────────────

  const createVote = useCallback(
    (args: Parameters<typeof mutators.votes.createVote>[0]) => {
      const result = zero.mutate(mutators.votes.createVote(args))
      toast.success(t('common.agendaToasts.voteCreated'))
      onServerError(result, () => toast.error(t('common.agendaToasts.voteCreateFailed')))
    },
    [zero]
  )

  const updateVote = useCallback(
    (args: Parameters<typeof mutators.votes.updateVote>[0]) => {
      const result = zero.mutate(mutators.votes.updateVote(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.voteUpdateFailed')))
    },
    [zero]
  )

  const deleteVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVote({ id }))
      toast.success(t('common.agendaToasts.voteDeleted'))
      onServerError(result, () => toast.error(t('common.agendaToasts.voteDeleteFailed')))
    },
    [zero]
  )

  // ── Vote Choices ───────────────────────────────────────────────────

  const createVoteChoice = useCallback(
    (args: Parameters<typeof mutators.votes.createVoteChoice>[0]) => {
      const result = zero.mutate(mutators.votes.createVoteChoice(args))
      onServerError(result, (msg) => console.error('Failed to create vote choice:', msg))
    },
    [zero]
  )

  const updateVoteChoice = useCallback(
    (args: Parameters<typeof mutators.votes.updateVoteChoice>[0]) => {
      const result = zero.mutate(mutators.votes.updateVoteChoice(args))
      onServerError(result, (msg) => console.error('Failed to update vote choice:', msg))
    },
    [zero]
  )

  const deleteVoteChoice = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVoteChoice({ id }))
      onServerError(result, (msg) => console.error('Failed to delete vote choice:', msg))
    },
    [zero]
  )

  // ── Voters ─────────────────────────────────────────────────────────

  const createVoter = useCallback(
    (args: Parameters<typeof mutators.votes.createVoter>[0]) => {
      const result = zero.mutate(mutators.votes.createVoter(args))
      onServerError(result, (msg) => console.error('Failed to create voter:', msg))
    },
    [zero]
  )

  const deleteVoter = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVoter({ id }))
      onServerError(result, (msg) => console.error('Failed to delete voter:', msg))
    },
    [zero]
  )

  // ── Indicative Voting ──────────────────────────────────────────────

  const castIndicativeVote = useCallback(
    (
      participationArgs: Parameters<typeof mutators.votes.castIndicativeVote>[0],
      decisions: Parameters<typeof mutators.votes.createIndicativeChoiceDecision>[0][]
    ) => {
      const participationResult = zero.mutate(
        mutators.votes.castIndicativeVote(participationArgs)
      )
      onServerError(participationResult, () => toast.error(t('common.agendaToasts.voteCastFailed')))

      for (const decision of decisions) {
        const decisionResult = zero.mutate(
          mutators.votes.createIndicativeChoiceDecision(decision)
        )
        onServerError(decisionResult, () => toast.error(t('common.agendaToasts.voteCastFailed')))
      }

      toast.success(t('common.agendaToasts.voteCast'))
    },
    [zero]
  )

  // ── Final Voting ───────────────────────────────────────────────────

  const castFinalVote = useCallback(
    (
      participationArgs: Parameters<typeof mutators.votes.castFinalVote>[0],
      decisions: Parameters<typeof mutators.votes.createFinalChoiceDecision>[0][]
    ) => {
      const participationResult = zero.mutate(
        mutators.votes.castFinalVote(participationArgs)
      )
      onServerError(participationResult, () => toast.error(t('common.agendaToasts.voteCastFailed')))

      for (const decision of decisions) {
        const decisionResult = zero.mutate(
          mutators.votes.createFinalChoiceDecision(decision)
        )
        onServerError(decisionResult, () => toast.error(t('common.agendaToasts.voteCastFailed')))
      }

      toast.success(t('common.agendaToasts.voteCast'))
    },
    [zero]
  )

  return {
    // Votes
    createVote,
    updateVote,
    deleteVote,

    // Choices
    createVoteChoice,
    updateVoteChoice,
    deleteVoteChoice,

    // Voters
    createVoter,
    deleteVoter,

    // Voting
    castIndicativeVote,
    castFinalVote,
  }
}
