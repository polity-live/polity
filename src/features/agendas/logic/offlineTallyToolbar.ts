import { translate } from '@/features/shared/hooks/use-translation';

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
    args.votingPhase === 'final' ||
    args.votingPhase === 'final'
  ) {
    return 'final' as const;
  }

  return null;
}

export function resolveOfflineTallyMode(tallies: readonly unknown[]) {
  return tallies.length > 0 ? ('edit' as const) : ('create' as const);
}

export function getOfflineTallyDialogTitle(phase: OfflineTallyPhase) {
  return translate(`features.agendas.offlineTally.entities.${phase}`);
}

export function getOfflineTallyTooltip(args: {
  phase: OfflineTallyPhase | null;
  mode: OfflineTallyMode;
}) {
  if (args.phase === 'indicative') {
    return translate(
      args.mode === 'edit'
        ? 'features.agendas.offlineTally.actions.editIndicative'
        : 'features.agendas.offlineTally.actions.saveIndicative'
    );
  }

  if (args.phase === 'final') {
    return translate(
      args.mode === 'edit'
        ? 'features.agendas.offlineTally.actions.editFinal'
        : 'features.agendas.offlineTally.actions.saveFinal'
    );
  }

  return undefined;
}

export function getOfflineTallySuccessMessage(phase: OfflineTallyPhase) {
  return translate(`features.agendas.offlineTally.success.${phase}`);
}
