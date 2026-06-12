export type GroupAmendmentBadgeStatus =
  | 'accepted'
  | 'approved'
  | 'rejected'
  | 'pending'
  | 'withdrawn';

export type GroupAmendmentDisplayStatus = 'accepted' | 'rejected' | 'pending' | 'withdrawn';

const ACCEPTED_BADGE_STATUSES = new Set(['accepted', 'supported']);
const APPROVED_BADGE_STATUSES = new Set(['approved', 'merged', 'completed']);

function mapSingleStatus(status?: string | null): GroupAmendmentBadgeStatus | null {
  if (!status) {
    return null;
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  if (status === 'withdrawn') {
    return 'withdrawn';
  }

  if (APPROVED_BADGE_STATUSES.has(status)) {
    return 'approved';
  }

  if (ACCEPTED_BADGE_STATUSES.has(status)) {
    return 'accepted';
  }

  return 'pending';
}

export function getGroupAmendmentBadgeStatus(
  ...statuses: (string | null | undefined)[]
): GroupAmendmentBadgeStatus | null {
  const normalized = statuses
    .map(status => mapSingleStatus(status))
    .filter((status): status is GroupAmendmentBadgeStatus => status !== null);

  if (normalized.includes('rejected')) {
    return 'rejected';
  }

  if (normalized.includes('withdrawn')) {
    return 'withdrawn';
  }

  if (normalized.includes('approved')) {
    return 'approved';
  }

  if (normalized.includes('accepted')) {
    return 'accepted';
  }

  if (normalized.includes('pending')) {
    return 'pending';
  }

  return null;
}

export function normalizeGroupAmendmentDisplayStatus(
  ...statuses: (string | null | undefined)[]
): GroupAmendmentDisplayStatus | null {
  const badgeStatus = getGroupAmendmentBadgeStatus(...statuses);

  if (badgeStatus === 'approved' || badgeStatus === 'accepted') {
    return 'accepted';
  }

  if (badgeStatus === 'rejected') {
    return 'rejected';
  }

  if (badgeStatus === 'withdrawn') {
    return 'withdrawn';
  }

  if (badgeStatus === 'pending') {
    return 'pending';
  }

  return null;
}

export function groupAmendmentsByDisplayStatus<T extends { decision_status?: string | null }>(
  amendments: readonly T[]
) {
  return {
    accepted: amendments.filter(amendment => amendment.decision_status === 'accepted'),
    pending: amendments.filter(amendment => amendment.decision_status === 'pending'),
    rejected: amendments.filter(amendment => amendment.decision_status === 'rejected'),
    withdrawn: amendments.filter(amendment => amendment.decision_status === 'withdrawn'),
  };
}
