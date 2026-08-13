import type { Browser } from '@playwright/test';

import { authenticateActor, type E2EActorUser } from '../auth';
import type { E2EDatabase } from '../db';
import type { E2ERunFixture } from '../test';
import type { SeedData } from '../seed';
import { deterministicE2EUuid } from '../run';

export type GovernanceActorRole = 'agenda-manager' | 'collaborator' | 'voter-a' | 'voter-b';

export interface GovernanceActors {
  agendaManager: E2EActorUser;
  collaborator: E2EActorUser;
  voterA: E2EActorUser;
  voterB: E2EActorUser;
}

export function governanceActors(e2eRun: E2ERunFixture): GovernanceActors {
  const actor = (role: GovernanceActorRole) => {
    const user = e2eRun.actor(role);
    e2eRun.registerActorId(user.id);
    return user;
  };

  return {
    agendaManager: actor('agenda-manager'),
    collaborator: actor('collaborator'),
    voterA: actor('voter-a'),
    voterB: actor('voter-b'),
  };
}

export async function authenticateGovernanceActor(
  browser: Browser,
  actors: GovernanceActors,
  role: GovernanceActorRole
) {
  const actor =
    role === 'agenda-manager'
      ? actors.agendaManager
      : role === 'collaborator'
        ? actors.collaborator
        : role === 'voter-a'
          ? actors.voterA
          : actors.voterB;
  await authenticateActor(browser, actor);
  return actor;
}

export function governanceEntityId(e2eRun: E2ERunFixture, label: string) {
  const id = deterministicE2EUuid(`${e2eRun.prefix}:governance:${label}`);
  e2eRun.registerEntityId(id);
  return id;
}

export async function seedAgendaSequence(
  sql: E2EDatabase,
  e2eRun: E2ERunFixture,
  seed: SeedData,
  titles: readonly string[]
) {
  const items = titles.map((title, index) => ({
    id: governanceEntityId(e2eRun, `agenda-sequence-${index + 1}`),
    title: `${e2eRun.prefix} ${title}`,
    orderIndex: index + 2,
  }));

  await sql`
    update public.agenda_item
    set order_index = 1, status = 'pending', updated_at = now()
    where id = ${seed.agendaItemId}::uuid
  `;

  for (const item of items) {
    await sql`
      insert into public.agenda_item (
        id, event_id, creator_id, title, description, type, status,
        order_index, duration, voting_phase, created_at, updated_at
      ) values (
        ${item.id}::uuid, ${seed.eventId}::uuid, ${seed.userId}::uuid,
        ${item.title}, ${item.title}, 'discussion', 'pending',
        ${item.orderIndex}, 15, 'internal', now(), now()
      )
    `;
  }

  return items;
}

export async function seedAmendmentDocument(
  sql: E2EDatabase,
  e2eRun: E2ERunFixture,
  seed: SeedData,
  versions: readonly string[]
) {
  const documentId = governanceEntityId(e2eRun, 'document');
  const versionIds = versions.map((_, index) =>
    governanceEntityId(e2eRun, `document-v${index + 1}`)
  );
  const content = (text: string) => [{ type: 'p', children: [{ text }] }];

  await sql`
    insert into public.document (id, amendment_id, content, editing_mode, created_at, updated_at)
    values (
      ${documentId}::uuid, ${seed.amendmentId}::uuid,
      ${sql.json(content(versions.at(-1) ?? ''))}::jsonb, 'edit', now(), now()
    );
    update public.amendment
    set document_id = ${documentId}::uuid, updated_at = now()
    where id = ${seed.amendmentId}::uuid;
  `;

  for (const [index, text] of versions.entries()) {
    await sql`
      insert into public.document_version (
        id, document_id, amendment_id, content, version_number,
        change_summary, author_id, created_at
      ) values (
        ${versionIds[index]}::uuid, ${documentId}::uuid, ${seed.amendmentId}::uuid,
        ${sql.json(content(text))}::jsonb, ${index + 1},
        ${`Version ${index + 1}`}, ${seed.userId}::uuid,
        now() - (${versions.length - index} * interval '1 minute')
      )
    `;
  }

  return { documentId, versionIds };
}

