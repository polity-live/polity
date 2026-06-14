import { featureThemeClassName } from '@/features/shared/theme';
import { describe, expect, it } from 'vitest';

import {
  applyGroupConnectionPreset,
  buildCanonicalGroupConnectionPayload,
  buildGroupConnectionComposerDefaults,
  buildRelativeMembershipRuleFromCanonical,
  hasConfiguredMembership,
  hasConfiguredGroupConnection,
  getPresetForRelationshipType,
} from '../groupConnectionComposer';

describe('groupConnectionComposer presets', () => {
  it('maps the parent preset to current members flowing into the partner parent group', () => {
    const value = applyGroupConnectionPreset('parent', buildGroupConnectionComposerDefaults());
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
      initiatorGroupId: 'B1',
    });

    expect(value.relationshipType).toBe('child');
    expect(value.membershipDirection).toBe('current_members_to_partner');
    expect(value.membershipRule.membershipMode).toBe('all_members');
    expect(payload).toMatchObject({
      group_a_id: 'B1',
      group_b_id: 'H1',
      connection_type: 'hierarchy',
      parent_group_id: 'H1',
      child_group_id: 'B1',
      grants: [],
    });
    expect(payload.membership_rule).toMatchObject({
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'all_members',
      required_source_role_id: null,
      eligible_origin_group_ids: [],
    });
  });

  it('maps the child preset to partner members flowing into the current parent group', () => {
    const value = applyGroupConnectionPreset('child', buildGroupConnectionComposerDefaults());
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'H1',
      otherGroupId: 'B1',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
      initiatorGroupId: 'H1',
    });

    expect(value.relationshipType).toBe('parent');
    expect(value.membershipDirection).toBe('partner_members_to_current');
    expect(value.membershipRule.membershipMode).toBe('all_members');
    expect(payload).toMatchObject({
      group_a_id: 'B1',
      group_b_id: 'H1',
      connection_type: 'hierarchy',
      parent_group_id: 'H1',
      child_group_id: 'B1',
      grants: [],
    });
    expect(payload.membership_rule).toMatchObject({
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'all_members',
    });
  });

  it('derives the partner-role preset from the current-group relationship type', () => {
    expect(
      getPresetForRelationshipType({
        relationshipType: 'parent',
        membershipDirection: buildGroupConnectionComposerDefaults().membershipDirection,
        membershipRule: buildGroupConnectionComposerDefaults().membershipRule,
      })
    ).toBe('child');

    expect(
      getPresetForRelationshipType({
        relationshipType: 'child',
        membershipDirection: buildGroupConnectionComposerDefaults().membershipDirection,
        membershipRule: buildGroupConnectionComposerDefaults().membershipRule,
      })
    ).toBe('parent');
  });

  it('treats membership-only links as configured links', () => {
    expect(
      hasConfiguredGroupConnection({
        rightDirections: {
          informationRight: 'none',
          amendmentRight: 'none',
          rightToSpeak: 'none',
          activeVotingRight: 'none',
          passiveVotingRight: 'none',
        },
        membershipDirection: 'partner_members_to_current',
        membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(true);
    expect(
      hasConfiguredGroupConnection({
        rightDirections: {
          informationRight: 'none',
          amendmentRight: 'none',
          rightToSpeak: 'none',
          activeVotingRight: 'none',
          passiveVotingRight: 'none',
        },
        membershipDirection: null,
        membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(false);
  });

  it('requires the dependent membership details for role and source-group modes', () => {
    expect(
      hasConfiguredMembership({
        membershipDirection: 'partner_members_to_current',
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'role_members',
          roleId: 'role-1',
          sourceGroupIds: [],
        },
      })
    ).toBe(true);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['B1'],
        },
      })
    ).toBe(true);
  });

  it(featureThemeClassName('networkGroupConnectionComposerThemedGradientSurface'), () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'sibling',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'mutual',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: null,
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      initiatorGroupId: 'B1',
    });

    expect(payload.grants).toEqual([
      expect.objectContaining({
        right_key: 'amendmentRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
      }),
      expect.objectContaining({
        right_key: 'amendmentRight',
        holder_group_id: 'H1',
        scope_group_id: 'B1',
      }),
    ]);
  });

  it('stores current_has_right_in_partner as current holder and partner scope', () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'child',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'current_has_right_in_partner',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: null,
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      initiatorGroupId: 'B1',
    });

    expect(payload.grants).toEqual([
      expect.objectContaining({
        right_key: 'amendmentRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
      }),
    ]);
  });

  it('stores partner_has_right_in_current as partner holder and current scope', () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'child',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'partner_has_right_in_current',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: null,
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      initiatorGroupId: 'B1',
    });

    expect(payload.grants).toEqual([
      expect.objectContaining({
        right_key: 'amendmentRight',
        holder_group_id: 'H1',
        scope_group_id: 'B1',
      }),
    ]);
  });

  it('maps the selected membership flow to explicit source and target groups', () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'sibling',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'none',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: 'current_members_to_partner',
      membershipRule: {
        membershipMode: 'selected_source_groups',
        roleId: '',
        sourceGroupIds: ['B1', 'B1', 'B2'],
      },
      initiatorGroupId: 'B1',
    });

    expect(payload.membership_rule).toMatchObject({
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'selected_source_groups',
      required_source_role_id: null,
      eligible_origin_group_ids: ['B1', 'B2'],
    });
  });

  it('hydrates an explicit membership rule back into the relative edit flow', () => {
    const membershipConfig = buildRelativeMembershipRuleFromCanonical({
      currentGroupId: 'B1',
      membershipRule: {
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'role_members',
        required_source_role_id: 'role-1',
        eligible_origin_group_ids: null,
      },
    });

    expect(membershipConfig).toEqual({
      membershipDirection: 'current_members_to_partner',
      membershipRule: {
        membershipMode: 'role_members',
        roleId: 'role-1',
        sourceGroupIds: [],
      },
    });
  });
});
