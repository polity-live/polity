'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { AlertTriangle, Check, Loader2, Mail, Trash2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { toast } from 'sonner';
import type { NormalizedGroupRelationship } from '../types/network.types';
import type { HierarchyConflictUser } from '../hooks/useHierarchyLinkConflicts';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import { GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import { UserSearchCard } from '@/features/search/ui/UserSearchCard';
import type { GroupConflictPreflightInput } from '@/features/groups/logic/groupConflictPreflight';

function buildNetworkLinkPreflightFromRelationships(
  relationships: readonly NormalizedGroupRelationship[]
): GroupConflictPreflightInput | null {
  const firstRelationship = relationships[0];
  if (!firstRelationship) {
    return null;
  }

  const forwardRelationship = relationships.find(relationship =>
    relationship.id.endsWith(':forward')
  );
  const backwardRelationship = relationships.find(relationship =>
    relationship.id.endsWith(':backward')
  );

  const source_group_id = forwardRelationship
    ? forwardRelationship.group_id
    : backwardRelationship
      ? backwardRelationship.related_group_id
      : firstRelationship.relationship_type === 'child'
        ? firstRelationship.group_id
        : firstRelationship.related_group_id;
  const target_group_id = forwardRelationship
    ? forwardRelationship.related_group_id
    : backwardRelationship
      ? backwardRelationship.group_id
      : firstRelationship.relationship_type === 'child'
        ? firstRelationship.related_group_id
        : firstRelationship.group_id;

  const rightRowsById = new Map<string, NormalizedGroupRelationship[]>();
  for (const relationship of relationships) {
    const key =
      relationship.network_link_right_id ??
      `${relationship.network_link_id}:${relationship.with_right}`;
    const rows = rightRowsById.get(key) ?? [];
    rows.push(relationship);
    rightRowsById.set(key, rows);
  }

  const rights = [...rightRowsById.entries()].flatMap(([rightId, rows]) => {
    const representative = rows[0];
    if (!representative?.with_right) {
      return [];
    }

    const hasForward = rows.some(row => row.id.endsWith(':forward'));
    const hasBackward = rows.some(row => row.id.endsWith(':backward'));
    const direction =
      representative.right_direction === 'bidirectional' || (hasForward && hasBackward)
        ? 'bidirectional'
        : hasForward
          ? 'forward'
          : 'backward';

    return [
      {
        id: representative.network_link_right_id ?? rightId,
        right_key: representative.with_right as
          | 'informationRight'
          | 'amendmentRight'
          | 'rightToSpeak'
          | 'activeVotingRight'
          | 'passiveVotingRight',
        direction: direction as 'forward' | 'backward' | 'bidirectional',
        status:
          (representative.status as 'active' | 'requested' | 'pending' | 'rejected' | null) ??
          'requested',
        initiator_group_id: representative.initiator_group_id ?? null,
      },
    ];
  });

  if (rights.length === 0) {
    return null;
  }

  return {
    kind: 'network_link_upsert' as const,
    link_id: firstRelationship.network_link_id ?? undefined,
    source_group_id,
    target_group_id,
    structural_relation: (firstRelationship.structural_relation === 'sibling'
      ? 'sibling'
      : 'parent_child') as 'sibling' | 'parent_child',
    rights,
    membership_rule: {
      membership_mode: firstRelationship.membership_mode ?? 'none',
      role_id: null,
      source_group_ids: null,
    },
  };
}

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { leaveGroup } = useGroupActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const relationshipPreflightInput = useMemo(
    () => (open ? buildNetworkLinkPreflightFromRelationships(relationships) : null),
    [open, relationships]
  );
  const relationshipPreflight = useGroupConflictPreflight(relationshipPreflightInput, {
    enabled: open && relationshipPreflightInput != null,
  });

  const rightsLabel = useMemo(
    () =>
      relationships
        .map(rel => rel.with_right)
        .filter(Boolean)
        .join(', '),
    [relationships]
  );
  const hasStructuredConflicts = relationshipPreflight.response.conflicts.length > 0;
  const hasLegacyConflictUsers = affectedUsers.length > 0 || partnerUsers.length > 0;

  const handleMessage = (user: HierarchyConflictUser) => {
    navigate({
      to: '/messages',
      search: {
        userId: user.userId,
        name: user.displayName,
      },
    });
    onOpenChange(false);
  };

  const handleRemoveFromGroup = async (user: HierarchyConflictUser) => {
    if (!user.membershipIdInCurrentGroup) {
      toast.error(t('common.network.conflictUserNotInGroup'));
      return;
    }

    setRemovingUserId(user.userId);
    try {
      await leaveGroup({ id: user.membershipIdInCurrentGroup });
      toast.success(t('common.network.conflictUserRemoved'));
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(t('common.network.conflictUserRemoveFailed'));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAccept = async () => {
    if (!canAccept || relationshipPreflight.blocking || relationshipPreflight.isLoading) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAccept();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const affectedMembersDescription = t('common.network.affectedMembersDescription');
  const futurePartnersDescription = t('common.network.futurePartnersDescription', {
    groupName: otherGroupName,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('common.network.manageLinkRequest')}</DialogTitle>
          <DialogDescription>
            {t('common.network.manageLinkRequestDescription', {
              groupName,
              otherGroupName,
              rights: rightsLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        {relationshipPreflight.isLoading ? (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Konflikte werden geprueft ...</span>
          </div>
        ) : !hasStructuredConflicts && !hasLegacyConflictUsers ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{t('common.network.linkPossibleDescription')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {relationshipPreflight.response.summary ??
                  t('common.network.linkConflictDescription')}
              </span>
            </div>
            {hasStructuredConflicts ? (
              <GroupConflictPanel response={relationshipPreflight.response} />
            ) : null}
            <div className="space-y-4">
              <section className="bg-muted/20 space-y-3 rounded-2xl border p-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    {t('common.network.affectedMembersHeading')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{affectedMembersDescription}</p>
                </div>
                {affectedUsers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {affectedUsers.map((user, index) => (
                      <UserSearchCard
                        key={user.userId}
                        index={index}
                        user={{
                          id: user.userId,
                          first_name: user.displayName,
                          avatar: user.avatarUrl,
                        }}
                        actions={
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={event => {
                                event.stopPropagation();
                                handleMessage(user);
                              }}
                            >
                              <Mail className="mr-1 h-3 w-3" />
                              {t('features.timeline.cards.message')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              disabled={removingUserId === user.userId || isSubmitting}
                              onClick={async event => {
                                event.stopPropagation();
                                await handleRemoveFromGroup(user);
                              }}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              {t('common.network.removeFromGroup')}
                            </Button>
                          </>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                    {t('common.network.noAffectedMembers')}
                  </div>
                )}
              </section>

              <section className="bg-muted/20 space-y-3 rounded-2xl border p-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    {t('common.network.futurePartnersHeading')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{futurePartnersDescription}</p>
                </div>
                {partnerUsers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {partnerUsers.map((user, index) => (
                      <UserSearchCard
                        key={user.userId}
                        index={index}
                        user={{
                          id: user.userId,
                          first_name: user.displayName,
                          avatar: user.avatarUrl,
                        }}
                        actions={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={event => {
                              event.stopPropagation();
                              handleMessage(user);
                            }}
                          >
                            <Mail className="mr-1 h-3 w-3" />
                            {t('features.timeline.cards.message')}
                          </Button>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                    {t('common.network.noFuturePartners', { groupName: otherGroupName })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleReject}>
            {t('common.network.reject')}
          </Button>
          <Button
            type="button"
            disabled={
              !canAccept ||
              isSubmitting ||
              relationshipPreflight.blocking ||
              relationshipPreflight.isLoading
            }
            onClick={handleAccept}
          >
            {t('common.network.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
