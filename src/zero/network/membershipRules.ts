import type { NetworkLinkMembershipRuleSnapshot } from './request-types';

export type CanonicalNetworkMembershipMode =
  | 'none'
  | 'all_members'
  | 'role_members'
  | 'selected_source_groups';

export type NetworkLinkMembershipDirection = 'forward' | 'backward';

export interface NetworkLinkMembershipRuleConfig {
  membership_mode: CanonicalNetworkMembershipMode;
  role_id: string | null;
  source_group_ids: string[] | null;
}

export interface NormalizedNetworkLinkMembershipRules {
  forward: NetworkLinkMembershipRuleConfig;
  backward: NetworkLinkMembershipRuleConfig;
}

export type MembershipRuleConfigLike =
  | {
      membership_mode?: string | null;
      role_id?: string | null;
      source_group_ids?: readonly string[] | null;
    }
  | null
  | undefined;

export type MembershipRuleLike =
  | ({
      id?: string;
      forward?: MembershipRuleConfigLike;
      backward?: MembershipRuleConfigLike;
      forward_membership_mode?: string | null;
      forward_role_id?: string | null;
      forward_source_group_ids?: readonly string[] | null;
      backward_membership_mode?: string | null;
      backward_role_id?: string | null;
      backward_source_group_ids?: readonly string[] | null;
      membership_mode?: string | null;
      role_id?: string | null;
      source_group_ids?: readonly string[] | null;
    } & Record<string, unknown>)
  | null
  | undefined;

export const EMPTY_MEMBERSHIP_RULE_CONFIG: NetworkLinkMembershipRuleConfig = {
  membership_mode: 'none',
  role_id: null,
  source_group_ids: null,
};

function dedupeStrings(values?: readonly string[] | null) {
  return values ? [...new Set(values.filter(Boolean))] : null;
}

export function normalizeMembershipRuleConfig(
  membershipRule: MembershipRuleConfigLike
): NetworkLinkMembershipRuleConfig {
  const membershipMode =
    membershipRule?.membership_mode === 'all_members' ||
    membershipRule?.membership_mode === 'role_members' ||
    membershipRule?.membership_mode === 'selected_source_groups'
      ? membershipRule.membership_mode
      : 'none';

  return {
    membership_mode: membershipMode,
    role_id: membershipMode === 'role_members' ? (membershipRule?.role_id ?? null) : null,
    source_group_ids:
      membershipMode === 'selected_source_groups'
        ? dedupeStrings(membershipRule?.source_group_ids ?? null)
        : null,
  };
}

function hasNestedDirections(
  rule: MembershipRuleLike
): rule is Extract<MembershipRuleLike, object> {
  return Boolean(rule) && ('forward' in rule || 'backward' in rule);
}

function hasFlatDirections(rule: MembershipRuleLike): rule is Extract<MembershipRuleLike, object> {
  return (
    Boolean(rule) &&
    ('forward_membership_mode' in rule ||
      'forward_role_id' in rule ||
      'forward_source_group_ids' in rule ||
      'backward_membership_mode' in rule ||
      'backward_role_id' in rule ||
      'backward_source_group_ids' in rule)
  );
}

export function normalizeMembershipRules(
  membershipRule: MembershipRuleLike
): NormalizedNetworkLinkMembershipRules {
  if (hasNestedDirections(membershipRule)) {
    return {
      forward: normalizeMembershipRuleConfig(membershipRule.forward),
      backward: normalizeMembershipRuleConfig(membershipRule.backward),
    };
  }

  if (hasFlatDirections(membershipRule)) {
    return {
      forward: normalizeMembershipRuleConfig({
        membership_mode: membershipRule.forward_membership_mode,
        role_id: membershipRule.forward_role_id,
        source_group_ids: membershipRule.forward_source_group_ids,
      }),
      backward: normalizeMembershipRuleConfig({
        membership_mode: membershipRule.backward_membership_mode,
        role_id: membershipRule.backward_role_id,
        source_group_ids: membershipRule.backward_source_group_ids,
      }),
    };
  }

  return {
    forward: EMPTY_MEMBERSHIP_RULE_CONFIG,
    backward: normalizeMembershipRuleConfig(membershipRule),
  };
}

export function hasActiveMembershipRuleConfig(config: MembershipRuleConfigLike) {
  return normalizeMembershipRuleConfig(config).membership_mode !== 'none';
}

export function hasActiveMembershipRules(membershipRule: MembershipRuleLike) {
  const normalized = normalizeMembershipRules(membershipRule);
  return (
    normalized.forward.membership_mode !== 'none' || normalized.backward.membership_mode !== 'none'
  );
}

export function sameMembershipRules(left: MembershipRuleLike, right: MembershipRuleLike) {
  const normalizedLeft = normalizeMembershipRules(left);
  const normalizedRight = normalizeMembershipRules(right);

  return (
    normalizedLeft.forward.membership_mode === normalizedRight.forward.membership_mode &&
    normalizedLeft.forward.role_id === normalizedRight.forward.role_id &&
    JSON.stringify(normalizedLeft.forward.source_group_ids ?? null) ===
      JSON.stringify(normalizedRight.forward.source_group_ids ?? null) &&
    normalizedLeft.backward.membership_mode === normalizedRight.backward.membership_mode &&
    normalizedLeft.backward.role_id === normalizedRight.backward.role_id &&
    JSON.stringify(normalizedLeft.backward.source_group_ids ?? null) ===
      JSON.stringify(normalizedRight.backward.source_group_ids ?? null)
  );
}

export function getMembershipRuleConfig(
  membershipRule: MembershipRuleLike,
  direction: NetworkLinkMembershipDirection
) {
  return normalizeMembershipRules(membershipRule)[direction];
}

export function toLegacyMembershipRuleFields(membershipRule: MembershipRuleLike) {
  return normalizeMembershipRules(membershipRule).backward;
}

export function toMembershipRuleSnapshot(
  membershipRule: MembershipRuleLike
): NetworkLinkMembershipRuleSnapshot {
  const normalized = normalizeMembershipRules(membershipRule);

  return {
    forward: normalized.forward,
    backward: normalized.backward,
  };
}

export function flattenMembershipRulesForStorage(membershipRule: MembershipRuleLike) {
  const normalized = normalizeMembershipRules(membershipRule);
  const legacy = normalized.backward;

  return {
    membership_mode: legacy.membership_mode,
    role_id: legacy.role_id,
    source_group_ids: legacy.source_group_ids,
    forward_membership_mode: normalized.forward.membership_mode,
    forward_role_id: normalized.forward.role_id,
    forward_source_group_ids: normalized.forward.source_group_ids,
    backward_membership_mode: normalized.backward.membership_mode,
    backward_role_id: normalized.backward.role_id,
    backward_source_group_ids: normalized.backward.source_group_ids,
  };
}

export function toDirectionalMembershipRuleInput(
  membershipRule: MembershipRuleLike,
  id?: string | null
) {
  const normalized = normalizeMembershipRules(membershipRule);

  return {
    id: id ?? undefined,
    forward: normalized.forward,
    backward: normalized.backward,
    ...flattenMembershipRulesForStorage(normalized),
  };
}
