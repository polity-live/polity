'use client';

import { useEffect, useState } from 'react';

import { useOfflineTallyDialogController } from '@/features/agendas/hooks/useOfflineTallyDialogController';
import { useOfflineTallySubmissionProgress } from '@/features/agendas/hooks/useOfflineTallySubmissionProgress';
import { ActionSubmissionOverlay } from '@/features/shared/ui/action-submission';

import { OfflineElectionTallyDialogView } from './OfflineElectionTallyDialogView';

interface OfflineElectionTallyCandidate {
  id: string;
  label: string;
}

interface OfflineElectionTallyValue {
  candidate_id?: string | null;
  count?: number | null;
}

interface OfflineElectionTallyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phase: 'indicative' | 'final';
  candidates: readonly OfflineElectionTallyCandidate[];
  tallies: readonly OfflineElectionTallyValue[];
  maxTotalVotes?: number | null;
  maxPerEntryVotes?: number | null;
  participantCount?: number | null;
  votesPerParticipant?: number | null;
  isSubmitting?: boolean;
  passwordError?: string | null;
  submitError?: string | null;
  onSubmit: (args: { password: string; counts: Record<string, number> }) => Promise<void>;
}

function getOfflineElectionTallyEntryId(tally: OfflineElectionTallyValue) {
  return tally.candidate_id;
}

function getOfflineElectionTallyCount(tally: OfflineElectionTallyValue) {
  return tally.count;
}

export function OfflineElectionTallyDialog({
  open,
  onOpenChange,
  title,
  description,
  phase,
  candidates,
  tallies,
  maxTotalVotes,
  maxPerEntryVotes,
  participantCount,
  votesPerParticipant,
  isSubmitting = false,
  passwordError,
  submitError,
  onSubmit,
}: OfflineElectionTallyDialogProps) {
  const [step, setStep] = useState<'counts' | 'password'>('counts');

  useEffect(() => {
    if (!open) {
      setStep('counts');
    }
  }, [open]);

  const controller = useOfflineTallyDialogController({
    open,
    entries: candidates,
    tallies,
    maxTotalVotes,
    maxPerEntryVotes,
    getTallyEntryId: getOfflineElectionTallyEntryId,
    getTallyCount: getOfflineElectionTallyCount,
    onSubmit,
  });
  const submissionSteps = useOfflineTallySubmissionProgress(isSubmitting);
  const tallyLimitFormula =
    participantCount != null && votesPerParticipant != null && maxTotalVotes != null
      ? `${participantCount} Participants x ${votesPerParticipant} Stimmen = ${maxTotalVotes}`
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('counts');
    }

    onOpenChange(nextOpen);
  };

  return (
    <>
      <OfflineElectionTallyDialogView
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        phase={phase}
        candidates={candidates}
        maxTotalVotes={maxTotalVotes}
        maxPerEntryVotes={maxPerEntryVotes}
        participantCount={participantCount}
        votesPerParticipant={votesPerParticipant}
        isSubmitting={isSubmitting}
        passwordError={passwordError}
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
          entityLabel: phase === 'final' ? 'Final offline tally' : 'Indicative offline tally',
          badges: [`${controller.totalVotes} offline selections`, tallyLimitFormula].filter(
            (badge): badge is string => Boolean(badge)
          ),
        }}
        onBack={() => undefined}
        onRetry={() => undefined}
      />
    </>
  );
}