export async function seedProcessBranches(
  sql: E2EDatabase,
  e2eRun: E2ERunFixture,
  seed: SeedData,
  options: { merged?: boolean } = {}
) {
  const processRunId = governanceEntityId(e2eRun, 'process-run');
  const mainBranchId = governanceEntityId(e2eRun, 'branch-main');
  const variantBranchId = governanceEntityId(e2eRun, 'branch-variant');
  const document = await seedAmendmentDocument(sql, e2eRun, seed, [
    `${e2eRun.prefix} original text`,
    `${e2eRun.prefix} accepted variant`,
  ]);

  await sql`
    insert into public.amendment_process_run (
      id, amendment_id, active_branch_id, status, created_by_id, created_at, updated_at
    ) values (
      ${processRunId}::uuid, ${seed.amendmentId}::uuid, null,
      ${options.merged ? 'completed' : 'active'}, ${seed.userId}::uuid, now(), now()
    );
    insert into public.amendment_process_branch (
      id, process_run_id, document_id, document_version_id, title,
      status, editing_mode, resolution, created_at, updated_at
    ) values
      (
        ${mainBranchId}::uuid, ${processRunId}::uuid, ${document.documentId}::uuid,
        ${document.versionIds[0]}::uuid, ${`${e2eRun.prefix} Main branch`},
        ${options.merged ? 'completed' : 'active'}, 'edit',
        ${options.merged ? 'winner' : null}, now(), now()
      ),
      (
        ${variantBranchId}::uuid, ${processRunId}::uuid, ${document.documentId}::uuid,
        ${document.versionIds[1]}::uuid, ${`${e2eRun.prefix} Variant branch`},
        ${options.merged ? 'merged' : 'active'}, 'edit',
        ${options.merged ? 'merged' : null}, now(), now()
      );
    update public.amendment_process_run
    set active_branch_id = ${mainBranchId}::uuid
    where id = ${processRunId}::uuid;
    update public.amendment
    set current_process_run_id = ${processRunId}::uuid, updated_at = now()
    where id = ${seed.amendmentId}::uuid;
  `;

  return { ...document, processRunId, mainBranchId, variantBranchId };
}

export async function seedChangeRequest(
  sql: E2EDatabase,
  e2eRun: E2ERunFixture,
  seed: SeedData,
  processBranchId: string,
  status: 'open' | 'approved' | 'rejected' = 'open'
) {
  const changeRequestId = governanceEntityId(e2eRun, 'change-request');
  await sql`
    insert into public.change_request (
      id, amendment_id, process_branch_id, user_id, title, description,
      status, change_type, original_text, new_text, changed_character_count,
      voting_status, branch_sequence_number, created_in_mode, visibility_scope,
      created_at, updated_at
    ) values (
      ${changeRequestId}::uuid, ${seed.amendmentId}::uuid, ${processBranchId}::uuid,
      ${seed.userId}::uuid, ${`${e2eRun.prefix} Change request`},
      'Governance E2E change request', ${status}, 'replace',
      'Original clause', 'Accepted clause', 15,
      ${status === 'open' ? 'open' : 'closed'}, 1, 'suggest_internal', 'public',
      now(), now()
    )
  `;
  return changeRequestId;
}

export async function inviteAmendmentCollaborator(
  sql: E2EDatabase,
  e2eRun: E2ERunFixture,
  seed: SeedData,
  actor: E2EActorUser
) {
  const collaborationId = governanceEntityId(e2eRun, 'collaboration-invitation');
  const collaboratorRoleId = governanceEntityId(e2eRun, 'collaboration-role');
  const documentRightId = governanceEntityId(e2eRun, 'collaboration-documents-update-right');
  await sql`
    insert into public.role (
      id, name, description, scope, amendment_id, assignment_mode, visibility, created_at
    ) values (
      ${collaboratorRoleId}::uuid, ${`${e2eRun.prefix} Amendment editor`},
      'Can edit the amendment document', 'amendment', ${seed.amendmentId}::uuid,
      'assigned', 'public', now()
    );
    insert into public.action_right (
      id, resource, action, role_id, amendment_id, created_at
    ) values (
      ${documentRightId}::uuid, 'documents', 'update',
      ${collaboratorRoleId}::uuid, ${seed.amendmentId}::uuid, now()
    );
    insert into public.amendment_collaborator (
      id, amendment_id, user_id, role_id, status, visibility, created_at
    ) values (
      ${collaborationId}::uuid, ${seed.amendmentId}::uuid, ${actor.id}::uuid,
      ${collaboratorRoleId}::uuid, 'invited', 'public', now()
    )
  `;
  return collaborationId;
}
