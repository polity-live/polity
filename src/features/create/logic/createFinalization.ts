import { useSyncExternalStore } from 'react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { MutationResultLike } from '@/zero/mutate-with-server-check';
import { toMutationError } from '@/zero/mutate-with-server-check';
import { toAppError } from '@/features/shared/errors';
import {
  trackMutationFinalization,
  type CreationEntityKind,
} from '@/features/notifications/utils/mutation-finalization';
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
  window.dispatchEvent(new CustomEvent(CREATE_RECOVERY_DRAFTS_CHANGED_EVENT));
}

function getRecoverableEntityDraftId(
  entityType: ContentType | null | undefined,
  entityId?: string
) {
  if (!entityType || !entityId) return null;
  return `${entityType}:${entityId}`;
}

export function isCreateRecoveryDraftExpired(
  draft: Pick<CreateRecoveryDraft, 'submittedAt'>,
  now = Date.now(),
  expiryMs = DEFAULT_EXPIRY_MS
) {
  return now - draft.submittedAt > expiryMs;
}

export function routeForCreateTarget(target: CreateSubmitTarget) {
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

export function subscribeCreateRecoveryDrafts(onStoreChange: () => void) {
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
  const appError = toAppError(mutationError, 'mutation_server_failed');
  saveCreateRecoveryDraft({
    ...draft,
    status: 'failed',
    errorMessage: appError.message,
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

export function getCreateFinalizationEntityKind(draft: CreateRecoveryDraft): CreationEntityKind {
  switch (draft.entityType) {
    case 'agenda_item':
      return 'agendaItem';
    case 'election':
      return 'candidate';
    case 'group':
    case 'event':
    case 'amendment':
    case 'blog':
    case 'statement':
    case 'todo':
    case 'payment':
      return draft.entityType;
    default:
      return 'document';
  }
}

export function trackCreateFinalization({ result, draft, retry }: TrackCreateFinalizationArgs) {
  const recoveryDraft: CreateRecoveryDraft = {
    ...draft,
    submittedAt: Date.now(),
    status: 'pending',
  };
  saveCreateRecoveryDraft(recoveryDraft);

  trackMutationFinalization({
    result,
    entityKind: getCreateFinalizationEntityKind(recoveryDraft),
    operationId: recoveryDraft.id,
    pendingToast: { testId: 'create-finalization-pending-toast' },
    successToast: { testId: 'create-finalization-saved-toast' },
    onSuccess: () => clearCreateRecoveryDraft(recoveryDraft.id),
    onError: error => markCreateRecoveryDraftFailed(recoveryDraft.id, error),
    errorToast: () => ({
      testId: 'create-finalization-error-toast',
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
    }),
  });
}

export function openCreateRecoveryTarget(draft: CreateRecoveryDraft) {
  window.location.assign(routeForCreateTarget(draft.target));
}
