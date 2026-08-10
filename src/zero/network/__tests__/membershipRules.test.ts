import { describe, expect, it } from 'vitest';

import {
  getMembershipRuleForSource,
  getMembershipRuleForTarget,
  hasActiveMembershipRules,
  normalizeMembershipRule,
  normalizeMembershipRules,
  sameMembershipRules,
  type GroupMembershipRuleLike,
} from '../membershipRules';

const baseRule: GroupMembershipRuleLike = {
  member_source_group_id: 'source',
  member_target_group_id: 'target',
  membership_mode: 'all_members',
};

describe('network membership rule normalization', () => {
  it.each([undefined, null, '', 'none', 'unknown'])('rejects unsupported mode %s', mode => {
    expect(normalizeMembershipRule({ ...baseRule, membership_mode: mode })).toBeNull();
  });

  it('requires both endpoints', () => {
    expect(normalizeMembershipRule(undefined)).toBeNull();
    expect(normalizeMembershipRule({ ...baseRule, member_source_group_id: null })).toBeNull();
    expect(normalizeMembershipRule({ ...baseRule, member_target_group_id: null })).toBeNull();
  });

  it('normalizes all-members and role-members fields', () => {
    expect(normalizeMembershipRules(baseRule)).toEqual({
      member_source_group_id: 'source',
      member_target_group_id: 'target',
      membership_mode: 'all_members',
      required_source_role_id: null,
      eligible_origin_group_ids: [],
    });
    expect(
      normalizeMembershipRule({
        ...baseRule,
        membership_mode: 'role_members',
        required_source_role_id: 'role',
        eligible_origin_group_ids: ['ignored'],
      })
    ).toMatchObject({
      membership_mode: 'role_members',
      required_source_role_id: 'role',
      eligible_origin_group_ids: [],
    });
    expect(
      normalizeMembershipRule({ ...baseRule, membership_mode: 'role_members' })
    ).toMatchObject({ required_source_role_id: null });
  });

  it('deduplicates valid direct and related selected-source origins', () => {
    expect(
      normalizeMembershipRule({
        ...baseRule,
        membership_mode: 'selected_source_groups',
        required_source_role_id: 'ignored',
        eligible_origin_group_ids: ['direct', 'shared', ''],
        origins: [
          { eligible_origin_group_id: 'related' },
          { eligible_origin_group_id: 'shared' },
          { eligible_origin_group_id: null },
        ],
      })
    ).toEqual({
      member_source_group_id: 'source',
      member_target_group_id: 'target',
      membership_mode: 'selected_source_groups',
      required_source_role_id: null,
      eligible_origin_group_ids: ['direct', 'shared', 'related'],
    });
    expect(
      normalizeMembershipRule({
        ...baseRule,
        membership_mode: 'selected_source_groups',
        eligible_origin_group_ids: null,
        origins: null,
      })?.eligible_origin_group_ids
    ).toEqual([]);
  });

  it('compares normalized rules and reports active rules', () => {
    expect(hasActiveMembershipRules(baseRule)).toBe(true);
    expect(hasActiveMembershipRules(null)).toBe(false);
    expect(sameMembershipRules(baseRule, { ...baseRule })).toBe(true);
    expect(
      sameMembershipRules(baseRule, { ...baseRule, membership_mode: 'role_members' })
    ).toBe(false);
    expect(sameMembershipRules(null, undefined)).toBe(true);
  });

  it('selects normalized rules by source and target', () => {
    expect(getMembershipRuleForTarget(baseRule, 'target')).toMatchObject({
      member_target_group_id: 'target',
    });
    expect(getMembershipRuleForTarget(baseRule, 'outside')).toBeNull();
    expect(getMembershipRuleForTarget(null, 'target')).toBeNull();
    expect(getMembershipRuleForSource(baseRule, 'source')).toMatchObject({
      member_source_group_id: 'source',
    });
    expect(getMembershipRuleForSource(baseRule, 'outside')).toBeNull();
    expect(getMembershipRuleForSource(null, 'source')).toBeNull();
  });
});
