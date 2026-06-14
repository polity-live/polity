'use client';

import { useTargetSelectionDialogController } from '@/features/amendments/hooks/useTargetSelectionDialogController';
import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';
import type { TargetGroupEventSelection } from '@/features/amendments/ui/TargetGroupEventSelector';
import { TargetSelectionDialogView } from './TargetSelectionDialogView';

interface TargetSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  allUsers: { id: string; name: string; email: string | null; avatar?: string | null }[];
  onConfirm: (selection: {
    sourceGroupId: string | null;
    groupId: string | null;
    groupData: TargetGroupEventSelection['groupData'] | null;
    eventId: string | null;
    eventData: TargetGroupEventSelection['eventData'] | null;
    collaboratorUserId: string;
    pathWithEvents: PathWithEventSegment[];
    pathMode: 'hierarchy' | 'workflow';
    workflowId: string | null;
  }) => void;
  isSaving?: boolean;
  showCollaboratorSelection?: boolean;
  title?: string;
  description?: string;
  confirmButtonText?: string;
}

export function TargetSelectionDialog({
  open,
  onOpenChange,
  currentUserId,
  allUsers,
  onConfirm,
  isSaving = false,
  showCollaboratorSelection = true,
  title,
  description,
  confirmButtonText,
}: TargetSelectionDialogProps) {
  return (
    <TargetSelectionDialogView
      open={open}
      currentUserId={currentUserId}
      isSaving={isSaving}
      showCollaboratorSelection={showCollaboratorSelection}
      {...useTargetSelectionDialogController({
        currentUserId,
        allUsers,
        onOpenChange,
        onConfirm,
        title,
        description,
        confirmButtonText,
      })}
    />
  );
}
