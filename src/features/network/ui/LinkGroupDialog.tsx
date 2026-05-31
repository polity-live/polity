'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useGroupRoles, useGroupState } from '@/zero/groups/useGroupState';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from 'sonner';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import {
  mergeGroupConflictResponses,
  toGroupConflictError,
} from '@/features/groups/logic/groupConflict';
import { GroupConflictDialog, GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import type {
  GroupRelationshipDirection,
  GroupRelationshipType,
  NormalizedGroupRelationship,
} from '../types/network.types';
import {
  buildExistingRightStatusesForDirection,
  type GroupRelationshipRightDisplayStatus,
} from '../logic/networkRelationshipHelpers';
import {
  getHierarchyPairForSelection,
  matchesRelationshipSelection,
  getStoredHierarchyRelationshipTypeForSource,
} from '../logic/groupRelationshipOrientation';
import {
  getSiblingMembershipModeLabel,
  getGroupRelationshipDirectionOptions,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
  invertGroupRelationshipType,
  type GroupRelationshipRight,
} from './GroupRelationshipFields';

interface LinkGroupDialogProps {
  currentGroupId: string;
  currentGroupName: string;
  initialTargetGroupId?: string;
  initialRelationshipType?: GroupRelationshipType;
  initialRights?: string[];
  trigger?: React.ReactNode;
  allRelationships?: NormalizedGroupRelationship[];
}

type EditableGroupType = 'base' | 'hierarchical';
type SiblingMembershipMode = 'open' | 'elected' | 'parliament';

const RELATIONSHIP_RIGHTS: GroupRelationshipRight[] = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
];

function createInitialRightDirections(): Record<
  GroupRelationshipRight,
  GroupRelationshipDirection
> {
  return {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  };
}

function getSelectedRightsFromDirections(
  directions: Record<GroupRelationshipRight, GroupRelationshipDirection>
) {
  return new Set(RELATIONSHIP_RIGHTS.filter(right => directions[right] !== 'none'));
}

