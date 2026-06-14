'use client';
import type { NormalizedGroupRelationship } from '../types/network.types';
import type { HierarchyConflictUser } from '../hooks/useHierarchyLinkConflicts';
interface HierarchyConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  otherGroupName: string;
  relationships: NormalizedGroupRelationship[];
  affectedUsers: HierarchyConflictUser[];
  partnerUsers: HierarchyConflictUser[];
  canAccept: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

import { useHierarchyConflictDialogController } from './useHierarchyConflictDialogController';
import { HierarchyConflictDialogView } from './HierarchyConflictDialogView';

export function HierarchyConflictDialog({
  open,
  onOpenChange,
  groupName,
  otherGroupName,
  relationships,
  affectedUsers,
  partnerUsers,
  canAccept,
  onAccept,
  onReject,
}: HierarchyConflictDialogProps) {
  const viewProps = useHierarchyConflictDialogController({
    open,
    onOpenChange,
    groupName,
    otherGroupName,
    relationships,
    affectedUsers,
    partnerUsers,
    canAccept,
    onAccept,
    onReject,
  });

  return <HierarchyConflictDialogView {...viewProps} />;
}
