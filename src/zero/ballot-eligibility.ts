import type { Transaction } from '@rocicorp/zero';
import { zql, type Schema } from './schema';

const ACTIVE_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];

type BallotTx = Transaction<Schema>;

function hasActiveVotingRight(
  participant: {
    participant_roles?: readonly {
      role?: {
        action_rights?: readonly {
          action?: string | null;
          resource?: string | null;
          event_id?: string | null;
        }[];
      } | null;
    }[];
  },
  eventId: string
) {
  return Boolean(
    participant.participant_roles?.some(link =>
      link.role?.action_rights?.some(
        right =>
          right.action === 'active_voting' &&
          right.resource === 'events' &&
          right.event_id === eventId
      )
    )
  );
}

async function loadBallotEvent(tx: BallotTx, agendaItemId: string | null | undefined) {
  if (!agendaItemId) throw new Error('Ballot is not linked to an event agenda item.');
  const agendaItem = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
  if (!agendaItem?.event_id) throw new Error('Ballot is not linked to an event.');
  const event = await tx.run(zql.event.where('id', agendaItem.event_id).one());
  if (!event) throw new Error('Event not found.');
  return event;
}

async function eligibleEventUsers(
  tx: BallotTx,
  event: { id: string; attendance_mode?: string | null; accreditation_required: boolean }
) {
  const [participants, accreditations, offlineRows] = await Promise.all([
    tx.run(
      zql.event_participant
        .where('event_id', event.id)
        .where('status', 'IN', ACTIVE_PARTICIPANT_STATUSES)
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
    ),
    event.accreditation_required
      ? tx.run(zql.accreditation.where('event_id', event.id).where('status', 'approved'))
      : Promise.resolve([]),
    tx.run(
      zql.event_offline_participant
        .where('event_id', event.id)
        .where('attendance_status', 'confirmed')
    ),
  ]);
  const approvedUserIds = new Set(accreditations.map(row => row.user_id));
  const forcedOfflineUserIds = new Set(
    offlineRows
      .filter(row => row.participation_channel === 'offline' && row.connected_user_id)
      .map(row => row.connected_user_id as string)
  );

  const users = participants
    .filter(participant => hasActiveVotingRight(participant, event.id))
    .filter(
      participant => !event.accreditation_required || approvedUserIds.has(participant.user_id)
    )
    .map(participant => ({
      userId: participant.user_id,
      participationChannel:
        event.attendance_mode === 'offline' || forcedOfflineUserIds.has(participant.user_id)
          ? ('offline' as const)
          : ('online' as const),
    }));
  const unconnectedOfflineCount =
    event.attendance_mode === 'hybrid' || event.attendance_mode === 'offline'
      ? offlineRows.filter(row => !row.connected_user_id).length
      : 0;
  return {
    users,
    offlineElectorateSize:
      users.filter(user => user.participationChannel === 'offline').length +
      unconnectedOfflineCount,
  };
}

export async function assertCurrentOnlineBallotEligibility(
  tx: BallotTx,
  agendaItemId: string | null | undefined,
  userId: string
) {
  const event = await loadBallotEvent(tx, agendaItemId);
  const electorate = await eligibleEventUsers(tx, event);
  const eligibleUser = electorate.users.find(user => user.userId === userId);

  if (!eligibleUser) {
    throw new Error('You are not currently eligible to vote in this event.');
  }
  if (eligibleUser.participationChannel !== 'online') {
    throw new Error('This vote must be entered via the offline tally flow for this participant.');
  }

  return { event, participationChannel: eligibleUser.participationChannel } as const;
}

export async function snapshotVoteElectorate(tx: BallotTx, voteId: string) {
  const vote = await tx.run(zql.vote.where('id', voteId).one());
  if (!vote) throw new Error('Vote not found.');
  if (vote.electorate_snapshotted_at != null) return;

  const existing = await tx.run(zql.voter.where('vote_id', voteId));
  const now = Date.now();
  if (existing.length === 0) {
    const event = await loadBallotEvent(tx, vote.agenda_item_id);
    const electorate = await eligibleEventUsers(tx, event);
    for (const eligible of electorate.users) {
      await tx.mutate.voter.insert({
        id: crypto.randomUUID(),
        vote_id: voteId,
        user_id: eligible.userId,
        participation_channel: eligible.participationChannel,
        snapshotted_at: now,
        created_at: now,
      });
    }
    await tx.mutate.vote.update({
      id: voteId,
      offline_electorate_size: electorate.offlineElectorateSize,
      updated_at: now,
    });
  }
  await tx.mutate.vote.update({ id: voteId, electorate_snapshotted_at: now, updated_at: now });
}

export async function snapshotElectionElectorate(tx: BallotTx, electionId: string) {
  const election = await tx.run(zql.election.where('id', electionId).one());
  if (!election) throw new Error('Election not found.');
  if (election.electorate_snapshotted_at != null) return;

  const existing = await tx.run(zql.elector.where('election_id', electionId));
  const now = Date.now();
  if (existing.length === 0) {
    const event = await loadBallotEvent(tx, election.agenda_item_id);
    const electorate = await eligibleEventUsers(tx, event);
    for (const eligible of electorate.users) {
      await tx.mutate.elector.insert({
        id: crypto.randomUUID(),
        election_id: electionId,
        user_id: eligible.userId,
        participation_channel: eligible.participationChannel,
        snapshotted_at: now,
        created_at: now,
      });
    }
    await tx.mutate.election.update({
      id: electionId,
      offline_electorate_size: electorate.offlineElectorateSize,
      updated_at: now,
    });
  }
  await tx.mutate.election.update({
    id: electionId,
    electorate_snapshotted_at: now,
    updated_at: now,
  });
}
