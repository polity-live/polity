import { featureThemeClassName } from '@/features/shared/theme';
import { describe, expect, it } from 'vitest';

import {
  applyGroupConnectionPreset,
  buildCanonicalGroupConnectionPayload,
  buildGroupConnectionComposerDefaults,
  buildRelativeMembershipRuleFromCanonical,
  GROUP_CONNECTION_PRESET_OPTIONS,
  hasConfiguredMembership,
  hasConfiguredGroupConnection,
  hasIncompleteMembershipRule,
  getSelectedMembershipDirection,
  getPresetForRelationshipType,
  SELECTABLE_MEMBERSHIP_MODES,
} from '../groupConnectionComposer';

describe('groupConnectionComposer presets', () => {
  it('exposes exactly four selectable presets', () => {
    const values = GROUP_CONNECTION_PRESET_OPTIONS.map(option => option.value) as string[];

    expect(values).toEqual(['parent', 'child', 'elected', 'role_members_to_partner']);
    expect(values).not.toContain('parliament');
  });

  it('exposes exactly three selectable membership modes', () => {
    const values = [...SELECTABLE_MEMBERSHIP_MODES] as string[];

    expect(values).toEqual(['none', 'all_members', 'role_members']);
    expect(values).not.toContain('selected_source_groups');
  });

  it('maps the parent preset to this child group sending members into the selected parent group', () => {
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

  it('maps the child preset to selected child group members flowing into this parent group', () => {
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

    expect(
      getPresetForRelationshipType({
        relationshipType: 'sibling',
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['B1'],
        },
      })
    ).toBe('elected');

    expect(
      getPresetForRelationshipType({
        relationshipType: 'sibling',
        membershipDirection: 'current_members_to_partner',
        membershipRule: {
          membershipMode: 'role_members',
          roleId: 'role-1',
          sourceGroupIds: [],
        },
      })
    ).toBe('role_members_to_partner');
  });

  it('maps the role receive preset to selected group role members flowing into this group', () => {
    const value = applyGroupConnectionPreset('elected', buildGroupConnectionComposerDefaults());
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'S1',
      otherGroupId: 'H1',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: { ...value.membershipRule, roleId: 'role-1' },
      initiatorGroupId: 'S1',
    });

    expect(value.relationshipType).toBe('sibling');
    expect(value.membershipDirection).toBe('partner_members_to_current');
    expect(value.membershipRule.membershipMode).toBe('role_members');
    expect(payload).toMatchObject({
      group_a_id: 'H1',
      group_b_id: 'S1',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
    });
    expect(payload.membership_rule).toMatchObject({
      member_source_group_id: 'H1',
      member_target_group_id: 'S1',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      eligible_origin_group_ids: [],
    });
  });

  it('maps the role send preset to this group role members flowing into the selected group', () => {
    const value = applyGroupConnectionPreset(
      'role_members_to_partner',
      buildGroupConnectionComposerDefaults()
    );
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'S1',
      otherGroupId: 'H1',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: { ...value.membershipRule, roleId: 'role-1' },
      initiatorGroupId: 'S1',
    });

    expect(value.relationshipType).toBe('sibling');
    expect(value.membershipDirection).toBe('current_members_to_partner');
    expect(value.membershipRule.membershipMode).toBe('role_members');
    expect(payload).toMatchObject({
      group_a_id: 'H1',
      group_b_id: 'S1',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
    });
    expect(payload.membership_rule).toMatchObject({
      member_source_group_id: 'S1',
      member_target_group_id: 'H1',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      eligible_origin_group_ids: [],
    });
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

  it('requires dependent membership details for role mode and source-group compatibility', () => {
    expect(
      hasIncompleteMembershipRule({
        membershipDirection: 'partner_members_to_current',
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(true);
    expect(
      hasIncompleteMembershipRule({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'role_members',
          roleId: 'role-1',
          sourceGroupIds: [],
        },
      })
    ).toBe(false);
    expect(
      hasIncompleteMembershipRule({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
      })
    ).toBe(true);
    expect(
      hasIncompleteMembershipRule({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['B1'],
        },
      })
    ).toBe(false);

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
        holder_group_id: 'H1',
        scope_group_id: 'B1',
      }),
      expect.objectContaining({
        right_key: 'amendmentRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
      }),
    ]);
  });

  it('stores current_grants_right_to_partner as partner holder and current scope', () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'child',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'current_grants_right_to_partner',
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

  it('stores partner_grants_right_to_current as current holder and partner scope', () => {
    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'B1',
      otherGroupId: 'H1',
      relationshipType: 'child',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'partner_grants_right_to_current',
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

  it('covers optional membership state, active payload reuse, and canonical hydration fallbacks', () => {
    const emptyRule = { membershipMode: 'none' as const, roleId: '', sourceGroupIds: [] };
    expect(
      hasIncompleteMembershipRule({ membershipDirection: null, membershipRule: emptyRule })
    ).toBe(false);
    expect(
      hasIncompleteMembershipRule({
        membershipDirection: 'current_members_to_partner',
        membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(false);
    expect(
      getSelectedMembershipDirection({ membershipDirection: null, membershipRule: emptyRule })
    ).toBeNull();
    expect(
      getSelectedMembershipDirection({
        membershipDirection: 'partner_members_to_current',
        membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe('partner_members_to_current');

    const preset = applyGroupConnectionPreset('parent', {
      ...buildGroupConnectionComposerDefaults(),
      membershipRule: null as never,
    });
    expect(preset.membershipRule).toEqual({
      membershipMode: 'all_members',
      roleId: '',
      sourceGroupIds: [],
    });

    const activePayload = buildCanonicalGroupConnectionPayload({
      currentGroupId: 'A',
      otherGroupId: 'B',
      relationshipType: 'parent',
      rightDirections: {
        informationRight: 'current_grants_right_to_partner',
        amendmentRight: 'none',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: 'partner_members_to_current',
      membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      connectionId: 'connection-existing',
      membershipRuleId: 'membership-existing',
      existingRightIdsByKey: { informationRight: 'grant-existing' },
      initiatorGroupId: 'A',
      status: 'active',
    });
    expect(activePayload).toMatchObject({
      id: 'connection-existing',
      status: 'active',
      grants: [{ id: 'grant-existing', status: 'active' }],
      membership_rule: {
        id: 'membership-existing',
        required_source_role_id: null,
      },
    });

    expect(
      buildRelativeMembershipRuleFromCanonical({ currentGroupId: 'A', membershipRule: null })
    ).toEqual({
      membershipDirection: null,
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
    });
    expect(
      buildRelativeMembershipRuleFromCanonical({
        currentGroupId: 'A',
        membershipRule: {
          member_source_group_id: 'B',
          membership_mode: 'selected_source_groups',
          origins: [{ eligible_origin_group_id: 'origin-a' }, { eligible_origin_group_id: null }],
        },
      })
    ).toEqual({
      membershipDirection: 'partner_members_to_current',
      membershipRule: {
        membershipMode: 'selected_source_groups',
        roleId: '',
        sourceGroupIds: ['origin-a'],
      },
    });
    expect(
      buildRelativeMembershipRuleFromCanonical({
        currentGroupId: 'A',
        membershipRule: {
          member_source_group_id: 'A',
          membership_mode: 'all_members',
          eligible_origin_group_ids: ['direct-origin'],
        },
      }).membershipRule
    ).toEqual({ membershipMode: 'all_members', roleId: '', sourceGroupIds: ['direct-origin'] });
    expect(
      buildRelativeMembershipRuleFromCanonical({
        currentGroupId: 'A',
        membershipRule: { member_source_group_id: 'A', membership_mode: 'invalid' },
      }).membershipRule
    ).toEqual({ membershipMode: 'none', roleId: '', sourceGroupIds: [] });
  });
});
