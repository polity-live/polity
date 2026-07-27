import { translate as translateText } from '@/features/shared/hooks/use-translation';
export const DELEGATE_ELECTION_METADATA_PREFIX = '@delegate-election-meta ';

export interface DelegateElectionAssignmentMeta {
  kind: 'delegate_election';
  targetEventId: string;
  targetGroupId: string;
  sourceGroupId: string;
  seatRoleIds: string[];
  allSeatRoleIds: string[];
  mode: 'single' | 'list';
}

interface BuildDelegateElectionDescriptionArgs {
  summary?: string | null;
  meta: DelegateElectionAssignmentMeta;
}

export function buildDelegateElectionDescription({
  summary,
  meta,
}: BuildDelegateElectionDescriptionArgs) {
  const trimmedSummary = summary?.trim() || '';
  const metadataLine = `${DELEGATE_ELECTION_METADATA_PREFIX}${JSON.stringify(meta)}`;
  return trimmedSummary ? `${metadataLine}\n${trimmedSummary}` : metadataLine;
}

export function parseDelegateElectionMetadata(
  description: string | null | undefined
): DelegateElectionAssignmentMeta | null {
  const firstLine = description?.split(/\r?\n/, 1)[0]?.trim() || '';
  if (!firstLine.startsWith(DELEGATE_ELECTION_METADATA_PREFIX)) {
    return null;
  }

  const payload = firstLine.slice(DELEGATE_ELECTION_METADATA_PREFIX.length);

  try {
    const parsed = JSON.parse(payload) as Partial<DelegateElectionAssignmentMeta>;
    if (
      parsed.kind !== 'delegate_election' ||
      typeof parsed.targetEventId !== 'string' ||
      typeof parsed.targetGroupId !== 'string' ||
      typeof parsed.sourceGroupId !== 'string' ||
      !Array.isArray(parsed.seatRoleIds) ||
      !Array.isArray(parsed.allSeatRoleIds) ||
      (parsed.mode !== 'single' && parsed.mode !== 'list')
    ) {
      return null;
    }

    return {
      kind: 'delegate_election',
      targetEventId: parsed.targetEventId,
      targetGroupId: parsed.targetGroupId,
      sourceGroupId: parsed.sourceGroupId,
      seatRoleIds: parsed.seatRoleIds.filter(
        (seatRoleId): seatRoleId is string =>
          typeof seatRoleId === 'string' && seatRoleId.length > 0
      ),
      allSeatRoleIds: parsed.allSeatRoleIds.filter(
        (seatRoleId): seatRoleId is string =>
          typeof seatRoleId === 'string' && seatRoleId.length > 0
      ),
      mode: parsed.mode,
    };
  } catch {
    return null;
  }
}

export function stripDelegateElectionMetadata(description: string | null | undefined) {
  if (!description) {
    return null;
  }

  const lines = description.split(/\r?\n/);
  if (!lines[0]?.trim().startsWith(DELEGATE_ELECTION_METADATA_PREFIX)) {
    return description;
  }

  const visibleDescription = lines.slice(1).join('\n').trim();
  return visibleDescription || null;
}

export function buildDelegateSeatRoleName(
  eventTitle: string | null | undefined,
  seatNumber: number
) {
  const resolvedEventTitle =
    eventTitle?.trim() || translateText('features.elections.delegate.assemblyFallback');
  return translateText('features.elections.delegate.seatRoleName', {
    event: resolvedEventTitle,
    seat: seatNumber,
  });
}

export function buildDelegateSeatRoleDescription(args: {
  sourceGroupName?: string | null;
  targetGroupName?: string | null;
  eventTitle?: string | null;
  seatNumber: number;
  totalSeats: number;
}) {
  const eventTitle =
    args.eventTitle?.trim() ||
    translateText('generated.inline.0055_die_delegiertenversammlung_9744e078');
  const sourceGroupName =
    args.sourceGroupName?.trim() ||
    translateText('features.elections.delegate.sourceGroupFallback');
  const targetGroupName =
    args.targetGroupName?.trim() ||
    translateText('features.elections.delegate.targetGroupFallback');
  return translateText('features.elections.delegate.seatRoleDescription', {
    sourceGroup: sourceGroupName,
    targetGroup: targetGroupName,
    event: eventTitle,
    seat: args.seatNumber,
    total: args.totalSeats,
  });
}
