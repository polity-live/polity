import type { UserHashtagRow } from '@/zero/common/queries';
import type { UserByIdRow } from '@/zero/users/queries';
import type { FullProfileRow } from '@/zero/users/useUserState';

/**
 * Re-export the normalized user profile row as the canonical type.
 * All consumers should use `UserProfile` (a.k.a. `FullProfileRow`) directly,
 * accessing snake_case fields from the Zero sync engine.
 */
export type UserProfile = UserByIdRow & {
  user_hashtags: UserHashtagRow[];
};

/** Derived sub-relation types from the fullProfile query */
export type ProfileStatement = FullProfileRow['statements'][number];
export type ProfileGroupMembership = FullProfileRow['group_memberships'][number];
export type ProfileBloggerRelation = FullProfileRow['blogger_relations'][number];
export type ProfileAmendmentCollaboration = FullProfileRow['amendment_collaborations'][number];
export type ProfileUserHashtag = UserProfile['user_hashtags'][number];

export interface TabSearchState {
  all: string;
  blogs: string;
  groups: string;
  amendments: string;
  statements: string;
}
