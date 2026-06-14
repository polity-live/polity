'use client';
import type { GroupRelationshipType, NormalizedGroupRelationship } from '../types/network.types';
interface LinkGroupDialogProps {
  currentGroupId: string;
  currentGroupName: string;
  initialTargetGroupId?: string;
  initialRelationshipType?: GroupRelationshipType;
  initialRights?: string[];
  trigger?: React.ReactNode;
  allRelationships?: NormalizedGroupRelationship[];
}

import { useLinkGroupDialogController } from './useLinkGroupDialogController';
import { LinkGroupDialogView } from './LinkGroupDialogView';

export function LinkGroupDialog({
  currentGroupId,
  currentGroupName,
  initialTargetGroupId,
  initialRelationshipType,
  initialRights,
  trigger,
  allRelationships,
}: LinkGroupDialogProps) {
  const viewProps = useLinkGroupDialogController({
    currentGroupId,
    currentGroupName,
    initialTargetGroupId,
    initialRelationshipType,
    initialRights,
    trigger,
    allRelationships,
  });

  return <LinkGroupDialogView {...viewProps} />;
}
