export interface ParticipationActionRightLike {
  resource?: string | null;
  action?: string | null;
}

export interface ParticipationRoleLike {
  id: string;
  name?: string | null;
  description?: string | null;
  assignee_kind?: string | null;
  assignment_mode?: string | null;
  sort_order?: number | null;
  default_request_role?: boolean | null;
  default_invite_role?: boolean | null;
  action_rights?: readonly ParticipationActionRightLike[] | null;
}

export interface ParticipationUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
  email?: string | null;
}

export interface ParticipationGroupLike {
  id?: string | null;
  name?: string | null;
  group_type?: string | null;
}

export interface ParticipationProvenanceGroupLike {
  id: string;
  name: string;
  group_type?: string | null;
}

export interface ParticipationDelegateRepresentedGroupLike {
  id: string;
  name: string;
  seatCount: number;
}

export interface ParticipationLike<TRole extends ParticipationRoleLike = ParticipationRoleLike> {
  id: string;
  user_id?: string | null;
  group_id?: string | null;
  source_group_id?: string | null;
  user?: ParticipationUserLike | null;
  group?: ParticipationGroupLike | null;
  source_group?: ParticipationGroupLike | null;
  created_at?: number | null;
  status?: string | null;
  source?: string | null;
  roles?: readonly TRole[] | null;
  elected_roles?: readonly TRole[] | null;
  role?: TRole | null;
  partGroup?: ParticipationProvenanceGroupLike | null;
  baseGroup?: ParticipationProvenanceGroupLike | null;
  provenanceBucketLabel?: string | null;
  delegateRepresentedGroups?: readonly ParticipationDelegateRepresentedGroupLike[] | null;
}
