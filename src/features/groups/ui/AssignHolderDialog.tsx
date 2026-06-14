'use client';

interface RoleWithHistory {
  id: string;
  title?: string | null;
  assignment_mode?: string | null;
  holder_history?: readonly {
    end_date?: number | string | null;
    user?: {
      id: string;
      first_name?: string | null;
      handle?: string | null;
      avatar?: string | null;
    };
  }[];
}

interface AssignHolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithHistory;
  groupId: string;
  onAssign: (userId: string, reason: 'elected' | 'appointed') => void;
}
import { useAssignHolderDialogController } from './useAssignHolderDialogController';
import { AssignHolderDialogView } from './AssignHolderDialogView';

export function AssignHolderDialog({
  open,
  onOpenChange,
  role,
  groupId,
  onAssign,
}: AssignHolderDialogProps) {
  const viewProps = useAssignHolderDialogController({
    open,
    onOpenChange,
    role,
    groupId,
    onAssign,
  });

  return <AssignHolderDialogView {...viewProps} />;
}
