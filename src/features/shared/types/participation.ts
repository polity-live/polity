export interface ParticipationActionRightLike {
  resource?: string | null;
  action?: string | null;
}

export interface ParticipationRoleLike {
  id: string;
  name?: string | null;
  description?: string | null;
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

export interface ParticipationLike<TRole extends ParticipationRoleLike = ParticipationRoleLike> {
  id: string;
  user?: ParticipationUserLike | null;
  created_at?: number | null;
  status?: string | null;
  source?: string | null;
  roles?: readonly TRole[] | null;
  role?: TRole | null;
}
