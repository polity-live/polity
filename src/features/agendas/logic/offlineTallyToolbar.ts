export type OfflineTallyPhase = 'indicative' | 'final';
export type OfflineTallyMode = 'create' | 'edit';

export function shouldShowOfflineTallyToolbarButton(args: {
  attendanceMode?: string | null;
  canManageVotes: boolean;
  phase: OfflineTallyPhase | null;
}) {
  return (
    (args.attendanceMode === 'offline' || args.attendanceMode === 'hybrid') &&
    args.canManageVotes &&
    args.phase === 'final'
  );
}

export function resolveOfflineTallyPhase(args: {
  allowsOfflineTallies: boolean;
  canManageOfflineTallies: boolean;
  votingPhase?: string | null;
}) {
  if (!args.allowsOfflineTallies || !args.canManageOfflineTallies) {
    return null;
  }

  if (
    args.votingPhase == null ||
    args.votingPhase === 'pending' ||
    args.votingPhase === 'indication'
  ) {
    return 'indicative' as const;
  }

  if (
    args.votingPhase === 'final' ||
    args.votingPhase === 'final_vote' ||
    args.votingPhase === 'final_open'
  ) {
    return 'final' as const;
  }

  return null;
}

export function resolveOfflineTallyMode(tallies: readonly unknown[]) {
  return tallies.length > 0 ? ('edit' as const) : ('create' as const);
}

export function getOfflineTallyDialogTitle(phase: OfflineTallyPhase) {
  return phase === 'final' ? 'Final offline tally' : 'Indicative offline tally';
}

export function getOfflineTallyTooltip(args: {
  phase: OfflineTallyPhase | null;
  mode: OfflineTallyMode;
}) {
  if (args.phase === 'indicative') {
    return args.mode === 'edit' ? 'Edit indicative offline tally' : 'Save indicative offline tally';
  }

  if (args.phase === 'final') {
    return args.mode === 'edit' ? 'Edit final offline tally' : 'Save final offline tally';
  }

  return undefined;
}

export function getOfflineTallySuccessMessage(phase: OfflineTallyPhase) {
  return phase === 'final' ? 'Offline final tally saved' : 'Offline indicative tally saved';
}
