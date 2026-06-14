export type GroupRightKey =
  | 'informationRight'
  | 'amendmentRight'
  | 'rightToSpeak'
  | 'activeVotingRight'
  | 'passiveVotingRight';

export interface GroupRightGrantRequestInput {
  readonly id: string;
  readonly existing_grant_id?: string | null;
  readonly operation: 'upsert' | 'remove';
  readonly right_key: GroupRightKey;
  readonly holder_group_id: string;
  readonly scope_group_id: string;
}

export interface GroupMembershipRuleRequestInput {
  readonly id?: string;
  readonly existing_membership_rule_id?: string | null;
  readonly operation: 'upsert' | 'remove';
  readonly member_source_group_id?: string | null;
  readonly member_target_group_id?: string | null;
  readonly membership_mode?: 'all_members' | 'role_members' | 'selected_source_groups' | null;
  readonly required_source_role_id?: string | null;
  readonly eligible_origin_group_ids?: readonly string[];
}
