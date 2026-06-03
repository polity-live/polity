import { describe, expect, it } from 'vitest';

import {
  applyNetworkLinkPreset,
  buildCanonicalNetworkLinkPayload,
  buildNetworkLinkComposerDefaults,
  buildRelativeMembershipRulesFromCanonical,
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
      membershipRules: value.membershipRules,
      initiatorGroupId: 'current-group',
    });

    expect(value.relationshipType).toBe('child');
    expect(value.membershipRules.outgoing.membershipMode).toBe('all_members');
    expect(value.rightDirections.passiveVotingRight).toBe('incoming');
    expect(payload.rights).toHaveLength(1);
    expect(payload.rights[0]).toMatchObject({
      right_key: 'passiveVotingRight',
      direction: 'forward',
    });
    expect(payload.membership_rule.backward.membership_mode).toBe('all_members');
    expect(payload.membership_rule.forward.membership_mode).toBe('none');
  });

  it('maps the Childgroup preset to a current-group parent relationship', () => {
    const value = applyNetworkLinkPreset('child', buildNetworkLinkComposerDefaults());
    const payload = buildCanonicalNetworkLinkPayload({
      currentGroupId: 'current-group',
      otherGroupId: 'partner-group',
      relationshipType: value.relationshipType,
      rightDirections: value.rightDirections,
      membershipRules: value.membershipRules,
      initiatorGroupId: 'current-group',
    });

    expect(value.relationshipType).toBe('parent');
    expect(value.membershipRules.incoming.membershipMode).toBe('all_members');
    expect(value.rightDirections.passiveVotingRight).toBe('outgoing');
    expect(payload.rights).toHaveLength(1);
    expect(payload.rights[0]).toMatchObject({
      right_key: 'passiveVotingRight',
      direction: 'forward',
    });
    expect(payload.membership_rule.backward.membership_mode).toBe('all_members');
    expect(payload.membership_rule.forward.membership_mode).toBe('none');
  });

  it('derives the partner-role preset from the current-group relationship type', () => {
    expect(
      getPresetForRelationshipType({
        relationshipType: 'parent',
        membershipRules: buildNetworkLinkComposerDefaults().membershipRules,
      })
    ).toBe('child');

    expect(
      getPresetForRelationshipType({
        relationshipType: 'child',
        membershipRules: buildNetworkLinkComposerDefaults().membershipRules,
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
        membershipRules: {
          incoming: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
          outgoing: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
        },
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
        membershipRules: {
          incoming: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
          outgoing: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
        },
      })
    ).toBe(false);
  });

  it('requires the dependent membership details for role and source-group modes', () => {
    expect(
      hasConfiguredMembership({
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipRule: {
          membershipMode: 'role_members',
          roleId: 'role-1',
          sourceGroupIds: [],
        },
      })
    ).toBe(true);
    expect(
      hasConfiguredMembership({
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
      })
    ).toBe(false);
    expect(
      hasConfiguredMembership({
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['group-1'],
        },
      })
    ).toBe(true);
  });

  it('normalizes bidirectional membership selections to a single active direction', () => {
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
      membershipRules: {
        incoming: { membershipMode: 'role_members', roleId: 'role-in', sourceGroupIds: [] },
        outgoing: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: ['group-1'],
        },
      },
      initiatorGroupId: 'current-group',
    });

    expect(payload.membership_rule.backward).toEqual({
      membership_mode: 'role_members',
      role_id: 'role-in',
      source_group_ids: null,
    });
    expect(payload.membership_rule.forward).toEqual({
      membership_mode: 'none',
      role_id: null,
      source_group_ids: null,
    });
  });

  it('collapses legacy bidirectional membership data to one edit direction when hydrating', () => {
    const membershipRules = buildRelativeMembershipRulesFromCanonical({
      currentGroupId: 'current-group',
      source_group_id: 'current-group',
      target_group_id: 'partner-group',
      membershipRule: {
        forward: {
          membership_mode: 'all_members',
          role_id: null,
          source_group_ids: null,
        },
        backward: {
          membership_mode: 'role_members',
          role_id: 'role-1',
          source_group_ids: null,
        },
      },
    });

    expect(membershipRules.incoming).toEqual({
      membershipMode: 'role_members',
      roleId: 'role-1',
      sourceGroupIds: [],
    });
    expect(membershipRules.outgoing).toEqual({
      membershipMode: 'none',
      roleId: '',
      sourceGroupIds: [],
    });
  });
});
