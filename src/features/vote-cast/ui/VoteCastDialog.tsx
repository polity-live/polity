'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

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
  VoteSubmissionOverlay,
  type VoteSubmissionContext,
  type VoteSubmissionProgressStatus,
  type VoteSubmissionProgressStep,
  type VoteSubmissionStatus,
  type VoteSubmissionStepKey,
} from '@/features/shared/ui/voting';
import { toast } from '@/features/shared/ui/ui/sonner';
import { trackServerFinalization } from '@/zero/mutate-with-server-check';
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
  documentPreviewContent?: ReactNode;
  requirePassword?: boolean;
  passwordError?: string | null;
  noVotingPasswordSettingsHref?: string;
  isPasswordVerifying?: boolean;
  onCastVote?: (choiceId: string, context?: VoteSubmissionContext) => Promise<void>;
  onCastElectionVote?: (candidateIds: string[], context?: VoteSubmissionContext) => Promise<void>;
  onPasswordSubmit?: (password: string) => Promise<void>;
  isLoading?: boolean;
}

const SUBMISSION_SUCCESS_CLOSE_DELAY_MS = 780;

function createInitialProgressSteps(): VoteSubmissionProgressStep[] {
  return [
    { key: 'verify', label: 'Stimmrecht prüfen', status: 'pending' },
    { key: 'cast', label: 'Stimme versiegeln', status: 'pending' },
    { key: 'sync', label: 'Ergebnis synchronisieren', status: 'pending' },
  ];
}