function buildRelationshipRequests(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
}) {
  const requests: {
    group_id: string;
    related_group_id: string;
    relationship_type: GroupRelationshipType;
    with_right: GroupRelationshipRight;
  }[] = [];

  if (args.relationshipType === 'sibling') {
    for (const right of RELATIONSHIP_RIGHTS) {
      const direction = args.rightDirections[right];

      if (direction === 'outgoing' || direction === 'bidirectional') {
        requests.push({
          group_id: args.currentGroupId,
          related_group_id: args.otherGroupId,
          relationship_type: 'sibling',
          with_right: right,
        });
      }

      if (direction === 'incoming' || direction === 'bidirectional') {
        requests.push({
          group_id: args.otherGroupId,
          related_group_id: args.currentGroupId,
          relationship_type: 'sibling',
          with_right: right,
        });
      }
    }

    return requests;
  }

  const hierarchyPair = getHierarchyPairForSelection({
    currentGroupId: args.currentGroupId,
    otherGroupId: args.otherGroupId,
    relationshipType: args.relationshipType,
  });

  for (const right of RELATIONSHIP_RIGHTS) {
    const direction = args.rightDirections[right];
    if (direction === 'none') {
      continue;
    }

    if (direction === 'outgoing' || direction === 'bidirectional') {
      requests.push({
        group_id: args.currentGroupId,
        related_group_id: args.otherGroupId,
        relationship_type: getStoredHierarchyRelationshipTypeForSource(
          args.currentGroupId,
          hierarchyPair
        ),
        with_right: right,
      });
    }

    if (direction === 'incoming' || direction === 'bidirectional') {
      requests.push({
        group_id: args.otherGroupId,
        related_group_id: args.currentGroupId,
        relationship_type: getStoredHierarchyRelationshipTypeForSource(
          args.otherGroupId,
          hierarchyPair
        ),
        with_right: right,
      });
    }
  }

  return requests;
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
  const { createRelationship, deleteRelationship, updateGroup } = useGroupActions();
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

  const currentEditableGroupType: EditableGroupType =
    currentGroup?.group_type === 'base' ? 'base' : 'hierarchical';
  const defaultRelationshipType: GroupRelationshipType =
    currentEditableGroupType === 'base' ? 'child' : 'parent';

  const [selectedGroupId, setSelectedGroupId] = useState(initialTargetGroupId || '');
  const [groupTypeSelection, setGroupTypeSelection] =
    useState<EditableGroupType>(currentEditableGroupType);
  const [relationshipType, setRelationshipType] = useState<GroupRelationshipType>(
    initialRelationshipType
      ? invertGroupRelationshipType(initialRelationshipType)
      : defaultRelationshipType
  );
  const [siblingMembershipMode, setSiblingMembershipMode] = useState<SiblingMembershipMode>(
    (currentGroup?.sibling_membership_mode as SiblingMembershipMode | undefined) ?? 'open'
  );
  const [connectedRoleId, setConnectedRoleId] = useState(currentGroup?.sibling_role_id ?? '');
  const [rightDirections, setRightDirections] = useState<
    Record<GroupRelationshipRight, GroupRelationshipDirection>
  >(() => {
    const directions = createInitialRightDirections();

    for (const right of initialRights ?? []) {
      if (RELATIONSHIP_RIGHTS.includes(right as GroupRelationshipRight)) {
        directions[right as GroupRelationshipRight] = 'outgoing';
      }
    }

    return directions;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { roles: selectedGroupRoles } = useGroupRoles(selectedGroupId || currentGroupId);

  const selectedRights = useMemo(
    () => getSelectedRightsFromDirections(rightDirections),
    [rightDirections]
  );

  const directionOptions = useMemo(() => getGroupRelationshipDirectionOptions(t), [t]);

  const availableGroups = (availableGroupsRaw || []).filter(group => group.id !== currentGroupId);
  const resolvedGroupType = relationshipType === 'sibling' ? 'sibling' : groupTypeSelection;
  const selectableConnectedRoles = useMemo(
    () =>
      selectedGroupRoles.filter(role => role.scope === 'group' && role.assignee_kind !== 'guest'),
    [selectedGroupRoles]
  );
  const desiredConnectedGroupId = relationshipType === 'sibling' ? selectedGroupId : null;
  const desiredSiblingMembershipMode =
    relationshipType === 'sibling' ? siblingMembershipMode : null;
  const desiredSiblingRoleId =
    relationshipType === 'sibling' && siblingMembershipMode === 'elected' ? connectedRoleId : null;
  const desiredParliamentSourceGroupIds =
    relationshipType === 'sibling' && siblingMembershipMode === 'parliament' && selectedGroupId
      ? [selectedGroupId]
      : [];

  const selectedGroupName = availableGroups.find(group => group.id === selectedGroupId)?.name ?? '';

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

  const currentSelectionRelationships = useMemo(
    () =>
      selectedGroupId
        ? relevantRelationships.filter(rel =>
            matchesRelationshipSelection(rel, {
              currentGroupId,
              otherGroupId: selectedGroupId,
              relationshipType,
            })
          )
        : [],
    [relevantRelationships, currentGroupId, selectedGroupId, relationshipType]
  );
  const desiredRelationships = useMemo(
    () =>
      selectedGroupId
        ? buildRelationshipRequests({
            currentGroupId,
            otherGroupId: selectedGroupId,
            relationshipType,
            rightDirections,
          })
        : [],
    [currentGroupId, selectedGroupId, relationshipType, rightDirections]
  );

  const existingRightDirections = useMemo(() => {
    const directions = createInitialRightDirections();

    for (const right of RELATIONSHIP_RIGHTS) {
      const hasOutgoing = currentSelectionRelationships.some(
        rel =>
          rel.with_right === right &&
          rel.group_id === currentGroupId &&
          rel.related_group_id === selectedGroupId
      );
      const hasIncoming = currentSelectionRelationships.some(
        rel =>
          rel.with_right === right &&
          rel.group_id === selectedGroupId &&
          rel.related_group_id === currentGroupId
      );

      directions[right] =
        hasOutgoing && hasIncoming
          ? 'bidirectional'
          : hasOutgoing
            ? 'outgoing'
            : hasIncoming
              ? 'incoming'
              : 'none';
    }

    return directions;
  }, [currentSelectionRelationships, currentGroupId, selectedGroupId]);

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
    () => RELATIONSHIP_RIGHTS.map(right => `${right}:${existingRightDirections[right]}`).join('|'),
    [existingRightDirections]
  );
  const siblingConfigurationPreflight = useGroupConflictPreflight(
    currentGroup && selectedGroupId
      ? {
          kind: 'sibling_configuration',
          group_id: currentGroupId,
          group_type: resolvedGroupType,
          connected_group_id: desiredConnectedGroupId,
          sibling_membership_mode: desiredSiblingMembershipMode,
          sibling_role_id: desiredSiblingRoleId,
          parliament_source_group_ids: desiredParliamentSourceGroupIds,
        }
      : null,
    { enabled: open && Boolean(currentGroup) && Boolean(selectedGroupId) }
  );
  const relationshipActivationPreflight = useGroupConflictPreflight(
    desiredRelationships.length > 0
      ? {
          kind: 'relationship_activation',
          draft_relationships: desiredRelationships.map(relationship => ({
            id: `${relationship.group_id}:${relationship.related_group_id}:${relationship.with_right}`,
            group_id: relationship.group_id,
            related_group_id: relationship.related_group_id,
            relationship_type: relationship.relationship_type,
            with_right: relationship.with_right,
            status: 'active',
            initiator_group_id: currentGroupId,
          })),
        }
      : null,
    { enabled: open && desiredRelationships.length > 0 }
  );
  const combinedConflictResponse = useMemo(
    () =>
      mergeGroupConflictResponses([
        siblingConfigurationPreflight.response,
        relationshipActivationPreflight.response,
      ]),
    [relationshipActivationPreflight.response, siblingConfigurationPreflight.response]
  );
  const hasBlockingConflicts = combinedConflictResponse.blocking;
  const isPreflightLoading =
    siblingConfigurationPreflight.isLoading || relationshipActivationPreflight.isLoading;

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
      setGroupTypeSelection(currentEditableGroupType);
      setSelectedGroupId(initialTargetGroupId);
      setRelationshipType(
        initialRelationshipType
          ? invertGroupRelationshipType(initialRelationshipType)
          : defaultRelationshipType
      );
      setSiblingMembershipMode(
        (currentGroup?.sibling_membership_mode as SiblingMembershipMode | undefined) ?? 'open'
      );
      setConnectedRoleId(currentGroup?.sibling_role_id ?? '');
      setRightDirections(() => {
        const directions = createInitialRightDirections();

        for (const right of initialRights ?? []) {
          if (RELATIONSHIP_RIGHTS.includes(right as GroupRelationshipRight)) {
            directions[right as GroupRelationshipRight] = 'outgoing';
          }
        }

        return directions;
      });
      return;
    }

    setGroupTypeSelection(currentEditableGroupType);
    setSelectedGroupId('');
    setRelationshipType(defaultRelationshipType);
    setSiblingMembershipMode(
      (currentGroup?.sibling_membership_mode as SiblingMembershipMode | undefined) ?? 'open'
    );
    setConnectedRoleId(currentGroup?.sibling_role_id ?? '');
    setRightDirections(createInitialRightDirections());
  }, [
    open,
    isEditMode,
    initialTargetGroupId,
    initialRelationshipType,
    initialRights,
    currentEditableGroupType,
    currentGroup?.sibling_membership_mode,
    currentGroup?.sibling_role_id,
    defaultRelationshipType,
  ]);

  useEffect(() => {
    if (!open || isEditMode || selectedGroupId) {
      return;
    }

    setRelationshipType(defaultRelationshipType);
  }, [open, isEditMode, selectedGroupId, defaultRelationshipType]);

  useEffect(() => {
    if (groupTypeSelection === 'base' && relationshipType !== 'child') {
      setRelationshipType('child');
    }
  }, [groupTypeSelection, relationshipType]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const syncKey = `${selectedGroupId}:${relationshipType}:${existingRightsSignature}`;
    if (lastSyncedRightsKeyRef.current === syncKey) {
      return;
    }

    setRightDirections(existingRightDirections);
    lastSyncedRightsKeyRef.current = syncKey;
  }, [
    open,
    isEditMode,
    selectedGroupId,
    relationshipType,
    existingRightDirections,
    existingRightsSignature,
  ]);

  const toggleRight = (right: GroupRelationshipRight) => {
    setRightDirections(currentDirections => ({
      ...currentDirections,
      [right]: currentDirections[right] === 'none' ? 'outgoing' : 'none',
    }));
  };

  const handleSubmit = async () => {
    if (!selectedGroupId) {
      return;
    }

    if (relationshipType === 'sibling' && siblingMembershipMode === 'elected' && !connectedRoleId) {
      toast.error('Waehle eine verbundene Rolle fuer gewaehlt verknuepfte Geschwistergruppen.');
      return;
    }

    if (
      relationshipType === 'sibling' &&
      siblingMembershipMode === 'parliament' &&
      rightDirections.passiveVotingRight === 'none'
    ) {
      toast.error(
        'Parlament-Geschwistergruppen benoetigen ein passives Wahlrecht zur verbundenen Gruppe.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (hasBlockingConflicts) {
        return;
      }

      let didUpdateGroup = false;

      if (
        currentGroup &&
        (currentGroup.group_type !== resolvedGroupType ||
          (currentGroup.connected_group_id ?? null) !== desiredConnectedGroupId ||
          (currentGroup.sibling_membership_mode ?? null) !== desiredSiblingMembershipMode ||
          (currentGroup.sibling_role_id ?? null) !== desiredSiblingRoleId ||
          (relationshipType === 'sibling' && siblingMembershipMode === 'parliament'))
      ) {
        const updateResult = updateGroup(
          {
            id: currentGroupId,
            group_type: resolvedGroupType,
            connected_group_id: desiredConnectedGroupId,
            sibling_membership_mode: desiredSiblingMembershipMode,
            sibling_role_id: desiredSiblingRoleId,
            parliament_source_group_ids: desiredParliamentSourceGroupIds,
          },
          { silent: true }
        );
        await serverConfirmed(updateResult);
        didUpdateGroup = true;
      }

      const desiredSignatures = new Set(
        desiredRelationships.map(
          relationship =>
            `${relationship.group_id}:${relationship.related_group_id}:${relationship.relationship_type}:${relationship.with_right}`
        )
      );

      const existingRelationships = relevantRelationships.filter(
        rel =>
          rel.with_right && RELATIONSHIP_RIGHTS.includes(rel.with_right as GroupRelationshipRight)
      );
      const existingSignatures = new Set(
        existingRelationships.map(
          rel =>
            `${rel.group_id}:${rel.related_group_id}:${rel.relationship_type ?? 'child'}:${rel.with_right}`
        )
      );

      const transactions: (
        | {
            type: 'createRelationship';
            id: string;
            groupId: string;
            relatedGroupId: string;
            relationshipType: GroupRelationshipType;
            right: GroupRelationshipRight;
          }
        | {
            type: 'deleteRelationship';
            id: string;
          }
      )[] = [];

      for (const rel of existingRelationships) {
        const signature = `${rel.group_id}:${rel.related_group_id}:${rel.relationship_type ?? 'child'}:${rel.with_right}`;

        if (!desiredSignatures.has(signature)) {
          transactions.push({
            type: 'deleteRelationship',
            id: rel.id,
          });
        }
      }

      for (const desiredRelationship of desiredRelationships) {
        const signature = `${desiredRelationship.group_id}:${desiredRelationship.related_group_id}:${desiredRelationship.relationship_type}:${desiredRelationship.with_right}`;

        if (!existingSignatures.has(signature)) {
          transactions.push({
            type: 'createRelationship',
            id: crypto.randomUUID(),
            groupId: desiredRelationship.group_id,
            relatedGroupId: desiredRelationship.related_group_id,
            relationshipType: desiredRelationship.relationship_type,
            right: desiredRelationship.with_right,
          });
        }
      }

      if (transactions.length > 0) {
        for (const tx of transactions) {
          if (tx.type === 'createRelationship') {
            const result = createRelationship({
              id: tx.id,
              group_id: tx.groupId,
              related_group_id: tx.relatedGroupId,
              relationship_type: tx.relationshipType,
              with_right: tx.right,
              status: 'requested',
              initiator_group_id: currentGroupId,
            });
            await serverConfirmed(result);
          } else {
            const result = deleteRelationship({ id: tx.id });
            await serverConfirmed(result);
          }
        }

        toast.success(
          isEditMode
            ? t('common.network.relationshipsUpdated')
            : t('common.network.relationshipsCreated')
        );
      } else if (didUpdateGroup) {
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
        setGroupTypeSelection(currentEditableGroupType);
        setRelationshipType(defaultRelationshipType);
        setSiblingMembershipMode(
          (currentGroup?.sibling_membership_mode as SiblingMembershipMode | undefined) ?? 'open'
        );
        setConnectedRoleId(currentGroup?.sibling_role_id ?? '');
        setRightDirections(createInitialRightDirections());
      }

      setOpen(false);
    } catch (error) {
      console.error('Error managing group relationships:', error);
      if (!toGroupConflictError(error)) {
        toast.error(t('common.network.relationshipSaveError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Label>Gruppentyp</Label>
            <RadioGroup
              value={groupTypeSelection}
              onValueChange={value => setGroupTypeSelection(value as EditableGroupType)}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: 'base',
                    title: t('pages.create.group.groupTypes.base'),
                    description: t('pages.create.group.groupTypes.baseDesc'),
                  },
                  {
                    value: 'hierarchical',
                    title: t('pages.create.group.groupTypes.hierarchical'),
                    description: t('pages.create.group.groupTypes.hierarchicalDesc'),
                  },
                ].map(option => (
                  <Label
                    key={option.value}
                    htmlFor={`dialog-group-type-${option.value}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      groupTypeSelection === option.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem
                      id={`dialog-group-type-${option.value}`}
                      value={option.value}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{option.title}</div>
                      <div className="text-muted-foreground text-xs">{option.description}</div>
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
          </div>

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
                  },
                  undefined,
                  group => `/group/${group.id}`
                )}
                value={selectedGroupId}
                onChange={(item: TypeaheadItem | null) => setSelectedGroupId(item?.id ?? '')}
                placeholder={t('common.network.selectGroupPlaceholder')}
                disablePortal
                showAllOnFocus
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
                siblingMembershipMode={
                  relationshipType === 'sibling' ? siblingMembershipMode : undefined
                }
                onValueChange={setRelationshipType}
                disabledOptions={{
                  parent: groupTypeSelection === 'base',
                  sibling: groupTypeSelection === 'base',
                }}
                helperText={
                  groupTypeSelection === 'base'
                    ? t('common.network.baseGroupsCanOnlyBeChildren')
                    : undefined
                }
              />

              {relationshipType === 'sibling' ? (
                <div className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-2">
                    <Label>Geschwistergruppentyp</Label>
                    <RadioGroup
                      value={siblingMembershipMode}
                      onValueChange={value =>
                        setSiblingMembershipMode(value as SiblingMembershipMode)
                      }
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        {[
                          {
                            value: 'open',
                            title: getSiblingMembershipModeLabel('open', t),
                            description:
                              'Mitglieder der verbundenen Gruppe koennen dieser Gruppe direkt beitreten.',
                          },
                          {
                            value: 'elected',
                            title: getSiblingMembershipModeLabel('elected', t),
                            description:
                              'Eine Rolle der verbundenen Gruppe erzeugt die Mitgliedschaft automatisch.',
                          },
                          {
                            value: 'parliament',
                            title: getSiblingMembershipModeLabel('parliament', t),
                            description:
                              'Mitgliedschaft wird aus Gruppen mit passivem Wahlrecht abgeleitet.',
                          },
                        ].map(option => (
                          <Label
                            key={option.value}
                            htmlFor={`dialog-sibling-mode-${option.value}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              siblingMembershipMode === option.value
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <RadioGroupItem
                              id={`dialog-sibling-mode-${option.value}`}
                              value={option.value}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="text-sm font-medium">{option.title}</div>
                              <div className="text-muted-foreground text-xs">
                                {option.description}
                              </div>
                            </div>
                          </Label>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>

                  {siblingMembershipMode === 'elected' ? (
                    <div className="grid gap-2">
                      <Label>Verbundene Rolle</Label>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          selectableConnectedRoles,
                          'role',
                          role => role.name || 'Role',
                          role => role.description || undefined
                        )}
                        value={connectedRoleId}
                        onChange={(item: TypeaheadItem | null) =>
                          setConnectedRoleId(item?.id ?? '')
                        }
                        placeholder="Mitgliedsrolle der verbundenen Gruppe waehlen"
                        disablePortal
                        showAllOnFocus
                      />
                    </div>
                  ) : null}

                  <p className="text-muted-foreground text-xs">
                    Aktiver Modus: {getSiblingMembershipModeLabel(siblingMembershipMode, t)}
                  </p>
                </div>
              ) : null}

              <GroupRelationshipRightsSelector
                label={t('common.network.selectRights')}
                helperText={t('common.network.existingRightsStatusHint')}
                selectedRights={selectedRights}
                onToggleRight={toggleRight}
                existingRightStatuses={
                  existingRightStatuses as ReadonlyMap<string, GroupRelationshipRightDisplayStatus>
                }
                rightDirections={rightDirections}
                onDirectionChange={(right, direction) =>
                  setRightDirections(currentDirections => ({
                    ...currentDirections,
                    [right]: direction,
                  }))
                }
                directionOptions={directionOptions}
                currentGroupName={currentGroupName}
                selectedGroupName={selectedGroupName}
                currentGroupId={currentGroupId}
                selectedGroupId={selectedGroupId}
              />

              {hasBlockingConflicts ? (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {combinedConflictResponse.summary ??
                          t('features.groups.conflicts.dialog.blockedSummaryFallback')}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {t('features.groups.conflicts.dialog.blockedDescription')}
                      </div>
                    </div>
                    <GroupConflictDialog
                      response={combinedConflictResponse}
                      triggerLabel={t('features.groups.conflicts.dialog.triggerLabel')}
                      title={t('features.groups.conflicts.dialog.blockedReasonTitle')}
                    />
                  </div>
                  <GroupConflictPanel response={combinedConflictResponse} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          {isPreflightLoading ? (
            <div className="text-muted-foreground mr-auto text-sm">Pruefe Konflikte...</div>
          ) : null}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedGroupId ||
              isSubmitting ||
              isLoadingQuery ||
              isPreflightLoading ||
              hasBlockingConflicts ||
              (relationshipType === 'sibling' &&
                siblingMembershipMode === 'elected' &&
                !connectedRoleId)
            }
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
