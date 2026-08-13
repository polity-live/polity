import { db } from '../db';
import { deterministicE2EUuid } from '../run';

export const eventActors = {
  organizer: 'event-organizer',
  participant: 'event-participant',
} as const;

export async function resetEventParticipant(eventId: string, userId: string) {
  await db()`
    delete from public.event_participant
    where event_id = ${eventId}::uuid and user_id = ${userId}::uuid
  `;
}

export async function seedEventParticipant(
  prefix: string,
  eventId: string,
  groupId: string,
  userId: string,
  status: 'invited' | 'requested' | 'confirmed' = 'confirmed'
) {
  const id = deterministicE2EUuid(`${prefix}:event-participant:${eventId}:${userId}`);
  await db()`
    insert into public.event_participant (
      id, event_id, user_id, group_id, status, visibility, created_at
    ) values (
      ${id}::uuid, ${eventId}::uuid, ${userId}::uuid, ${groupId}::uuid,
      ${status}, 'public', now()
    )
    on conflict (event_id, user_id) where instance_date is null do update
    set status = excluded.status,
        group_id = excluded.group_id,
        visibility = excluded.visibility
  `;
  return id;
}
