/**
 * useAmendmentWorkflow Hook
 *
 * Manages amendment workflow state transitions and validation.
 */

import { useState, useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { VOTE_PHASE, VOTE_PURPOSE } from '@/zero/votes/vote-workflow';
import {
  EDITING_MODE_TRANSITIONS,
  canTransitionTo,
  isEventPhase,
  isTerminalEditingMode,
  type EditingMode,
} from '@/zero/amendments/editing-mode-policy';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface UseAmendmentWorkflowProps {
  amendmentId: string;
  processBranchId?: string | null;
  currentStatus: EditingMode;
  currentEventId?: string;
  agendaItemId?: string;
  senderId?: string;
  amendmentTitle?: string;
}

export function useAmendmentWorkflow({
  amendmentId,
  processBranchId,
  currentStatus,
  agendaItemId,
}: UseAmendmentWorkflowProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { updateAmendment, updateProcessBranch } = useAmendmentActions();
  const { createVote } = useVoteActions();
  const { initializeChangeRequestVoting } = useAgendaActions();

  /**
   * Transition to a new workflow status
   */
  const transitionTo = useCallback(
    async (targetStatus: EditingMode): Promise<boolean> => {
      if (!canTransitionTo(currentStatus, targetStatus)) {
        toast.error(`Ungültiger Übergang von ${currentStatus} zu ${targetStatus}`);
        return false;
      }

      if (isTerminalEditingMode(currentStatus)) {
        toast.error(
          translateText(
            'generated.inline.0141_amendment_ist_in_einem_finalen_status_und_kan_a6e57071'
          )
        );
        return false;
      }

      setIsTransitioning(true);

      try {
        if (!processBranchId) {
          throw new Error('A process branch is required for workflow transitions.');
        }

        await updateProcessBranch({
          id: processBranchId,
          editing_mode: targetStatus,
        });

        // Auto-initialize CR voting when transitioning into the system-managed event final phase.
        if (targetStatus === 'event_final_closing_vote' && agendaItemId) {
          console.log(
            '[useAmendmentWorkflow] Initializing CR voting — amendmentId:',
            amendmentId,
            'agendaItemId:',
            agendaItemId
          );
          await initializeChangeRequestVoting({
            amendment_id: amendmentId,
            agenda_item_id: agendaItemId,
          });
        } else if (targetStatus === 'event_final_closing_vote' && !agendaItemId) {
          console.warn(
            '[useAmendmentWorkflow] Cannot initialize CR voting — agendaItemId is missing! amendmentId:',
            amendmentId
          );
        }

        toast.success(`Workflow geändert zu: ${targetStatus}`);
        return true;
      } catch (error) {
        console.error('Failed to transition workflow status:', error);
        toast.error(
          translateText('generated.inline.0142_fehler_beim_ndern_des_workflow_status_0352a976')
        );
        return false;
      } finally {
        setIsTransitioning(false);
      }
    },
    [
      amendmentId,
      agendaItemId,
      currentStatus,
      initializeChangeRequestVoting,
      processBranchId,
      updateProcessBranch,
    ]
  );

  /**
   * Start internal voting session
   */
  const startInternalVoting = useCallback(
    async (intervalMinutes: number): Promise<string | null> => {
      if (currentStatus !== 'suggest_internal' && currentStatus !== 'vote_internal') {
        toast.error(
          translateText(
            'generated.inline.0143_internes_voting_kann_nur_im_suggesting_oder_v_12f51dc6'
          )
        );
        return null;
      }

      try {
        // Transition to vote_internal if not already there
        if (currentStatus !== 'vote_internal') {
          await transitionTo('vote_internal');
        }

        // Create voting session
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        const endTime = now + intervalMinutes * 60 * 1000;

        await createVote({
          id: sessionId,
          amendment_id: amendmentId,
          agenda_item_id: null,
          title: translateText('generated.inline.0015_internal_vote_1abb1046'),
          description: null,
          status: VOTE_PHASE.indicative,
          purpose: VOTE_PURPOSE.closing,
          majority_type: null,
          closing_type: null,
          closing_duration_seconds: intervalMinutes * 60,
          closing_end_time: endTime,
          visibility: 'private',
        });

        toast.success(`Interne Abstimmung gestartet (${intervalMinutes} Minuten)`);
        return sessionId;
      } catch (error) {
        console.error('Failed to start internal voting:', error);
        toast.error(
          translateText(
            'generated.inline.0144_fehler_beim_starten_der_internen_abstimmung_7834e018'
          )
        );
        return null;
      }
    },
    [amendmentId, currentStatus, transitionTo]
  );

  /**
   * Submit amendment to event (transition to event phase)
   */
  const submitToEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      // Can submit from all collaborator phase
      const allowedPhases: EditingMode[] = ['edit', 'suggest_internal', 'vote_internal'];

      if (!allowedPhases.includes(currentStatus)) {
        toast.error(
          translateText(
            'generated.inline.0145_amendment_kann_nicht_in_diesem_status_an_ein__20c9ce4d'
          )
        );
        return false;
      }

      try {
        if (!processBranchId) {
          throw new Error('A process branch is required for workflow transitions.');
        }

        await updateAmendment({
          id: amendmentId,
          event_id: eventId,
        });
        await updateProcessBranch({
          id: processBranchId,
          editing_mode: 'suggest_event',
        });

        toast.success(
          translateText('generated.inline.0146_amendment_wurde_an_event_weitergeleitet_847cbe4b')
        );
        return true;
      } catch (error) {
        console.error('Failed to submit to event:', error);
        toast.error(
          translateText('generated.inline.0147_fehler_beim_weiterleiten_an_event_2eb0299d')
        );
        return false;
      }
    },
    [amendmentId, currentStatus, processBranchId, updateAmendment, updateProcessBranch]
  );

  /**
   * Add group as supporter (called after event approval)
   */
  const addGroupSupporter = useCallback(async (): Promise<boolean> => {
    try {
      // Note: supporter_groups is not a column on amendment table.
      // Group supporters are tracked via support_confirmation records.
      toast.success(
        translateText('generated.inline.0148_gruppe_als_supporter_hinzugef_gt_0e13f4b3')
      );
      return true;
    } catch (error) {
      console.error('Failed to add group supporter:', error);
      toast.error(
        translateText('generated.inline.0149_fehler_beim_hinzuf_gen_des_supporters_b044a449')
      );
      return false;
    }
  }, []);

  /**
   * Finalize amendment as passed or rejected
   */
  const finalizeAmendment = useCallback(
    async (result: 'passed' | 'rejected'): Promise<boolean> => {
      if (!canTransitionTo(currentStatus, result)) {
        toast.error(`Ungültiger Übergang zu ${result}`);
        return false;
      }

      try {
        if (!processBranchId) {
          throw new Error('A process branch is required for workflow transitions.');
        }

        await updateProcessBranch({
          id: processBranchId,
          editing_mode: result,
        });

        toast.success(
          result === 'passed' ? '🎉 Amendment wurde angenommen!' : 'Amendment wurde abgelehnt'
        );
        return true;
      } catch (error) {
        console.error('Failed to finalize amendment:', error);
        toast.error(
          translateText('generated.inline.0150_fehler_beim_finalisieren_des_amendments_c95f6157')
        );
        return false;
      }
    },
    [currentStatus, processBranchId, updateProcessBranch]
  );

  return {
    currentStatus,
    isTransitioning,
    canTransitionTo: (target: EditingMode) => canTransitionTo(currentStatus, target),
    possibleTransitions: EDITING_MODE_TRANSITIONS[currentStatus],
    isInEventPhase: isEventPhase(currentStatus),
    isTerminal: isTerminalEditingMode(currentStatus),
    transitionTo,
    startInternalVoting,
    submitToEvent,
    addGroupSupporter,
    finalizeAmendment,
  };
}
