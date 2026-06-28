import { useSyncExternalStore } from 'react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { MutationResultLike } from '@/zero/mutate-with-server-check';
import { toMutationError } from '@/zero/mutate-with-server-check';
import type { CreateSubmitTarget } from '../types/create-form.types';

const RECOVERY_PREFIX = 'polity:create:recovery:';
const RESTORE_KEY = 'polity:create:restore';
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const CREATE_RECOVERY_DRAFTS_CHANGED_EVENT = 'polity:create:recovery-drafts-changed';

export type CreateRecoveryDraftStatus = 'pending' | 'failed';

export interface CreateRecoveryDraft {
  id: string;
  entityType: ContentType;
  entityId: string;
  createPath: string;
  formState: unknown;
  mutationPayload: unknown;
  target: CreateSubmitTarget;
  submittedAt: number;
  status: CreateRecoveryDraftStatus;
  errorMessage?: string;
}

interface TrackCreateFinalizationArgs {
  result: MutationResultLike;
  draft: Omit<CreateRecoveryDraft, 'submittedAt' | 'status'>;
  retry?: () => void;
}

function storageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

function recoveryKey(id: string) {
  return `${RECOVERY_PREFIX}${id}`;
}

interface RecoveryDraftSnapshotCacheEntry {
  raw: string | null;
  draft: CreateRecoveryDraft | null;
}

const recoveryDraftSnapshotCache = new Map<string, RecoveryDraftSnapshotCacheEntry>();

function emitCreateRecoveryDraftsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATE_RECOVERY_DRAFTS_CHANGED_EVENT));
}

function getRecoverableEntityDraftId(
  entityType: ContentType | null | undefined,
  entityId?: string
) {
  if (!entityType || !entityId) return null;
  return `${entityType}:${entityId}`;
}

function isCreateRecoveryDraftExpired(
  draft: Pick<CreateRecoveryDraft, 'submittedAt'>,
  now = Date.now(),
  expiryMs = DEFAULT_EXPIRY_MS
) {
  return now - draft.submittedAt > expiryMs;
}

function routeForTarget(target: CreateSubmitTarget) {
  if (target.kind === 'external') return target.href;

  const concretePath = Object.entries(target.params ?? {}).reduce(
    (path, [key, value]) =>
      path
        .replaceAll(`$${key}`, encodeURIComponent(value))
        .replaceAll(`{${key}}`, encodeURIComponent(value)),
    target.to
  );
  const params = new URLSearchParams();
  if (target.search && typeof target.search === 'object') {
    for (const [key, value] of Object.entries(target.search as Record<string, unknown>)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
  }
  const query = params.toString();
  const hash = target.hash ? `#${encodeURIComponent(target.hash)}` : '';
  return `${concretePath}${query ? `?${query}` : ''}${hash}`;
}

function readRecoveryDraftByStorageId(id: string): CreateRecoveryDraft | null {
  if (!storageAvailable()) return null;

  const key = recoveryKey(id);
  const raw = window.sessionStorage.getItem(key);
  const cached = recoveryDraftSnapshotCache.get(id);
  if (cached?.raw === raw) return cached.draft;

  let draft: CreateRecoveryDraft | null;
  try {
    draft = JSON.parse(raw ?? 'null') as CreateRecoveryDraft | null;
  } catch {
    window.sessionStorage.removeItem(key);
    draft = null;
  }

  if (draft && isCreateRecoveryDraftExpired(draft)) {
    window.sessionStorage.removeItem(key);
    draft = null;
  }

  recoveryDraftSnapshotCache.set(id, { raw, draft });
  return draft;
}

function subscribeCreateRecoveryDrafts(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(RECOVERY_PREFIX) || event.key === RESTORE_KEY) {
      recoveryDraftSnapshotCache.clear();
      onStoreChange();
    }
  };

  window.addEventListener(CREATE_RECOVERY_DRAFTS_CHANGED_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(CREATE_RECOVERY_DRAFTS_CHANGED_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function pruneExpiredCreateRecoveryDrafts(now = Date.now(), expiryMs = DEFAULT_EXPIRY_MS) {
  if (!storageAvailable()) return;

  let removedAny = false;
  for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
    const key = window.sessionStorage.key(index);
    if (!key?.startsWith(RECOVERY_PREFIX)) continue;

    try {
      const draft = JSON.parse(
        window.sessionStorage.getItem(key) ?? 'null'
      ) as CreateRecoveryDraft | null;
      if (!draft || now - draft.submittedAt > expiryMs) {
        window.sessionStorage.removeItem(key);
        recoveryDraftSnapshotCache.delete(key.slice(RECOVERY_PREFIX.length));
        removedAny = true;
      }
    } catch {
      window.sessionStorage.removeItem(key);
      recoveryDraftSnapshotCache.delete(key.slice(RECOVERY_PREFIX.length));
      removedAny = true;
    }
  }

  if (removedAny) emitCreateRecoveryDraftsChanged();
}

export function saveCreateRecoveryDraft(draft: CreateRecoveryDraft) {
  if (!storageAvailable()) return;
  pruneExpiredCreateRecoveryDrafts(draft.submittedAt);
  window.sessionStorage.setItem(recoveryKey(draft.id), JSON.stringify(draft));
  recoveryDraftSnapshotCache.delete(draft.id);
  emitCreateRecoveryDraftsChanged();
}

export function getCreateRecoveryDraft(id: string): CreateRecoveryDraft | null {
  return readRecoveryDraftByStorageId(id);
}

export function getCreateRecoveryDraftForEntity(
  entityType: ContentType | null | undefined,
  entityId?: string
): CreateRecoveryDraft | null {
  const draftId = getRecoverableEntityDraftId(entityType, entityId);
  return draftId ? getCreateRecoveryDraft(draftId) : null;
}

export function useCreateRecoveryDraft(
  entityType: ContentType | null | undefined,
  entityId?: string
): CreateRecoveryDraft | null {
  const draftId = getRecoverableEntityDraftId(entityType, entityId);
  return useSyncExternalStore(
    subscribeCreateRecoveryDrafts,
    () => (draftId ? getCreateRecoveryDraft(draftId) : null),
    () => null
  );
}

export function clearCreateRecoveryDraft(id: string) {
  if (!storageAvailable()) return;
  window.sessionStorage.removeItem(recoveryKey(id));
  recoveryDraftSnapshotCache.delete(id);
  emitCreateRecoveryDraftsChanged();
}

export function markCreateRecoveryDraftFailed(id: string, error: unknown) {
  const draft = getCreateRecoveryDraft(id);
  if (!draft) return;

  const mutationError =
    error instanceof Error ? error : toMutationError(typeof error === 'string' ? error : null);
  saveCreateRecoveryDraft({
    ...draft,
    status: 'failed',
    errorMessage: mutationError.message,
  });
}

export function setCreateRestoreDraft(draft: CreateRecoveryDraft) {
  if (!storageAvailable()) return;
  window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify(draft));
  emitCreateRecoveryDraftsChanged();
}

