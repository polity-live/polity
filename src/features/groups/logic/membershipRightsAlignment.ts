import { GROUP_ACTION_RIGHTS, PERMISSION_IMPLIES } from '@/zero/rbac/constants';
import type { ActionType, ResourceType } from '@/zero/rbac/types';
import type { GroupRightKey } from '@/zero/network/request-types';
import { findRightPaths, type ReachableRightPath } from '@/zero/network/rightTraversal';
import type { ParticipationLike } from '@/features/shared/types/participation';
import {
  buildMembershipRightsSummary,
  getMembershipDisplayRoles,
  type MembershipRightSummary,
} from './buildMembershipRightsSummary';

export type MembershipRightsAlignmentStatus = 'aligned' | 'missing' | 'extra' | 'mixed';

export interface ActionRightDefinition {
  resource: ResourceType;
  action: ActionType;
  label: string;
}

export interface ConnectedGroupRight {
  rightKey: GroupRightKey;
  paths: ReachableRightPath[];
}

export interface MembershipRightsAlignmentRow<
  TMembership extends ParticipationLike = ParticipationLike,
> {
  membership: TMembership;
  sourceGroupId: string | null;
  targetGroupId: string;
  status: MembershipRightsAlignmentStatus;
  connectedRights: ConnectedGroupRight[];
  expectedRights: ActionRightDefinition[];
  actualRights: MembershipRightSummary[];
  missingRights: ActionRightDefinition[];
  extraRights: MembershipRightSummary[];
  assignedRoleCount: number;
}

export interface GroupRightGrantLike {
  id: string;
  connection_id: string;
  right_key?: string | null;
  holder_group_id?: string | null;
  scope_group_id?: string | null;
  status?: string | null;
}

export interface DerivedGroupRightRelationshipLike {
  id: string;
  connection_id?: string | null;
  grant_id?: string | null;
  with_right?: string | null;
  group_id?: string | null;
  related_group_id?: string | null;
  status?: string | null;
}

export const GROUP_RIGHT_ACTION_RIGHT_MAPPING: Record<
  GroupRightKey,
  readonly Pick<ActionRightDefinition, 'resource' | 'action'>[]
> = {
  informationRight: [
    { resource: 'groups', action: 'view' },
    { resource: 'groupDocuments', action: 'view' },
    { resource: 'groupLinks', action: 'view' },
  ],
  amendmentRight: [{ resource: 'amendments', action: 'create' }],
  rightToSpeak: [],
  activeVotingRight: [],
  passiveVotingRight: [],
};

const GROUP_RIGHT_KEYS = Object.keys(GROUP_RIGHT_ACTION_RIGHT_MAPPING) as GroupRightKey[];

const ACTION_RIGHT_LABELS_BY_KEY = new Map(
  GROUP_ACTION_RIGHTS.map(right => [getActionRightKey(right.resource, right.action), right.label])
);
const ACTION_RIGHT_ORDER_BY_KEY = new Map(
  GROUP_ACTION_RIGHTS.map((right, index) => [
    getActionRightKey(right.resource, right.action),
    index,
  ])
);

export function buildMembershipRightsAlignmentRows<
  TMembership extends ParticipationLike = ParticipationLike,
>(args: {
  memberships: readonly TMembership[];
  targetGroupId: string;
  grants: readonly GroupRightGrantLike[];
}): MembershipRightsAlignmentRow<TMembership>[] {
  const activeGrants = normalizeActiveGroupRightGrants(args.grants);

  return args.memberships.map(membership =>
    buildMembershipRightsAlignmentRow({
      membership,
      targetGroupId: args.targetGroupId,
      grants: activeGrants,
    })
  );
}

export function buildMembershipRightsAlignmentRowsFromRelationships<
  TMembership extends ParticipationLike = ParticipationLike,
>(args: {
  memberships: readonly TMembership[];
  targetGroupId: string;
  relationships: readonly DerivedGroupRightRelationshipLike[];
}): MembershipRightsAlignmentRow<TMembership>[] {
  return buildMembershipRightsAlignmentRows({
    memberships: args.memberships,
    targetGroupId: args.targetGroupId,
    grants: args.relationships.flatMap(relationship => {
      if (
        !relationship.with_right ||
        !relationship.group_id ||
        !relationship.related_group_id ||
        !isGroupRightKey(relationship.with_right)
      ) {
        return [];
      }

      return [
        {
          id: relationship.grant_id ?? relationship.id,
          connection_id: relationship.connection_id ?? relationship.id,
          right_key: relationship.with_right,
          holder_group_id: relationship.group_id,
          scope_group_id: relationship.related_group_id,
          status: relationship.status,
        },
      ];
    }),
  });
}

