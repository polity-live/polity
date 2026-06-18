export const ACTIVE_GROUP_MEMBER_STATUSES = new Set(['active', 'admin', 'member']);
export const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set([
  'active',
  'admin',
  'member',
  'confirmed',
]);

export interface UserBearingRow {
  user_id?: string | null;
  user?: { id?: string | null } | null;
}

export function isActiveGroupMemberStatus(status: string | null | undefined) {
  return ACTIVE_GROUP_MEMBER_STATUSES.has(status ?? '');
}

export function isActiveEventParticipantStatus(status: string | null | undefined) {
  return ACTIVE_EVENT_PARTICIPANT_STATUSES.has(status ?? '');
}

export function getRowUserId(row: UserBearingRow | null | undefined) {
  return row?.user?.id ?? row?.user_id ?? null;
}

export function uniqueUserIds(...groups: readonly (readonly (string | null | undefined)[])[]) {
  const ids = new Set<string>();

  for (const group of groups) {
    for (const id of group) {
      if (id) {
        ids.add(id);
      }
    }
  }

  return [...ids];
}

export function collectUserIds(rows: readonly UserBearingRow[]) {
  return uniqueUserIds(rows.map(getRowUserId));
}
