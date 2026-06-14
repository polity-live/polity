/**
 * Add Link Dialog Component
 *
 * Dialog for adding a new link to the group.
 */

import { useAddLinkDialogController } from '../hooks/useAddLinkDialogController';
import { AddLinkDialogView } from './AddLinkDialogView';

interface AddLinkDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { label: string; url: string }) => void;
}

export function AddLinkDialog({ isOpen, onOpenChange, onSubmit }: AddLinkDialogProps) {
  return (
    <AddLinkDialogView
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      {...useAddLinkDialogController({ onSubmit })}
    />
  );
}
