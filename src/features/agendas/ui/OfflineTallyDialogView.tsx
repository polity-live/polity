import type { OfflineTallyPhase } from '@/features/agendas/logic/offlineTallyToolbar';

import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { VotePasswordInput } from '@/features/vote-cast/ui/VotePasswordInput';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface OfflineTallyChoice {
  id: string;
  label: string;
}

interface OfflineTallyDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phase: OfflineTallyPhase;
  choices: readonly OfflineTallyChoice[];
  maxTotalVotes?: number | null;
  isSubmitting: boolean;
  passwordError?: string | null;
  submitError?: string | null;
  draft: Record<string, string>;
  totalVotes: number;
  isOverLimit: boolean;
  onDraftValueChange: (id: string, value: string) => void;
  onPasswordSubmit: (password: string) => Promise<void>;
}

export function OfflineTallyDialogView({
  open,
  onOpenChange,
  title,
  description,
  phase,
  choices,
  maxTotalVotes,
  isSubmitting,
  passwordError,
  submitError,
  draft,
  totalVotes,
  isOverLimit,
  onDraftValueChange,
  onPasswordSubmit,
}: OfflineTallyDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="bg-background h-dvh !max-h-none max-h-none w-screen max-w-none overflow-y-auto rounded-none border-0 p-0 shadow-none sm:max-w-none">
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-8">
          <div
            className="bg-card text-card-foreground w-full rounded-lg border p-5 shadow-[var(--shadow-floating)] sm:p-6"
            data-slot="offline-tally-centered-card"
          >
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div className="bg-muted/30 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">
                    {phase}
                    {translateText('generated.inline.0013_tally_e086c480')}
                  </span>
                  <span>
                    {translateText('generated.inline.0063_total_offline_selections_31ff1407')}
                    {totalVotes}
                    {maxTotalVotes != null ? ` / ${maxTotalVotes}` : ''}
                  </span>
                </div>
                {isOverLimit ? (
                  <p className="text-destructive mt-2">
                    {translateText(
                      'generated.inline.0064_the_current_total_exceeds_the_confirmed_offli_9a720fd4'
                    )}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3">
                {choices.map((choice: any) => (
                  <div
                    key={choice.id}
                    className="grid gap-2 md:grid-cols-[1fr_120px] md:items-center"
                  >
                    <FormControlLabel htmlFor={`offline-tally-${choice.id}`}>
                      {choice.label}
                    </FormControlLabel>
                    <FormControlInput
                      id={`offline-tally-${choice.id}`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={draft[choice.id] ?? '0'}
                      onChange={event => onDraftValueChange(choice.id, event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed p-4">
                <VotePasswordInput
                  onSubmit={onPasswordSubmit}
                  error={passwordError}
                  isLoading={isSubmitting}
                />
              </div>

              {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
            </div>

            <DialogFooter className="mt-5 sm:items-center">
              <p
                className={cn(
                  'text-muted-foreground mr-auto text-sm',
                  isSubmitting && 'inline-flex items-center gap-2'
                )}
              >
                {isSubmitting
                  ? translateText('generated.inline.0019_saving_tally_a0d995b9')
                  : translateText(
                      'generated.inline.0020_enter_your_voting_pin_above_to_save_these_tal_7fc92e75'
                    )}
              </p>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
