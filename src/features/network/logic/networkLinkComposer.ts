import type {
  GroupRelationshipDirection,
  GroupRelationshipType,
  NetworkLinkComposerMembershipRuleValue,
  NetworkLinkComposerValue,
  NetworkLinkPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import type { GroupRelationshipRight } from '../ui/GroupRelationshipFields';
import {
  normalizeMembershipRules,
  toLegacyMembershipRuleFields,
} from '@/zero/network/membershipRules';

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

export function hasConfiguredMembership(args: {
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  if (args.membershipRule.membershipMode === 'none') {
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

export function hasSelectedMembership(args: {
  membershipRule: NetworkLinkComposerMembershipRuleValue;
}) {
  return args.membershipRule.membershipMode !== 'none';
}

export function getSelectedMembershipDirection(args: {
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}): RelativeMembershipDirection | null {
  if (hasSelectedMembership({ membershipRule: args.membershipRules.incoming })) {
    return 'incoming';
  }

  if (hasSelectedMembership({ membershipRule: args.membershipRules.outgoing })) {
    return 'outgoing';
  }

  return null;
}

export function normalizeExclusiveMembershipRules(args: {
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}) {
  const selectedDirection = getSelectedMembershipDirection(args);

  return {
    incoming:
      selectedDirection === 'incoming'
        ? args.membershipRules.incoming
        : createEmptyMembershipRule(),
    outgoing:
      selectedDirection === 'outgoing'
        ? args.membershipRules.outgoing
        : createEmptyMembershipRule(),
  } satisfies Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}

export function hasConfiguredNetworkLink(args: {
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}) {
  return (
    hasSelectedRights(args.rightDirections) ||
    RELATIVE_MEMBERSHIP_DIRECTIONS.some(direction =>
      hasConfiguredMembership({ membershipRule: args.membershipRules[direction] })
    )
  );
}

export function createEmptyMembershipRule(): NetworkLinkComposerMembershipRuleValue {
  return {
    membershipMode: 'none',
    roleId: '',
    sourceGroupIds: [],
  };
}

export function createInitialMembershipRules(): Record<
  RelativeMembershipDirection,
  NetworkLinkComposerMembershipRuleValue
> {
  return {
    incoming: createEmptyMembershipRule(),
    outgoing: createEmptyMembershipRule(),
  };
}

export function buildNetworkLinkComposerDefaults(): NetworkLinkComposerValue {
  const preset: NetworkLinkPreset = 'parent';

  return applyNetworkLinkPreset(preset, {
    selectedGroupId: '',
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipRules: createInitialMembershipRules(),
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
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}): NetworkLinkPreset {
  if (args.relationshipType === 'sibling') {
    const normalizedMembershipRules = normalizeExclusiveMembershipRules({
      membershipRules: args.membershipRules,
    });
    const preferredRule = hasSelectedMembership({
      membershipRule: normalizedMembershipRules.incoming,
    })
      ? normalizedMembershipRules.incoming
      : normalizedMembershipRules.outgoing;
    return preferredRule.membershipMode === 'selected_source_groups' ? 'parliament' : 'elected';
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
  const membershipRules = createInitialMembershipRules();
  const currentDirectionRule = current.membershipRules[direction] ?? createEmptyMembershipRule();

  if (preset === 'parent') {
    membershipRules[direction] = {
      membershipMode: 'all_members',
      roleId: '',
      sourceGroupIds: [],
    };
    return {
      ...current,
      preset,
      relationshipType: getRelationshipTypeForPreset(preset),
      membershipRules,
      rightDirections: getPresetRightDirections(preset),
    };
  }

  if (preset === 'child') {
    membershipRules[direction] = {
      membershipMode: 'all_members',
      roleId: '',
      sourceGroupIds: [],
    };
    return {
      ...current,
      preset,
      relationshipType: getRelationshipTypeForPreset(preset),
      membershipRules,
      rightDirections: getPresetRightDirections(preset),
    };
  }

  if (preset === 'elected') {
    membershipRules[direction] = {
      membershipMode: 'role_members',
      roleId: currentDirectionRule.roleId,
      sourceGroupIds: [],
    };
    return {
      ...current,
      preset,
      relationshipType: getRelationshipTypeForPreset(preset),
      membershipRules,
      rightDirections: getPresetRightDirections(preset),
    };
  }

  membershipRules[direction] = {
    membershipMode: 'selected_source_groups',
    roleId: '',
    sourceGroupIds: currentDirectionRule.sourceGroupIds,
  };

  return {
    ...current,
    preset,
    relationshipType: getRelationshipTypeForPreset(preset),
    membershipRules,
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

export function buildCanonicalNetworkLinkPayload(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: GroupRelationshipType;
  rightDirections: Record<GroupRelationshipRight, GroupRelationshipDirection>;
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
  linkId?: string | null;
  existingRightIdsByKey?: Partial<Record<GroupRelationshipRight, string | undefined>>;
  membershipRuleId?: string | null;
  initiatorGroupId: string;
  status?: 'active' | 'requested' | 'pending' | 'rejected';
}) {
  const membershipRules = normalizeExclusiveMembershipRules({
    membershipRules: args.membershipRules,
  });
  const { source_group_id, target_group_id, structural_relation, sourceIsCurrentGroup } =
    getCanonicalSourceTarget({
      currentGroupId: args.currentGroupId,
      otherGroupId: args.otherGroupId,
      relationshipType: args.relationshipType,
    });

  const toCanonicalMembershipRule = (direction: RelativeMembershipDirection) => {
    const membershipRule = membershipRules[direction];
    return {
      membership_mode: membershipRule.membershipMode,
      role_id:
        membershipRule.membershipMode === 'role_members' ? (membershipRule.roleId ?? null) : null,
      source_group_ids:
        membershipRule.membershipMode === 'selected_source_groups'
          ? [...new Set(membershipRule.sourceGroupIds ?? [])]
          : null,
    };
  };

  const forwardRule = sourceIsCurrentGroup
    ? toCanonicalMembershipRule('outgoing')
    : toCanonicalMembershipRule('incoming');
  const backwardRule = sourceIsCurrentGroup
    ? toCanonicalMembershipRule('incoming')
    : toCanonicalMembershipRule('outgoing');
  const legacyRule = toLegacyMembershipRuleFields({
    forward: forwardRule,
    backward: backwardRule,
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
      forward: forwardRule,
      backward: backwardRule,
      membership_mode: legacyRule.membership_mode,
      role_id: legacyRule.role_id,
      source_group_ids: legacyRule.source_group_ids,
    },
  };
}

export function buildRelativeMembershipRulesFromCanonical(args: {
  currentGroupId: string;
  source_group_id: string;
  target_group_id: string;
  membershipRule:
    | {
        forward?: {
          membership_mode?: string | null;
          role_id?: string | null;
          source_group_ids?: string[] | null;
        } | null;
        backward?: {
          membership_mode?: string | null;
          role_id?: string | null;
          source_group_ids?: string[] | null;
        } | null;
        membership_mode?: string | null;
        role_id?: string | null;
        source_group_ids?: string[] | null;
      }
    | null
    | undefined;
}) {
  const normalized = normalizeMembershipRules(args.membershipRule);
  const sourceIsCurrentGroup = args.source_group_id === args.currentGroupId;
  const incoming = sourceIsCurrentGroup ? normalized.backward : normalized.forward;
  const outgoing = sourceIsCurrentGroup ? normalized.forward : normalized.backward;
  const membershipRules = normalizeExclusiveMembershipRules({
    membershipRules: {
      incoming: {
        membershipMode: incoming.membership_mode,
        roleId: incoming.role_id ?? '',
        sourceGroupIds: incoming.source_group_ids ?? [],
      },
      outgoing: {
        membershipMode: outgoing.membership_mode,
        roleId: outgoing.role_id ?? '',
        sourceGroupIds: outgoing.source_group_ids ?? [],
      },
    },
  });

  return {
    incoming: membershipRules.incoming,
    outgoing: membershipRules.outgoing,
  } satisfies Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}
