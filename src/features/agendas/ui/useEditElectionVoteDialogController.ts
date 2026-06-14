'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  resolveElectionBallotVisibility,
  resolveVoteBallotVisibility,
  type BallotVisibility,
} from '@/zero/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface ElectionSettings {
  id: string;
  majority_type?: string | null;
  closing_type?: string | null;
  closing_duration_seconds?: number | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
  max_votes?: number;
}

interface VoteSettings {
  id: string;
  majority_type?: string | null;
  closing_type?: string | null;
  closing_duration_seconds?: number | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
}

interface VoteChoice {
  id: string;
  label: string | null;
  order_index: number | null;
}

interface EditElectionVoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendaItemId?: string;
  agendaItemTitle?: string | null;
  agendaItemDescription?: string | null;
  agendaItemDuration?: number | null;
  /** Set for election agenda items */
  election?: ElectionSettings | null;
  /** Set for vote agenda items */
  vote?: VoteSettings | null;
  /** Current choices (for votes only) */
  choices?: VoteChoice[];
}
export function useEditElectionVoteDialogController({
  open,
  onOpenChange,
  agendaItemId,
  agendaItemTitle,
  agendaItemDescription,
  agendaItemDuration,
  election,
  vote,
  choices = [],
}: EditElectionVoteDialogProps) {
  const { t } = useTranslation();
  const agendaActions = useAgendaActions();
  const electionActions = useElectionActions();
  const voteActionsHook = useVoteActions();

  const isElection = !!election;
  const entity = election || vote;

  // Local form state
  const [majorityType, setMajorityType] = useState(entity?.majority_type || 'relative');
  const [closingType, setClosingType] = useState(entity?.closing_type || 'moderator');
  const [closingDuration, setClosingDuration] = useState(
    entity?.closing_duration_seconds ? Math.round(entity.closing_duration_seconds / 60) : 5
  );
  const [visibility, setVisibility] = useState<Visibility>(
    (entity?.visibility as Visibility) ?? 'public'
  );
  const [ballotVisibility, setBallotVisibility] = useState<BallotVisibility>(
    isElection
      ? resolveElectionBallotVisibility(entity?.ballot_visibility)
      : resolveVoteBallotVisibility(entity?.ballot_visibility)
  );
  const [maxVotes, setMaxVotes] = useState(election?.max_votes ?? 1);
  const [title, setTitle] = useState(agendaItemTitle ?? '');
  const [description, setDescription] = useState(agendaItemDescription ?? '');
  const [duration, setDuration] = useState(
    typeof agendaItemDuration === 'number' && agendaItemDuration > 0 ? agendaItemDuration : 30
  );
  const [localChoices, setLocalChoices] = useState<VoteChoice[]>(choices);
  const [newChoiceLabel, setNewChoiceLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync state when dialog opens or entity changes
  useEffect(() => {
    if (!open) {
      return;
    }

    if (entity) {
      setMajorityType(entity.majority_type || 'relative');
      setClosingType(entity.closing_type || 'moderator');
      setClosingDuration(
        entity.closing_duration_seconds ? Math.round(entity.closing_duration_seconds / 60) : 5
      );
      setVisibility((entity.visibility as Visibility) ?? 'public');
      setBallotVisibility(
        isElection
          ? resolveElectionBallotVisibility(entity.ballot_visibility)
          : resolveVoteBallotVisibility(entity.ballot_visibility)
      );
    }

    if (isElection && election) {
      setMaxVotes(election.max_votes ?? 1);
    }

    setTitle(agendaItemTitle ?? '');
    setDescription(agendaItemDescription ?? '');
    setDuration(
      typeof agendaItemDuration === 'number' && agendaItemDuration > 0 ? agendaItemDuration : 30
    );
    setLocalChoices(choices);
    setNewChoiceLabel('');
  }, [
    open,
    entity,
    isElection,
    election,
    agendaItemTitle,
    agendaItemDescription,
    agendaItemDuration,
    choices,
  ]);

  const handleAddChoice = () => {
    const label = newChoiceLabel.trim();
    if (!label) return;
    setLocalChoices(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        order_index: prev.length,
      },
    ]);
    setNewChoiceLabel('');
  };

  const handleRemoveChoice = (id: string) => {
    setLocalChoices(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    if (!agendaItemId && !entity) return;
    setSaving(true);
    try {
      const durationSeconds = closingType === 'time' ? closingDuration * 60 : null;
      const normalizedTitle = title.trim() || null;
      const normalizedDescription = description.trim() || null;
      const normalizedDuration = Number.isFinite(duration) ? Math.max(1, duration) : 30;

      if (agendaItemId) {
        await agendaActions.updateAgendaItem({
          id: agendaItemId,
          title: normalizedTitle,
          description: normalizedDescription,
          duration: normalizedDuration,
        });
      }

      if (isElection && election) {
        await electionActions.updateElection({
          id: election.id,
          description: normalizedDescription,
          majority_type: majorityType,
          closing_type: closingType,
          closing_duration_seconds: durationSeconds,
          visibility,
          ballot_visibility: ballotVisibility,
          max_votes: maxVotes,
        });
      } else if (vote) {
        await voteActionsHook.updateVote({
          id: vote.id,
          description: normalizedDescription,
          majority_type: majorityType,
          closing_type: closingType,
          closing_duration_seconds: durationSeconds,
          visibility,
          ballot_visibility: ballotVisibility,
        });

        // Sync choices — add new, remove deleted
        const existingIds = new Set(choices.map(c => c.id));
        const localIds = new Set(localChoices.map(c => c.id));

        // Add new choices
        for (const lc of localChoices) {
          if (!existingIds.has(lc.id)) {
            await voteActionsHook.createVoteChoice({
              id: lc.id,
              vote_id: vote.id,
              label: lc.label,
              order_index: lc.order_index,
            });
          }
        }

        // Remove deleted choices
        for (const ec of choices) {
          if (!localIds.has(ec.id)) {
            await voteActionsHook.deleteVoteChoice(ec.id);
          }
        }
      }

      onOpenChange(false);
    } catch {
      // toast handled by action hooks
    } finally {
      setSaving(false);
    }
  };
  return {
    open,
    onOpenChange,
    agendaItemId,
    agendaItemTitle,
    agendaItemDescription,
    agendaItemDuration,
    election,
    vote,
    choices,
    t,
    agendaActions,
    electionActions,
    voteActionsHook,
    isElection,
    entity,
    majorityType,
    setMajorityType,
    closingType,
    setClosingType,
    closingDuration,
    setClosingDuration,
    visibility,
    setVisibility,
    ballotVisibility,
    setBallotVisibility,
    maxVotes,
    setMaxVotes,
    title,
    setTitle,
    description,
    setDescription,
    duration,
    setDuration,
    localChoices,
    setLocalChoices,
    newChoiceLabel,
    setNewChoiceLabel,
    saving,
    setSaving,
    handleAddChoice,
    handleRemoveChoice,
    handleSave,
  };
}
