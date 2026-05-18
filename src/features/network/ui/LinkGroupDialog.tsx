'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { Link } from 'lucide-react';
import { useGroupState } from '@/zero/groups/useGroupState';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { NormalizedGroupRelationship } from '../types/network.types';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import {
  buildExistingRightStatusesForDirection,
  type GroupRelationshipRightDisplayStatus,
} from '../logic/networkRelationshipHelpers';
import {
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
  invertGroupRelationshipType,
  type GroupRelationshipRight,
  type GroupRelationshipType,
} from './GroupRelationshipFields';

interface LinkGroupDialogProps {
  currentGroupId: string;
  currentGroupName: string;
  initialTargetGroupId?: string;
  initialRelationshipType?: 'parent' | 'child';
  initialRights?: string[];
  trigger?: React.ReactNode;
  allRelationships?: NormalizedGroupRelationship[];
}

export function LinkGroupDialog({
  currentGroupId,
  currentGroupName,
  initialTargetGroupId,
  initialRelationshipType,
  initialRights,
  trigger,
  allRelationships,
}: LinkGroupDialogProps) {
  const { t } = useTranslation();
  const { createRelationship, deleteRelationship } = useGroupActions();
  const [open, setOpen] = useState(false);
  const initializedForOpenRef = useRef(false);
  const lastSyncedRightsKeyRef = useRef<string | null>(null);

  const isEditMode = !!initialTargetGroupId;

  const {
    group: currentGroup,
    relationships: hierarchyRaw,
    relationshipsAsTarget: hierarchyAsTargetRaw,
    searchResults: availableGroupsRaw,
    isLoading: groupStateLoading,
  } = useGroupState({ groupId: currentGroupId, includeSearch: true });

  const isBaseGroup = currentGroup?.group_type === 'base';
  const defaultRelationshipType: GroupRelationshipType = isBaseGroup ? 'child' : 'parent';

  const [selectedGroupId, setSelectedGroupId] = useState(initialTargetGroupId || '');
  const [relationshipType, setRelationshipType] = useState<GroupRelationshipType>(
    initialRelationshipType
      ? invertGroupRelationshipType(initialRelationshipType)
      : defaultRelationshipType
  );
  const [selectedRights, setSelectedRights] = useState<Set<GroupRelationshipRight>>(
    initialRights ? new Set(initialRights as GroupRelationshipRight[]) : new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableGroups = (availableGroupsRaw || []).filter(group => group.id !== currentGroupId);

  const shouldQuery = !allRelationships && !!selectedGroupId && open;
  const isLoadingQuery = shouldQuery ? groupStateLoading : false;

  const hierarchyRelationships = useMemo(
    () => [...(hierarchyRaw || []), ...(hierarchyAsTargetRaw || [])],
    [hierarchyRaw, hierarchyAsTargetRaw]
  );

  const relevantRelationships = useMemo(() => {
    const relationships = allRelationships ?? hierarchyRelationships;

    return relationships.filter(
      rel =>
        (rel.group_id === currentGroupId && rel.related_group_id === selectedGroupId) ||
        (rel.group_id === selectedGroupId && rel.related_group_id === currentGroupId)
    );
  }, [allRelationships, hierarchyRelationships, currentGroupId, selectedGroupId]);

  const currentDirectionRelationships = useMemo(
    () =>
      relevantRelationships.filter(rel => {
        if (relationshipType === 'parent') {
          return rel.group_id === currentGroupId && rel.related_group_id === selectedGroupId;
        }

        return rel.group_id === selectedGroupId && rel.related_group_id === currentGroupId;
      }),
    [relevantRelationships, relationshipType, selectedGroupId, currentGroupId]
  );

  const existingRightsForDirection = useMemo(
    () =>
      new Set(
        currentDirectionRelationships
          .map(rel => rel.with_right)
          .filter((right): right is GroupRelationshipRight => right != null)
      ),
    [currentDirectionRelationships]
  );

  const existingRightStatuses = useMemo<ReadonlyMap<string, GroupRelationshipRightDisplayStatus>>(
    () =>
      selectedGroupId
        ? buildExistingRightStatusesForDirection(relevantRelationships, {
            currentGroupId,
            otherGroupId: selectedGroupId,
            relationshipType,
          })
        : new Map<string, GroupRelationshipRightDisplayStatus>(),
    [relevantRelationships, currentGroupId, selectedGroupId, relationshipType]
  );

  const existingRightsSignature = useMemo(
    () => Array.from(existingRightsForDirection).sort().join('|'),
    [existingRightsForDirection]
  );

  useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      lastSyncedRightsKeyRef.current = null;
      return;
    }

    if (initializedForOpenRef.current) {
      return;
    }

    initializedForOpenRef.current = true;

    if (isEditMode && initialTargetGroupId) {
      setSelectedGroupId(initialTargetGroupId);
      setRelationshipType(
        initialRelationshipType
          ? invertGroupRelationshipType(initialRelationshipType)
          : defaultRelationshipType
      );
      setSelectedRights(
        initialRights ? new Set(initialRights as GroupRelationshipRight[]) : new Set()
      );
      return;
    }

    setSelectedGroupId('');
    setRelationshipType(defaultRelationshipType);
    setSelectedRights(new Set());
  }, [
    open,
    isEditMode,
    initialTargetGroupId,
    initialRelationshipType,
    initialRights,
    defaultRelationshipType,
  ]);

  useEffect(() => {
    if (!open || isEditMode || selectedGroupId) {
      return;
    }

    setRelationshipType(defaultRelationshipType);
  }, [open, isEditMode, selectedGroupId, defaultRelationshipType]);

  useEffect(() => {
    if (!open || isEditMode) {
      return;
    }

    const syncKey = `${selectedGroupId}:${relationshipType}:${existingRightsSignature}`;
    if (lastSyncedRightsKeyRef.current === syncKey) {
      return;
    }

    setSelectedRights(new Set(existingRightsForDirection));
    lastSyncedRightsKeyRef.current = syncKey;
  }, [
    open,
    isEditMode,
    selectedGroupId,
    relationshipType,
    existingRightsForDirection,
    existingRightsSignature,
  ]);

  const toggleRight = (right: GroupRelationshipRight) => {
    const next = new Set(selectedRights);

    if (next.has(right)) {
      next.delete(right);
    } else {
      next.add(right);
    }

    setSelectedRights(next);
  };

  const handleSubmit = async () => {
    if (!selectedGroupId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const transactions = [];

      const existingRightsSet = new Set(
        currentDirectionRelationships
          .map(rel => rel.with_right)
          .filter((right): right is GroupRelationshipRight => right != null)
      );

      for (const right of selectedRights) {
        if (!existingRightsSet.has(right)) {
          const relationshipId = crypto.randomUUID();
          const relationshipData = {
            withRight: right as string | null,
            createdAt: now,
            updatedAt: now,
            status: 'requested' as string | null,
            initiatorGroupId: currentGroupId as string | null,
          };

          if (relationshipType === 'parent') {
            transactions.push({
              type: 'createRelationship' as const,
              id: relationshipId,
              data: relationshipData,
              parentGroupId: currentGroupId,
              childGroupId: selectedGroupId,
              relationshipType: invertGroupRelationshipType(relationshipType),
            });
          } else {
            transactions.push({
              type: 'createRelationship' as const,
              id: relationshipId,
              data: relationshipData,
              parentGroupId: selectedGroupId,
              childGroupId: currentGroupId,
              relationshipType: invertGroupRelationshipType(relationshipType),
            });
          }
        }
      }

      for (const rel of currentDirectionRelationships) {
        if (!selectedRights.has(rel.with_right as GroupRelationshipRight)) {
          transactions.push({
            type: 'deleteRelationship' as const,
            id: rel.id,
          });
        }
      }

      if (transactions.length > 0) {
        for (const tx of transactions) {
          if (tx.type === 'createRelationship') {
            await createRelationship({
              id: tx.id,
              group_id: tx.parentGroupId,
              related_group_id: tx.childGroupId,
              relationship_type: tx.relationshipType,
              with_right: tx.data.withRight,
              status: tx.data.status,
              initiator_group_id: tx.data.initiatorGroupId,
            });
          } else {
            await deleteRelationship({ id: tx.id });
          }
        }

        toast.success(
          isEditMode
            ? t('common.network.relationshipsUpdated')
            : t('common.network.relationshipsCreated')
        );
      } else {
        toast.info(t('common.network.noChanges'));
      }

      if (!isEditMode) {
        setSelectedGroupId('');
        setRelationshipType(defaultRelationshipType);
        setSelectedRights(new Set());
      }

      setOpen(false);
    } catch (error) {
      console.error('Error managing group relationships:', error);
      toast.error(t('common.network.relationshipSaveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGroupName = availableGroups.find(group => group.id === selectedGroupId)?.name ?? '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline">
            <Link className="mr-2 h-4 w-4" />
            {t('components.actionBar.linkGroup')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="h-[min(90dvh,42rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <DialogHeader className="px-6 pt-6 pr-12 pb-4">
          <DialogTitle>
            {isEditMode ? t('common.network.editRelationship') : t('common.network.linkGroupTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('common.network.editRelationshipDescription', {
                  groupName: selectedGroupName || t('common.unspecified'),
                })
              : t('common.network.linkGroupDescription', { groupName: currentGroupName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="group">{t('common.network.selectGroup')}</Label>
            {isEditMode ? (
              <div className="bg-muted/30 rounded-md border px-3 py-2 text-sm font-medium">
                {selectedGroupName || currentGroupName}
              </div>
            ) : (
              <TypeaheadSearch
                items={toTypeaheadItems(
                  availableGroups,
                  'group',
                  group => group.name || 'Group',
                  group => {
                    const description = richTextToPlainText(group.description);
                    return description ? description.substring(0, 60) : undefined;
                  }
                )}
                value={selectedGroupId}
                onChange={(item: TypeaheadItem | null) => setSelectedGroupId(item?.id ?? '')}
                placeholder={t('common.network.selectGroupPlaceholder')}
                disablePortal
              />
            )}
          </div>

          {selectedGroupId ? (
            <>
              <GroupRelationshipTypeSelect
                label={t('common.network.relationshipTypeLabel')}
                value={relationshipType}
                currentGroupName={currentGroupName}
                selectedGroupName={selectedGroupName}
                onValueChange={setRelationshipType}
                disabled={isEditMode}
                disabledOptions={{ parent: !isEditMode && isBaseGroup }}
                helperText={
                  !isEditMode && isBaseGroup
                    ? t('common.network.baseGroupsCanOnlyBeChildren')
                    : undefined
                }
              />

              <GroupRelationshipRightsSelector
                label={t('common.network.selectRights')}
                helperText={t('common.network.existingRightsStatusHint')}
                selectedRights={selectedRights}
                onToggleRight={toggleRight}
                existingRightStatuses={
                  existingRightStatuses as ReadonlyMap<string, GroupRelationshipRightDisplayStatus>
                }
              />
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedGroupId || isSubmitting || isLoadingQuery}
          >
            {isSubmitting
              ? t('common.network.saving')
              : isEditMode
                ? t('common.network.saveChanges')
                : t('common.actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
