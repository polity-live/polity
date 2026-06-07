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
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupRoles, useGroupState } from '@/zero/groups/useGroupState';
import { useNetworkLinkActions, useNetworkLinkState } from '@/zero/network';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from 'sonner';
import type {
  GroupRelationshipType,
  NetworkLinkComposerValue,
  NormalizedGroupRelationship,
} from '../types/network.types';
import {
  applyNetworkLinkPreset,
  buildRelativeMembershipRuleFromCanonical,
  buildCanonicalNetworkLinkPayload,
  buildNetworkLinkComposerDefaults,
  createInitialRelationshipDirections,
  hasConfiguredNetworkLink,
  getPresetForRelationshipType,
  getSelectedMembershipDirection,
  getSelectedRights,
} from '../logic/networkLinkComposer';
import {
  explodeNetworkLinkChangeRequestsToRelationships,
  explodeNetworkLinksToRelationships,
  getPrimaryLinkForPair,
} from '../logic/networkLinkDerived';
import type { GroupRelationshipRightDisplayStatus } from '../logic/networkRelationshipHelpers';
import { buildExistingRightStatusesForDirection } from '../logic/networkRelationshipHelpers';
import { matchesRelationshipSelection } from '../logic/groupRelationshipOrientation';
import { useNetworkLinkComposer } from '../hooks/useNetworkLinkComposer';
import { useNetworkLinkComposerPreflight } from '../hooks/useNetworkLinkComposerPreflight';
import { NetworkLinkComposer } from './NetworkLinkComposer';
import type { GroupRelationshipRight } from './GroupRelationshipFields';

interface LinkGroupDialogProps {
  currentGroupId: string;
  currentGroupName: string;
  initialTargetGroupId?: string;
  initialRelationshipType?: GroupRelationshipType;
  initialRights?: string[];
  trigger?: React.ReactNode;
  allRelationships?: NormalizedGroupRelationship[];
}

function getRequestRelationshipType(
  request: {
    source_group_id: string;
    target_group_id: string;
    structural_relation: string;
  },
  currentGroupId: string
): GroupRelationshipType | null {
  if (request.structural_relation === 'sibling') {
    return request.source_group_id === currentGroupId || request.target_group_id === currentGroupId
      ? 'sibling'
      : null;
  }

  if (request.source_group_id === currentGroupId) {
    return 'parent';
  }

  if (request.target_group_id === currentGroupId) {
    return 'child';
  }

  return null;
}

