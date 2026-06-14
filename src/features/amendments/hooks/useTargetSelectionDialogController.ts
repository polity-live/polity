import { useMemo, useState } from 'react';

import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';
import type { TargetGroupEventSelection } from '@/features/amendments/ui/TargetGroupEventSelector';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface UseTargetSelectionDialogControllerProps {
  currentUserId: string;
  allUsers: { id: string; name: string; email: string | null; avatar?: string | null }[];
  onOpenChange: (open: boolean) => void;
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
  title?: string;
  description?: string;
  confirmButtonText?: string;
}

export function useTargetSelectionDialogController({
  currentUserId,
  allUsers,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmButtonText,
}: UseTargetSelectionDialogControllerProps) {
  const { t } = useTranslation();
  const [pendingTarget, setPendingTarget] = useState<TargetGroupEventSelection | null>(null);

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

  return {
    collaborators,
    confirmText: confirmButtonText || t('features.amendments.targetSelection.defaultConfirm'),
    dialogDescription: description || t('features.amendments.targetSelection.defaultDescription'),
    dialogTitle: title || t('features.amendments.targetSelection.defaultTitle'),
    cancelText: t('features.amendments.process.cancel'),
    onCancel: handleCancel,
    onConfirmClick: handleConfirm,
    onOpenChange: handleOpenChange,
    onTargetSelect: setPendingTarget,
  };
}
