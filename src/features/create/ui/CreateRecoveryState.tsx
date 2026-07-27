import { AlertTriangle, FilePenLine, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { GlobalLoadingAnimation } from '@/features/shared/ui/feedback';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { localizeAppError } from '@/features/shared/errors';
import type { CreateRecoveryDraft } from '../logic/createFinalization';
import { useCreateRecoveryActions } from '../hooks/useCreateRecoveryActions';

interface CreateRecoveryStateProps {
  draft: CreateRecoveryDraft;
}

function entityLabel(draft: CreateRecoveryDraft) {
  return translateText(
    `features.timeline.contentTypes.${draft.entityType}`,
    translateText('pages.create.targets.creation', 'Creation')
  );
}

export function CreateRecoveryState({ draft }: CreateRecoveryStateProps) {
  const { retry, restore, discard, isRetrying, canRetry } = useCreateRecoveryActions(draft);

  if (draft.status === 'pending') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <GlobalLoadingAnimation connectionStatus="connecting" />
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">
            {translateText('pages.create.recovery.pendingTitle', 'Finalizing creation')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {translateText(
              'pages.create.recovery.pendingDescription',
              '{{entity}} is being saved. This page will appear as soon as local data catches up.'
            ).replace('{{entity}}', entityLabel(draft))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="bg-destructive/10 text-destructive flex h-12 w-12 items-center justify-center rounded-xl">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold">
          {translateText('pages.create.recovery.failedTitle', 'Creation needs attention')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {(draft.errorMessage && localizeAppError(draft.errorMessage)) ||
            translateText(
              'pages.create.recovery.failedDescription',
              'The server rejected this creation. You can retry it or restore the form.'
            )}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {canRetry ? (
          <Button type="button" onClick={retry} loading={isRetrying}>
            <RotateCcw className="h-4 w-4" />
            {translateText('pages.create.recovery.retry', 'Retry')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={restore}>
          <FilePenLine className="h-4 w-4" />
          {translateText('pages.create.recovery.restore', 'Restore')}
        </Button>
        <Button type="button" variant="ghost" onClick={discard}>
          <Trash2 className="h-4 w-4" />
          {translateText('pages.create.recovery.discard', 'Discard')}
        </Button>
      </div>
    </div>
  );
}
