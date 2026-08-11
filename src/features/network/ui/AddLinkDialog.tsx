/**
 * Add Link Dialog Component
 *
 * Dialog for adding a new link to the group.
 */

import { useAddLinkDialogController } from '../hooks/useAddLinkDialogController';
import { AddLinkDialogView } from './AddLinkDialogView';

interface AddLinkDialogProps {
  'data-action-scope'?: 'presentation';
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { label: string; url: string }) => unknown | Promise<unknown>;
}

export function AddLinkDialog({ isOpen, onOpenChange, onSubmit }: AddLinkDialogProps) {
  return (
    <AddLinkDialogView
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      {...useAddLinkDialogController({
        onSubmit,
        onSuccess: () => onOpenChange(false),
      })}
    />
  );
}
