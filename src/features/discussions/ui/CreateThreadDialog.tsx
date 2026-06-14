import { useCreateThreadDialogController } from '../hooks/useCreateThreadDialogController';
import { CreateThreadDialogView } from './CreateThreadDialogView';

interface CreateThreadDialogProps {
  amendmentId: string;
  userId?: string;
  amendmentTitle?: string;
  senderName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateThread: (
    amendmentId: string,
    title: string,
    description: string,
    userId: string,
    fileId?: string
  ) => Promise<string>;
}

export function CreateThreadDialog({
  amendmentId,
  userId,
  open,
  onOpenChange,
  onCreateThread,
}: CreateThreadDialogProps) {
  return (
    <CreateThreadDialogView
      open={open}
      onOpenChange={onOpenChange}
      {...useCreateThreadDialogController({
        amendmentId,
        userId,
        onOpenChange,
        onCreateThread,
      })}
    />
  );
}
