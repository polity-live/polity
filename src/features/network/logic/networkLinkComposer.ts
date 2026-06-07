import type {
  GroupRelationshipDirection,
  GroupRelationshipType,
  NetworkLinkComposerMembershipRuleValue,
  NetworkLinkComposerValue,
  NetworkLinkPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import type { GroupRelationshipRight } from '../ui/GroupRelationshipFields';
import { normalizeMembershipRules } from '@/zero/network/membershipRules';

export const RELATIONSHIP_RIGHTS: GroupRelationshipRight[] = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
];

export const RELATIVE_MEMBERSHIP_DIRECTIONS: RelativeMembershipDirection[] = [
  'incoming',
  'outgoing',
];

export function createInitialRelationshipDirections(): Record<
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

function getPresetRightDirections(
  preset: NetworkLinkPreset
): Record<GroupRelationshipRight, GroupRelationshipDirection> {
  const rightDirections = createInitialRelationshipDirections();

  if (preset === 'parent') {
    rightDirections.passiveVotingRight = 'incoming';
    return rightDirections;
  }

  if (preset === 'child') {
    rightDirections.passiveVotingRight = 'outgoing';
    return rightDirections;
  }

  return rightDirections;
}

export function getSelectedRights(
  directions: Record<GroupRelationshipRight, GroupRelationshipDirection>
) {
  return RELATIONSHIP_RIGHTS.filter(right => directions[right] !== 'none');
}

export function hasSelectedRights(
  directions: Record<GroupRelationshipRight, GroupRelationshipDirection>
) {
  return getSelectedRights(directions).length > 0;
}

export function createEmptyMembershipRule(): NetworkLinkComposerMembershipRuleValue {
  return {
    membershipMode: 'none',
    roleId: '',
    sourceGroupIds: [],
  };
}

export function hasSelectedMembership(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  return args.membershipDirection != null && args.membershipRule.membershipMode !== 'none';
}

export function hasConfiguredMembership(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  if (!hasSelectedMembership(args)) {
    return false;
  }

  if (args.membershipRule.membershipMode === 'role_members') {
    return Boolean(args.membershipRule.roleId);
  }

  if (args.membershipRule.membershipMode === 'selected_source_groups') {
    return Boolean(args.membershipRule.sourceGroupIds.length);
  }

  return true;
}

export function getSelectedMembershipDirection(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  return hasSelectedMembership(args) ? args.membershipDirection : null;
}

export function hasConfiguredNetworkLink(args: {
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  return (
    hasSelectedRights(args.rightDirections) ||
    hasConfiguredMembership({
      membershipDirection: args.membershipDirection,
      membershipRule: args.membershipRule,
    })
  );
}

export function buildNetworkLinkComposerDefaults(): NetworkLinkComposerValue {
  const preset: NetworkLinkPreset = 'parent';

  return applyNetworkLinkPreset(preset, {
    selectedGroupId: '',
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipDirection: null,
    membershipRule: createEmptyMembershipRule(),
    rightDirections: createInitialRelationshipDirections(),
    preset,
  });
}

export function getRelationshipTypeForPreset(preset: NetworkLinkPreset): GroupRelationshipType {
  if (preset === 'parent') {
    return 'child';
  }

  if (preset === 'child') {
    return 'parent';
  }

  return 'sibling';
}

export function getPresetForRelationshipType(args: {
  relationshipType: GroupRelationshipType;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}): NetworkLinkPreset {
  if (args.relationshipType === 'sibling') {
    return args.membershipRule.membershipMode === 'selected_source_groups'
      ? 'parliament'
      : 'elected';
  }

  return args.relationshipType === 'parent' ? 'child' : 'parent';
}

export function getPresetMembershipDirection(
  preset: NetworkLinkPreset
): RelativeMembershipDirection {
  switch (preset) {
    case 'parent':
      return 'outgoing';
    case 'child':
    case 'parliament':
    case 'elected':
    default:
      return 'incoming';
  }
}

export function applyNetworkLinkPreset(
  preset: NetworkLinkPreset,
  current: NetworkLinkComposerValue
): NetworkLinkComposerValue {
  const direction = getPresetMembershipDirection(preset);
  const currentRule = current.membershipRule ?? createEmptyMembershipRule();

  if (preset === 'parent' || preset === 'child') {
    return {
      ...current,
      preset,
      relationshipType: getRelationshipTypeForPreset(preset),
      membershipDirection: direction,
      membershipRule: {
        membershipMode: 'all_members',
        roleId: '',
        sourceGroupIds: [],
      },
      rightDirections: getPresetRightDirections(preset),
    };
  }

  if (preset === 'elected') {
    return {
      ...current,
      preset,
      relationshipType: getRelationshipTypeForPreset(preset),
      membershipDirection: direction,
      membershipRule: {
        membershipMode: 'role_members',
        roleId: currentRule.roleId,
        sourceGroupIds: [],
      },
      rightDirections: getPresetRightDirections(preset),
    };
  }

  return {
    ...current,
    preset,
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipDirection: direction,
    membershipRule: {
      membershipMode: 'selected_source_groups',
      roleId: '',
      sourceGroupIds: currentRule.sourceGroupIds,
    },
    rightDirections: getPresetRightDirections(preset),
  };
}

function getCanonicalSourceTarget(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
}) {
  if (args.relationshipType === 'parent') {
    return {
      source_group_id: args.currentGroupId,
      target_group_id: args.otherGroupId,
      structural_relation: 'parent_child' as const,
      sourceIsCurrentGroup: true,
    };
  }

  if (args.relationshipType === 'child') {
    return {
      source_group_id: args.otherGroupId,
      target_group_id: args.currentGroupId,
      structural_relation: 'parent_child' as const,
      sourceIsCurrentGroup: false,
    };
  }

  return {
    source_group_id: args.currentGroupId,
    target_group_id: args.otherGroupId,
    structural_relation: 'sibling' as const,
    sourceIsCurrentGroup: true,
  };
}

