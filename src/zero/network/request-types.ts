import type { ReadonlyJSONObject } from '@rocicorp/zero';

export interface NetworkLinkRightSnapshot extends ReadonlyJSONObject {
  readonly id: string;
  right_key:
    | 'informationRight'
    | 'amendmentRight'
    | 'rightToSpeak'
    | 'activeVotingRight'
    | 'passiveVotingRight';
  readonly direction: 'forward' | 'backward' | 'bidirectional';
}

export interface NetworkLinkMembershipRuleConfigSnapshot extends ReadonlyJSONObject {
  readonly membership_direction: 'forward' | 'backward' | null;
  readonly membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  readonly role_id: string | null;
  readonly source_group_ids: readonly string[] | null;
}

export type NetworkLinkMembershipRuleSnapshot = NetworkLinkMembershipRuleConfigSnapshot;
