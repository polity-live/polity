export interface SubscriptionRowState {
  id: string;
  subscriber_id?: string;
  subscriber_user?: { id: string } | null;
}

export interface ProjectedSubscriptionRow extends SubscriptionRowState {
  subscriber_id: string;
}
export interface ProjectedSubscriptionState {
  subscriberCount: number;
  subscriptions: readonly ProjectedSubscriptionRow[];
  isLoading: boolean;
}

export interface ProjectedGroupMembershipState {
  group: {
    id: string;
    group_type?: string | null;
    connected_group_id?: string | null;
    primary_sibling_membership_mode?: string | null;
  };
  memberships: readonly ProjectedMembershipRow[];
  connectedGroupMemberships: readonly ProjectedMembershipRow[];
  guestAccesses: readonly ProjectedGuestAccessRow[];
  memberCount: number;
  isLoading: boolean;
}

export interface ProjectedMembershipRow {
  id: string;
  status?: string | null;
  role?: { name?: string | null } | null;
}

export interface ProjectedGuestAccessRow {
  id: string;
  status: string;
}

export interface ProjectedEventParticipationState {
  event: {
    id: string;
    event_type?: string | null;
    visibility: string;
    group?: {
      id: string;
      memberships?: readonly {
        user_id?: string | null;
        user?: { id: string } | null;
        status?: string | null;
      }[];
    } | null;
    delegates?: readonly {
      user_id?: string | null;
      user?: { id: string } | null;
      status?: string | null;
    }[];
  };
  participants: readonly { id: string; user_id: string; status?: string | null }[];
  participantCount: number;
  isLoading: boolean;
}

export interface ProjectedAmendmentCollaborationState {
  collaborations: readonly { id: string; status?: string | null }[];
  collaboratorCount: number;
  isLoading: boolean;
}
