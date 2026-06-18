'use client';

import type { OfflineTallyPhase } from '@/features/agendas/logic/offlineTallyToolbar';

import { useOfflineTallyDialogController } from '@/features/agendas/hooks/useOfflineTallyDialogController';

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
  isSubmitting?: boolean;
  passwordError?: string | null;
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
  isSubmitting = false,
  passwordError,
  submitError,
  onSubmit,
}: OfflineTallyDialogProps) {
  const controller = useOfflineTallyDialogController({
    open,
    entries: choices,
    tallies,
    maxTotalVotes,
    getTallyEntryId: getOfflineTallyEntryId,
    getTallyCount: getOfflineTallyCount,
    onSubmit,
  });

  return (
    <OfflineTallyDialogView
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      phase={phase}
      choices={choices}
      maxTotalVotes={maxTotalVotes}
      isSubmitting={isSubmitting}
      passwordError={passwordError}
      submitError={submitError}
      {...controller}
    />
  );
}
