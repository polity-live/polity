import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  GroupConnectionComposerMembershipRuleValue,
  GroupConnectionComposerValue,
  GroupConnectionPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import type { GroupRelationshipRight } from '../ui/GroupRelationshipFields';

export const RELATIONSHIP_RIGHTS: GroupRelationshipRight[] = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
];

export const RELATIVE_MEMBERSHIP_DIRECTIONS: RelativeMembershipDirection[] = [
  'partner_members_to_current',
  'current_members_to_partner',
];

export const SELECTABLE_MEMBERSHIP_MODES = [
  'none',
  'all_members',
  'role_members',
] as const satisfies readonly CanonicalMembershipMode[];

export const GROUP_CONNECTION_PRESET_OPTIONS = [
  {
    value: 'parent',
    relationshipType: 'child',
    membershipMode: 'all_members',
  },
  {
    value: 'child',
    relationshipType: 'parent',
    membershipMode: 'all_members',
  },
  {
    value: 'elected',
    relationshipType: 'sibling',
    membershipMode: 'role_members',
  },
  {
    value: 'role_members_to_partner',
    relationshipType: 'sibling',
    membershipMode: 'role_members',
  },
] as const satisfies readonly {
  value: GroupConnectionPreset;
  relationshipType: GroupRelationshipType;
  membershipMode: CanonicalMembershipMode;
}[];

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

function getPresetRightDirections() {
  return createInitialRelationshipDirections();
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

export function createEmptyMembershipRule(): GroupConnectionComposerMembershipRuleValue {
  return { membershipMode: 'none', roleId: '', sourceGroupIds: [] };
}

export function hasSelectedMembership(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  return args.membershipDirection != null && args.membershipRule.membershipMode !== 'none';
}

export function hasIncompleteMembershipRule(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  if (!hasSelectedMembership(args)) {
    return false;
  }

  if (args.membershipRule.membershipMode === 'role_members') {
    return !args.membershipRule.roleId;
  }

  if (args.membershipRule.membershipMode === 'selected_source_groups') {
    return args.membershipRule.sourceGroupIds.length === 0;
  }

  return false;
}

export function hasConfiguredMembership(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  if (!hasSelectedMembership(args)) {
    return false;
  }
  if (args.membershipRule.membershipMode === 'role_members') {
    return Boolean(args.membershipRule.roleId);
  }
  if (args.membershipRule.membershipMode === 'selected_source_groups') {
    return args.membershipRule.sourceGroupIds.length > 0;
  }
  return true;
}

export function getSelectedMembershipDirection(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  return hasSelectedMembership(args) ? args.membershipDirection : null;
}

export function hasConfiguredGroupConnection(args: {
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  return (
    hasSelectedRights(args.rightDirections) ||
    hasConfiguredMembership({
      membershipDirection: args.membershipDirection,
      membershipRule: args.membershipRule,
    })
  );
}

export function buildGroupConnectionComposerDefaults(): GroupConnectionComposerValue {
  const preset: GroupConnectionPreset = 'parent';
  return applyGroupConnectionPreset(preset, {
    selectedGroupId: '',
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipDirection: null,
    membershipRule: createEmptyMembershipRule(),
    rightDirections: createInitialRelationshipDirections(),
    preset,
  });
}

export function getRelationshipTypeForPreset(preset: GroupConnectionPreset): GroupRelationshipType {
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
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}): GroupConnectionPreset {
  if (args.relationshipType === 'sibling') {
    return args.membershipDirection === 'current_members_to_partner'
      ? 'role_members_to_partner'
      : 'elected';
  }
  return args.relationshipType === 'parent' ? 'child' : 'parent';
}

export function getPresetMembershipDirection(
  preset: GroupConnectionPreset
): RelativeMembershipDirection {
  switch (preset) {
    case 'parent':
    case 'role_members_to_partner':
      return 'current_members_to_partner';
    case 'child':
    case 'elected':
      return 'partner_members_to_current';
  }
}

export function applyGroupConnectionPreset(
  preset: GroupConnectionPreset,
  current: GroupConnectionComposerValue
): GroupConnectionComposerValue {
  const membershipDirection = getPresetMembershipDirection(preset);
  const currentRule = current.membershipRule ?? createEmptyMembershipRule();
  const membershipMode =
    preset === 'elected' || preset === 'role_members_to_partner' ? 'role_members' : 'all_members';

  return {
    ...current,
    preset,
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipDirection,
    membershipRule: {
      membershipMode,
      roleId: membershipMode === 'role_members' ? currentRule.roleId : '',
      sourceGroupIds: [],
    },
    rightDirections: getPresetRightDirections(),
  };
}

export function canonicalGroupPair(firstGroupId: string, secondGroupId: string) {
  return firstGroupId < secondGroupId
    ? { group_a_id: firstGroupId, group_b_id: secondGroupId }
    : { group_a_id: secondGroupId, group_b_id: firstGroupId };
}

function getStructure(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
}) {
  const pair = canonicalGroupPair(args.currentGroupId, args.otherGroupId);
  if (args.relationshipType === 'sibling') {
    return {
      ...pair,
      connection_type: 'peer' as const,
      parent_group_id: null,
      child_group_id: null,
    };
  }
  const currentIsParent = args.relationshipType === 'parent';
  return {
    ...pair,
    connection_type: 'hierarchy' as const,
    parent_group_id: currentIsParent ? args.currentGroupId : args.otherGroupId,
    child_group_id: currentIsParent ? args.otherGroupId : args.currentGroupId,
  };
}