function getSubmissionStatusForStep(
  stepKey: VoteSubmissionStepKey,
  stepStatus: VoteSubmissionProgressStatus
): VoteSubmissionStatus | null {
  if (stepStatus === 'error') return 'error';
  if (stepStatus !== 'active') return null;

  if (stepKey === 'verify') return 'verifying';
  if (stepKey === 'cast') return 'casting';
  return 'syncing';
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
  documentPreviewContent,
  requirePassword,
  passwordError,
  noVotingPasswordSettingsHref,
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
  const [submissionStatus, setSubmissionStatus] = useState<VoteSubmissionStatus>('idle');
  const [submissionError, setSubmissionError] = useState<unknown>(null);
  const [submissionSteps, setSubmissionSteps] = useState<VoteSubmissionProgressStep[]>(
    createInitialProgressSteps
  );
  const serverRejectedRef = useRef(false);

  const isElection = Boolean(candidates?.length);
  const isMultiSelect = isElection && maxVotes > 1;
  const isListElection = isElection && electionMode === 'list';
  const assignedVoteCount = selectedCandidateIds.length;
  const remainingVoteCount = Math.max(0, maxVotes - assignedVoteCount);

  const handleReset = useCallback(() => {
    setStep('choice');
    setSelectedChoiceId(null);
    setSelectedCandidateIds([]);
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionSteps(createInitialProgressSteps());
    serverRejectedRef.current = false;
  }, []);

  const resetSubmissionOnly = useCallback(() => {
    setStep('choice');
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionSteps(createInitialProgressSteps());
    serverRejectedRef.current = false;
  }, []);

  const handleOpenChange = (value: boolean) => {
    if (!value) handleReset();
    onOpenChange(value);
  };

  const reportProgress = useCallback(
    (stepKey: VoteSubmissionStepKey, stepStatus: VoteSubmissionProgressStatus) => {
      setSubmissionSteps(prev =>
        prev.map(stepItem =>
          stepItem.key === stepKey ? { ...stepItem, status: stepStatus } : stepItem
        )
      );

      const nextStatus = getSubmissionStatusForStep(stepKey, stepStatus);
      if (nextStatus) {
        setSubmissionStatus(nextStatus);
      }
    },
    []
  );

  const markStep = useCallback(
    (stepKey: VoteSubmissionStepKey, stepStatus: VoteSubmissionProgressStatus) => {
      reportProgress(stepKey, stepStatus);
    },
    [reportProgress]
  );

  const handleServerRejection = useCallback(
    (error: Error) => {
      serverRejectedRef.current = true;
      setSubmissionError(error);
      setSubmissionStatus('error');
      setSubmissionSteps(prev =>
        prev.map(stepItem =>
          stepItem.key === 'sync'
            ? { ...stepItem, status: 'error' }
            : { ...stepItem, status: 'complete' }
        )
      );
      onOpenChange(true);
      toast.error(error.message, {
        action: {
          label: requirePassword ? 'PIN erneut eingeben' : 'Auswahl öffnen',
          onClick: () => {
            setSubmissionStatus('idle');
            setSubmissionError(null);
            setSubmissionSteps(createInitialProgressSteps());
            serverRejectedRef.current = false;
            setStep(requirePassword ? 'password' : 'choice');
            onOpenChange(true);
          },
        },
      });
    },
    [onOpenChange, requirePassword]
  );

  const trackServerResult = useCallback(
    (result: Parameters<NonNullable<VoteSubmissionContext['trackServerResult']>>[0]) => {
      trackServerFinalization(result, {
        onError: handleServerRejection,
      });
    },
    [handleServerRejection]
  );

  const submissionContext = useMemo<VoteSubmissionContext>(
    () => ({
      reportProgress,
      trackServerResult,
    }),
    [reportProgress, trackServerResult]
  );

  const submitVote = useCallback(
    async (context: VoteSubmissionContext) => {
      markStep('cast', 'active');

      if (isElection && selectedCandidateIds.length > 0 && onCastElectionVote) {
        await onCastElectionVote(selectedCandidateIds, context);
      } else if (selectedChoiceId && onCastVote) {
        await onCastVote(selectedChoiceId, context);
      }

      markStep('cast', 'complete');
      markStep('sync', 'active');
      markStep('sync', 'complete');
    },
    [isElection, markStep, onCastElectionVote, onCastVote, selectedCandidateIds, selectedChoiceId]
  );

  const performSubmission = useCallback(
    async (password?: string | null) => {
      setSubmissionError(null);
      setSubmissionSteps(createInitialProgressSteps());
      setSubmissionStatus('verifying');
      serverRejectedRef.current = false;
      markStep('verify', 'active');

      try {
        if (password && onPasswordSubmit) {
          await onPasswordSubmit(password);
        }
        markStep('verify', 'complete');

        await submitVote(submissionContext);
        if (!serverRejectedRef.current) {
          setSubmissionSteps(prev => prev.map(stepItem => ({ ...stepItem, status: 'complete' })));
          setSubmissionStatus('success');
        }
      } catch (error) {
        setSubmissionError(error);
        setSubmissionStatus('error');
        setSubmissionSteps(prev =>
          prev.map(stepItem =>
            stepItem.status === 'active' ? { ...stepItem, status: 'error' } : stepItem
          )
        );
      }
    },
    [markStep, onPasswordSubmit, submissionContext, submitVote]
  );

  const handleConfirm = async () => {
    if (requirePassword) {
      setStep('password');
      return;
    }
    await performSubmission(null);
  };

  const handlePasswordSubmit = async (password: string) => {
    await performSubmission(password);
  };

  const handleSubmissionBack = () => {
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionSteps(createInitialProgressSteps());
    serverRejectedRef.current = false;
    setStep(requirePassword ? 'password' : 'choice');
  };

  const handleSubmissionRetry = () => {
    if (requirePassword) {
      setSubmissionStatus('idle');
      setSubmissionError(null);
      setSubmissionSteps(createInitialProgressSteps());
      serverRejectedRef.current = false;
      setStep('password');
      return;
    }

    void performSubmission(null);
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

  const selectedCandidates =
    candidates?.filter((candidate: any) => selectedCandidateIds.includes(candidate.id)) ?? [];
  const selectedChoice = choices?.find((choice: any) => choice.id === selectedChoiceId);

  useEffect(() => {
    if (submissionStatus !== 'success') return;

    const timeoutId = window.setTimeout(() => {
      resetSubmissionOnly();
      onOpenChange(false);
    }, SUBMISSION_SUCCESS_CLOSE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [onOpenChange, resetSubmissionOnly, submissionStatus]);

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
      noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
      isPasswordVerifying={isPasswordVerifying || submissionStatus === 'verifying'}
      isLoading={isLoading || submissionStatus !== 'idle'}
      submissionActive={submissionStatus !== 'idle'}
      forwardingPreviewContent={forwardingPreviewContent}
      documentPreviewContent={documentPreviewContent}
      submissionOverlay={
        <VoteSubmissionOverlay
          status={submissionStatus}
          selection={{
            type: isElection ? 'election' : 'vote',
            title,
            phase,
            choiceLabel: selectedChoice?.label,
            candidates: selectedCandidates,
            maxVotes,
          }}
          progressSteps={submissionSteps}
          error={submissionError}
          onBack={handleSubmissionBack}
          onRetry={handleSubmissionRetry}
        />
      }
      labels={{
        castVote: t('features.events.voting.castVote'),
        confirmWithPassword: t('features.events.voting.confirmWithPassword'),
        cancel: t('common.actions.cancel'),
        confirm: t('common.actions.confirm'),
        yourChoice: t('features.events.voting.yourChoice'),
        selectUpTo: t('features.events.voting.selectUpTo', `Select up to ${maxVotes} candidates`),
        assignedVotes: `${assignedVoteCount} ${translateText('generated.inline.0183_von_445584ed')} ${maxVotes} ${translateText('generated.inline.1231_stimmen_vergeben_6192649c')}`,
        remainingVotes: `${remainingVoteCount} ${translateText('generated.inline.1232_stimmen_offen_628de92d')}`,
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
