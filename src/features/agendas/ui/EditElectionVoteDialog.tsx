'use client';

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
import { useEditElectionVoteDialogController } from './useEditElectionVoteDialogController';
import { EditElectionVoteDialogView } from './EditElectionVoteDialogView';

export function EditElectionVoteDialog({
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
  const viewProps = useEditElectionVoteDialogController({
    open,
    onOpenChange,
    agendaItemId,
    agendaItemTitle,
    agendaItemDescription,
    agendaItemDuration,
    election,
    vote,
    choices,
  });

  return <EditElectionVoteDialogView {...viewProps} />;
}
