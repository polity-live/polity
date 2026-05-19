import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface UserGroupRoleLike {
  id?: string | null;
  name?: string | null;
  sort_order?: number | null;
}

interface UserGroupMembershipRoleLinkLike<TRole extends UserGroupRoleLike = UserGroupRoleLike> {
  role?: TRole | null;
}

function selectPrimaryGroupRole<TRole extends UserGroupRoleLike>(roles: readonly TRole[]) {
  if (roles.length === 0) return null;

  return (
    [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1))[0] ?? null
  );
}

function normalizeGroupMemberships<
  TMembership extends {
    membership_roles?: readonly UserGroupMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends UserGroupRoleLike,
>(memberships: readonly TMembership[] | null | undefined) {
  return (memberships || []).map(membership => {
    const roles: TRole[] = [];
    for (const link of membership.membership_roles || []) {
      if (link.role) {
        roles.push(link.role);
      }
    }

    return {
      ...membership,
      roles,
      role: selectPrimaryGroupRole(roles) ?? membership.role ?? null,
    };
  });
}

function normalizeUserProfile<
  TUser extends { group_memberships?: readonly unknown[] | null } | null | undefined,
>(user: TUser) {
  if (!user) return user;

  return {
    ...user,
    group_memberships: normalizeGroupMemberships(
      user.group_memberships as
        | readonly {
            membership_roles?: readonly UserGroupMembershipRoleLinkLike[] | null;
            role?: UserGroupRoleLike | null;
          }[]
        | null
        | undefined
    ),
  };
}

interface UserStateOptions {
  userId?: string;
  includePublicUsers?: boolean;
  includeAllUsers?: boolean;
  includeFullProfile?: boolean;
  includeGroupMemberships?: boolean;
  includeSearchableUsers?: boolean;
}

/**
 * Reactive state hook for user data.
 * Returns query-derived state — no mutations.
 */
export function useUserState(options: UserStateOptions = {}) {
  const {
    userId,
    includePublicUsers,
    includeAllUsers,
    includeFullProfile,
    includeGroupMemberships,
    includeSearchableUsers,
  } = options;

  const [currentUser, currentResult] = useQuery(queries.users.current({}));

  const [user, userResult] = useQuery(userId ? queries.users.byId({ id: userId }) : undefined);

  const [followers] = useQuery(userId ? queries.users.followers({ userId }) : undefined);

  const [following] = useQuery(userId ? queries.users.following({ userId }) : undefined);

  const [publicUsers, publicUsersResult] = useQuery(
    includePublicUsers ? queries.users.publicUsers({}) : undefined
  );

  const [allUsers, allUsersResult] = useQuery(
    includeAllUsers ? queries.users.allUsers({}) : undefined
  );

  const [fullProfile, fullProfileResult] = useQuery(
    includeFullProfile && userId ? queries.users.fullProfile({ id: userId }) : undefined
  );

  const [userWithGroupMemberships, userWithGroupMembershipsResult] = useQuery(
    includeGroupMemberships && userId
      ? queries.users.withGroupMemberships({ id: userId })
      : undefined
  );

  const [searchableUsers, searchableUsersResult] = useQuery(
    includeSearchableUsers ? queries.users.searchableUsers({}) : undefined
  );

  const isLoading =
    currentResult.type === 'unknown' ||
    (userId !== undefined && userResult.type === 'unknown') ||
    (includePublicUsers === true && publicUsersResult.type === 'unknown') ||
    (includeAllUsers === true && allUsersResult.type === 'unknown') ||
    (includeFullProfile === true && userId !== undefined && fullProfileResult.type === 'unknown') ||
    (includeGroupMemberships === true &&
      userId !== undefined &&
      userWithGroupMembershipsResult.type === 'unknown') ||
    (includeSearchableUsers === true && searchableUsersResult.type === 'unknown');

  return {
    currentUser,
    user,
    followers: followers ?? [],
    following: following ?? [],
    followerCount: followers?.length ?? 0,
    followingCount: following?.length ?? 0,
    publicUsers: publicUsers ?? [],
    allUsers: allUsers ?? [],
    fullProfile: (fullProfile ?? []).map(profile => normalizeUserProfile(profile)),
    userWithGroupMemberships: (userWithGroupMemberships ?? []).map(profile =>
      normalizeUserProfile(profile)
    ),
    searchableUsers: searchableUsers ?? [],
    isLoading,
  };
}

/** Type of a single element in the fullProfile query result */
export type FullProfileRow = ReturnType<typeof useUserState>['fullProfile'][number];