function buildMembershipRightsAlignmentRow<TMembership extends ParticipationLike>(args: {
  membership: TMembership;
  targetGroupId: string;
  grants: readonly NormalizedGroupRightGrant[];
}): MembershipRightsAlignmentRow<TMembership> {
  const sourceGroupId = resolveMembershipSourceGroupId(args.membership);
  const connectedRights = sourceGroupId
    ? resolveConnectedRights({
        sourceGroupId,
        targetGroupId: args.targetGroupId,
        grants: args.grants,
      })
    : [];
  const expectedRights = buildExpectedActionRights(connectedRights.map(right => right.rightKey));
  const actualRights = buildMembershipRightsSummary(args.membership);
  const expectedKeys = new Set(
    expectedRights.map(right => getActionRightKey(right.resource, right.action))
  );
  const actualKeys = new Set(actualRights.map(right => right.key));
  const missingRights = expectedRights.filter(
    right => !actualKeys.has(getActionRightKey(right.resource, right.action))
  );
  const extraRights = actualRights.filter(right => !expectedKeys.has(right.key));

  return {
    membership: args.membership,
    sourceGroupId,
    targetGroupId: args.targetGroupId,
    status: getAlignmentStatus(missingRights.length, extraRights.length),
    connectedRights,
    expectedRights,
    actualRights,
    missingRights,
    extraRights,
    assignedRoleCount: getMembershipDisplayRoles(args.membership).length,
  };
}

function normalizeActiveGroupRightGrants(
  grants: readonly GroupRightGrantLike[]
): NormalizedGroupRightGrant[] {
  return grants.flatMap(grant => {
    if (
      grant.status !== 'active' ||
      !grant.right_key ||
      !grant.holder_group_id ||
      !grant.scope_group_id ||
      !isGroupRightKey(grant.right_key)
    ) {
      return [];
    }

    return [
      {
        id: grant.id,
        connection_id: grant.connection_id,
        right_key: grant.right_key,
        holder_group_id: grant.holder_group_id,
        scope_group_id: grant.scope_group_id,
        status: 'active',
      },
    ];
  });
}

interface NormalizedGroupRightGrant {
  id: string;
  connection_id: string;
  right_key: GroupRightKey;
  holder_group_id: string;
  scope_group_id: string;
  status: 'active';
}

function resolveConnectedRights(args: {
  sourceGroupId: string;
  targetGroupId: string;
  grants: readonly NormalizedGroupRightGrant[];
}): ConnectedGroupRight[] {
  return GROUP_RIGHT_KEYS.flatMap(rightKey => {
    const paths = findRightPaths({
      startGroupId: args.sourceGroupId,
      targetGroupId: args.targetGroupId,
      rightKey,
      grants: args.grants,
    });

    return paths.length > 0 ? [{ rightKey, paths }] : [];
  });
}

function buildExpectedActionRights(rightKeys: readonly GroupRightKey[]): ActionRightDefinition[] {
  const rightsByKey = new Map<string, ActionRightDefinition>();

  for (const rightKey of rightKeys) {
    for (const right of GROUP_RIGHT_ACTION_RIGHT_MAPPING[rightKey]) {
      addExpectedActionRight(rightsByKey, right.resource, right.action);

      const impliedActions = PERMISSION_IMPLIES[right.action] ?? [];
      for (const impliedAction of impliedActions) {
        addExpectedActionRight(rightsByKey, right.resource, impliedAction);
      }
    }
  }

  return sortActionRightDefinitions([...rightsByKey.values()]);
}

function addExpectedActionRight(
  rightsByKey: Map<string, ActionRightDefinition>,
  resource: ResourceType,
  action: ActionType
) {
  const key = getActionRightKey(resource, action);
  if (rightsByKey.has(key)) {
    return;
  }

  rightsByKey.set(key, {
    resource,
    action,
    label: ACTION_RIGHT_LABELS_BY_KEY.get(key) ?? formatFallbackRightLabel(resource, action),
  });
}

function sortActionRightDefinitions<
  TRight extends { resource: string; action: string; label: string },
>(rights: readonly TRight[]) {
  return [...rights].sort((left, right) => {
    const leftIndex =
      ACTION_RIGHT_ORDER_BY_KEY.get(getActionRightKey(left.resource, left.action)) ??
      Number.MAX_SAFE_INTEGER;
    const rightIndex =
      ACTION_RIGHT_ORDER_BY_KEY.get(getActionRightKey(right.resource, right.action)) ??
      Number.MAX_SAFE_INTEGER;

    return (
      leftIndex - rightIndex ||
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    );
  });
}

function resolveMembershipSourceGroupId(membership: ParticipationLike) {
  return membership.baseGroup?.id ?? membership.source_group_id ?? null;
}

function getAlignmentStatus(
  missingCount: number,
  extraCount: number
): MembershipRightsAlignmentStatus {
  if (missingCount > 0 && extraCount > 0) {
    return 'mixed';
  }
  if (missingCount > 0) {
    return 'missing';
  }
  if (extraCount > 0) {
    return 'extra';
  }
  return 'aligned';
}

function isGroupRightKey(value: string): value is GroupRightKey {
  return GROUP_RIGHT_KEYS.includes(value as GroupRightKey);
}

function getActionRightKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function formatFallbackRightLabel(resource: string, action: string) {
  return `${resource} / ${action}`;
}
