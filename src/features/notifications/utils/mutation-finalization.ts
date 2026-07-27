import type { ExternalToast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { MutationResultLike } from '@/zero/mutate-with-server-check';
import { toMutationError } from '@/zero/mutate-with-server-check';
import { gatedToast as toast } from './gated-toast';
import { localizeAppError } from '@/features/shared/errors';

export type CreationEntityKind =
  | 'agendaItem'
  | 'aiSkill'
  | 'aiTool'
  | 'amendment'
  | 'blog'
  | 'blogEntry'
  | 'candidate'
  | 'changeRequest'
  | 'collaborator'
  | 'comment'
  | 'conversation'
  | 'customer'
  | 'document'
  | 'documentThread'
  | 'documentVersion'
  | 'election'
  | 'event'
  | 'eventException'
  | 'group'
  | 'groupConnection'
  | 'invitation'
  | 'link'
  | 'member'
  | 'participant'
  | 'payment'
  | 'role'
  | 'roleHolder'
  | 'speaker'
  | 'statement'
  | 'survey'
  | 'todo'
  | 'vote'
  | 'workflow'
  | 'workflowStep';

export type CreationNotificationMode = 'background' | 'silent';

export interface CreationMutationOptions {
  notificationMode?: CreationNotificationMode;
}

export interface CreationFinalizationMessages {
  pending: string;
  success: string;
  error: string;
}

interface TrackMutationFinalizationArgs {
  result: MutationResultLike;
  entityKind: CreationEntityKind;
  operationId?: string;
  messages?: Partial<CreationFinalizationMessages>;
  pendingToast?: ExternalToast;
  successToast?: ExternalToast;
  errorToast?: ExternalToast | ((error: Error) => ExternalToast);
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

let generatedOperationId = 0;

function getEntityLabel(entityKind: CreationEntityKind) {
  return translateText(
    `common.creationFinalization.entities.${entityKind}`,
    entityKind.replace(/([a-z])([A-Z])/g, '$1 $2')
  );
}

export function getCreationFinalizationMessages(
  entityKind: CreationEntityKind,
  overrides: Partial<CreationFinalizationMessages> = {}
): CreationFinalizationMessages {
  const entity = getEntityLabel(entityKind);
  return {
    pending:
      overrides.pending ??
      translateText(
        'common.creationFinalization.pending',
        { entity },
        `${entity} is being finalized`
      ),
    success:
      overrides.success ??
      translateText(
        'common.creationFinalization.success',
        { entity },
        `${entity} created successfully`
      ),
    error:
      overrides.error ??
      translateText(
        'common.creationFinalization.error',
        { entity },
        `${entity} could not be created`
      ),
  };
}

function nextOperationId() {
  generatedOperationId += 1;
  return `${Date.now()}:${generatedOperationId}`;
}

export function getCreationFinalizationToastId(
  entityKind: CreationEntityKind,
  operationId?: string
) {
  return `creation:${entityKind}:${operationId ?? nextOperationId()}`;
}

/**
 * Owns the single toast lifecycle for one optimistic creation.
 * The optimistic client apply remains non-blocking, while success is only shown
 * after both the client apply and authoritative server finalization succeed.
 */
export function trackMutationFinalization({
  result,
  entityKind,
  operationId,
  messages: messageOverrides,
  pendingToast,
  successToast,
  errorToast,
  onSuccess,
  onError,
}: TrackMutationFinalizationArgs) {
  const messages = getCreationFinalizationMessages(entityKind, messageOverrides);
  const toastId = getCreationFinalizationToastId(entityKind, operationId);
  let settled = false;
  let clientSucceeded = false;
  let serverSucceeded = false;

  toast.loading(messages.pending, {
    ...pendingToast,
    id: toastId,
    duration: pendingToast?.duration ?? Infinity,
    testId: pendingToast?.testId ?? 'mutation-finalization-pending-toast',
  });

  const finishSuccess = () => {
    if (settled || !clientSucceeded || !serverSucceeded) return;
    settled = true;
    onSuccess?.();
    toast.finalizationSuccess(messages.success, {
      ...successToast,
      id: toastId,
      duration: successToast?.duration ?? 1500,
    });
  };

  const finishError = (value: unknown) => {
    if (settled) return;
    settled = true;
    const error = value instanceof Error ? value : toMutationError(null);
    onError?.(error);
    const resolvedErrorToast =
      typeof errorToast === 'function' ? errorToast(error) : (errorToast ?? {});
    toast.finalizationError(messages.error, {
      description: localizeAppError(error),
      ...resolvedErrorToast,
      id: toastId,
    });
  };

  (result.client ?? Promise.resolve())
    .then(() => {
      clientSucceeded = true;
      finishSuccess();
    })
    .catch(finishError);

  result.server
    .then(serverResult => {
      if (serverResult.type === 'error') {
        finishError(toMutationError(serverResult.error?.message));
        return;
      }
      serverSucceeded = true;
      finishSuccess();
    })
    .catch(finishError);

  return toastId;
}

export function trackCreationUnlessSilent(
  result: MutationResultLike,
  entityKind: CreationEntityKind,
  options?: CreationMutationOptions,
  operationId?: string,
  messages?: Partial<CreationFinalizationMessages>
) {
  if (options?.notificationMode === 'silent') return;
  trackMutationFinalization({ result, entityKind, operationId, messages });
}

/** Combines several child mutations into one authoritative logical operation. */
export function combineMutationResults(results: readonly MutationResultLike[]): MutationResultLike {
  return {
    client: Promise.all(results.map(result => result.client ?? Promise.resolve())),
    server: Promise.all(results.map(result => result.server)).then(serverResults => {
      const failed = serverResults.find(result => result?.type === 'error');
      return failed ?? { type: 'success' as const };
    }),
  };
}
