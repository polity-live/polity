import type { ParticipationUserLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type NamedBallotResultsPhase = 'indicative' | 'final';

export interface NamedBallotOption {
  id: string;
  label: string;
  order: number;
}

export interface NamedBallotResultRow {
  id: string;
  displayName: string;
  userId: string | null;
  userHandle: string | null;
  avatar: string | null;
  selectionIds: string[];
  selections: string[];
  kind: 'participant' | 'offline';
  status: 'recorded' | 'pending' | 'not_participated' | 'offline_aggregated';
  statusLabel: string;
  isStruckThrough: boolean;
}

export interface NamedBallotResultGroup {
  key: string;
  label: string;
  rows: NamedBallotResultRow[];
  optionSummaries: {
    id: string;
    label: string;
    count: number;
  }[];
  eligibleCount: number;
  recordedCount: number;
  offlineAggregatedCount: number;
}

export interface NamedBallotTotalOptionSummary {
  id: string;
  label: string;
  namedCount: number;
  offlineCount: number;
  totalCount: number;
}

export interface NamedBallotResultsModel {
  phase: NamedBallotResultsPhase;
  isClosed: boolean;
  groupedBySourceGroup: boolean;
  groups: NamedBallotResultGroup[];
  totalOptionSummaries: NamedBallotTotalOptionSummary[];
  totalEligibleCount: number;
  totalRecordedCount: number;
  totalOfflineAggregatedCount: number;
}

interface GroupLike {
  id?: string | null;
  name?: string | null;
}

interface EligibleParticipantLike {
  id: string;
  user_id?: string | null;
  user?: ParticipationUserLike | null;
  source_group?: GroupLike | null;
  partGroup?: { id: string; name?: string | null } | null;
  baseGroup?: { id: string; name?: string | null } | null;
}

interface OfflineParticipantLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  attendance_status?: string | null;
  participation_channel?: string | null;
  group_offline_member?: {
    group?: GroupLike | null;
  } | null;
  connected_user?: ParticipationUserLike | null;
}

interface VoteParticipationLike {
  voter_id?: string | null;
  voter?: {
    user_id?: string | null;
  } | null;
  decisions?:
    | readonly {
        choice_id?: string | null;
        choice?: { id: string } | null;
      }[]
    | null;
}

