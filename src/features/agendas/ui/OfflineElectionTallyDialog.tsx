'use client';

import { useOfflineTallyDialogController } from '@/features/agendas/hooks/useOfflineTallyDialogController';

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
  isSubmitting = false,
  passwordError,
  submitError,
  onSubmit,
}: OfflineElectionTallyDialogProps) {
  const controller = useOfflineTallyDialogController({
    open,
    entries: candidates,
    tallies,
    maxTotalVotes,
    getTallyEntryId: getOfflineElectionTallyEntryId,
    getTallyCount: getOfflineElectionTallyCount,
    onSubmit,
  });

  return (
    <OfflineElectionTallyDialogView
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      phase={phase}
      candidates={candidates}
      maxTotalVotes={maxTotalVotes}
      isSubmitting={isSubmitting}
      passwordError={passwordError}
      submitError={submitError}
      {...controller}
    />
  );
}
