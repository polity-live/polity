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

interface OfflineElectionTallyCandidate {
  id: string;
  label: string;
}

interface OfflineElectionTallyDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phase: 'indicative' | 'final';
  candidates: readonly OfflineElectionTallyCandidate[];
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

export function OfflineElectionTallyDialogView({
  open,
  onOpenChange,
  title,
  description,
  phase,
  candidates,
  maxTotalVotes,
  isSubmitting,
  passwordError,
  submitError,
  draft,
  totalVotes,
  isOverLimit,
  onDraftValueChange,
  onPasswordSubmit,
}: OfflineElectionTallyDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            {candidates.map((candidate: any) => (
              <div
                key={candidate.id}
                className="grid gap-2 md:grid-cols-[1fr_120px] md:items-center"
              >
                <FormControlLabel htmlFor={`offline-election-tally-${candidate.id}`}>
                  {candidate.label}
                </FormControlLabel>
                <FormControlInput
                  id={`offline-election-tally-${candidate.id}`}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draft[candidate.id] ?? '0'}
                  onChange={event => onDraftValueChange(candidate.id, event.target.value)}
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

        <DialogFooter>
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
      </ScrollableDialogContent>
    </Dialog>
  );
}
