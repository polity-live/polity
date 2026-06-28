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
    default:
      return null;
  }
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
    canRetry:
      draft?.entityType === 'group' ||
      draft?.entityType === 'event' ||
      draft?.entityType === 'amendment' ||
      draft?.entityType === 'blog',
  };
}