export function getGrantEndpointsForRightDirection(
  direction: Exclude<GroupRelationshipDirection, 'none' | 'mutual'>,
  currentGroupId: string,
  partnerGroupId: string
) {
  return direction === 'current_grants_right_to_partner'
    ? { holder_group_id: partnerGroupId, scope_group_id: currentGroupId }
    : { holder_group_id: currentGroupId, scope_group_id: partnerGroupId };
}

export function getExpandedRightDirections(direction: GroupRelationshipDirection) {
  if (direction === 'none') {
    return [] as Exclude<GroupRelationshipDirection, 'none' | 'mutual'>[];
  }

  if (direction === 'mutual') {
    return ['current_grants_right_to_partner', 'partner_grants_right_to_current'] as Exclude<
      GroupRelationshipDirection,
      'none' | 'mutual'
    >[];
  }

  return [direction] as Exclude<GroupRelationshipDirection, 'none' | 'mutual'>[];
}

export function buildCanonicalGroupConnectionPayload(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
  connectionId?: string | null;
  existingRightIdsByKey?: Partial<Record<GroupRelationshipRight, string | undefined>>;
  existingGrantIdsByKeyAndHolder?: Partial<Record<string, string | undefined>>;
  membershipRuleId?: string | null;
  initiatorGroupId: string;
  status?: 'active' | 'requested' | 'pending' | 'rejected';
}) {
  const structure = getStructure(args);
  const grants = RELATIONSHIP_RIGHTS.flatMap(right => {
    const directions = getExpandedRightDirections(args.rightDirections[right]);

    return directions.map(direction => {
      const endpoints = getGrantEndpointsForRightDirection(
        direction,
        args.currentGroupId,
        args.otherGroupId
      );
      const existingId =
        args.existingGrantIdsByKeyAndHolder?.[`${right}:${endpoints.holder_group_id}`] ??
        args.existingRightIdsByKey?.[right];
      return {
        id: existingId ?? crypto.randomUUID(),
        right_key: right,
        ...endpoints,
        status: args.status === 'active' ? 'active' : 'pending',
        initiator_group_id: args.initiatorGroupId,
      };
    });
  });

  const hasMembership =
    args.membershipDirection != null && args.membershipRule.membershipMode !== 'none';
  const memberSourceGroupId =
    args.membershipDirection === 'current_members_to_partner'
      ? args.currentGroupId
      : args.otherGroupId;
  const memberTargetGroupId =
    args.membershipDirection === 'current_members_to_partner'
      ? args.otherGroupId
      : args.currentGroupId;

  return {
    id: args.connectionId ?? crypto.randomUUID(),
    ...structure,
    status: args.status ?? 'pending',
    grants,
    membership_rule: hasMembership
      ? {
          id: args.membershipRuleId ?? crypto.randomUUID(),
          member_source_group_id: memberSourceGroupId,
          member_target_group_id: memberTargetGroupId,
          membership_mode: args.membershipRule.membershipMode as Exclude<
            GroupConnectionComposerMembershipRuleValue['membershipMode'],
            'none'
          >,
          required_source_role_id:
            args.membershipRule.membershipMode === 'role_members'
              ? args.membershipRule.roleId || null
              : null,
          eligible_origin_group_ids:
            args.membershipRule.membershipMode === 'selected_source_groups'
              ? [...new Set(args.membershipRule.sourceGroupIds)]
              : [],
        }
      : null,
  };
}

export function buildRelativeMembershipRuleFromCanonical(args: {
  currentGroupId: string;
  membershipRule:
    | {
        member_source_group_id?: string | null;
        member_target_group_id?: string | null;
        membership_mode?: string | null;
        required_source_role_id?: string | null;
        origins?: readonly { eligible_origin_group_id?: string | null }[] | null;
        eligible_origin_group_ids?: readonly string[] | null;
      }
    | null
    | undefined;
}) {
  const rule = args.membershipRule;
  const membershipDirection: RelativeMembershipDirection | null = !rule
    ? null
    : rule.member_source_group_id === args.currentGroupId
      ? 'current_members_to_partner'
      : 'partner_members_to_current';
  const mode =
    rule?.membership_mode === 'all_members' ||
    rule?.membership_mode === 'role_members' ||
    rule?.membership_mode === 'selected_source_groups'
      ? rule.membership_mode
      : 'none';
  const originIds =
    rule?.eligible_origin_group_ids ??
    rule?.origins
      ?.map(origin => origin.eligible_origin_group_id)
      .filter((id): id is string => Boolean(id)) ??
    [];

  return {
    membershipDirection,
    membershipRule: {
      membershipMode: mode,
      roleId: rule?.required_source_role_id ?? '',
      sourceGroupIds: [...originIds],
    },
  } satisfies Pick<GroupConnectionComposerValue, 'membershipDirection' | 'membershipRule'>;
}
