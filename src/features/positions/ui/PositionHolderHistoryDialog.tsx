'use client';

import {
  HolderHistoryDialog,
  type HolderHistoryRoleLike,
} from '@/features/shared/ui/participation';
import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';

type PositionRow = ReturnType<typeof useFacadeGroupRoles>['roles'][number];

interface PositionHolderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: PositionRow;
}

export function PositionHolderHistoryDialog({
  open,
  onOpenChange,
  role,
}: PositionHolderHistoryDialogProps) {
  return (
    <HolderHistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      role={role as HolderHistoryRoleLike}
    />
  );
}

export { PositionHolderHistoryDialog as RoleHolderHistoryDialog };