function matchesRequestSelection(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  request: {
    source_group_id: string;
    target_group_id: string;
    structural_relation: string;
  };
}) {
  const touchesPair =
    (args.request.source_group_id === args.currentGroupId &&
      args.request.target_group_id === args.otherGroupId) ||
    (args.request.source_group_id === args.otherGroupId &&
      args.request.target_group_id === args.currentGroupId);

  if (!touchesPair) {
    return false;
  }

  return getRequestRelationshipType(args.request, args.currentGroupId) === args.relationshipType;
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
  const { proposeNetworkLinkChange } = useNetworkLinkActions();
  const [open, setOpen] = useState(false);
  const initializedForOpenRef = useRef(false);
  const lastHydratedStateRef = useRef<string | null>(null);
  const isEditMode = Boolean(initialTargetGroupId);

  const { searchResults: availableGroupsRaw, isLoading: groupStateLoading } = useGroupState({
    groupId: currentGroupId,
    includeSearch: true,
  });

  const availableGroups = (availableGroupsRaw || []).filter(group => group.id !== currentGroupId);

  const composer = useNetworkLinkComposer();
  const { value, setValue, activeTab, setActiveTab, resetComposer } = composer;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { roles: selectedGroupRoles } = useGroupRoles(value.selectedGroupId || currentGroupId);
  const { roles: currentGroupRoles } = useGroupRoles(currentGroupId);
  const { pairLinks, pairLinksLoading, pairChangeRequests, pairChangeRequestsLoading } =
    useNetworkLinkState({
      groupAId: currentGroupId,
      groupBId: value.selectedGroupId || currentGroupId,
    });

  const relevantLinks = useMemo(
    () =>
      pairLinks.filter(
        link =>
          (link.source_group_id === currentGroupId &&
            link.target_group_id === value.selectedGroupId) ||
          (link.source_group_id === value.selectedGroupId &&
            link.target_group_id === currentGroupId)
      ),
    [currentGroupId, pairLinks, value.selectedGroupId]
  );
  const pairRelationships = useMemo(
    () => explodeNetworkLinksToRelationships(relevantLinks),
    [relevantLinks]
  );
  const pairRequestRelationships = useMemo(
    () => explodeNetworkLinkChangeRequestsToRelationships(pairChangeRequests),
    [pairChangeRequests]
  );

  const currentPrimaryLink = useMemo(
    () =>
      value.selectedGroupId
        ? getPrimaryLinkForPair({
            currentGroupId,
            otherGroupId: value.selectedGroupId,
            links: relevantLinks,
            relationshipType: value.relationshipType,
          })
        : null,
    [currentGroupId, relevantLinks, value.relationshipType, value.selectedGroupId]
  );

  const currentPrimaryRequest = useMemo(() => {
    if (!value.selectedGroupId) {
      return null;
    }

    return (
      [...pairChangeRequests]
        .filter(request =>
          matchesRequestSelection({
            currentGroupId,
            otherGroupId: value.selectedGroupId,
            relationshipType: value.relationshipType,
            request,
          })
        )
        .sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0))[0] ?? null
    );
  }, [currentGroupId, pairChangeRequests, value.relationshipType, value.selectedGroupId]);

  const relevantRelationships = useMemo(() => {
    const relationships = allRelationships ?? [...pairRelationships, ...pairRequestRelationships];
    return relationships.filter(
      rel =>
        (rel.group_id === currentGroupId && rel.related_group_id === value.selectedGroupId) ||
        (rel.group_id === value.selectedGroupId && rel.related_group_id === currentGroupId)
    );
  }, [
    allRelationships,
    currentGroupId,
    pairRelationships,
    pairRequestRelationships,
    value.selectedGroupId,
  ]);

  const currentSelectionRelationships = useMemo(
    () =>
      value.selectedGroupId
        ? relevantRelationships.filter(rel =>
            matchesRelationshipSelection(rel, {
              currentGroupId,
              otherGroupId: value.selectedGroupId,
              relationshipType: value.relationshipType,
            })
          )
        : [],
    [currentGroupId, relevantRelationships, value.relationshipType, value.selectedGroupId]
  );

  const existingRightStatuses = useMemo<ReadonlyMap<string, GroupRelationshipRightDisplayStatus>>(
    () =>
      value.selectedGroupId
        ? buildExistingRightStatusesForDirection(relevantRelationships, {
            currentGroupId,
            otherGroupId: value.selectedGroupId,
            relationshipType: value.relationshipType,
          })
        : new Map<string, GroupRelationshipRightDisplayStatus>(),
    [currentGroupId, relevantRelationships, value.relationshipType, value.selectedGroupId]
  );

  const existingRightIdsByKey = useMemo(() => {
    const ids: Partial<Record<GroupRelationshipRight, string | undefined>> = {};

    for (const right of currentPrimaryRequest?.desired_rights ?? []) {
      ids[right.right_key as GroupRelationshipRight] = right.id;
    }

    for (const right of currentPrimaryLink?.rights ?? []) {
      const rightKey = right.right_key as GroupRelationshipRight;
      ids[rightKey] = ids[rightKey] ?? right.id;
    }

    return ids;
  }, [currentPrimaryLink?.rights, currentPrimaryRequest?.desired_rights]);

  const selectableRolesByDirection = useMemo(
    () => ({
      incoming: selectedGroupRoles.filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
      outgoing: currentGroupRoles.filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
    }),
    [currentGroupRoles, selectedGroupRoles]
  );

  const preflight = useNetworkLinkComposerPreflight({
    currentGroupId,
    initiatorGroupId: currentGroupId,
    value,
    existingLinkId:
      currentPrimaryLink?.id ?? currentPrimaryRequest?.proposed_network_link_id ?? null,
    existingRightIdsByKey,
    membershipRuleId: currentPrimaryLink?.membership_rule?.id ?? null,
    enabled: open && Boolean(value.selectedGroupId),
  });

  useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      lastHydratedStateRef.current = null;
      return;
    }

    if (initializedForOpenRef.current) {
      return;
    }

    initializedForOpenRef.current = true;
    const baseValue = buildNetworkLinkComposerDefaults();
    const relationshipType = initialRelationshipType ?? 'child';
    const preset = getPresetForRelationshipType({
      relationshipType,
      membershipDirection: baseValue.membershipDirection,
      membershipRule: baseValue.membershipRule,
    });
    const nextValue: NetworkLinkComposerValue = applyNetworkLinkPreset(preset, {
      ...baseValue,
      selectedGroupId: initialTargetGroupId ?? '',
      relationshipType,
      rightDirections: createInitialRelationshipDirections(),
    });

    if (initialRights?.length) {
      for (const right of initialRights) {
        if (right in nextValue.rightDirections) {
          nextValue.rightDirections[right as keyof typeof nextValue.rightDirections] = 'outgoing';
        }
      }
    }

    resetComposer(nextValue);
    setActiveTab('preset');
  }, [
    initialRelationshipType,
    initialRights,
    initialTargetGroupId,
    open,
    resetComposer,
    setActiveTab,
  ]);

  useEffect(() => {
    if (!open || !value.selectedGroupId) {
      return;
    }

    const hydrationKey = [
      value.selectedGroupId,
      value.relationshipType,
      currentPrimaryLink?.id ?? 'no-link',
      currentPrimaryRequest?.id ?? 'no-request',
    ].join(':');

    if (lastHydratedStateRef.current === hydrationKey) {
      return;
    }

    const nextValue = { ...value };
    const source = currentPrimaryRequest ?? currentPrimaryLink;

    if (!source) {
      if (
        currentSelectionRelationships.length === 0 &&
        getSelectedRights(value.rightDirections).length > 0
      ) {
        return;
      }
      return;
    }

    if ('desired_rights' in source) {
      const nextDirections = createInitialRelationshipDirections();
      for (const right of source.desired_rights ?? []) {
        nextDirections[right.right_key] =
          right.direction === 'bidirectional'
            ? 'bidirectional'
            : source.source_group_id === currentGroupId
              ? right.direction === 'forward'
                ? 'outgoing'
                : 'incoming'
              : right.direction === 'forward'
                ? 'incoming'
                : 'outgoing';
      }

      const membershipConfig = buildRelativeMembershipRuleFromCanonical({
        currentGroupId,
        source_group_id: source.source_group_id,
        target_group_id: source.target_group_id,
        membershipRule: {
          membership_direction: source.desired_membership_direction ?? null,
          membership_mode: source.desired_membership_mode,
          role_id: source.desired_role_id ?? null,
          source_group_ids: source.desired_source_group_ids ?? null,
        },
      });

      setValue({
        ...nextValue,
        selectedGroupId: value.selectedGroupId,
        relationshipType:
          getRequestRelationshipType(source, currentGroupId) ?? value.relationshipType,
        ...membershipConfig,
        rightDirections: nextDirections,
        preset: getPresetForRelationshipType({
          relationshipType:
            getRequestRelationshipType(source, currentGroupId) ?? value.relationshipType,
          membershipDirection: membershipConfig.membershipDirection,
          membershipRule: membershipConfig.membershipRule,
        }),
      });
      lastHydratedStateRef.current = hydrationKey;
      return;
    }

    const nextDirections = createInitialRelationshipDirections();
    for (const right of source.rights ?? []) {
      nextDirections[right.right_key as GroupRelationshipRight] =
        right.direction === 'bidirectional'
          ? 'bidirectional'
          : source.source_group_id === currentGroupId
            ? right.direction === 'forward'
              ? 'outgoing'
              : 'incoming'
            : right.direction === 'forward'
              ? 'incoming'
              : 'outgoing';
    }

    const membershipConfig = buildRelativeMembershipRuleFromCanonical({
      currentGroupId,
      source_group_id: source.source_group_id,
      target_group_id: source.target_group_id,
      membershipRule: source.membership_rule,
    });

    setValue({
      ...nextValue,
      selectedGroupId: value.selectedGroupId,
      relationshipType:
        getRequestRelationshipType(source, currentGroupId) ?? value.relationshipType,
      ...membershipConfig,
      rightDirections: nextDirections,
      preset: getPresetForRelationshipType({
        relationshipType:
          getRequestRelationshipType(source, currentGroupId) ?? value.relationshipType,
        membershipDirection: membershipConfig.membershipDirection,
        membershipRule: membershipConfig.membershipRule,
      }),
    });
    lastHydratedStateRef.current = hydrationKey;
  }, [
    currentGroupId,
    currentPrimaryLink,
    currentPrimaryRequest,
    currentSelectionRelationships.length,
    open,
    setValue,
    value,
  ]);

  const handleSubmit = async () => {
    if (!value.selectedGroupId) {
      return;
    }

    const selectedMembershipDirection = getSelectedMembershipDirection({
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
    });
    const selectedMembershipRule = selectedMembershipDirection ? value.membershipRule : null;

    if (
      selectedMembershipRule?.membershipMode === 'role_members' &&
      !selectedMembershipRule.roleId
    ) {
      toast.error(
        selectedMembershipDirection === 'incoming'
          ? 'Wähle eine Rolle für den eingehenden Mitgliedschaftsfluss.'
          : 'Wähle eine Rolle für den ausgehenden Mitgliedschaftsfluss.'
      );
      return;
    }

    if (
      selectedMembershipRule?.membershipMode === 'selected_source_groups' &&
      selectedMembershipRule.sourceGroupIds.length === 0
    ) {
      toast.error(
        selectedMembershipDirection === 'incoming'
          ? 'Wähle mindestens eine Source-Gruppe für den eingehenden Mitgliedschaftsfluss.'
          : 'Wähle mindestens eine Source-Gruppe für den ausgehenden Mitgliedschaftsfluss.'
      );
      return;
    }

    if (
      !hasConfiguredNetworkLink({
        rightDirections: value.rightDirections,
        membershipDirection: value.membershipDirection,
        membershipRule: value.membershipRule,
      })
    ) {
      toast.error(
        t(
          'common.network.selectRightsOrMembership',
          'Wahle mindestens ein Recht oder konfiguriere die Mitgliedschaft.'
        )
      );
      return;
    }

    if (preflight.blocking) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildCanonicalNetworkLinkPayload({
        currentGroupId,
        otherGroupId: value.selectedGroupId,
        relationshipType: value.relationshipType,
        rightDirections: value.rightDirections,
        membershipDirection: value.membershipDirection,
        membershipRule: value.membershipRule,
        linkId:
          currentPrimaryLink?.id ?? currentPrimaryRequest?.proposed_network_link_id ?? undefined,
        existingRightIdsByKey,
        membershipRuleId: currentPrimaryLink?.membership_rule?.id ?? undefined,
        initiatorGroupId: currentGroupId,
        status: 'requested',
      });

      const result = proposeNetworkLinkChange({
        id: currentPrimaryRequest?.id ?? crypto.randomUUID(),
        active_network_link_id: currentPrimaryLink?.id ?? null,
        proposed_network_link_id: payload.id,
        source_group_id: payload.source_group_id,
        target_group_id: payload.target_group_id,
        structural_relation: payload.structural_relation,
        initiator_group_id: currentGroupId,
        desired_rights: payload.rights.map(right => ({
          id: right.id,
          right_key: right.right_key,
          direction: right.direction,
        })),
        desired_membership_direction: payload.membership_rule.membership_direction ?? null,
        desired_membership_mode: payload.membership_rule.membership_mode,
        desired_role_id: payload.membership_rule.role_id ?? null,
        desired_source_group_ids: payload.membership_rule.source_group_ids ?? null,
      });
      await serverConfirmed(result);

      toast.success(
        isEditMode
          ? t('common.network.relationshipsUpdated')
          : t('common.network.relationshipsCreated')
      );
      setOpen(false);
    } catch (error) {
      console.error('Error managing group relationships:', error);
      toast.error(t('common.network.relationshipSaveError'));
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
      <DialogContent className="h-[min(90dvh,46rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="px-6 pt-6 pr-12 pb-4">
          <DialogTitle>
            {isEditMode ? t('common.network.editRelationship') : t('common.network.linkGroupTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('common.network.editRelationshipDescription', {
                  groupName: currentGroupName || t('common.unspecified'),
                })
              : t('common.network.linkGroupDescription', { groupName: currentGroupName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto px-6 py-4">
          <NetworkLinkComposer
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            value={value}
            onValueChange={setValue}
            currentGroupId={currentGroupId}
            currentGroupName={currentGroupName}
            availableGroups={availableGroups}
            selectableRolesByDirection={selectableRolesByDirection}
            existingRightStatuses={existingRightStatuses}
            preflight={preflight}
            disableGroupSelection={isEditMode}
            groupSelectorLabel={t('common.network.selectGroup')}
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          {preflight.isLoading ? (
            <div className="text-muted-foreground mr-auto text-sm">Prüfe Konflikte...</div>
          ) : null}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !value.selectedGroupId ||
              isSubmitting ||
              groupStateLoading ||
              pairLinksLoading ||
              pairChangeRequestsLoading ||
              preflight.isLoading ||
              preflight.blocking ||
              (() => {
                const selectedMembershipDirection = getSelectedMembershipDirection({
                  membershipDirection: value.membershipDirection,
                  membershipRule: value.membershipRule,
                });

                if (!selectedMembershipDirection) {
                  return false;
                }

                const selectedMembershipRule = value.membershipRule;
                return (
                  (selectedMembershipRule.membershipMode === 'role_members' &&
                    !selectedMembershipRule.roleId) ||
                  (selectedMembershipRule.membershipMode === 'selected_source_groups' &&
                    selectedMembershipRule.sourceGroupIds.length === 0)
                );
              })()
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