function toCanonicalMembershipDirection(args: {
  sourceIsCurrentGroup: boolean;
  membershipDirection: RelativeMembershipDirection | null;
  membershipMode: NetworkLinkComposerMembershipRuleValue['membershipMode'];
}) {
  if (args.membershipDirection == null || args.membershipMode === 'none') {
    return null;
  }

  if (args.sourceIsCurrentGroup) {
    return args.membershipDirection === 'outgoing' ? 'forward' : 'backward';
  }

  return args.membershipDirection === 'outgoing' ? 'backward' : 'forward';
}

export function buildCanonicalNetworkLinkPayload(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
  linkId?: string | null;
  existingRightIdsByKey?: Partial<Record<GroupRelationshipRight, string | undefined>>;
  membershipRuleId?: string | null;
  initiatorGroupId: string;
  status?: 'active' | 'requested' | 'pending' | 'rejected';
}) {
  const { source_group_id, target_group_id, structural_relation, sourceIsCurrentGroup } =
    getCanonicalSourceTarget({
      currentGroupId: args.currentGroupId,
      otherGroupId: args.otherGroupId,
      relationshipType: args.relationshipType,
    });

  const membershipDirection = toCanonicalMembershipDirection({
    sourceIsCurrentGroup,
    membershipDirection: args.membershipDirection,
    membershipMode: args.membershipRule.membershipMode,
  });
  const normalizedMembershipRule = normalizeMembershipRules({
    membership_direction: membershipDirection,
    membership_mode: args.membershipRule.membershipMode,
    role_id:
      args.membershipRule.membershipMode === 'role_members'
        ? (args.membershipRule.roleId ?? null)
        : null,
    source_group_ids:
      args.membershipRule.membershipMode === 'selected_source_groups'
        ? [...new Set(args.membershipRule.sourceGroupIds ?? [])]
        : null,
  });

  return {
    id: args.linkId ?? crypto.randomUUID(),
    source_group_id,
    target_group_id,
    structural_relation,
    status: args.status ?? 'requested',
    rights: RELATIONSHIP_RIGHTS.flatMap(right => {
      const direction = args.rightDirections[right];
      if (direction === 'none') {
        return [];
      }

      const canonicalDirection =
        direction === 'bidirectional'
          ? 'bidirectional'
          : sourceIsCurrentGroup
            ? direction === 'outgoing'
              ? 'forward'
              : 'backward'
            : direction === 'outgoing'
              ? 'backward'
              : 'forward';

      return [
        {
          id: args.existingRightIdsByKey?.[right] ?? crypto.randomUUID(),
          right_key: right,
          direction: canonicalDirection as 'forward' | 'backward' | 'bidirectional',
          status: args.status ?? 'requested',
          initiator_group_id: args.initiatorGroupId,
        },
      ];
    }),
    membership_rule: {
      id: args.membershipRuleId ?? crypto.randomUUID(),
      membership_direction: normalizedMembershipRule.membership_direction,
      membership_mode: normalizedMembershipRule.membership_mode,
      role_id: normalizedMembershipRule.role_id,
      source_group_ids: normalizedMembershipRule.source_group_ids,
    },
  };
}

export function buildRelativeMembershipRuleFromCanonical(args: {
  currentGroupId: string;
  source_group_id: string;
  target_group_id: string;
  membershipRule:
    | {
        membership_direction?: string | null;
        membership_mode?: string | null;
        role_id?: string | null;
        source_group_ids?: string[] | null;
      }
    | null
    | undefined;
}) {
  const normalized = normalizeMembershipRules(args.membershipRule);
  const sourceIsCurrentGroup = args.source_group_id === args.currentGroupId;

  const membershipDirection =
    normalized.membership_direction == null
      ? null
      : sourceIsCurrentGroup
        ? normalized.membership_direction === 'forward'
          ? 'outgoing'
          : 'incoming'
        : normalized.membership_direction === 'forward'
          ? 'incoming'
          : 'outgoing';

  return {
    membershipDirection,
    membershipRule: {
      membershipMode: normalized.membership_mode,
      roleId: normalized.role_id ?? '',
      sourceGroupIds: normalized.source_group_ids ?? [],
    },
  } satisfies Pick<NetworkLinkComposerValue, 'membershipDirection' | 'membershipRule'>;
}
