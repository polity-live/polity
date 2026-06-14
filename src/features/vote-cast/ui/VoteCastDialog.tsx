'use client';

import { useCallback, useState } from 'react';

import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';
import {
  getElectionModeLabel,
  getSeatCountLabel,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import {
  VoteCastDialogView,
  type VoteCastCandidate,
  type VoteCastChoice,
  type VoteCastDialogStep,
} from '@/features/shared/ui/voting';
import type { VotingPhase } from '../logic/votePhaseHelpers';

interface VoteCastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: VotingPhase;
  candidates?: VoteCastCandidate[];
  maxVotes?: number;
  electionMode?: ElectionMode | null;
  seatCount?: number | null;
  choices?: VoteCastChoice[];
  title?: string;
  forwardingPreview?: {
    nextEventId?: string | null;
    nextGroupName?: string | null;
    nextEventTitle: string;
    nextEventStartDate?: number | null;
  } | null;
  requirePassword?: boolean;
  passwordError?: string | null;
  isPasswordVerifying?: boolean;
  onCastVote?: (choiceId: string) => Promise<void>;
  onCastElectionVote?: (candidateIds: string[]) => Promise<void>;
  onPasswordSubmit?: (password: string) => Promise<void>;
  isLoading?: boolean;
}

export function VoteCastDialog({
  open,
  onOpenChange,
  phase,
  candidates,
  maxVotes = 1,
  electionMode,
  seatCount,
  choices,
  title,
  forwardingPreview,
  requirePassword,
  passwordError,
  isPasswordVerifying,
  onCastVote,
  onCastElectionVote,
  onPasswordSubmit,
  isLoading,
}: VoteCastDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<VoteCastDialogStep>('choice');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const isElection = Boolean(candidates?.length);
  const isMultiSelect = isElection && maxVotes > 1;
  const isListElection = isElection && electionMode === 'list';
  const assignedVoteCount = selectedCandidateIds.length;
  const remainingVoteCount = Math.max(0, maxVotes - assignedVoteCount);

  const handleReset = useCallback(() => {
    setStep('choice');
    setSelectedChoiceId(null);
    setSelectedCandidateIds([]);
  }, []);

  const handleOpenChange = (value: boolean) => {
    if (!value) handleReset();
    onOpenChange(value);
  };

  const submitVote = async () => {
    if (isElection && selectedCandidateIds.length > 0 && onCastElectionVote) {
      await onCastElectionVote(selectedCandidateIds);
    } else if (selectedChoiceId && onCastVote) {
      await onCastVote(selectedChoiceId);
    }
    handleReset();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (requirePassword) {
      setStep('password');
      return;
    }
    await submitVote();
  };

  const handlePasswordSubmit = async (password: string) => {
    try {
      if (onPasswordSubmit) {
        await onPasswordSubmit(password);
      }
      await submitVote();
    } catch {
      // Verification feedback is handled by the password hook that owns passwordError.
    }
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidateIds(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      }
      if (isMultiSelect) {
        if (prev.length >= maxVotes) return prev;
        return [...prev, candidateId];
      }
      return [candidateId];
    });
  };

  const forwardingPreviewContent = forwardingPreview ? (
    <AmendmentForwardingPreview
      nextEventId={forwardingPreview.nextEventId}
      nextGroupName={forwardingPreview.nextGroupName}
      nextEventTitle={forwardingPreview.nextEventTitle}
      nextEventStartDate={forwardingPreview.nextEventStartDate}
      compact
    />
  ) : null;

  return (
    <VoteCastDialogView
      open={open}
      onOpenChange={handleOpenChange}
      step={step}
      phase={phase}
      title={title}
      candidates={candidates}
      choices={choices}
      selectedCandidateIds={selectedCandidateIds}
      selectedChoiceId={selectedChoiceId}
      maxVotes={maxVotes}
      isMultiSelect={isMultiSelect}
      isListElection={isListElection}
      requirePassword={requirePassword}
      passwordError={passwordError}
      isPasswordVerifying={isPasswordVerifying}
      isLoading={isLoading}
      forwardingPreviewContent={forwardingPreviewContent}
      labels={{
        castVote: t('features.events.voting.castVote'),
        confirmWithPassword: t('features.events.voting.confirmWithPassword'),
        cancel: t('common.actions.cancel'),
        confirm: t('common.actions.confirm'),
        yourChoice: t('features.events.voting.yourChoice'),
        selectUpTo: t('features.events.voting.selectUpTo', `Select up to ${maxVotes} candidates`),
        assignedVotes: `${assignedVoteCount}${translateText('generated.inline.0183_von_445584ed')}${maxVotes}${translateText('generated.inline.1231_stimmen_vergeben_6192649c')}`,
        remainingVotes: `${remainingVoteCount}${translateText('generated.inline.1232_stimmen_offen_628de92d')}`,
        electionModeSummary: isListElection
          ? `${getElectionModeLabel('list')}${seatCount ? ` · ${getSeatCountLabel(seatCount)}` : ''}`
          : undefined,
      }}
      onToggleCandidate={toggleCandidate}
      onSelectChoice={setSelectedChoiceId}
      onConfirm={() => void handleConfirm()}
      onCancel={() => handleOpenChange(false)}
      onPasswordSubmit={handlePasswordSubmit}
    />
  );
}
