export type AgendaDisplayType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';

export function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function getEffectiveVotingPhase(
  status?: string | null,
  fallback?: string | null
): string | null {
  const normalizePhase = (value?: string | null) => {
    if (value === 'final' || value === 'final_vote') return 'final_vote';
    if (value === 'closed') return 'closed';
    if (value === 'indicative' || value === 'indication') return 'indication';
    return null;
  };

  const resolvedStatus = normalizePhase(status);
  const resolvedFallback = normalizePhase(fallback);

  if (resolvedStatus === 'closed' || resolvedFallback === 'closed') return 'closed';
  if (resolvedStatus === 'final_vote' || resolvedFallback === 'final_vote') return 'final_vote';

  return 'indication';
}

export function getEffectiveCRVotingPhase(
  item?: {
    status?: string | null;
    vote?: { status?: string | null } | null;
  } | null
): string | null {
  if (!item) return null;
  if (item.status === 'pending') return 'pending';

  const phase = getEffectiveVotingPhase(item.vote?.status, null);
  if (phase === 'final_vote') return 'final_vote';
  if (phase === 'closed') return 'closed';
  return 'indication';
}

export function resolveAttendanceMode(
  event?: {
    attendance_mode?: string | null;
    location_type?: string | null;
  } | null
) {
  if (event?.attendance_mode === 'online' || event?.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event?.location_type === 'online' ? 'online' : 'offline';
}

export function normalizeSearchToken(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

export function getAgendaDisplayType(type?: string | null): AgendaDisplayType {
  if (type === 'amendment' || type === 'implementation_review' || type === 'support_confirmation') {
    return 'vote';
  }

  if (
    type === 'election' ||
    type === 'vote' ||
    type === 'speech' ||
    type === 'discussion' ||
    type === 'accreditation'
  ) {
    return type;
  }

  return 'discussion';
}
