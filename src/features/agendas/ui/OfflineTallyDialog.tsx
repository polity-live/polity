'use client';

import { FormControlInput } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { useEffect, useMemo, useState } from 'react';
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
import type { OfflineTallyPhase } from '@/features/agendas/logic/offlineTallyToolbar';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface OfflineTallyChoice {
  id: string;
  label: string;
}

interface OfflineTallyValue {
  id: string;
  count?: number | null;
}

interface OfflineTallyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phase: OfflineTallyPhase;
  choices: readonly OfflineTallyChoice[];
  tallies: readonly OfflineTallyValue[];
  maxTotalVotes?: number | null;
  isSubmitting?: boolean;
  passwordError?: string | null;
  submitError?: string | null;
  onSubmit: (args: { password: string; counts: Record<string, number> }) => Promise<void>;
}

export function OfflineTallyDialog({
  open,
  onOpenChange,
  title,
  description,
  phase,
  choices,
  tallies,
  maxTotalVotes,
  isSubmitting = false,
  passwordError,
  submitError,
  onSubmit,
}: OfflineTallyDialogProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft: Record<string, string> = {};
    for (const choice of choices) {
      const tally = tallies.find(item => item.id === choice.id);
      nextDraft[choice.id] = String(tally?.count ?? 0);
    }
    setDraft(nextDraft);
  }, [choices, open, tallies]);

  const normalizedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const choice of choices) {
      counts[choice.id] = Math.max(0, Number.parseInt(draft[choice.id] ?? '0', 10) || 0);
    }
    return counts;
  }, [choices, draft]);

  const totalVotes = useMemo(
    () => Object.values(normalizedCounts).reduce((sum, value) => sum + value, 0),
    [normalizedCounts]
  );

  const isOverLimit = maxTotalVotes != null && totalVotes > maxTotalVotes;

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
            {choices.map(choice => (
              <label
                key={choice.id}
                className="grid gap-2 md:grid-cols-[1fr_120px] md:items-center"
              >
                <span className="text-sm font-medium">{choice.label}</span>
                <FormControlInput
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draft[choice.id] ?? '0'}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      [choice.id]: event.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                />
              </label>
            ))}
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <VotePasswordInput
              onSubmit={password => onSubmit({ password, counts: normalizedCounts })}
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
