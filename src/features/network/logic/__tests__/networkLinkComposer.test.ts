import { describe, expect, it } from 'vitest';

import {
  applyNetworkLinkPreset,
  buildCanonicalNetworkLinkPayload,
  buildNetworkLinkComposerDefaults,
  buildRelativeMembershipRuleFromCanonical,
  hasConfiguredMembership,
  hasConfiguredNetworkLink,
  getPresetForRelationshipType,
} from '../networkLinkComposer';

describe('networkLinkComposer presets', () => {
  it('maps the Parentgroup preset to a current-group child relationship', () => {
    const value = applyNetworkLinkPreset('parent', buildNetworkLinkComposerDefaults());
    const payload = buildCanonicalNetworkLinkPayload({
      currentGroupId: 'current-group',
      otherGroupId: 'partner-group',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
      initiatorGroupId: 'current-group',
    });

    expect(value.relationshipType).toBe('child');
    expect(value.membershipDirection).toBe('outgoing');
    expect(value.membershipRule.membershipMode).toBe('all_members');
    expect(value.rightDirections.passiveVotingRight).toBe('incoming');
    expect(payload.rights).toHaveLength(1);
    expect(payload.rights[0]).toMatchObject({
      right_key: 'passiveVotingRight',
      direction: 'forward',
    });
    expect(payload.membership_rule).toMatchObject({
      membership_direction: 'backward',
      membership_mode: 'all_members',
      role_id: null,
      source_group_ids: null,
    });
  });

  it('maps the Childgroup preset to a current-group parent relationship', () => {
    const value = applyNetworkLinkPreset('child', buildNetworkLinkComposerDefaults());
    const payload = buildCanonicalNetworkLinkPayload({
      currentGroupId: 'current-group',
      otherGroupId: 'partner-group',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
      initiatorGroupId: 'current-group',
    });

    expect(value.relationshipType).toBe('parent');
    expect(value.membershipDirection).toBe('incoming');
    expect(value.membershipRule.membershipMode).toBe('all_members');
    expect(value.rightDirections.passiveVotingRight).toBe('outgoing');
    expect(payload.rights).toHaveLength(1);
    expect(payload.rights[0]).toMatchObject({
      right_key: 'passiveVotingRight',
      direction: 'forward',
    });
    expect(payload.membership_rule).toMatchObject({
      membership_direction: 'backward',
      membership_mode: 'all_members',
      role_id: null,
      source_group_ids: null,
    });
  });

  it('derives the partner-role preset from the current-group relationship type', () => {
    expect(
      getPresetForRelationshipType({
        relationshipType: 'parent',
        membershipDirection: buildNetworkLinkComposerDefaults().membershipDirection,
        membershipRule: buildNetworkLinkComposerDefaults().membershipRule,
      })
    ).toBe('child');

    expect(
      getPresetForRelationshipType({
        relationshipType: 'child',
        membershipDirection: buildNetworkLinkComposerDefaults().membershipDirection,
        membershipRule: buildNetworkLinkComposerDefaults().membershipRule,
      })
    ).toBe('parent');
  });

  it('treats membership-only links as valid configured links', () => {
    expect(
      hasConfiguredNetworkLink({
        rightDirections: {
          informationRight: 'none',
          amendmentRight: 'none',
          rightToSpeak: 'none',
          activeVotingRight: 'none',
          passiveVotingRight: 'none',
        },
        membershipDirection: 'incoming',
        membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(true);
    expect(
      hasConfiguredNetworkLink({
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
        membershipDirection: 'incoming',
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'incoming',
        membershipRule: {
          membershipMode: 'role_members',
          roleId: 'role-1',
          sourceGroupIds: [],
        },
      })
    ).toBe(true);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'incoming',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipDirection: 'incoming',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['group-1'],
        },
      })
    ).toBe(true);
  });

  it('maps the selected edit direction to one canonical membership direction', () => {
    const payload = buildCanonicalNetworkLinkPayload({
      currentGroupId: 'current-group',
      otherGroupId: 'partner-group',
      relationshipType: 'sibling',
      rightDirections: {
        informationRight: 'none',
        amendmentRight: 'none',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
      membershipDirection: 'outgoing',
      membershipRule: {
        membershipMode: 'selected_source_groups',
        roleId: '',
        sourceGroupIds: ['group-1'],
      },
      initiatorGroupId: 'current-group',
    });

    expect(payload.membership_rule).toEqual({
      id: payload.membership_rule.id,
      membership_direction: 'forward',
      membership_mode: 'selected_source_groups',
      role_id: null,
      source_group_ids: ['group-1'],
    });
  });

  it('hydrates a canonical membership rule back into the relative edit direction', () => {
    const membershipConfig = buildRelativeMembershipRuleFromCanonical({
      currentGroupId: 'current-group',
      source_group_id: 'current-group',
      target_group_id: 'partner-group',
      membershipRule: {
        membership_direction: 'backward',
        membership_mode: 'role_members',
        role_id: 'role-1',
        source_group_ids: null,
      },
    });

    expect(membershipConfig).toEqual({
      membershipDirection: 'incoming',
      membershipRule: {
        membershipMode: 'role_members',
        roleId: 'role-1',
        sourceGroupIds: [],
      },
    });
  });
});
