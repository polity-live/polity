'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupRoles, useGroupState } from '@/zero/groups/useGroupState';
import { useGroupConnectionActions, useGroupConnectionState } from '@/zero/network';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from '@/features/shared/ui/ui/sonner';
import type {
  CanonicalMembershipMode,
  GroupRelationshipType,
  GroupConnectionComposerValue,
  NormalizedGroupRelationship,
} from '../types/network.types';
import {
  applyGroupConnectionPreset,
  buildRelativeMembershipRuleFromCanonical,
  buildCanonicalGroupConnectionPayload,
  buildGroupConnectionComposerDefaults,
  createInitialRelationshipDirections,
  hasConfiguredGroupConnection,
  getPresetForRelationshipType,
  getSelectedMembershipDirection,
  getSelectedRights,
} from '../logic/groupConnectionComposer';
import {
  buildRightDirectionsForConnection,
  deriveNormalizedGroupConnectionRequestRows,
  deriveNormalizedGroupRelationships,
  getPrimaryConnectionForPair,
} from '../logic/groupConnectionDerived';
import type { GroupRelationshipRightDisplayStatus } from '../logic/networkRelationshipHelpers';
import { buildExistingRightStatusesForDirection } from '../logic/networkRelationshipHelpers';
import { matchesRelationshipSelection } from '../logic/groupRelationshipOrientation';
import { useGroupConnectionComposer } from '../hooks/useGroupConnectionComposer';
import { useGroupConnectionComposerPreflight } from '../hooks/useGroupConnectionComposerPreflight';
import type { GroupRelationshipRight } from './GroupRelationshipFields';
function isGroupRelationshipRight(value: string): value is GroupRelationshipRight {
  return (
    value === 'informationRight' ||
    value === 'amendmentRight' ||
    value === 'rightToSpeak' ||
    value === 'activeVotingRight' ||
    value === 'passiveVotingRight'
  );
}
function isStoredMembershipMode(value: string): value is Exclude<CanonicalMembershipMode, 'none'> {
  return value === 'all_members' || value === 'role_members' || value === 'selected_source_groups';
}
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
    group_a_id: string;
    group_b_id: string;
    desired_connection_type: string;
    desired_parent_group_id?: string | null;
    desired_child_group_id?: string | null;
  },
  currentGroupId: string
): GroupRelationshipType | null {
  if (request.desired_connection_type === 'peer') {
    return request.group_a_id === currentGroupId || request.group_b_id === currentGroupId
      ? 'sibling'
      : null;
  }

  if (request.desired_parent_group_id === currentGroupId) {
    return 'parent';
  }

  if (request.desired_child_group_id === currentGroupId) {
    return 'child';
  }

  return null;
}
function matchesRequestSelection(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  request: {
    group_a_id: string;
    group_b_id: string;
    desired_connection_type: string;
    desired_parent_group_id?: string | null;
    desired_child_group_id?: string | null;
  };
}) {
  const touchesPair =
    (args.request.group_a_id === args.currentGroupId &&
      args.request.group_b_id === args.otherGroupId) ||
    (args.request.group_a_id === args.otherGroupId &&
      args.request.group_b_id === args.currentGroupId);

  if (!touchesPair) {
    return false;
  }

  return getRequestRelationshipType(args.request, args.currentGroupId) === args.relationshipType;
}

