'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';
import { GroupEventsList } from './GroupEventsList';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  getGroupRelationshipDirectionOptions,
  getCurrentGroupRelationshipLabel,
  type GroupRelationshipDirection,
  type GroupRelationshipRight,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
} from './GroupRelationshipFields';
import {
  getRelationshipDirectionForPreview,
  getRelationshipPreviewData,
} from '../logic/networkRelationshipDialogHelpers';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EventByGroupRow } from '@/zero/events/useEventState';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';
import type { NetworkRelationshipDialogData } from '@/features/network/types/networkEdge.types';
import type { NetworkGroupEntity } from '../types/network.types';

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
    const sourceName =
      relationship.sourceName ?? relationship.source ?? t('common.labels.source', 'Source');
    const targetName =
      relationship.targetName ?? relationship.target ?? t('common.labels.target', 'Target');

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
      direction: getRelationshipDirectionForPreview({
        edgeDirection: relationship.rightEdgeDirections?.[right] ?? 'forward',
        isIncomingPerspective: previewData.isIncomingPerspective,
      }),
    }));
  };

  if (!entity) return null;

  const relationshipPreviewData =
    entity.type === 'relationship' ? getRelationshipPreviewData(entity.data) : null;
  const relationshipDirectionOptions = getGroupRelationshipDirectionOptions(t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entity.type === 'group'
              ? t('common.labels.groupDetails')
              : entity.type === 'user'
                ? t('common.labels.userDetails')
                : entity.type === 'event'
                  ? t('common.labels.eventDetails')
                  : t('common.labels.relationshipDetails')}
          </DialogTitle>
          <DialogDescription>
            {entity.type === 'group'
              ? t('common.labels.viewGroupInfo')
              : entity.type === 'user'
                ? t('common.labels.viewUserInfo')
                : entity.type === 'event'
                  ? t('common.labels.viewEventInfo')
                  : t('common.labels.viewRelationshipInfo')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Group Details with Events */}
          {entity.type === 'group' && entity.data && (
            <div className="space-y-4">
              <GroupSearchCard group={entity.data} />

              {/* Upcoming Events Section */}
              <div className="rounded-lg border p-4">
                <h4 className="mb-3 text-sm font-semibold">{t('common.labels.upcomingEvents')}</h4>
                <GroupEventsList
                  groupId={entity.data.id}
                  onEventClick={(eventId, eventData) => {
                    // If custom onEventSelect handler provided, use it
                    if (entity.data.onEventSelect) {
                      entity.data.onEventSelect(eventId, eventData);
                    } else {
                      // Default behavior: navigate to event page
                      navigate({ to: `/event/${eventId}` });
                      onOpenChange(false);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Event Details */}
          {entity.type === 'event' && entity.data && (
            <div className="rounded-lg border p-4">
              <div className="space-y-3">
                {entity.data.imageURL && (
                  <img
                    src={entity.data.imageURL}
                    alt={entity.data.title ?? undefined}
                    className="h-32 w-full rounded-md object-cover"
                  />
                )}
                <div>
                  <h3 className="text-xl font-semibold">{entity.data.title}</h3>
                  {entity.data.description && (
                    <p className="text-muted-foreground mt-2 text-sm">{entity.data.description}</p>
                  )}
                  {entity.data.startDate && (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{t('common.labels.date')}:</span>{' '}
                      {new Date(entity.data.startDate).toLocaleDateString()}
                    </p>
                  )}
                  {entity.data.location && (
                    <p className="text-sm">
                      <span className="font-medium">{t('common.labels.location')}:</span>{' '}
                      {entity.data.location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Details */}
          {entity.type === 'user' && entity.data && (
            <div className="rounded-lg border p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {entity.data.avatarFile?.url && (
                    <img
                      src={entity.data.avatarFile.url}
                      alt={entity.data.name ?? undefined}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold">{entity.data.name}</h3>
                    {entity.data.subtitle && (
                      <p className="text-muted-foreground text-sm">{entity.data.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Relationship Details */}
          {entity.type === 'relationship' && entity.data && (
            <div className="space-y-4">
              {relationshipPreviewData ? (
                <div className="space-y-2 rounded-lg border p-4">
                  <GroupRelationshipTypeSelect
                    label={t('common.network.relationshipTypeLabel')}
                    value={relationshipPreviewData.relationshipType}
                    currentGroupName={relationshipPreviewData.currentGroupName}
                    selectedGroupName={relationshipPreviewData.selectedGroupName}
                    onValueChange={() => undefined}
                    disabled
                    helperText={getCurrentGroupRelationshipLabel({
                      relationshipType: relationshipPreviewData.relationshipType,
                      currentGroupName: relationshipPreviewData.currentGroupName,
                      selectedGroupName: relationshipPreviewData.selectedGroupName,
                      t,
                    })}
                  />
                </div>
              ) : getRelationshipSentence(entity.data) ? (
                <div className="bg-muted/30 flex items-center gap-2 rounded-lg border p-3">
                  <p className="text-base font-semibold">{getRelationshipSentence(entity.data)}</p>
                </div>
              ) : null}

              {(!entity.data.rights || entity.data.rights.length === 0) &&
                entity.data.relationshipKinds &&
                entity.data.relationshipKinds.length > 0 && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {t('common.labels.connectionType')}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {entity.data.relationshipKinds.length}{' '}
                        {t('common.network.relationshipStatuses')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entity.data.relationshipKinds.map(relationshipKind => (
                        <Badge
                          key={relationshipKind}
                          variant="outline"
                          className={
                            relationshipKind === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : relationshipKind === 'incoming'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                          }
                        >
                          {getRelationshipKindLabel(relationshipKind)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {entity.data.rights && (entity.data.rights as string[]).length > 0 ? (
                <div className="space-y-3">
                  {relationshipPreviewData ? (
                    <GroupRelationshipRightsSelector
                      label={t('common.network.selectRights')}
                      helperText={t(
                        'common.network.directionDetails',
                        'Richtung der einzelnen Rechte'
                      )}
                      selectedRights={new Set(entity.data.rights as GroupRelationshipRight[])}
                      onToggleRight={() => undefined}
                      existingRightStatuses={getExistingRightStatuses(entity.data)}
                      rightDirections={
                        Object.fromEntries(
                          getRightDirectionDetails(entity.data).map(({ right, direction }) => [
                            right,
                            direction,
                          ])
                        ) as Partial<Record<GroupRelationshipRight, GroupRelationshipDirection>>
                      }
                      onDirectionChange={() => undefined}
                      directionOptions={relationshipDirectionOptions}
                      currentGroupName={relationshipPreviewData.currentGroupName}
                      selectedGroupName={relationshipPreviewData.selectedGroupName}
                      currentGroupId={relationshipPreviewData.currentGroupId}
                      selectedGroupId={relationshipPreviewData.selectedGroupId}
                      disabled
                      optionsContainerClassName="max-h-[min(42dvh,22rem)] overflow-y-auto pr-1"
                    />
                  ) : (
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {t('common.network.selectRights')}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {(entity.data.rights as string[]).length} {t('common.labels.rightsGranted')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border p-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {t('common.labels.connectionType')}
                      </p>
                      <p className="text-lg font-semibold">
                        {entity.data.label || t('common.labels.connection')}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {entity.data.label
                        ? entity.data.label
                        : t('common.labels.membershipConnection')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          {entity.type === 'group' && entity.data?.id && (
            <Button
              onClick={() => {
                navigate({ to: `/group/${entity.data.id}` });
                onOpenChange(false);
              }}
            >
              {t('common.labels.showGroup')}
            </Button>
          )}
          {entity.type === 'user' && entity.data?.id && (
            <Button
              onClick={() => {
                navigate({ to: `/user/${entity.data.id}` });
                onOpenChange(false);
              }}
            >
              {t('common.labels.showUser')}
            </Button>
          )}
          {entity.type === 'event' && entity.data?.id && (
            <Button
              onClick={() => {
                navigate({ to: `/event/${entity.data.id}` });
                onOpenChange(false);
              }}
            >
              {t('common.labels.showEvent')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
