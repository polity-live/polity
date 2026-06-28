import { useCallback, useState } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { mutators } from '@/zero/mutators';
import type { MutationResultLike } from '@/zero/mutate-with-server-check';
import {
  clearCreateRecoveryDraft,
  setCreateRestoreDraft,
  trackCreateFinalization,
  type CreateRecoveryDraft,
} from '../logic/createFinalization';

function toTrackableDraft(
  draft: CreateRecoveryDraft
): Omit<CreateRecoveryDraft, 'submittedAt' | 'status'> {
  return {
    id: draft.id,
    entityType: draft.entityType,
    entityId: draft.entityId,
    createPath: draft.createPath,
    formState: draft.formState,
    mutationPayload: draft.mutationPayload,
    target: draft.target,
  };
}

function createRetryMutation(
  zero: ReturnType<typeof useZero>,
  draft: CreateRecoveryDraft
): MutationResultLike | null {
  switch (draft.entityType) {
    case 'group':
      return zero.mutate(
        mutators.groups.createFull(
          draft.mutationPayload as Parameters<typeof mutators.groups.createFull>[0]
        )
      );
    case 'event':
      return zero.mutate(
        mutators.events.createFull(
          draft.mutationPayload as Parameters<typeof mutators.events.createFull>[0]
        )
      );
    case 'amendment':
      return zero.mutate(
        mutators.amendments.createFull(
          draft.mutationPayload as Parameters<typeof mutators.amendments.createFull>[0]
        )
      );
    case 'blog':
      return zero.mutate(
        mutators.blogs.createFull(
          draft.mutationPayload as Parameters<typeof mutators.blogs.createFull>[0]
        )
      );
    case 'statement':
      return zero.mutate(
        mutators.statements.createFull(
          draft.mutationPayload as Parameters<typeof mutators.statements.createFull>[0]
        )
      );
    case 'todo':
      return zero.mutate(
        mutators.todos.createFull(
          draft.mutationPayload as Parameters<typeof mutators.todos.createFull>[0]
        )
      );
    case 'agenda_item':
      return zero.mutate(
        mutators.agendas.createFull(
          draft.mutationPayload as Parameters<typeof mutators.agendas.createFull>[0]
        )
      );
    case 'payment':
      return zero.mutate(
        mutators.payments.createPayment(
          draft.mutationPayload as Parameters<typeof mutators.payments.createPayment>[0]
        )
      );
    case 'election':
      if (!draft.createPath.includes('election-candidate')) return null;
      return zero.mutate(
        mutators.elections.addCandidate(
          draft.mutationPayload as Parameters<typeof mutators.elections.addCandidate>[0]
        )
      );
    default:
      return null;
  }
}

function canRetryCreateDraft(draft: CreateRecoveryDraft | null) {
  if (!draft) return false;
  if (draft.entityType === 'election') return draft.createPath.includes('election-candidate');

  return (
    draft.entityType === 'group' ||
    draft.entityType === 'event' ||
    draft.entityType === 'amendment' ||
    draft.entityType === 'blog' ||
    draft.entityType === 'statement' ||
    draft.entityType === 'todo' ||
    draft.entityType === 'agenda_item' ||
    draft.entityType === 'payment'
  );
}

export function useCreateRecoveryActions(draft: CreateRecoveryDraft | null) {
  const zero = useZero();
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(() => {
    if (!draft) return;

    const runRetry = () => {
      const result = createRetryMutation(zero, draft);
      if (!result) return;

      void (result.client ?? Promise.resolve()).finally(() => {
        setIsRetrying(false);
      });
      trackCreateFinalization({
        result,
        draft: toTrackableDraft(draft),
        retry: runRetry,
      });
    };

    setIsRetrying(true);
    runRetry();
  }, [draft, zero]);

  const restore = useCallback(() => {
    if (!draft || typeof window === 'undefined') return;
    setCreateRestoreDraft(draft);
    window.location.assign(draft.createPath);
  }, [draft]);

  const discard = useCallback(() => {
    if (!draft) return;
    clearCreateRecoveryDraft(draft.id);
  }, [draft]);

  return {
    retry,
    restore,
    discard,
    isRetrying,
    canRetry: canRetryCreateDraft(draft),
  };
}
