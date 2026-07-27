import {
  buildDelegateElectionDescription,
  buildDelegateSeatRoleDescription,
  buildDelegateSeatRoleName,
  parseDelegateElectionMetadata,
} from '@/features/elections/logic/electionAssignmentMetadata';
import type { ElectionMode } from './electionMode';
import { translate } from '@/features/shared/hooks/use-translation';

function delegateAssemblyFallback() {
  return translate('features.elections.delegate.assemblyFallback');
}

interface DelegateElectionRoleLike {
  elections?:
    | readonly {
        description?: string | null;
      }[]
    | null;
}

export function collectExistingDelegateSeatRoleIds(
  roles: readonly DelegateElectionRoleLike[],
  sourceGroupId: string,
  targetEventId: string
) {
  const seatRoleIds = new Set<string>();

  for (const role of roles) {
    for (const election of role.elections || []) {
      const metadata = parseDelegateElectionMetadata(election.description);
      if (
        !metadata ||
        metadata.sourceGroupId !== sourceGroupId ||
        metadata.targetEventId !== targetEventId
      ) {
        continue;
      }

      for (const seatRoleId of metadata.allSeatRoleIds) {
        seatRoleIds.add(seatRoleId);
      }
    }
  }

  return [...seatRoleIds];
}

export function buildDelegateSeatRoleInput(args: {
  sourceGroupName?: string | null;
  targetGroupName?: string | null;
  targetEventTitle?: string | null;
  seatNumber: number;
  totalSeats: number;
}) {
  return {
    name: buildDelegateSeatRoleName(args.targetEventTitle, args.seatNumber),
    description: buildDelegateSeatRoleDescription({
      sourceGroupName: args.sourceGroupName,
      targetGroupName: args.targetGroupName,
      eventTitle: args.targetEventTitle,
      seatNumber: args.seatNumber,
      totalSeats: args.totalSeats,
    }),
  };
}

export function buildDelegateElectionAgendaItemTitle(args: {
  mode: ElectionMode;
  targetEventTitle?: string | null;
  seatNumber?: number | null;
}) {
  if (args.mode === 'list') {
    return translate('features.elections.delegate.agendaListTitle', {
      event: args.targetEventTitle || delegateAssemblyFallback(),
    });
  }

  return translate('features.elections.delegate.agendaSingleTitle', {
    seat: args.seatNumber ?? 1,
    event: args.targetEventTitle || delegateAssemblyFallback(),
  });
}

export function buildDelegateElectionAgendaItemDescription(args: {
  mode: ElectionMode;
  seatCount: number;
  totalSeatCount: number;
  seatNumber?: number | null;
}) {
  if (args.mode === 'list') {
    return translate('features.elections.delegate.agendaListDescription', {
      count: args.seatCount,
    });
  }

  return translate('features.elections.delegate.agendaSingleDescription', {
    seat: args.seatNumber ?? 1,
    total: args.totalSeatCount,
  });
}

export function buildDelegateElectionRecordTitle(args: {
  mode: ElectionMode;
  targetEventTitle?: string | null;
  seatNumber?: number | null;
}) {
  if (args.mode === 'list') {
    return translate('features.elections.delegate.recordListTitle', {
      event: args.targetEventTitle || delegateAssemblyFallback(),
    });
  }

  return translate('features.elections.delegate.recordSingleTitle', {
    seat: args.seatNumber ?? 1,
    event: args.targetEventTitle || delegateAssemblyFallback(),
  });
}

export function buildDelegateElectionRecordDescription(args: {
  sourceGroupId: string;
  sourceGroupName?: string | null;
  targetGroupId: string;
  targetEventId: string;
  targetEventTitle?: string | null;
  seatRoleIds: string[];
  allSeatRoleIds: string[];
  mode: ElectionMode;
}) {
  return buildDelegateElectionDescription({
    summary: translate('features.elections.delegate.recordSummary', {
      sourceGroup:
        args.sourceGroupName || translate('features.elections.delegate.sourceGroupFallback'),
      event: args.targetEventTitle || delegateAssemblyFallback(),
    }),
    meta: {
      kind: 'delegate_election',
      targetEventId: args.targetEventId,
      targetGroupId: args.targetGroupId,
      sourceGroupId: args.sourceGroupId,
      seatRoleIds: args.seatRoleIds,
      allSeatRoleIds: args.allSeatRoleIds,
      mode: args.mode,
    },
  });
}
