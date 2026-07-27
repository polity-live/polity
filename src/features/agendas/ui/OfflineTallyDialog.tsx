'use client';

import { useEffect, useState } from 'react';

import type { OfflineTallyPhase } from '@/features/agendas/logic/offlineTallyToolbar';

import { useOfflineTallyDialogController } from '@/features/agendas/hooks/useOfflineTallyDialogController';
import { useOfflineTallySubmissionProgress } from '@/features/agendas/hooks/useOfflineTallySubmissionProgress';
import { ActionSubmissionOverlay } from '@/features/shared/ui/action-submission';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import { OfflineTallyDialogView } from './OfflineTallyDialogView';

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
  maxPerEntryVotes?: number | null;
  maxPerEntryLimitLabel?: string;
  participantCount?: number | null;
  votesPerParticipant?: number | null;
  isSubmitting?: boolean;
  passwordError?: string | null;
  noVotingPasswordSettingsHref?: string;
  submitError?: string | null;
  onSubmit: (args: { password: string; counts: Record<string, number> }) => Promise<void>;
}

function getOfflineTallyEntryId(tally: OfflineTallyValue) {
  return tally.id;
}

function getOfflineTallyCount(tally: OfflineTallyValue) {
  return tally.count;
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
  maxPerEntryVotes,
  maxPerEntryLimitLabel,
  participantCount,
  votesPerParticipant,
  isSubmitting = false,
  passwordError,
  noVotingPasswordSettingsHref,
  submitError,
  onSubmit,
}: OfflineTallyDialogProps) {
  const [step, setStep] = useState<'counts' | 'password'>('counts');
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      setStep('counts');
    }
  }, [open]);

  const controller = useOfflineTallyDialogController({
    open,
    entries: choices,
    tallies,
    maxTotalVotes,
    maxPerEntryVotes,
    getTallyEntryId: getOfflineTallyEntryId,
    getTallyCount: getOfflineTallyCount,
    onSubmit,
  });
  const submissionSteps = useOfflineTallySubmissionProgress(isSubmitting);
  const tallyLimitFormula =
    participantCount != null && votesPerParticipant != null && maxTotalVotes != null
      ? t('features.agendas.offlineTally.totalLimitFormula', {
          participants: participantCount,
          votes: votesPerParticipant,
          total: maxTotalVotes,
        })
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('counts');
    }

    onOpenChange(nextOpen);
  };

  return (
    <>
      <OfflineTallyDialogView
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        phase={phase}
        choices={choices}
        maxTotalVotes={maxTotalVotes}
        maxPerEntryVotes={maxPerEntryVotes}
        maxPerEntryLimitLabel={maxPerEntryLimitLabel}
        participantCount={participantCount}
        votesPerParticipant={votesPerParticipant}
        isSubmitting={isSubmitting}
        passwordError={passwordError}
        noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
        submitError={submitError}
        step={step}
        onConfirmCounts={() => {
          if (!controller.isOverLimit) {
            setStep('password');
          }
        }}
        onBackToCounts={() => setStep('counts')}
        {...controller}
      />
      <ActionSubmissionOverlay
        kind="tally"
        status={isSubmitting ? 'submitting' : 'idle'}
        steps={submissionSteps}
        preview={{
          title,
          description,
          entityLabel: t(`features.agendas.offlineTally.entities.${phase}`),
          badges: [
            t('features.agendas.offlineTally.selectionCount', {
              count: controller.totalVotes,
            }),
            tallyLimitFormula,
          ].filter((badge): badge is string => Boolean(badge)),
        }}
        onBack={() => undefined}
        onRetry={() => undefined}
      />
    </>
  );
}
