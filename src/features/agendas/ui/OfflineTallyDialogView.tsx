import type { OfflineTallyPhase } from '@/features/agendas/logic/offlineTallyToolbar';

import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { VotePasswordInput } from '@/features/vote-cast/ui/VotePasswordInput';
import { StatusBadge } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { AgendaDialogContent } from './AgendaUiSystem';

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
  maxPerEntryVotes?: number | null;
  maxPerEntryLimitLabel?: string;
  participantCount?: number | null;
  votesPerParticipant?: number | null;
  isSubmitting: boolean;
  passwordError?: string | null;
  noVotingPasswordSettingsHref?: string;
  submitError?: string | null;
  step: 'counts' | 'password';
  draft: Record<string, string>;
  totalVotes: number;
  isOverTotalLimit: boolean;
  isOverEntryLimit: boolean;
  isOverLimit: boolean;
  overLimitEntryIds: string[];
  onDraftValueChange: (id: string, value: string) => void;
  onConfirmCounts: () => void;
  onBackToCounts: () => void;
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
  maxPerEntryVotes,
  maxPerEntryLimitLabel,
  participantCount,
  votesPerParticipant,
  isSubmitting,
  passwordError,
  noVotingPasswordSettingsHref,
  submitError,
  step,
  draft,
  totalVotes,
  isOverTotalLimit,
  isOverEntryLimit,
  isOverLimit,
  overLimitEntryIds,
  onDraftValueChange,
  onConfirmCounts,
  onBackToCounts,
  onPasswordSubmit,
}: OfflineTallyDialogViewProps) {
  const resolvedMaxPerEntryLimitLabel =
    maxPerEntryLimitLabel ?? translateText('features.agendas.offlineTally.entry');
  const tallyLimitFormula =
    participantCount != null && votesPerParticipant != null && maxTotalVotes != null
      ? translateText('features.agendas.offlineTally.totalLimitFormula', {
          participants: participantCount,
          votes: votesPerParticipant,
          total: maxTotalVotes,
        })
      : null;
  const perEntryLimitMessage =
    isOverEntryLimit && maxPerEntryVotes != null
      ? translateText('features.agendas.offlineTally.maxSelectionsPerEntry', {
          entry: resolvedMaxPerEntryLimitLabel,
          count: maxPerEntryVotes,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AgendaDialogContent size="fullscreen">
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-8">
          <div
            className="bg-card text-card-foreground border-border/70 w-full rounded-xl border p-5 shadow-sm sm:p-6"
            data-slot="offline-tally-centered-card"
          >
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div className="bg-muted/30 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <StatusBadge
                      status={phase}
                      tone={phase === 'final' ? 'danger' : 'info'}
                      className={cn(
                        'uppercase',
                        phase === 'final' && 'animate-pulse ring-2 ring-current/20'
                      )}
                    >
                      {phase}
                    </StatusBadge>
                    <span>{translateText('generated.inline.0013_tally_e086c480')}</span>
                  </span>
                  <span>
                    {translateText('generated.inline.0063_total_offline_selections_31ff1407')}
                    {totalVotes}
                  </span>
                </div>
                {tallyLimitFormula ? (
                  <p className="text-muted-foreground mt-2 text-right">{tallyLimitFormula}</p>
                ) : null}
                {isOverTotalLimit ? (
                  <p className="text-destructive mt-2">
                    {translateText(
                      'generated.inline.0064_the_current_total_exceeds_the_confirmed_offli_9a720fd4'
                    )}
                  </p>
                ) : null}
                {perEntryLimitMessage ? (
                  <p className="text-destructive mt-2">{perEntryLimitMessage}</p>
                ) : null}
              </div>

              {step === 'counts' ? (
                <div className="grid gap-3">
                  {choices.map((choice: any) => {
                    const isEntryOverLimit = overLimitEntryIds.includes(choice.id);

                    return (
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
                          max={maxPerEntryVotes ?? undefined}
                          inputMode="numeric"
                          value={draft[choice.id] ?? '0'}
                          onChange={event => onDraftValueChange(choice.id, event.target.value)}
                          disabled={isSubmitting}
                          aria-invalid={isEntryOverLimit || undefined}
                          className={isEntryOverLimit ? 'border-destructive' : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4">
                  <VotePasswordInput
                    onSubmit={onPasswordSubmit}
                    error={passwordError}
                    noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
                    isLoading={isSubmitting}
                  />
                </div>
              )}

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
                  : step === 'password'
                    ? translateText(
                        'generated.inline.0020_enter_your_voting_pin_above_to_save_these_tal_7fc92e75'
                      )
                    : null}
              </p>
              {step === 'password' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={onBackToCounts}
                >
                  {translateText('generated.inline.0493_back_b52b36b7', 'Back')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
              {step === 'counts' ? (
                <Button
                  type="button"
                  disabled={isSubmitting || isOverLimit}
                  onClick={onConfirmCounts}
                >
                  {translateText('generated.inline.0948_confirm_04a21221', 'Confirm')}
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        </div>
      </AgendaDialogContent>
    </Dialog>
  );
}
