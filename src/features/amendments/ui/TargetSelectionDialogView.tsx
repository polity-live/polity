import { TargetGroupEventSelector } from '@/features/amendments/ui/TargetGroupEventSelector';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

import type { TargetGroupEventSelection } from './TargetGroupEventSelector';

interface TargetSelectionDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  collaborators: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  }[];
  showCollaboratorSelection: boolean;
  isSaving: boolean;
  dialogTitle: string;
  dialogDescription: string;
  confirmText: string;
  cancelText: string;
  onCancel: () => void;
  onConfirmClick: () => void;
  onTargetSelect: (selection: TargetGroupEventSelection | null) => void;
}

export function TargetSelectionDialogView({
  open,
  onOpenChange,
  currentUserId,
  collaborators,
  showCollaboratorSelection,
  isSaving,
  dialogTitle,
  dialogDescription,
  confirmText,
  cancelText,
  onCancel,
  onConfirmClick,
  onTargetSelect,
}: TargetSelectionDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="flex h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <TargetGroupEventSelector
            userId={currentUserId}
            collaborators={showCollaboratorSelection ? collaborators : []}
            onSelect={onTargetSelect}
            disablePortal
            allowGroupWithoutEvent
            layoutScope="target-selection-dialog"
          />
        </div>

        <DialogFooter separator className="pt-4">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button onClick={onConfirmClick} disabled={isSaving}>
            {confirmText}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
