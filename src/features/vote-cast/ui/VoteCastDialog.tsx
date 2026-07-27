'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';
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
import { localizeAppError } from '@/features/shared/errors';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { APP_TUTORIAL_RECOVER_TARGET_EVENT } from '@/features/app-tutorial/events';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { VOTE_CAST_SUCCESS_TOAST_ID } from '../logic/voteCastToast';
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
  forwardingPreview?: AmendmentForwardingPreviewModel | null;
  documentPreviewContent?: ReactNode;
  tutorialAnchor?: string;
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
const AMENDMENT_TUTORIAL_ANCHOR = 'agenda-amendment-vote';
const ELECTION_TUTORIAL_ANCHOR = 'agenda-election-vote';

function tutorialAnchorMatchesDialog(recoveryAnchor: string, tutorialAnchor: string) {
  if (tutorialAnchor === AMENDMENT_TUTORIAL_ANCHOR) {
    return recoveryAnchor.startsWith('agenda-amendment-');
  }
  if (tutorialAnchor === ELECTION_TUTORIAL_ANCHOR) {
    return recoveryAnchor.startsWith('agenda-election-');
  }
  return false;
}

function tutorialAmendmentChoiceId(choices: VoteCastChoice[] | undefined) {
  return choices?.find(
    choice => choice.semanticKey === 'accept' || /^(ja|yes)$/i.test(choice.label.trim())
  )?.id;
}

function createInitialProgressSteps(): VoteSubmissionProgressStep[] {
  return [
    {
      key: 'verify',
      copy: { key: 'common.voteSubmission.steps.verify' },
      status: 'pending',
    },
    {
      key: 'cast',
      copy: { key: 'common.voteSubmission.steps.cast' },
      status: 'pending',
    },
    {
      key: 'sync',
      copy: { key: 'common.voteSubmission.steps.sync' },
      status: 'pending',
    },
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
  tutorialAnchor,
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
  const submissionInFlightRef = useRef(false);

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
    submissionInFlightRef.current = false;
  }, []);

  const resetSubmissionOnly = useCallback(() => {
    setStep('choice');
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionSteps(createInitialProgressSteps());
    serverRejectedRef.current = false;
    submissionInFlightRef.current = false;
  }, []);

  const handleOpenChange = (value: boolean) => {
    if (!value && !tutorialAnchor) handleReset();
    onOpenChange(value);
  };

  useEffect(() => {
    if (!tutorialAnchor) return;

    const recoverTarget = (event: WindowEventMap[typeof APP_TUTORIAL_RECOVER_TARGET_EVENT]) => {
      const recoveryAnchor = event.detail.anchor;
      if (!tutorialAnchorMatchesDialog(recoveryAnchor, tutorialAnchor)) return;

      setSubmissionStatus('idle');
      setSubmissionError(null);
      setSubmissionSteps(createInitialProgressSteps());
      serverRejectedRef.current = false;
      submissionInFlightRef.current = false;

      if (tutorialAnchor === AMENDMENT_TUTORIAL_ANCHOR) {
        setSelectedChoiceId(currentChoiceId => {
          if (currentChoiceId && choices?.some(choice => choice.id === currentChoiceId)) {
            return currentChoiceId;
          }
          return tutorialAmendmentChoiceId(choices) ?? choices?.[0]?.id ?? null;
        });
      } else {
        setSelectedCandidateIds(currentCandidateIds => {
          const validCandidateIds = currentCandidateIds.filter(candidateId =>
            candidates?.some(candidate => candidate.id === candidateId)
          );
          if (validCandidateIds.length > 0) return validCandidateIds;
          return candidates?.[0] ? [candidates[0].id] : [];
        });
      }

      setStep(recoveryAnchor.endsWith('-password') ? 'password' : 'choice');
      onOpenChange(true);
    };

    window.addEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recoverTarget);
    return () => window.removeEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recoverTarget);
  }, [candidates, choices, onOpenChange, tutorialAnchor]);

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
      toast.error(localizeAppError(error), {
        action: {
          label: requirePassword
            ? t('common.voteSubmission.enterPinAgain')
            : t('common.voteSubmission.openSelection'),
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
    [onOpenChange, requirePassword, t]
  );

  const trackServerResult = useCallback(
    async (result: Parameters<NonNullable<VoteSubmissionContext['trackServerResult']>>[0]) => {
      try {
        await serverConfirmed(result);
        toast.success(t('common.agendaToasts.voteCast'), {
          id: VOTE_CAST_SUCCESS_TOAST_ID,
        });
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Vote submission failed.');
        handleServerRejection(normalizedError);
        throw normalizedError;
      }
    },
    [handleServerRejection, t]
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
      if (submissionInFlightRef.current) return;
      submissionInFlightRef.current = true;
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
      } finally {
        submissionInFlightRef.current = false;
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
      status={forwardingPreview.status}
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
      tutorialAnchor={tutorialAnchor}
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