export function useLinkGroupDialogController({
  currentGroupId,
  currentGroupName,
  initialTargetGroupId,
  initialRelationshipType,
  initialRights,
  trigger,
  allRelationships,
}: LinkGroupDialogProps) {
  const { t } = useTranslation();

  const { proposeGroupConnectionChange } = useGroupConnectionActions();

  const [open, setOpen] = useState(false);

  const initializedForOpenRef = useRef(false);

  const lastHydratedStateRef = useRef<string | null>(null);

  const isEditMode = Boolean(initialTargetGroupId);

  const { searchResults: availableGroupsRaw, isLoading: groupStateLoading } = useGroupState({
    groupId: currentGroupId,
    includeSearch: true,
  });

  const availableGroups = (availableGroupsRaw || []).filter(group => group.id !== currentGroupId);

  const composer = useGroupConnectionComposer();

  const { value, setValue, activeTab, setActiveTab, resetComposer } = composer;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { roles: selectedGroupRoles } = useGroupRoles(value.selectedGroupId || currentGroupId);

  const { roles: currentGroupRoles } = useGroupRoles(currentGroupId);

  const {
    pairConnections,
    pairConnectionsLoading,
    pairConnectionRequests,
    pairConnectionRequestsLoading,
  } = useGroupConnectionState({
    groupAId: currentGroupId,
    groupBId: value.selectedGroupId || currentGroupId,
  });

  const relevantConnections = useMemo(
    () =>
      pairConnections.filter(
        link =>
          (link.group_a_id === currentGroupId && link.group_b_id === value.selectedGroupId) ||
          (link.group_a_id === value.selectedGroupId && link.group_b_id === currentGroupId)
      ),
    [currentGroupId, pairConnections, value.selectedGroupId]
  );

  const pairRelationships = useMemo(
    () => deriveNormalizedGroupRelationships(relevantConnections),
    [relevantConnections]
  );

  const pairRequestRelationships = useMemo(
    () => deriveNormalizedGroupConnectionRequestRows(pairConnectionRequests),
    [pairConnectionRequests]
  );

  const currentPrimaryConnection = useMemo(
    () =>
      value.selectedGroupId
        ? getPrimaryConnectionForPair({
            currentGroupId,
            otherGroupId: value.selectedGroupId,
            connections: relevantConnections,
            relationshipType: value.relationshipType,
          })
        : null,
    [currentGroupId, relevantConnections, value.relationshipType, value.selectedGroupId]
  );

  const currentPrimaryRequest = useMemo(() => {
    if (!value.selectedGroupId) {
      return null;
    }

    return (
      [...pairConnectionRequests]
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
  }, [currentGroupId, pairConnectionRequests, value.relationshipType, value.selectedGroupId]);

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

    for (const right of currentPrimaryRequest?.grant_requests ?? []) {
      ids[right.right_key as GroupRelationshipRight] = right.id;
    }

    for (const right of currentPrimaryConnection?.grants ?? []) {
      const rightKey = right.right_key as GroupRelationshipRight;
      ids[rightKey] = ids[rightKey] ?? right.id;
    }

    return ids;
  }, [currentPrimaryConnection?.grants, currentPrimaryRequest?.grant_requests]);

  const existingGrantIdsByKeyAndHolder = useMemo(() => {
    const ids: Record<string, string> = {};
    for (const grant of currentPrimaryConnection?.grants ?? []) {
      ids[`${grant.right_key}:${grant.holder_group_id}`] = grant.id;
    }
    return ids;
  }, [currentPrimaryConnection?.grants]);

  const selectableRolesByDirection = useMemo(
    () => ({
      partner_members_to_current: selectedGroupRoles.filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
      current_members_to_partner: currentGroupRoles.filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
    }),
    [currentGroupRoles, selectedGroupRoles]
  );

  const preflight = useGroupConnectionComposerPreflight({
    currentGroupId,
    initiatorGroupId: currentGroupId,
    value,
    existingConnectionId:
      currentPrimaryConnection?.id ?? currentPrimaryRequest?.proposed_connection_id ?? null,
    existingRightIdsByKey,
    membershipRuleId: currentPrimaryConnection?.membership_rule?.id ?? null,
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
    const baseValue = buildGroupConnectionComposerDefaults();
    const relationshipType = initialRelationshipType ?? 'child';
    const preset = getPresetForRelationshipType({
      relationshipType,
      membershipDirection: baseValue.membershipDirection,
      membershipRule: baseValue.membershipRule,
    });
    const nextValue: GroupConnectionComposerValue = applyGroupConnectionPreset(preset, {
      ...baseValue,
      selectedGroupId: initialTargetGroupId ?? '',
      relationshipType,
      rightDirections: createInitialRelationshipDirections(),
    });

    if (initialRights?.length) {
      for (const right of initialRights) {
        if (right in nextValue.rightDirections) {
          nextValue.rightDirections[right as keyof typeof nextValue.rightDirections] =
            'current_has_right_in_partner';
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
      currentPrimaryConnection?.id ?? 'no-connection',
      currentPrimaryRequest?.id ?? 'no-request',
    ].join(':');

    if (lastHydratedStateRef.current === hydrationKey) {
      return;
    }

    const nextValue = { ...value };
    const source = currentPrimaryRequest ?? currentPrimaryConnection;

    if (!source) {
      if (
        currentSelectionRelationships.length === 0 &&
        getSelectedRights(value.rightDirections).length > 0
      ) {
        return;
      }
      return;
    }

    const isRequest = 'grant_requests' in source;
    const activeGrants = currentPrimaryConnection?.grants ?? [];
    const grantsByKey = new Map<
      string,
      {
        right_key: string;
        holder_group_id: string;
        scope_group_id: string;
        status?: string | null;
      }
    >(
      activeGrants.map(grant => [
        `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`,
        grant,
      ])
    );
    if (isRequest) {
      for (const request of source.grant_requests ?? []) {
        const key = `${request.right_key}:${request.holder_group_id}:${request.scope_group_id}`;
        if (request.operation === 'remove') {
          grantsByKey.delete(key);
        } else {
          grantsByKey.set(key, request);
        }
      }
    }
    const nextDirections = buildRightDirectionsForConnection({
      currentGroupId,
      connection: { grants: isRequest ? [...grantsByKey.values()] : source.grants },
      includePending: isRequest,
    }) as typeof value.rightDirections;
    const membershipRequests = isRequest ? (source.membership_rule_requests ?? []) : [];
    const membershipRequest =
      membershipRequests.length <= 1
        ? (membershipRequests[0] ?? null)
        : [...membershipRequests].sort(
            (left, right) =>
              (right.updated_at ?? right.created_at ?? 0) -
              (left.updated_at ?? left.created_at ?? 0)
          )[0];
    const membershipRule = isRequest
      ? membershipRequest?.operation === 'remove'
        ? null
        : (membershipRequest ?? currentPrimaryConnection?.membership_rule ?? null)
      : source.membership_rule;
    const membershipConfig = buildRelativeMembershipRuleFromCanonical({
      currentGroupId,
      membershipRule,
    });
    const relationshipType = isRequest
      ? (getRequestRelationshipType(source, currentGroupId) ?? value.relationshipType)
      : source.connection_type === 'peer'
        ? 'sibling'
        : source.parent_group_id === currentGroupId
          ? 'parent'
          : 'child';

    setValue({
      ...nextValue,
      selectedGroupId: value.selectedGroupId,
      relationshipType,
      ...membershipConfig,
      rightDirections: nextDirections,
      preset: getPresetForRelationshipType({
        relationshipType,
        membershipDirection: membershipConfig.membershipDirection,
        membershipRule: membershipConfig.membershipRule,
      }),
    });
    lastHydratedStateRef.current = hydrationKey;
  }, [
    currentGroupId,
    currentPrimaryConnection,
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
        selectedMembershipDirection === 'partner_members_to_current'
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
        selectedMembershipDirection === 'partner_members_to_current'
          ? 'Wähle mindestens eine Source-Gruppe für den eingehenden Mitgliedschaftsfluss.'
          : 'Wähle mindestens eine Source-Gruppe für den ausgehenden Mitgliedschaftsfluss.'
      );
      return;
    }

    if (
      !hasConfiguredGroupConnection({
        rightDirections: value.rightDirections,
        membershipDirection: value.membershipDirection,
        membershipRule: value.membershipRule,
      })
    ) {
      toast.error(t('common.network.selectRightsOrMembership'));
      return;
    }

    if (preflight.blocking) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildCanonicalGroupConnectionPayload({
        currentGroupId,
        otherGroupId: value.selectedGroupId,
        relationshipType: value.relationshipType,
        rightDirections: value.rightDirections,
        membershipDirection: value.membershipDirection,
        membershipRule: value.membershipRule,
        connectionId:
          currentPrimaryConnection?.id ??
          currentPrimaryRequest?.proposed_connection_id ??
          undefined,
        existingRightIdsByKey,
        existingGrantIdsByKeyAndHolder,
        membershipRuleId: currentPrimaryConnection?.membership_rule?.id ?? undefined,
        initiatorGroupId: currentGroupId,
        status: 'requested',
      });

      const desiredGrantKeys = new Set(
        payload.grants.map(
          grant => `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`
        )
      );
      const grants = [
        ...payload.grants.map(grant => ({
          id: crypto.randomUUID(),
          existing_grant_id:
            existingGrantIdsByKeyAndHolder[`${grant.right_key}:${grant.holder_group_id}`] ?? null,
          operation: 'upsert' as const,
          right_key: grant.right_key,
          holder_group_id: grant.holder_group_id,
          scope_group_id: grant.scope_group_id,
        })),
        ...(currentPrimaryConnection?.grants ?? [])
          .filter(
            grant =>
              isGroupRelationshipRight(grant.right_key) &&
              !desiredGrantKeys.has(
                `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`
              )
          )
          .map(grant => ({
            id: crypto.randomUUID(),
            existing_grant_id: grant.id,
            operation: 'remove' as const,
            right_key: grant.right_key as GroupRelationshipRight,
            holder_group_id: grant.holder_group_id,
            scope_group_id: grant.scope_group_id,
          })),
      ];
      const existingMembershipRule = currentPrimaryConnection?.membership_rule ?? null;
      const membershipRule = payload.membership_rule
        ? {
            ...payload.membership_rule,
            id: crypto.randomUUID(),
            existing_membership_rule_id: existingMembershipRule?.id ?? null,
            operation: 'upsert' as const,
          }
        : existingMembershipRule && isStoredMembershipMode(existingMembershipRule.membership_mode)
          ? {
              id: crypto.randomUUID(),
              existing_membership_rule_id: existingMembershipRule.id,
              operation: 'remove' as const,
              member_source_group_id: existingMembershipRule.member_source_group_id,
              member_target_group_id: existingMembershipRule.member_target_group_id,
              membership_mode: existingMembershipRule.membership_mode,
              required_source_role_id: existingMembershipRule.required_source_role_id,
              eligible_origin_group_ids:
                existingMembershipRule.origins
                  ?.map(origin => origin.eligible_origin_group_id)
                  .filter((id): id is string => Boolean(id)) ?? [],
            }
          : null;

      const result = proposeGroupConnectionChange({
        id: currentPrimaryRequest?.id ?? crypto.randomUUID(),
        active_connection_id: currentPrimaryConnection?.id ?? null,
        proposed_connection_id: payload.id,
        group_a_id: payload.group_a_id,
        group_b_id: payload.group_b_id,
        desired_connection_type: payload.connection_type,
        desired_parent_group_id: payload.parent_group_id,
        desired_child_group_id: payload.child_group_id,
        initiator_group_id: currentGroupId,
        grants,
        membership_rule: membershipRule,
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

  return {
    currentGroupId,
    currentGroupName,
    initialTargetGroupId,
    initialRelationshipType,
    initialRights,
    trigger,
    allRelationships,
    t,
    proposeGroupConnectionChange,
    open,
    setOpen,
    initializedForOpenRef,
    lastHydratedStateRef,
    isEditMode,
    availableGroupsRaw,
    groupStateLoading,
    availableGroups,
    composer,
    value,
    setValue,
    activeTab,
    setActiveTab,
    resetComposer,
    isSubmitting,
    setIsSubmitting,
    selectedGroupRoles,
    currentGroupRoles,
    pairConnections,
    pairConnectionsLoading,
    pairConnectionRequests,
    pairConnectionRequestsLoading,
    relevantConnections,
    pairRelationships,
    pairRequestRelationships,
    currentPrimaryConnection,
    currentPrimaryRequest,
    relevantRelationships,
    currentSelectionRelationships,
    existingRightStatuses,
    existingRightIdsByKey,
    existingGrantIdsByKeyAndHolder,
    selectableRolesByDirection,
    preflight,
    handleSubmit,
  };
}
