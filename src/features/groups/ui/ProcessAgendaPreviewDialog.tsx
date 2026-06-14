interface ProcessAgendaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amendmentId: string;
  amendmentTitle?: string | null;
  processRunId?: string | null;
  focusStepRunId?: string | null;
}
import { useProcessAgendaPreviewDialogController } from './useProcessAgendaPreviewDialogController';
import { ProcessAgendaPreviewDialogView } from './ProcessAgendaPreviewDialogView';

export function ProcessAgendaPreviewDialog({
  open,
  onOpenChange,
  amendmentId,
  amendmentTitle,
  processRunId,
  focusStepRunId,
}: ProcessAgendaPreviewDialogProps) {
  const viewProps = useProcessAgendaPreviewDialogController({
    open,
    onOpenChange,
    amendmentId,
    amendmentTitle,
    processRunId,
    focusStepRunId,
  });

  return <ProcessAgendaPreviewDialogView {...viewProps} />;
}
