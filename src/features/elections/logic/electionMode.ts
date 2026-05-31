export type ElectionMode = 'single' | 'list';

const VALID_ELECTION_MODES = new Set<ElectionMode>(['single', 'list']);

function normalizePositiveInteger(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value) {
    return null;
  }

  return Math.max(1, Math.trunc(value));
}

export function normalizeElectionMode(
  value: string | null | undefined,
  fallback: ElectionMode = 'single'
): ElectionMode {
  return VALID_ELECTION_MODES.has(value as ElectionMode) ? (value as ElectionMode) : fallback;
}

export function normalizeDelegateElectionMode(value: string | null | undefined): ElectionMode {
  return normalizeElectionMode(value, 'list');
}

export function resolveElectionMode(args: {
  electionMode?: string | null;
  seatCount?: number | null;
  maxVotes?: number | null;
  fallbackMode?: ElectionMode;
  delegateAssignmentMode?: ElectionMode | null;
}) {
  const explicitMode = args.electionMode;
  if (VALID_ELECTION_MODES.has(explicitMode as ElectionMode)) {
    return explicitMode as ElectionMode;
  }

  if (args.delegateAssignmentMode && VALID_ELECTION_MODES.has(args.delegateAssignmentMode)) {
    return args.delegateAssignmentMode;
  }

  if ((args.seatCount ?? 0) > 1 || (args.maxVotes ?? 0) > 1) {
    return 'list' as const;
  }

  return args.fallbackMode ?? 'single';
}

export function resolveElectionSeatCount(args: {
  electionMode?: string | null;
  seatCount?: number | null;
  maxVotes?: number | null;
  fallbackSeatCount?: number | null;
  delegateAssignmentMode?: ElectionMode | null;
}) {
  const mode = resolveElectionMode(args);
  if (mode === 'single') {
    return 1;
  }

  return (
    normalizePositiveInteger(args.seatCount) ??
    normalizePositiveInteger(args.fallbackSeatCount) ??
    normalizePositiveInteger(args.maxVotes) ??
    1
  );
}

export function deriveElectionMaxVotes(mode: ElectionMode, seatCount?: number | null) {
  if (mode === 'single') {
    return 1;
  }

  return normalizePositiveInteger(seatCount) ?? 1;
}

export function getElectionModeLabel(mode: ElectionMode) {
  return mode === 'list' ? 'Listenwahl' : 'Einzelwahl';
}

export function getSeatCountLabel(seatCount: number) {
  return `${seatCount} ${seatCount === 1 ? 'Position' : 'Positionen'}`;
}

export function getElectionModeSummaryLabel(mode: ElectionMode, seatCount?: number | null) {
  if (mode === 'list') {
    const resolvedSeatCount = normalizePositiveInteger(seatCount) ?? 1;
    return `${getElectionModeLabel(mode)} · ${getSeatCountLabel(resolvedSeatCount)}`;
  }

  return getElectionModeLabel(mode);
}
