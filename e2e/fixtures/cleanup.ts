import { closeDb, db, runCleanupStep } from './db';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CleanupOptions {
  actorIds: readonly string[];
  entityIds?: readonly string[];
  closeConnection?: boolean;
}

export interface CleanupResources {
  actorIds: string[];
  entityIds: string[];
  resourceIds: string[];
}

function exactIds(values: readonly string[], label: string) {
  const ids = [...new Set(values)];
  for (const id of ids) {
    if (!UUID_PATTERN.test(id)) {
      throw new Error(`Refusing E2E cleanup with an invalid ${label}: ${id}`);
    }
  }
  return ids;
}

export function normalizeCleanupResources(options: CleanupOptions): CleanupResources {
  const actorIds = exactIds(options.actorIds, 'actor ID');
  if (actorIds.length === 0) {
    throw new Error('Refusing E2E cleanup without an exact actor ID.');
  }
  const entityIds = exactIds(options.entityIds ?? [], 'entity ID');
  return {
    actorIds,
    entityIds,
    resourceIds: [...new Set([...actorIds, ...entityIds])],
  };
}

/**
 * Deletes only rows identified by the current test's exact UUIDs or by exact
 * foreign-key relationships to those UUIDs. Text prefixes are deliberately not
 * accepted: two parallel tests may share a run prefix, but never an actor ID.
 */
export async function cleanupE2ERows(options: CleanupOptions) {
  const sql = db();
  const { actorIds, resourceIds } = normalizeCleanupResources(options);
  const actors = sql.array(actorIds);
  const resources = sql.array(resourceIds);

  await runCleanupStep(
    'notifications',
    () => sql`
      delete from public.notification
      where id = any(${resources}::uuid[])
         or recipient_id = any(${actors}::uuid[])
         or sender_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'payments',
    () => sql`
      delete from public.payment
      where id = any(${resources}::uuid[])
         or payer_user_id = any(${actors}::uuid[])
         or receiver_user_id = any(${actors}::uuid[])
         or payer_group_id = any(${resources}::uuid[])
         or receiver_group_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'elections',
    () => sql`
      delete from public.election
      where id = any(${resources}::uuid[])
         or agenda_item_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'agenda items',
    () => sql`
      delete from public.agenda_item
      where id = any(${resources}::uuid[])
         or event_id = any(${resources}::uuid[])
         or amendment_id = any(${resources}::uuid[])
         or creator_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'documents for amendments',
    () => sql`
      delete from public.document
      where id = any(${resources}::uuid[])
         or amendment_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'amendments',
    () => sql`
      delete from public.amendment
      where id = any(${resources}::uuid[])
         or created_by_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'events',
    () => sql`
      delete from public.event
      where id = any(${resources}::uuid[])
         or group_id = any(${resources}::uuid[])
         or creator_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'todos',
    () => sql`
      delete from public.todo
      where id = any(${resources}::uuid[])
         or creator_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'statements',
    () => sql`
      delete from public.statement
      where id = any(${resources}::uuid[])
         or user_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'blogs',
    () => sql`
      delete from public.blog
      where id = any(${resources}::uuid[])
         or group_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'timeline rows',
    () => sql`
      delete from public.timeline_event
      where id = any(${resources}::uuid[])
         or entity_id = any(${resources}::uuid[])
         or user_id = any(${actors}::uuid[])
         or actor_id = any(${actors}::uuid[])
         or group_id = any(${resources}::uuid[])
         or amendment_id = any(${resources}::uuid[])
         or event_id = any(${resources}::uuid[])
         or todo_id = any(${resources}::uuid[])
         or blog_id = any(${resources}::uuid[])
         or statement_id = any(${resources}::uuid[])
         or election_id = any(${resources}::uuid[])
         or amendment_vote_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'search rows owned by actors or groups',
    () => sql`
      delete from public.search_document
      where entity_id = any(${resources}::uuid[])
         or owner_user_id = any(${actors}::uuid[])
         or group_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'links',
    () => sql`
      delete from public.link
      where id = any(${resources}::uuid[])
         or user_id = any(${actors}::uuid[])
         or group_id = any(${resources}::uuid[])
         or event_id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'groups',
    () => sql`
      delete from public."group"
      where id = any(${resources}::uuid[])
    `
  );

  await runCleanupStep(
    'fixture public users',
    () => sql`
      delete from public."user"
      where id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'fixture auth identities',
    () => sql`
      delete from auth.identities
      where user_id = any(${actors}::uuid[])
    `
  );

  await runCleanupStep(
    'fixture auth users',
    () => sql`
      delete from auth.users
      where id = any(${actors}::uuid[])
    `
  );

  if (options.closeConnection) {
    await closeDb();
  }
}
