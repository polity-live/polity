import type { NetworkLinkMembershipRuleSnapshot } from './request-types';

export type CanonicalNetworkMembershipMode =
  | 'none'
  | 'all_members'
  | 'role_members'
  | 'selected_source_groups';

export type NetworkLinkMembershipDirection = 'forward' | 'backward';

export interface NetworkLinkMembershipRuleConfig {
  membership_direction: NetworkLinkMembershipDirection | null;
  membership_mode: CanonicalNetworkMembershipMode;
  role_id: string | null;
  source_group_ids: string[] | null;
}

export interface DirectionalMembershipRuleConfig {
  membership_mode: CanonicalNetworkMembershipMode;
  role_id: string | null;
  source_group_ids: string[] | null;
}

export interface MembershipRuleConfigLike {
  membership_direction?: string | null;
  membership_mode?: string | null;
  role_id?: string | null;
  source_group_ids?: readonly string[] | null;
}

export type MembershipRuleLike = MembershipRuleConfigLike | null | undefined;

export const EMPTY_DIRECTIONAL_MEMBERSHIP_RULE_CONFIG: DirectionalMembershipRuleConfig = {
  membership_mode: 'none',
  role_id: null,
  source_group_ids: null,
};

export const EMPTY_MEMBERSHIP_RULE_CONFIG: NetworkLinkMembershipRuleConfig = {
  membership_direction: null,
  membership_mode: 'none',
  role_id: null,
  source_group_ids: null,
};

function dedupeStrings(values?: readonly string[] | null) {
  return values ? [...new Set(values.filter(Boolean))] : null;
}

function normalizeMembershipMode(value?: string | null): CanonicalNetworkMembershipMode {
  switch (value) {
    case 'all_members':
    case 'role_members':
    case 'selected_source_groups':
      return value;
    default:
      return 'none';
  }
}

function normalizeMembershipDirection(
  value: string | null | undefined,
  membershipMode: CanonicalNetworkMembershipMode
): NetworkLinkMembershipDirection | null {
  if (membershipMode === 'none') {
    return null;
  }

  return value === 'forward' || value === 'backward' ? value : null;
}

export function normalizeMembershipRuleConfig(
  membershipRule: MembershipRuleConfigLike | null | undefined
): NetworkLinkMembershipRuleConfig {
  const membershipMode = normalizeMembershipMode(membershipRule?.membership_mode);
  const membershipDirection = normalizeMembershipDirection(
    membershipRule?.membership_direction,
    membershipMode
  );

  if (membershipMode === 'none' || !membershipDirection) {
    return EMPTY_MEMBERSHIP_RULE_CONFIG;
  }

  return {
    membership_direction: membershipDirection,
    membership_mode: membershipMode,
    role_id: membershipMode === 'role_members' ? (membershipRule?.role_id ?? null) : null,
    source_group_ids:
      membershipMode === 'selected_source_groups'
        ? dedupeStrings(membershipRule?.source_group_ids ?? null)
        : null,
  };
}

export function normalizeMembershipRules(
  membershipRule: MembershipRuleLike
): NetworkLinkMembershipRuleConfig {
  return normalizeMembershipRuleConfig(membershipRule);
}

export function hasActiveMembershipRuleConfig(config: MembershipRuleConfigLike | null | undefined) {
  return normalizeMembershipRuleConfig(config).membership_mode !== 'none';
}

export function hasActiveMembershipRules(membershipRule: MembershipRuleLike) {
  return normalizeMembershipRules(membershipRule).membership_mode !== 'none';
}

export function sameMembershipRules(left: MembershipRuleLike, right: MembershipRuleLike) {
  const normalizedLeft = normalizeMembershipRules(left);
  const normalizedRight = normalizeMembershipRules(right);

  return (
    normalizedLeft.membership_direction === normalizedRight.membership_direction &&
    normalizedLeft.membership_mode === normalizedRight.membership_mode &&
    normalizedLeft.role_id === normalizedRight.role_id &&
    JSON.stringify(normalizedLeft.source_group_ids ?? null) ===
      JSON.stringify(normalizedRight.source_group_ids ?? null)
  );
}

export function getMembershipRuleDirection(membershipRule: MembershipRuleLike) {
  return normalizeMembershipRules(membershipRule).membership_direction;
}

export function getMembershipRuleConfig(
  membershipRule: MembershipRuleLike,
  direction: NetworkLinkMembershipDirection
): DirectionalMembershipRuleConfig {
  const normalized = normalizeMembershipRules(membershipRule);

  if (normalized.membership_direction !== direction) {
    return EMPTY_DIRECTIONAL_MEMBERSHIP_RULE_CONFIG;
  }

  return {
    membership_mode: normalized.membership_mode,
    role_id: normalized.role_id,
    source_group_ids: normalized.source_group_ids,
  };
}

export function flattenMembershipRulesForStorage(membershipRule: MembershipRuleLike) {
  const normalized = normalizeMembershipRules(membershipRule);

  return {
    membership_direction: normalized.membership_direction,
    membership_mode: normalized.membership_mode,
    role_id: normalized.role_id,
    source_group_ids: normalized.source_group_ids,
  };
}

export function toLegacyMembershipRuleFields(membershipRule: MembershipRuleLike) {
  return normalizeMembershipRules(membershipRule);
}

export function toMembershipRuleSnapshot(
  membershipRule: MembershipRuleLike
): NetworkLinkMembershipRuleSnapshot {
  return normalizeMembershipRules(membershipRule);
}

export function toDirectionalMembershipRuleInput(
  membershipRule: MembershipRuleLike,
  id?: string | null
) {
  const normalized = normalizeMembershipRules(membershipRule);

  return {
    id: id ?? undefined,
    ...flattenMembershipRulesForStorage(normalized),
  };
}