interface VoteOfflineTallyLike {
  choice_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface ElectionParticipationLike {
  elector_id?: string | null;
  elector?: {
    user_id?: string | null;
  } | null;
  selections?:
    | readonly {
        candidate_id?: string | null;
        candidate?: { id: string } | null;
      }[]
    | null;
}

interface ElectionOfflineTallyLike {
  candidate_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface VoteLike {
  status?: string | null;
  choices?:
    | readonly {
        id: string;
        label?: string | null;
        order_index?: number | null;
      }[]
    | null;
  voters?:
    | readonly {
        id: string;
        user_id?: string | null;
      }[]
    | null;
  indicative_participations?: readonly VoteParticipationLike[] | null;
  final_participations?: readonly VoteParticipationLike[] | null;
  offline_tallies?: readonly VoteOfflineTallyLike[] | null;
}

interface ElectionLike {
  status?: string | null;
  candidates?:
    | readonly {
        id: string;
        name?: string | null;
        order_index?: number | null;
        user?: ParticipationUserLike | null;
      }[]
    | null;
  electors?:
    | readonly {
        id: string;
        user_id?: string | null;
      }[]
    | null;
  indicative_participations?: readonly ElectionParticipationLike[] | null;
  final_participations?: readonly ElectionParticipationLike[] | null;
  offline_tallies?: readonly ElectionOfflineTallyLike[] | null;
}

function resolveResultsPhase(status?: string | null): {
  phase: NamedBallotResultsPhase;
  isClosed: boolean;
} {
  if (status === 'closed' || status === 'runoff_required' || status === 'no_winner') {
    return { phase: 'final', isClosed: true };
  }

  if (status === 'indicative' || status === 'indicative_open' || status === 'indication') {
    return { phase: 'indicative', isClosed: false };
  }
  if (status === 'final_open') {
    return { phase: 'final', isClosed: false };
  }

  return { phase: 'final', isClosed: false };
}

function buildDisplayName(user?: ParticipationUserLike | null, fallback = 'Unknown') {
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  return fullName || user?.handle || user?.email || fallback;
}

function buildOfflineDisplayName(participant: OfflineParticipantLike) {
  const fullName = `${participant.first_name ?? ''} ${participant.last_name ?? ''}`.trim();
  if (fullName) {
    return fullName;
  }

  return buildDisplayName(participant.connected_user, 'Offline participant');
}

function sortByDisplayName<T extends { displayName: string }>(rows: readonly T[]) {
  return [...rows].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' })
  );
}

function buildOptionMap(options: readonly NamedBallotOption[]) {
  return new Map(options.map(option => [option.id, option]));
}

function resolveGroup(args: {
  groupedBySourceGroup: boolean;
  explicitGroup?: GroupLike | null;
  partGroup?: GroupLike | null;
  baseGroup?: GroupLike | null;
}) {
  if (!args.groupedBySourceGroup) {
    return {
      key: 'all',
      label: translateText('generated.inline.0002_alle_stimmberechtigten_392b165f'),
      isFallback: false,
    };
  }

  const group = args.explicitGroup ?? args.partGroup ?? args.baseGroup ?? null;
  if (group?.id) {
    return {
      key: `group:${group.id}`,
      label: group.name || 'Unbenannte Herkunftsgruppe',
      isFallback: false,
    };
  }

  return {
    key: 'group:unknown',
    label: translateText('generated.inline.0003_ohne_herkunftsgruppe_d2558955'),
    isFallback: true,
  };
}

function createEmptyGroup(key: string, label: string): NamedBallotResultGroup {
  return {
    key,
    label,
    rows: [],
    optionSummaries: [],
    eligibleCount: 0,
    recordedCount: 0,
    offlineAggregatedCount: 0,
  };
}

function finalizeGroups(
  groups: Map<string, NamedBallotResultGroup>,
  options: readonly NamedBallotOption[]
): NamedBallotResultGroup[] {
  return [...groups.values()]
    .map(group => ({
      ...group,
      rows: sortByDisplayName(group.rows),
      optionSummaries: options
        .map(option => ({
          id: option.id,
          label: option.label,
          count: group.rows.reduce(
            (sum, row) =>
              sum + row.selectionIds.filter(selectionId => selectionId === option.id).length,
            0
          ),
        }))
        .filter(summary => summary.count > 0),
    }))
    .sort((left, right) => {
      if (left.key === 'all' || right.key === 'all') {
        return left.key === 'all' ? -1 : 1;
      }

      if (left.key === 'group:unknown' || right.key === 'group:unknown') {
        return left.key === 'group:unknown' ? 1 : -1;
      }

      return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
}

function buildTotalOptionSummaries(args: {
  options: readonly NamedBallotOption[];
  groups: readonly NamedBallotResultGroup[];
  offlineCountsByOptionId: Map<string, number>;
}): NamedBallotTotalOptionSummary[] {
  return args.options
    .map(option => {
      const namedCount = args.groups.reduce((sum, group) => {
        const groupSummary = group.optionSummaries.find(summary => summary.id === option.id);
        return sum + (groupSummary?.count ?? 0);
      }, 0);
      const offlineCount = args.offlineCountsByOptionId.get(option.id) ?? 0;
      const totalCount = namedCount + offlineCount;

      return {
        id: option.id,
        label: option.label,
        namedCount,
        offlineCount,
        totalCount,
      };
    })
    .filter(summary => summary.totalCount > 0);
}

function buildOfflineCountsByOptionId<T extends { phase?: string | null; count?: number | null }>(
  tallies: readonly T[],
  phase: NamedBallotResultsPhase,
  getOptionId: (tally: T) => string | null | undefined
) {
  const counts = new Map<string, number>();

  for (const tally of tallies) {
    if (tally.phase !== phase) {
      continue;
    }

    const optionId = getOptionId(tally);
    if (!optionId) {
      continue;
    }

    counts.set(optionId, (counts.get(optionId) ?? 0) + (tally.count ?? 0));
  }

  return counts;
}

function buildResultsModel(args: {
  status?: string | null;
  options: readonly NamedBallotOption[];
  eligibleParticipants: readonly EligibleParticipantLike[];
  confirmedOfflineParticipants: readonly OfflineParticipantLike[];
  groupedBySourceGroup: boolean;
  selectionsByUserId: Map<string, string[]>;
  offlineCountsByOptionId: Map<string, number>;
}): NamedBallotResultsModel {
  const { phase, isClosed } = resolveResultsPhase(args.status);
  const groups = new Map<string, NamedBallotResultGroup>();
  const optionMap = buildOptionMap(args.options);

  for (const participant of args.eligibleParticipants) {
    const userId = participant.user?.id ?? participant.user_id ?? null;
    if (!userId) {
      continue;
    }

    const groupMeta = resolveGroup({
      groupedBySourceGroup: args.groupedBySourceGroup,
      explicitGroup: participant.source_group ?? null,
      partGroup: participant.partGroup ?? null,
      baseGroup: participant.baseGroup ?? null,
    });
    const group = groups.get(groupMeta.key) ?? createEmptyGroup(groupMeta.key, groupMeta.label);
    const selections = args.selectionsByUserId.get(userId) ?? [];
    const rowStatus =
      selections.length > 0 ? 'recorded' : isClosed ? 'not_participated' : 'pending';

    group.rows.push({
      id: participant.id,
      displayName: buildDisplayName(participant.user, userId),
      userId,
      userHandle: participant.user?.handle ?? null,
      avatar: participant.user?.avatar ?? null,
      selectionIds: selections,
      selections: selections
        .map(selectionId => optionMap.get(selectionId)?.label)
        .filter((label): label is string => Boolean(label)),
      kind: 'participant',
      status: rowStatus,
      statusLabel:
        rowStatus === 'recorded'
          ? 'Erfasst'
          : rowStatus === 'not_participated'
            ? 'Nicht teilgenommen'
            : 'Noch offen',
      isStruckThrough: rowStatus === 'not_participated',
    });
    group.eligibleCount += 1;
    if (rowStatus === 'recorded') {
      group.recordedCount += 1;
    }

    groups.set(groupMeta.key, group);
  }

  for (const participant of args.confirmedOfflineParticipants) {
    const groupMeta = resolveGroup({
      groupedBySourceGroup: args.groupedBySourceGroup,
      explicitGroup: participant.group_offline_member?.group ?? null,
    });
    const group = groups.get(groupMeta.key) ?? createEmptyGroup(groupMeta.key, groupMeta.label);
    group.rows.push({
      id: participant.id,
      displayName: buildOfflineDisplayName(participant),
      userId: participant.connected_user?.id ?? null,
      userHandle: participant.connected_user?.handle ?? null,
      avatar: participant.connected_user?.avatar ?? null,
      selectionIds: [],
      selections: [],
      kind: 'offline',
      status: 'offline_aggregated',
      statusLabel: 'Offline / aggregiert',
      isStruckThrough: false,
    });
    group.offlineAggregatedCount += 1;
    groups.set(groupMeta.key, group);
  }

  const finalizedGroups = finalizeGroups(groups, args.options);

  return {
    phase,
    isClosed,
    groupedBySourceGroup: args.groupedBySourceGroup,
    groups: finalizedGroups,
    totalOptionSummaries: buildTotalOptionSummaries({
      options: args.options,
      groups: finalizedGroups,
      offlineCountsByOptionId: args.offlineCountsByOptionId,
    }),
    totalEligibleCount: finalizedGroups.reduce((sum, group) => sum + group.eligibleCount, 0),
    totalRecordedCount: finalizedGroups.reduce((sum, group) => sum + group.recordedCount, 0),
    totalOfflineAggregatedCount: finalizedGroups.reduce(
      (sum, group) => sum + group.offlineAggregatedCount,
      0
    ),
  };
}

export function buildNamedVoteResultsModel(args: {
  vote: VoteLike;
  eligibleParticipants: readonly EligibleParticipantLike[];
  confirmedOfflineParticipants: readonly OfflineParticipantLike[];
  groupedBySourceGroup: boolean;
}) {
  const options = (args.vote.choices ?? [])
    .map((choice, index) => ({
      id: choice.id,
      label: choice.label || `Choice ${index + 1}`,
      order: choice.order_index ?? index,
    }))
    .sort((left, right) => left.order - right.order);

  const { phase } = resolveResultsPhase(args.vote.status);
  const voterIdByRecordId = new Map(
    (args.vote.voters ?? []).map(voter => [voter.id, voter.user_id ?? null] as const)
  );
  const participations =
    phase === 'indicative'
      ? (args.vote.indicative_participations ?? [])
      : (args.vote.final_participations ?? []);
  const selectionsByUserId = new Map<string, string[]>();

  for (const participation of participations) {
    const userId =
      participation.voter?.user_id ??
      (participation.voter_id ? voterIdByRecordId.get(participation.voter_id) : null);
    if (!userId) {
      continue;
    }

    const selectedChoiceIds = (participation.decisions ?? [])
      .map(decision => decision.choice?.id ?? decision.choice_id ?? '')
      .filter(Boolean);
    selectionsByUserId.set(userId, selectedChoiceIds);
  }

  return buildResultsModel({
    status: args.vote.status,
    options,
    eligibleParticipants: args.eligibleParticipants,
    confirmedOfflineParticipants: args.confirmedOfflineParticipants,
    groupedBySourceGroup: args.groupedBySourceGroup,
    selectionsByUserId,
    offlineCountsByOptionId: buildOfflineCountsByOptionId(
      args.vote.offline_tallies ?? [],
      phase,
      tally => tally.choice_id
    ),
  });
}

export function buildNamedElectionResultsModel(args: {
  election: ElectionLike;
  eligibleParticipants: readonly EligibleParticipantLike[];
  confirmedOfflineParticipants: readonly OfflineParticipantLike[];
  groupedBySourceGroup: boolean;
}) {
  const options = (args.election.candidates ?? [])
    .map((candidate, index) => ({
      id: candidate.id,
      label: buildDisplayName(candidate.user, candidate.name || `Candidate ${index + 1}`),
      order: candidate.order_index ?? index,
    }))
    .sort((left, right) => left.order - right.order);

  const optionOrder = new Map(options.map(option => [option.id, option.order]));
  const { phase } = resolveResultsPhase(args.election.status);
  const electorIdByRecordId = new Map(
    (args.election.electors ?? []).map(elector => [elector.id, elector.user_id ?? null] as const)
  );
  const participations =
    phase === 'indicative'
      ? (args.election.indicative_participations ?? [])
      : (args.election.final_participations ?? []);
  const selectionsByUserId = new Map<string, string[]>();

  for (const participation of participations) {
    const userId =
      participation.elector?.user_id ??
      (participation.elector_id ? electorIdByRecordId.get(participation.elector_id) : null);
    if (!userId) {
      continue;
    }

    const selectedCandidateIds = (participation.selections ?? [])
      .map(selection => selection.candidate?.id ?? selection.candidate_id ?? '')
      .filter(Boolean)
      .sort(
        (left, right) =>
          (optionOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (optionOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
    selectionsByUserId.set(userId, selectedCandidateIds);
  }

  return buildResultsModel({
    status: args.election.status,
    options,
    eligibleParticipants: args.eligibleParticipants,
    confirmedOfflineParticipants: args.confirmedOfflineParticipants,
    groupedBySourceGroup: args.groupedBySourceGroup,
    selectionsByUserId,
    offlineCountsByOptionId: buildOfflineCountsByOptionId(
      args.election.offline_tallies ?? [],
      phase,
      tally => tally.candidate_id
    ),
  });
}
