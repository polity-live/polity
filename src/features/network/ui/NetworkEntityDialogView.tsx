'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, isRightType } from '@/features/shared/ui/status';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';
import { GroupEventsList } from './GroupEventsList';
import {
  type GroupRelationshipRight,
  GroupRelationshipMembershipModeSummary,
  GroupRelationshipRightsSummary,
  GroupRelationshipTypeSummary,
} from './GroupRelationshipFields';
import { getCanonicalMembershipModeLabel } from '../logic/groupConnectionDerived';
import type { EventByGroupRow } from '@/zero/events/useEventState';
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
export interface NetworkEntityDialogViewProps {
  entity: any;
  getExistingRightStatuses: any;
  getRelationshipKindLabel: any;
  getRelationshipSentence: any;
  getRightDirectionDetails: any;
  navigate: any;
  onOpenChange: any;
  open: any;
  relationshipPreviewData: any;
  siblingMembershipMode: any;
  t: any;
}

export function NetworkEntityDialogView({
  entity,
  getExistingRightStatuses,
  getRelationshipKindLabel,
  getRelationshipSentence,
  getRightDirectionDetails,
  navigate,
  onOpenChange,
  open,
  relationshipPreviewData,
  siblingMembershipMode,
  t,
}: NetworkEntityDialogViewProps) {
  const relationshipRights =
    entity.type === 'relationship' && Array.isArray(entity.data?.rights)
      ? (entity.data.rights as string[]).filter(isRightType)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-w-2xl">
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
                  groupName={entity.data.name ?? undefined}
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
                      className="h-16 w-16 rounded-md object-cover"
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
                <GroupRelationshipTypeSummary
                  label={t('common.network.relationshipTypeLabel')}
                  relationshipType={relationshipPreviewData.relationshipType}
                  currentGroupName={relationshipPreviewData.currentGroupName}
                  selectedGroupName={relationshipPreviewData.selectedGroupName}
                  siblingMembershipMode={siblingMembershipMode}
                  currentGroupId={relationshipPreviewData.currentGroupId}
                  selectedGroupId={relationshipPreviewData.selectedGroupId}
                />
              ) : getRelationshipSentence(entity.data) ? (
                <div className="bg-muted/30 flex items-center gap-2 rounded-lg border p-3">
                  <p className="text-base font-semibold">{getRelationshipSentence(entity.data)}</p>
                </div>
              ) : null}

              {entity.data.membershipMode && relationshipPreviewData ? (
                <GroupRelationshipMembershipModeSummary
                  label={t('common.network.membershipModeLabel')}
                  membershipMode={entity.data.membershipMode}
                  membershipDirection={entity.data.membershipDirection}
                  currentGroupName={relationshipPreviewData.currentGroupName}
                  selectedGroupName={relationshipPreviewData.selectedGroupName}
                  currentGroupId={relationshipPreviewData.currentGroupId}
                  selectedGroupId={relationshipPreviewData.selectedGroupId}
                  membershipSourceGroupId={entity.data.membershipSourceGroupId}
                  membershipTargetGroupId={entity.data.membershipTargetGroupId}
                  membershipSourceGroupName={entity.data.membershipSourceGroupName}
                  membershipTargetGroupName={entity.data.membershipTargetGroupName}
                  requiredSourceRoleId={entity.data.membershipRequiredSourceRoleId}
                  requiredSourceRoleName={entity.data.membershipRequiredSourceRoleName}
                />
              ) : entity.data.membershipMode ? (
                <div className="rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm font-medium">
                      {t('common.network.membershipModeLabel')}
                    </p>
                    <p className="text-lg font-semibold">
                      {getCanonicalMembershipModeLabel(entity.data.membershipMode)}
                    </p>
                  </div>
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
                      {entity.data.relationshipKinds.map((relationshipKind: any) => (
                        <BadgeControl
                          key={relationshipKind}
                          variant="outline"
                          className={
                            relationshipKind === 'active'
                              ? featureThemeClassName('networkNetworkEntityDialogSuccessBadge')
                              : relationshipKind === 'incoming'
                                ? featureThemeClassName('networkNetworkEntityDialogInfoBadge')
                                : featureThemeClassName('networkNetworkEntityDialogWarningBadge')
                          }
                        >
                          {getRelationshipKindLabel(relationshipKind)}
                        </BadgeControl>
                      ))}
                    </div>
                  </div>
                )}

              {relationshipRights.length > 0 ? (
                <div className="space-y-3">
                  {relationshipPreviewData ? (
                    <GroupRelationshipRightsSummary
                      label={t('common.network.selectRights')}
                      selectedRights={relationshipRights as GroupRelationshipRight[]}
                      helperText={t('common.network.directionDetails')}
                      existingRightStatuses={getExistingRightStatuses(entity.data)}
                      rightDirections={
                        Object.fromEntries(
                          getRightDirectionDetails(entity.data)
                            .filter(({ right }: { right: string }) => isRightType(right))
                            .map(({ right, direction }: { right: string; direction: any }) => [
                              right,
                              direction,
                            ])
                        ) as Partial<Record<GroupRelationshipRight, GroupRelationshipDirection>>
                      }
                      currentGroupName={relationshipPreviewData.currentGroupName}
                      selectedGroupName={relationshipPreviewData.selectedGroupName}
                      currentGroupId={relationshipPreviewData.currentGroupId}
                      selectedGroupId={relationshipPreviewData.selectedGroupId}
                      optionsContainerClassName="max-h-[min(42dvh,22rem)] overflow-y-auto pr-1"
                    />
                  ) : (
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {t('common.network.selectRights')}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {relationshipRights.length} {t('common.labels.rightsGranted')}
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-action-id="network.entity-dialog.close"
          >
            {t('common.actions.cancel')}
          </Button>
          {entity.type === 'group' && entity.data?.id && (
            <Button
              onClick={() => {
                navigate({ to: `/group/${entity.data.id}` });
                onOpenChange(false);
              }}
              data-action-id="network.entity-dialog.group.open"
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
              data-action-id="network.entity-dialog.user.open"
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
              data-action-id="network.entity-dialog.event.open"
            >
              {t('common.labels.showEvent')}
            </Button>
          )}
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