export function consumeCreateRestoreDraft<TFormState>(
  entityType: ContentType
): (CreateRecoveryDraft & { formState: TFormState }) | null {
  if (!storageAvailable()) return null;

  try {
    const draft = JSON.parse(
      window.sessionStorage.getItem(RESTORE_KEY) ?? 'null'
    ) as CreateRecoveryDraft | null;
    if (!draft || draft.entityType !== entityType) return null;
    window.sessionStorage.removeItem(RESTORE_KEY);
    emitCreateRecoveryDraftsChanged();
    return draft as CreateRecoveryDraft & { formState: TFormState };
  } catch {
    window.sessionStorage.removeItem(RESTORE_KEY);
    emitCreateRecoveryDraftsChanged();
    return null;
  }
}

export async function waitForOptimisticCreate(result: MutationResultLike) {
  await (result.client ?? Promise.resolve());
}

export function trackCreateFinalization({ result, draft, retry }: TrackCreateFinalizationArgs) {
  const recoveryDraft: CreateRecoveryDraft = {
    ...draft,
    submittedAt: Date.now(),
    status: 'pending',
  };
  saveCreateRecoveryDraft(recoveryDraft);

  let toastId: string | number | undefined;
  try {
    toastId = toast.loading(
      translateText(
        'pages.create.progress.finalization.pending',
        'Finalizing creation in the background...'
      )
    );
  } catch {
    toastId = undefined;
  }

  const dismissFinalizationToast = () => {
    if (toastId === undefined) return;
    try {
      toast.dismiss(toastId);
    } catch {
      // Some tests mock only the toast variants they assert.
    }
  };

  const completeFinalizationToast = () => {
    if (toastId === undefined) return;
    try {
      toast.finalizationSuccess(
        translateText('pages.create.progress.finalization.saved', 'Saved'),
        {
          id: toastId,
          duration: 1500,
        }
      );
    } catch {
      // Some tests mock only the toast variants they assert.
    }
  };

  result.server
    .then(serverResult => {
      if (serverResult.type === 'success') {
        clearCreateRecoveryDraft(recoveryDraft.id);
        completeFinalizationToast();
        return;
      }

      const error = toMutationError(serverResult.error?.message);
      markCreateRecoveryDraftFailed(recoveryDraft.id, error);
      dismissFinalizationToast();
      toast.error(error.message, {
        action: {
          label: translateText('pages.create.recovery.restore', 'Restore'),
          onClick: () => {
            const failedDraft = getCreateRecoveryDraft(recoveryDraft.id) ?? recoveryDraft;
            setCreateRestoreDraft(failedDraft);
            window.location.assign(failedDraft.createPath);
          },
        },
        cancel: retry
          ? {
              label: translateText('pages.create.recovery.retry', 'Retry'),
              onClick: retry,
            }
          : undefined,
      });
    })
    .catch(error => {
      const mutationError = error instanceof Error ? error : toMutationError(null);
      markCreateRecoveryDraftFailed(recoveryDraft.id, mutationError);
      dismissFinalizationToast();
      toast.error(mutationError.message, {
        action: {
          label: translateText('pages.create.recovery.restore', 'Restore'),
          onClick: () => {
            const failedDraft = getCreateRecoveryDraft(recoveryDraft.id) ?? recoveryDraft;
            setCreateRestoreDraft(failedDraft);
            window.location.assign(failedDraft.createPath);
          },
        },
        cancel: retry
          ? {
              label: translateText('pages.create.recovery.retry', 'Retry'),
              onClick: retry,
            }
          : undefined,
      });
    });
}

export function openCreateRecoveryTarget(draft: CreateRecoveryDraft) {
  window.location.assign(routeForTarget(draft.target));
}
