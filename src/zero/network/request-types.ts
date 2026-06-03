export interface NetworkLinkRightSnapshot {
  id: string;
  right_key:
    | 'informationRight'
    | 'amendmentRight'
    | 'rightToSpeak'
    | 'activeVotingRight'
    | 'passiveVotingRight';
  direction: 'forward' | 'backward' | 'bidirectional';
}

export interface NetworkLinkMembershipRuleConfigSnapshot {
  membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  role_id: string | null;
  source_group_ids: string[] | null;
}

export interface NetworkLinkMembershipRuleSnapshot {
  forward: NetworkLinkMembershipRuleConfigSnapshot;
  backward: NetworkLinkMembershipRuleConfigSnapshot;
}
