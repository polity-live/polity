'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  TargetGroupEventSelector,
  type TargetGroupEventSelection,
} from '@/features/amendments/ui/TargetGroupEventSelector';
import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';

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
  const { t } = useTranslation();
  const [pendingTarget, setPendingTarget] = useState<TargetGroupEventSelection | null>(null);

  const dialogTitle = title || t('features.amendments.targetSelection.defaultTitle');
  const dialogDescription =
    description || t('features.amendments.targetSelection.defaultDescription');
  const confirmText = confirmButtonText || t('features.amendments.targetSelection.defaultConfirm');

  const collaborators = useMemo(
    () =>
      allUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email ?? undefined,
        avatar: user.avatar ?? undefined,
      })),
    [allUsers]
  );

  const handleCancel = () => {
    onOpenChange(false);
    setPendingTarget(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setPendingTarget(null);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      sourceGroupId: pendingTarget?.sourceGroupId ?? null,
      groupId: pendingTarget?.groupId ?? null,
      groupData: pendingTarget?.groupData ?? null,
      eventId: pendingTarget?.eventId ?? null,
      eventData: pendingTarget?.eventData ?? null,
      collaboratorUserId: pendingTarget?.selectedUserId ?? currentUserId,
      pathWithEvents: pendingTarget?.pathWithEvents ?? [],
      pathMode: pendingTarget?.pathMode ?? 'hierarchy',
      workflowId: pendingTarget?.workflowId ?? null,
    });
    handleCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <TargetGroupEventSelector
            userId={currentUserId}
            collaborators={showCollaboratorSelection ? collaborators : []}
            onSelect={setPendingTarget}
            disablePortal
            allowGroupWithoutEvent
            layoutScope="target-selection-dialog"
          />
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleCancel}>
            {t('features.amendments.process.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
