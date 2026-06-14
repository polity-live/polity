export type GroupMembershipMode = 'all_members' | 'role_members' | 'selected_source_groups';

export interface GroupMembershipRuleConfig {
  member_source_group_id: string;
  member_target_group_id: string;
  membership_mode: GroupMembershipMode;
  required_source_role_id: string | null;
  eligible_origin_group_ids: string[];
}

export interface GroupMembershipRuleLike {
  member_source_group_id?: string | null;
  member_target_group_id?: string | null;
  membership_mode?: string | null;
  required_source_role_id?: string | null;
  origins?:
    | readonly {
        eligible_origin_group_id?: string | null;
      }[]
    | null;
  eligible_origin_group_ids?: readonly string[] | null;
}

function normalizeMode(value?: string | null): GroupMembershipMode | null {
  switch (value) {
    case 'all_members':
    case 'role_members':
    case 'selected_source_groups':
      return value;
    default:
      return null;
  }
}

function normalizeOrigins(rule?: GroupMembershipRuleLike | null) {
  const direct = rule?.eligible_origin_group_ids ?? [];
  const related =
    rule?.origins?.map(origin => origin.eligible_origin_group_id).filter(Boolean) ?? [];
  return [...new Set([...direct, ...related].filter((id): id is string => Boolean(id)))];
}

export function normalizeMembershipRule(
  rule: GroupMembershipRuleLike | null | undefined
): GroupMembershipRuleConfig | null {
  const membershipMode = normalizeMode(rule?.membership_mode);
  const memberSourceGroupId = rule?.member_source_group_id ?? null;
  const memberTargetGroupId = rule?.member_target_group_id ?? null;

  if (!membershipMode || !memberSourceGroupId || !memberTargetGroupId) {
    return null;
  }

  return {
    member_source_group_id: memberSourceGroupId,
    member_target_group_id: memberTargetGroupId,
    membership_mode: membershipMode,
    required_source_role_id:
      membershipMode === 'role_members' ? (rule?.required_source_role_id ?? null) : null,
    eligible_origin_group_ids:
      membershipMode === 'selected_source_groups' ? normalizeOrigins(rule) : [],
  };
}

export const normalizeMembershipRules = normalizeMembershipRule;

export function hasActiveMembershipRules(rule: GroupMembershipRuleLike | null | undefined) {
  return normalizeMembershipRule(rule) !== null;
}

export function sameMembershipRules(
  left: GroupMembershipRuleLike | null | undefined,
  right: GroupMembershipRuleLike | null | undefined
) {
  const normalizedLeft = normalizeMembershipRule(left);
  const normalizedRight = normalizeMembershipRule(right);

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function getMembershipRuleForTarget(
  rule: GroupMembershipRuleLike | null | undefined,
  targetGroupId: string
) {
  const normalized = normalizeMembershipRule(rule);
  return normalized?.member_target_group_id === targetGroupId ? normalized : null;
}

export function getMembershipRuleForSource(
  rule: GroupMembershipRuleLike | null | undefined,
  sourceGroupId: string
) {
  const normalized = normalizeMembershipRule(rule);
  return normalized?.member_source_group_id === sourceGroupId ? normalized : null;
}
