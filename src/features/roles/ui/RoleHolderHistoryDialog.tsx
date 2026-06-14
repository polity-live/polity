'use client';

import {
  HolderHistoryDialog,
  type HolderHistoryRoleLike,
} from '@/features/shared/ui/participation';
import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';

type RoleRow = ReturnType<typeof useFacadeGroupRoles>['roles'][number];

interface RoleHolderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleRow;
}

export function RoleHolderHistoryDialog({
  open,
  onOpenChange,
  role,
}: RoleHolderHistoryDialogProps) {
  return (
    <HolderHistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      role={role as HolderHistoryRoleLike}
    />
  );
}
