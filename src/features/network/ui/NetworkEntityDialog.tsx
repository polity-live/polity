'use client';

import {
  getRelationshipDirectionForPreview,
  getRelationshipPreviewData,
} from '../logic/networkRelationshipDialogHelpers';
import { getSiblingMembershipKind } from '../logic/groupConnectionDerived';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EventByGroupRow } from '@/zero/events/useEventState';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';
import type { NetworkRelationshipDialogData } from '@/features/network/types/networkEdge.types';
import type { GroupRelationshipDirection, NetworkGroupEntity } from '../types/network.types';

interface NetworkEventData {
  id?: string;
  imageURL?: string | null;
  title?: string | null;
  description?: string | null;
  startDate?: string | number | Date | null;
  location?: string | null;
}

interface NetworkUserData {
  id?: string;
  name?: string | null;
  subtitle?: string | null;
  avatarFile?: { url?: string | null } | null;
}

interface NetworkGroupData extends Partial<NetworkGroupEntity> {
  id: string;
  name?: string | null;
  description?: string | null;
  onEventSelect?: (eventId: string, eventData: EventByGroupRow) => void;
}

export type NetworkDialogEntity =
  | { type: 'group'; data: NetworkGroupData }
  | { type: 'event'; data: NetworkEventData }
  | { type: 'user'; data: NetworkUserData }
  | { type: 'relationship'; data: NetworkRelationshipDialogData };

interface NetworkEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: NetworkDialogEntity | null;
}
import { NetworkEntityDialogView } from './NetworkEntityDialogView';
export function NetworkEntityDialog({ open, onOpenChange, entity }: NetworkEntityDialogProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getRelationshipKindLabel = (relationshipKind: NetworkRelationshipKind) => {
    switch (relationshipKind) {
      case 'active':
        return t('common.network.active');
      case 'incoming':
        return t('common.network.incomingRequest');
      case 'outgoing':
        return t('common.network.outgoingRequest');
      default:
        return relationshipKind;
    }
  };

  const getRelationshipSentence = (relationship: NetworkRelationshipDialogData) => {
    const sourceName = relationship.sourceName ?? relationship.source ?? t('common.labels.source');
    const targetName = relationship.targetName ?? relationship.target ?? t('common.labels.target');

    switch (relationship.relationshipType) {
      case 'parent':
        return `${t('common.network.parent')} ${sourceName} → ${t('common.network.child')} ${targetName}`;
      case 'sibling':
        return `${t('common.network.sibling')} ${sourceName} ↔ ${t('common.network.sibling')} ${targetName}`;
      default:
        return typeof relationship.label === 'string' ? relationship.label : null;
    }
  };

  const getExistingRightStatuses = (relationship: NetworkRelationshipDialogData) => {
    const statuses = new Map<string, 'accepted' | 'incoming' | 'outgoing'>();

    Object.entries(relationship.rightRelationshipKinds ?? {}).forEach(
      ([right, relationshipKind]) => {
        if (relationshipKind === 'incoming' || relationshipKind === 'outgoing') {
          statuses.set(right, relationshipKind);
          return;
        }

        if (relationshipKind === 'active') {
          statuses.set(right, 'accepted');
        }
      }
    );

    return statuses;
  };

  const getRightDirectionDetails = (relationship: NetworkRelationshipDialogData) => {
    const previewData = getRelationshipPreviewData(relationship);

    if (!previewData || !relationship.rights || relationship.rights.length === 0) {
      return [] as {
        right: string;
        direction: GroupRelationshipDirection;
      }[];
    }

    return relationship.rights.map(right => ({
      right,
      direction:
        relationship.rightDisplayDirections?.[right] ??
        getRelationshipDirectionForPreview({
          edgeDirection: relationship.rightEdgeDirections?.[right] ?? 'forward',
          isIncomingPerspective: previewData.isIncomingPerspective,
        }),
    }));
  };

  if (!entity) return null;

  const relationshipPreviewData =
    entity.type === 'relationship' ? getRelationshipPreviewData(entity.data) : null;
  const siblingMembershipMode =
    entity.type === 'relationship' && relationshipPreviewData?.relationshipType === 'sibling'
      ? (getSiblingMembershipKind(entity.data.membershipMode) ?? undefined)
      : undefined;
  return (
    <NetworkEntityDialogView
      entity={entity}
      getExistingRightStatuses={getExistingRightStatuses}
      getRelationshipKindLabel={getRelationshipKindLabel}
      getRelationshipSentence={getRelationshipSentence}
      getRightDirectionDetails={getRightDirectionDetails}
      navigate={navigate}
      onOpenChange={onOpenChange}
      open={open}
      relationshipPreviewData={relationshipPreviewData}
      siblingMembershipMode={siblingMembershipMode}
      t={t}
    />
  );
}
