export type AgendaDisplayType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';

function normalizeVotingPhase(value?: string | null) {
  if (value === 'pending') return 'pending';
  if (value === 'final') return 'final';
  if (value === 'closed' || value === 'completed') return 'closed';
  if (value === 'indicative' || value === 'indication') return 'indication';
  return null;
}

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
  const resolvedStatus = normalizeVotingPhase(status);
  const resolvedFallback = normalizeVotingPhase(fallback);

  if (resolvedStatus === 'closed' || resolvedFallback === 'closed') return 'closed';
  if (resolvedStatus === 'final' || resolvedFallback === 'final') return 'final';
  if (resolvedStatus === 'pending' || resolvedFallback === 'pending') return 'pending';

  return 'indication';
}

export function getEffectiveCRVotingPhase(
  item?: {
    status?: string | null;
    vote?: { status?: string | null } | null;
  } | null
): string | null {
  if (!item) return null;

  return (
    normalizeVotingPhase(item.vote?.status) ?? normalizeVotingPhase(item.status) ?? 'indication'
  );
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
