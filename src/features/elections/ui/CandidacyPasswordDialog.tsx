'use client';

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { BadgeControl } from '@/features/shared/ui/status';
import { VotePasswordInput } from '@/features/vote-cast/ui/VotePasswordInput';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { KeyRound, RefreshCcw, UserCheck } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';

export type CandidacyPasswordDialogMode = 'become' | 'withdraw';

export interface CandidacyPasswordDialogProps {
  open: boolean;
  mode: CandidacyPasswordDialogMode;
  electionTitle?: string | null;
  electionDescription?: string | null;
  roleTitle?: string | null;
  candidatesCount?: number | null;
  majorityType?: string | null;
  error?: string | null;
  noVotingPasswordSettingsHref?: string;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void | Promise<void>;
}

export function CandidacyPasswordDialog({
  open,
  mode,
  electionTitle,
  electionDescription,
  roleTitle,
  candidatesCount,
  majorityType,
  error,
  noVotingPasswordSettingsHref,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: CandidacyPasswordDialogProps) {
  const { t } = useTranslation();
  const isWithdraw = mode === 'withdraw';
  const loadingSteps = [
    {
      key: 'verify',
      icon: KeyRound,
      label: t('features.events.candidacy.stepVerifyPin'),
    },
    {
      key: 'commit',
      icon: UserCheck,
      label: isWithdraw
        ? t('features.events.candidacy.stepWithdrawCandidacy')
        : t('features.events.candidacy.stepSubmitCandidacy'),
    },
    {
      key: 'sync',
      icon: RefreshCcw,
      label: t('features.events.candidacy.stepSyncElection'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        showCloseButton={!isSubmitting}
        className="bg-background h-dvh !max-h-none max-h-none w-screen max-w-none overflow-y-auto rounded-none border-0 p-0 shadow-none sm:max-w-none"
      >
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-8">
          <div
            className="bg-card text-card-foreground w-full rounded-lg border p-5 shadow-[var(--shadow-floating)] sm:p-6"
            data-slot="candidacy-password-centered-card"
          >
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>
                {isWithdraw
                  ? t('features.events.candidacy.withdrawTitle')
                  : t('features.events.candidacy.becomeTitle')}
              </DialogTitle>
              <DialogDescription>
                {isSubmitting
                  ? t('features.events.candidacy.loadingDescription')
                  : isWithdraw
                    ? t('features.events.candidacy.withdrawDescription')
                    : t('features.events.candidacy.becomeDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div className="bg-muted/30 rounded-lg border p-4">
                <div className="space-y-1">
                  {electionTitle ? <p className="font-medium">{electionTitle}</p> : null}
                  {electionDescription ? (
                    <p className="text-muted-foreground text-sm">{electionDescription}</p>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {roleTitle ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t('features.events.candidacy.role')}
                      </span>
                      <span className="text-right font-medium">{roleTitle}</span>
                    </div>
                  ) : null}
                  {typeof candidatesCount === 'number' ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t('features.events.candidacy.currentCandidates')}
                      </span>
                      <span className="font-medium">{candidatesCount}</span>
                    </div>
                  ) : null}
                  {majorityType ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t('features.events.candidacy.votingMethod')}
                      </span>
                      <BadgeControl variant="outline" size="xs">
                        {majorityType}
                      </BadgeControl>
                    </div>
                  ) : null}
                </div>
              </div>

              {isSubmitting ? (
                <div
                  className="grid gap-3 sm:grid-cols-3"
                  data-slot="candidacy-submission-steps"
                  aria-label={t('features.events.candidacy.loadingStepsLabel')}
                >
                  {loadingSteps.map((step, index) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.key}
                        className="border-border/70 bg-background/70 rounded-2xl border px-3 py-4 shadow-[var(--shadow-panel)]"
                      >
                        <div className="flex flex-col items-center gap-3 text-center">
                          <span
                            className={cn(
                              'border-primary/30 bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full border',
                              'animate-pulse'
                            )}
                            style={{ animationDelay: `${index * 180}ms` }}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="text-sm font-medium">{step.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4">
                  <VotePasswordInput
                    onSubmit={onSubmit}
                    error={error}
                    noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
                    isLoading={isSubmitting}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-5 items-center sm:items-center">
              <p className="text-muted-foreground mr-auto text-sm">
                {isSubmitting ? t('features.events.candidacy.verifyingPin') : null}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                {t('features.events.candidacy.cancel')}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
