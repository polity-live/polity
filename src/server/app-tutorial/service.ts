import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';

import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import {
  APP_TUTORIAL_CHECKPOINT_IDS,
  APP_TUTORIAL_CHECKPOINTS,
  APP_TUTORIAL_FIXTURE_VERSION,
  getAppTutorialCheckpoint,
  getNextAppTutorialCheckpoint,
  matchesAppTutorialExpectedInput,
  resolveAppTutorialRoute,
  type AppTutorialCheckpointId,
  type AppTutorialCompletion,
  type AppTutorialEffect,
  type AppTutorialRouteAlias,
} from '@/features/app-tutorial/catalog';
import {
  APP_TUTORIAL_AMENDMENT_AGENDA_TITLE,
  APP_TUTORIAL_AMENDMENT_TITLE,
  APP_TUTORIAL_ELECTION_AGENDA_DESCRIPTION,
  APP_TUTORIAL_ELECTION_AGENDA_TITLE,
  APP_TUTORIAL_ELECTION_DESCRIPTION,
  APP_TUTORIAL_ELECTION_TITLE,
  APP_TUTORIAL_FIRST_EVENT_TITLE,
  APP_TUTORIAL_PREPARED_TEXT_CHANGES,
  createAppTutorialAmendmentTextFixture,
} from '@/features/app-tutorial/amendment-fixture';
import {
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  createAppTutorialInitialCityDesignState,
} from '@/features/app-tutorial/city-design-fixture';
import { getCityDesignMapSelectionBoundingBox } from '@/features/amendments/city-design/logic/cityDesignBbox';
import {
  APP_TUTORIAL_ASSISTANT_TODO_TITLE,
  hasAppTutorialAssistantTodoAttachment,
  hasAppTutorialAssistantTodoOutput,
  mergeAppTutorialAssistantTodoOutput,
} from './assistant-todo-context';
import { getAppTutorialSql } from './db';
import { horizontalScrollEvidenceIsValid } from './scroll-evidence';
import { addAppTutorialFixtureTextAliasesToSearchText } from '@/features/app-tutorial/fixture-copy';

const RUN_LIFETIME_DAYS = 30;
const RUN_LIFETIME_INTERVAL = `${RUN_LIFETIME_DAYS} days`;
const MEMBERSHIP_REQUEST_REPAIR_CHECKPOINTS = new Set<AppTutorialCheckpointId>([
  'secondary-navigation',
  'open-avatar-menu',
  'open-profile',
  'open-memberships',
  'view-membership-request',
]);

type Transaction = postgres.TransactionSql<Record<string, never>>;

function toJsonValue(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

interface RunRow {
  id: string;
  user_id: string;
  status: 'active' | 'paused';
  current_checkpoint_id: AppTutorialCheckpointId;
  fixture_version: number;
  revision: number;
  expires_at: Date;
}

interface EntityRow {
  alias: AppTutorialRouteAlias;
  entity_id: string;
}

interface TutorialSearchDocumentRow {
  id: string;
  search_text: string;
}

export interface PublicAppTutorialRun {
  runId: string;
  status: 'active' | 'paused';
  currentCheckpointId: AppTutorialCheckpointId;
  route: string;
  revision: number;
  expiresAt: string;
}

export interface TutorialAdvanceEvidence {
  type?:
    | 'acknowledge'
    | 'action'
    | 'click'
    | 'drop'
    | 'entity-selection'
    | 'input'
    | 'mutation'
    | 'view'
    | 'scroll';
  anchor?: string;
  entityId?: string;
  value?: string;
  event?: string;
  scrollPixels?: number;
  scrollRangePixels?: number;
  desktopAcknowledged?: boolean;
}

export interface TutorialAdvanceResult {
  completed: boolean;
  pending?: boolean;
  route: string;
  run?: PublicAppTutorialRun;
}

export class AppTutorialEffectPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppTutorialEffectPendingError';
  }
}

function uuidPair(a: string, b: string): [string, string] {
  const pair: [string, string] = [a, b];
  pair.sort();
  return pair;
}

function richText(text: string) {
  return [{ type: 'p', children: [{ text }] }];
}

async function lockUser(tx: Transaction, userId: string) {
  await tx`select pg_advisory_xact_lock(hashtext(${`app-tutorial:${userId}`}))`;
}

async function loadEntities(
  tx: Transaction,
  runId: string
): Promise<Partial<Record<AppTutorialRouteAlias, string>>> {
  const rows = await tx<EntityRow[]>`
    select alias, entity_id
    from app_tutorial_entity
    where run_id = ${runId}
  `;
  return Object.fromEntries(rows.map(row => [row.alias, row.entity_id]));
}

async function publicRun(tx: Transaction, run: RunRow): Promise<PublicAppTutorialRun> {
  const entities = await loadEntities(tx, run.id);
  const checkpoint = getAppTutorialCheckpoint(run.current_checkpoint_id);
  return {
    runId: run.id,
    status: run.status,
    currentCheckpointId: run.current_checkpoint_id,
    route: resolveAppTutorialRoute(checkpoint.route, entities),
    revision: run.revision,
    expiresAt: run.expires_at.toISOString(),
  };
}

async function ensureTutorialSearchAliases(tx: Transaction, runId: string) {
  const rows = await tx<TutorialSearchDocumentRow[]>`
    select id, search_text
    from search_document
    where tutorial_run_id = ${runId}
  `;
  for (const row of rows) {
    const searchTextWithAliases = addAppTutorialFixtureTextAliasesToSearchText(row.search_text);
    if (searchTextWithAliases === row.search_text) continue;
    await tx`
      update search_document
      set search_text = ${searchTextWithAliases}
      where id = ${row.id}
        and tutorial_run_id = ${runId}
    `;
  }
}

async function cleanupRun(tx: Transaction, runId: string) {
  // Process steps also reference tutorial events and groups with ON DELETE SET
  // NULL. Delete the runtime graph first so those FK actions cannot update a
  // step after its process run was removed by the root tutorial cascade.
  await tx`
    delete from amendment_process_run
    where amendment_id in (
      select id from amendment where tutorial_run_id = ${runId}
    )
  `;
  // Search documents are generated roots and may not yet have observed the
  // source-row delete trigger when a generic run cascade starts.
  await tx`delete from search_document where tutorial_run_id = ${runId}`;
  await tx`delete from app_tutorial_run where id = ${runId}`;
}

async function addEntity(
  tx: Transaction,
  runId: string,
  alias: AppTutorialRouteAlias,
  entityType: string,
  entityId: string
) {
  await tx`
    insert into app_tutorial_entity (run_id, alias, entity_type, entity_id)
    values (${runId}, ${alias}, ${entityType}, ${entityId})
    on conflict (run_id, alias) do update
      set entity_type = excluded.entity_type, entity_id = excluded.entity_id
  `;
}

async function createFixtures(tx: Transaction, runId: string, userId: string) {
  const initiativeGroupId = randomUUID();
  const mobilityForumGroupId = randomUUID();
  const climateCouncilGroupId = randomUUID();
  const amendmentId = randomUUID();
  const documentId = randomUUID();
  const cityDesignId = randomUUID();
  const firstEventId = randomUUID();
  const secondEventId = randomUUID();
  const firstAgendaItemId = randomUUID();
  const amendmentVoteId = randomUUID();
  const amendmentAcceptChoiceId = randomUUID();
  const amendmentRejectChoiceId = randomUUID();
  const amendmentAbstainChoiceId = randomUUID();
  const networkTodoId = randomUUID();
  const tutorialConversationId = randomUUID();
  const syntheticUserIds = Array.from({ length: 5 }, () => randomUUID());
  const firstEventStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const firstEventEnd = new Date(firstEventStart.getTime() + 2 * 60 * 60 * 1000);
  const secondEventStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const secondEventEnd = new Date(secondEventStart.getTime() + 2 * 60 * 60 * 1000);
  const preparedChangeRequests = APP_TUTORIAL_PREPARED_TEXT_CHANGES.map((change, index) => ({
    ...change,
    changeRequestId: randomUUID(),
    suggestionId: randomUUID(),
    userId: syntheticUserIds[index],
  }));
  const amendmentTextFixture = createAppTutorialAmendmentTextFixture({
    baseText:
      'Die Euckenstraße erhält einen geschützten Radweg und zusätzliche klimaresiliente Begrünung.',
    closingText: 'Die Umsetzung wird schrittweise dokumentiert und gemeinsam ausgewertet.',
    changes: preparedChangeRequests,
  });
  const tutorialCityDesignState = createAppTutorialInitialCityDesignState();
  if (!tutorialCityDesignState.mapSelection) {
    throw new Error('The app tutorial city design selection is missing.');
  }
  const tutorialCityDesignBbox = getCityDesignMapSelectionBoundingBox(
    tutorialCityDesignState.mapSelection
  );

  const syntheticNames = [
    ['Leonie', 'Brandt'],
    ['Murat', 'Demir'],
    ['Sofia', 'Keller'],
    ['Jonas', 'Nguyen'],
    ['Amira', 'Scholz'],
  ] as const;
  for (let index = 0; index < syntheticUserIds.length; index += 1) {
    await tx`
      insert into "user" (
        id, handle, first_name, last_name, city, visibility, tutorial_run_id
      ) values (
        ${syntheticUserIds[index]},
        ${`tutorial-${runId.slice(0, 8)}-${index + 1}`},
        ${syntheticNames[index][0]},
        ${syntheticNames[index][1]},
        'München',
        'authenticated',
        ${runId}
      )
    `;
  }

  await tx`
    insert into "group" (
      id, name, description, group_type, city, street, house_number,
      latitude, longitude, visibility, owner_id, member_count,
      signed_up_member_count, event_count, amendment_count, tutorial_run_id
    ) values
      (
        ${initiativeGroupId},
        'Initiative Klimafitte Euckenstraße',
        ${tx.json(richText('Gemeinsam gestalten wir die Euckenstraße klimaresilient, sicher und lebenswert.'))},
        'base', 'München', 'Euckenstraße', '38', 48.1351, 11.5820,
        'authenticated', ${userId}, 5, 5, 1, 1, ${runId}
      ),
      (
        ${mobilityForumGroupId},
        'Mobilitätsforum München-West',
        ${tx.json(richText('Austausch für sichere und nachhaltige Mobilität im Münchner Westen.'))},
        'base', 'München', null, null, 48.1450, 11.5200,
        'authenticated', ${userId}, 0, 0, 0, 0, ${runId}
      ),
      (
        ${climateCouncilGroupId},
        'Münchner Klimarat',
        ${tx.json(richText('Transparente, vernetzte Klimapolitik für München.'))},
        'hierarchical', 'München', null, null, 48.1372, 11.5756,
        'authenticated', ${userId}, 0, 0, 1, 0, ${runId}
      )
  `;

  for (const syntheticUserId of syntheticUserIds) {
    await tx`
      insert into group_membership (id, group_id, user_id, status, visibility)
      values (
        ${randomUUID()}, ${initiativeGroupId}, ${syntheticUserId},
        'active', 'authenticated'
      )
    `;
  }

  const [hierarchyA, hierarchyB] = uuidPair(mobilityForumGroupId, climateCouncilGroupId);
  const hierarchyConnectionId = randomUUID();
  await tx`
    insert into group_connection (
      id, group_a_id, group_b_id, connection_type, connection_kind,
      parent_group_id, child_group_id, from_group_id, to_group_id,
      status, created_by_id
    ) values (
      ${hierarchyConnectionId}, ${hierarchyA}, ${hierarchyB}, 'hierarchy',
      'hierarchy', ${climateCouncilGroupId}, ${mobilityForumGroupId},
      ${mobilityForumGroupId}, ${climateCouncilGroupId}, 'active', ${userId}
    )
  `;
  await tx`
    insert into group_hierarchy_path (
      id, ancestor_group_id, descendant_group_id, direct_child_group_id,
      base_group_id, depth, path_group_ids, status, connection_id
    ) values (
      ${randomUUID()}, ${climateCouncilGroupId}, ${mobilityForumGroupId},
      ${mobilityForumGroupId}, ${mobilityForumGroupId}, 1,
      ${tx.array([climateCouncilGroupId, mobilityForumGroupId])}::uuid[],
      'active', ${hierarchyConnectionId}
    )
  `;

  await tx`
    insert into event (
      id, title, description, status, event_type, attendance_mode,
      location_type, location_name, city, street, house_number, visibility,
      start_date, end_date, timezone, participant_count, amendment_count,
      agenda_management, meeting_type, group_id, creator_id, tutorial_run_id
    ) values
      (
        ${firstEventId}, ${APP_TUTORIAL_FIRST_EVENT_TITLE},
        ${tx.json(richText('Beratung und Beschluss des vorbereiteten Entwurfs zur Stadtgestaltung.'))},
        'scheduled', 'assembly', 'hybrid', 'address', 'Euckenstraße 38',
        'München', 'Euckenstraße', '38', 'authenticated',
        ${firstEventStart}, ${firstEventEnd}, 'Europe/Berlin', 6, 1,
        'moderated', 'assembly', ${initiativeGroupId}, ${userId}, ${runId}
      ),
      (
        ${secondEventId}, 'Sitzung Münchner Klimarat',
        ${tx.json(richText('Folgeberatung vernetzter Münchner Klima-Initiativen.'))},
        'scheduled', 'assembly', 'offline', 'address', 'Rathaus München',
        'München', 'Marienplatz', '8', 'authenticated',
        ${secondEventStart}, ${secondEventEnd}, 'Europe/Berlin', 6, 0,
        'moderated', 'assembly', ${climateCouncilGroupId}, ${userId}, ${runId}
      )
  `;

  for (const eventId of [firstEventId, secondEventId]) {
    const participantRoleId = randomUUID();
    await tx`
      insert into role (
        id, name, description, scope, event_id, visibility
      ) values (
        ${participantRoleId}, 'Tutorial-Teilnehmende',
        'Rolle für Abstimmung und Agenda im isolierten Live-Tutorial.',
        'event', ${eventId}, 'authenticated'
      )
    `;
    for (const [resource, action] of [
      ['events', 'update'],
      ['events', 'active_voting'],
      ['events', 'passive_voting'],
      ['agendaItems', 'manage'],
    ] as const) {
      await tx`
        insert into action_right (
          id, resource, action, role_id, event_id
        ) values (
          ${randomUUID()}, ${resource}, ${action}, ${participantRoleId}, ${eventId}
        )
      `;
    }
    for (const participantUserId of [userId, ...syntheticUserIds]) {
      const eventParticipantId = randomUUID();
      await tx`
        insert into event_participant (
          id, event_id, user_id, status, visibility
        ) values (
          ${eventParticipantId}, ${eventId}, ${participantUserId}, 'confirmed', 'authenticated'
        )
      `;
      await tx`
        insert into event_participant_role (
          id, event_participant_id, role_id, assigned_by_id
        ) values (
          ${randomUUID()}, ${eventParticipantId}, ${participantRoleId}, ${userId}
        )
      `;
    }
  }

  await tx`
    insert into document (id, amendment_id, content, editing_mode)
    values (
      ${documentId}, ${amendmentId},
      ${tx.json(toJsonValue(amendmentTextFixture.documentContent))},
      'edit'
    )
  `;
  await tx`
    insert into amendment (
      id, code, title, reason, category, created_by_id, group_id, document_id,
      city, street, house_number, latitude, longitude, visibility,
      change_request_count, collaborator_count, discussions, tutorial_run_id
    ) values (
      ${amendmentId}, 'EUC-38',
      ${APP_TUTORIAL_AMENDMENT_TITLE},
      'Mehr Sicherheit, Schatten und Versickerungsfläche für die Euckenstraße.',
      'city-design', ${userId}, ${initiativeGroupId}, ${documentId},
      'München', 'Euckenstraße', '38', 48.1351, 11.5820,
      'authenticated', 2, 6, ${tx.json(toJsonValue(amendmentTextFixture.discussions))}, ${runId}
    )
  `;
  await tx`
    insert into document_version (
      id, document_id, amendment_id, content, version_number, change_summary, author_id
    ) values (
      ${randomUUID()}, ${documentId}, ${amendmentId},
      ${tx.json(toJsonValue(amendmentTextFixture.documentContent))},
      1, 'Vorbereiteter Tutorial-Stand', ${userId}
    )
  `;
  for (const collaboratorId of [userId, ...syntheticUserIds]) {
    await tx`
      insert into amendment_collaborator (
        id, amendment_id, user_id, status, visibility
      ) values (
        ${randomUUID()}, ${amendmentId}, ${collaboratorId}, 'active', 'authenticated'
      )
    `;
    await tx`
      insert into document_collaborator (
        id, document_id, user_id, status, visibility
      ) values (
        ${randomUUID()}, ${documentId}, ${collaboratorId}, 'active', 'authenticated'
      )
    `;
  }
  await tx`
    insert into amendment_city_design (
      id, amendment_id, created_by_id, title, bbox, center_lat, center_lon,
      osm_snapshot, design_state, currency, estimated_total_cost_minor,
      cost_catalog_version, cost_summary
    ) values (
      ${cityDesignId}, ${amendmentId}, ${userId}, 'Euckenstraße 38',
      ${tx.json([
        tutorialCityDesignBbox.west,
        tutorialCityDesignBbox.south,
        tutorialCityDesignBbox.east,
        tutorialCityDesignBbox.north,
      ])},
      ${APP_TUTORIAL_CITY_DESIGN_CENTER.lat}, ${APP_TUTORIAL_CITY_DESIGN_CENTER.lon},
      ${null},
      ${tx.json(toJsonValue(tutorialCityDesignState))},
      'EUR', 0, 'tutorial-v1', ${tx.json({ items: [], totalMinor: 0 })}
    )
  `;

  for (let index = 0; index < preparedChangeRequests.length; index += 1) {
    const item = preparedChangeRequests[index];
    await tx`
      insert into change_request (
        id, amendment_id, user_id, title, description, status, source_type,
        change_type, original_text, new_text, changed_character_count,
        branch_sequence_number, created_in_mode, visibility_scope, suggestion_id
      ) values (
        ${item.changeRequestId}, ${amendmentId}, ${item.userId},
        ${item.title}, ${item.description}, 'open', 'text', 'insert',
        '', ${item.newText}, ${item.newText.length}, ${index + 1},
        'suggest_internal', 'authenticated', ${item.suggestionId}
      )
    `;
  }

  await tx`
    insert into agenda_item (
      id, event_id, amendment_id, creator_id, title, description, type,
      status, order_index, duration, majority_type, voting_phase
    ) values (
      ${firstAgendaItemId}, ${firstEventId}, ${amendmentId}, ${userId},
      ${APP_TUTORIAL_AMENDMENT_AGENDA_TITLE},
      'Beratung und Abstimmung des vorbereiteten Amendments.',
      'amendment', 'scheduled', 0, 30, 'relative', 'final'
    )
  `;

  await tx`
    insert into vote (
      id, agenda_item_id, amendment_id, title, description, status, purpose,
      majority_type, closing_type, visibility, ballot_visibility,
      electorate_snapshotted_at
    ) values (
      ${amendmentVoteId}, ${firstAgendaItemId}, ${amendmentId},
      'Klimafitte Euckenstraße annehmen',
      'Finale Abstimmung über die vorbereitete Stadtgestaltung.',
      'final', 'closing', 'relative', 'moderator', 'authenticated', 'named', now()
    )
  `;
  await tx`
    insert into vote_choice (id, vote_id, label, semantic_key, order_index)
    values
      (${amendmentAcceptChoiceId}, ${amendmentVoteId}, 'Ja', 'accept', 0),
      (${amendmentRejectChoiceId}, ${amendmentVoteId}, 'Nein', 'reject', 1),
      (${amendmentAbstainChoiceId}, ${amendmentVoteId}, 'Enthaltung', 'abstain', 2)
  `;
  for (const voterUserId of [userId, ...syntheticUserIds]) {
    await tx`
      insert into voter (id, vote_id, user_id, participation_channel)
      values (${randomUUID()}, ${amendmentVoteId}, ${voterUserId}, 'online')
    `;
  }

  await tx`
    insert into todo (
      id, title, description, status, priority, due_date, visibility,
      creator_id, group_id, tutorial_run_id
    ) values (
      ${networkTodoId}, 'Münchner Klimarat im Netzwerk verknüpfen',
      'Verknüpfe die Initiative als Untergruppe mit dem Münchner Klimarat und frage Informations- und Antragsrecht an.',
      'pending', 'high', ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)},
      'authenticated', ${userId}, ${initiativeGroupId}, ${runId}
    )
  `;
  await tx`
    insert into todo_assignment (id, todo_id, user_id, role)
    values (${randomUUID()}, ${networkTodoId}, ${userId}, 'assignee')
  `;

  const blogId = randomUUID();
  await tx`
    insert into blog (
      id, title, description, content, visibility, group_id, tutorial_run_id
    ) values (
      ${blogId}, 'Warum die Euckenstraße mehr Schatten braucht',
      'Hintergründe zur klimaresilienten Stadtgestaltung.',
      ${tx.json(richText('Bäume, Entsiegelung und sichere Mobilität wirken gemeinsam gegen Hitze.'))},
      'authenticated', ${initiativeGroupId}, ${runId}
    )
  `;
  await tx`
    insert into blog_blogger (id, blog_id, user_id, status, visibility)
    values (${randomUUID()}, ${blogId}, ${syntheticUserIds[0]}, 'writer', 'authenticated')
  `;
  await tx`
    insert into statement (
      id, user_id, group_id, title, text, visibility, tutorial_run_id
    ) values (
      ${randomUUID()}, ${syntheticUserIds[1]}, ${initiativeGroupId},
      'Sichere Wege und kühle Straßen gehören zusammen.',
      'Ich unterstütze den geschützten Radweg und die neue Baumreihe.',
      'authenticated', ${runId}
    )
  `;
  await tx`
    insert into payment (
      id, amount, currency, label, type, payer_group_id, receiver_group_id,
      tutorial_run_id
    ) values (
      ${randomUUID()}, 1250, 'EUR', 'Planungsbudget Straßenwerkstatt',
      'budget', ${initiativeGroupId}, ${initiativeGroupId}, ${runId}
    )
  `;

  await tx`
    insert into conversation (
      id, type, name, status, pinned, assistant_for_user_id,
      requested_by_id, tutorial_run_id
    ) values (
      ${tutorialConversationId}, 'assistant',
      'Live-Tutorial · Assistent Aria & Kai', 'active', true,
      ${userId}, ${userId}, ${runId}
    )
  `;
  for (const participantUserId of [userId, ARIA_KAI_USER_ID]) {
    await tx`
      insert into conversation_participant (
        id, conversation_id, user_id, unread_count
      ) values (
        ${randomUUID()}, ${tutorialConversationId}, ${participantUserId}, 0
      )
    `;
  }
  await tx`
    insert into message (
      id, conversation_id, sender_id, content, context_json, is_read
    ) values (
      ${randomUUID()}, ${tutorialConversationId}, ${ARIA_KAI_USER_ID},
      'Ich begleite dich im Live-Tutorial. Erstelle gleich gemeinsam mit mir eine echte Sandbox-Aufgabe.',
      '[]', true
    )
  `;

  const entityValues: [AppTutorialRouteAlias, string, string][] = [
    ['userId', 'user', userId],
    ['initiativeGroupId', 'group', initiativeGroupId],
    ['climateCouncilGroupId', 'group', climateCouncilGroupId],
    ['networkTodoId', 'todo', networkTodoId],
    ['amendmentId', 'amendment', amendmentId],
    ['firstEventId', 'event', firstEventId],
    ['secondEventId', 'event', secondEventId],
    ['firstAgendaItemId', 'agenda_item', firstAgendaItemId],
    ['amendmentVoteId', 'vote', amendmentVoteId],
    ['amendmentAcceptChoiceId', 'vote_choice', amendmentAcceptChoiceId],
    ['tutorialConversationId', 'conversation', tutorialConversationId],
  ];
  for (const [alias, entityType, entityId] of entityValues) {
    await addEntity(tx, runId, alias, entityType, entityId);
  }
}

async function loadOpenRun(tx: Transaction, userId: string, forUpdate = false) {
  const lock = forUpdate ? tx`for update` : tx``;
  const rows = await tx<RunRow[]>`
    select id, user_id, status, current_checkpoint_id, fixture_version,
           revision, expires_at
    from app_tutorial_run
    where user_id = ${userId}
      and status in ('active', 'paused')
    limit 1
    ${lock}
  `;
  return rows[0] ?? null;
}

async function assertFixtureIntegrity(tx: Transaction, run: RunRow) {
  const requiredAliases: AppTutorialRouteAlias[] = [
    'initiativeGroupId',
    'climateCouncilGroupId',
    'networkTodoId',
    'amendmentId',
    'firstEventId',
    'secondEventId',
    'firstAgendaItemId',
    'amendmentVoteId',
    'amendmentAcceptChoiceId',
    'tutorialConversationId',
  ];
  const aliases = await tx<{ alias: string }[]>`
    select alias
    from app_tutorial_entity
    where run_id = ${run.id}
      and alias = any(${tx.array(requiredAliases)}::text[])
  `;
  if (aliases.length !== requiredAliases.length) {
    throw new Error('Tutorial sandbox cannot be repaired; restart required');
  }

  await tx`
    update "group" set tutorial_run_id = ${run.id}
    where id in (
      ${await entityId(tx, run.id, 'initiativeGroupId')},
      ${await entityId(tx, run.id, 'climateCouncilGroupId')}
    )
      and tutorial_run_id is distinct from ${run.id}
  `;
  if (MEMBERSHIP_REQUEST_REPAIR_CHECKPOINTS.has(run.current_checkpoint_id)) {
    await tx`
      insert into group_membership (
        id, group_id, user_id, status, visibility, source, origin_kind
      ) values (
        ${randomUUID()}, ${await entityId(tx, run.id, 'initiativeGroupId')},
        ${run.user_id}, 'requested', 'authenticated', 'direct', 'direct'
      )
      on conflict (user_id, group_id) do update
      set status = 'requested',
          visibility = 'authenticated',
          source = 'direct',
          origin_kind = 'direct'
      where group_membership.status is distinct from 'requested'
         or group_membership.visibility is distinct from 'authenticated'
         or group_membership.source is distinct from 'direct'
         or group_membership.origin_kind is distinct from 'direct'
    `;
  }
  await tx`
    delete from group_membership membership
    using "user" tutorial_user, "group" fixture_group
    where membership.user_id = tutorial_user.id
      and membership.group_id = fixture_group.id
      and tutorial_user.tutorial_run_id = ${run.id}
      and fixture_group.tutorial_run_id = ${run.id}
      and fixture_group.id <> ${await entityId(tx, run.id, 'initiativeGroupId')}
  `;
  await tx`
    update "group"
    set member_count = 0, signed_up_member_count = 0
    where tutorial_run_id = ${run.id}
      and id <> ${await entityId(tx, run.id, 'initiativeGroupId')}
      and (member_count is distinct from 0 or signed_up_member_count is distinct from 0)
  `;
  await tx`
    update event set tutorial_run_id = ${run.id}
    where id in (
      ${await entityId(tx, run.id, 'firstEventId')},
      ${await entityId(tx, run.id, 'secondEventId')}
    )
      and tutorial_run_id is distinct from ${run.id}
  `;
  await tx`
    update amendment set tutorial_run_id = ${run.id}
    where id = ${await entityId(tx, run.id, 'amendmentId')}
      and tutorial_run_id is distinct from ${run.id}
  `;
  await tx`
    update todo
    set tutorial_run_id = ${run.id},
        status = case when status = 'open' then 'pending' else status end
    where id = ${await entityId(tx, run.id, 'networkTodoId')}
      and (tutorial_run_id is distinct from ${run.id} or status = 'open')
  `;
  await tx`
    update conversation set tutorial_run_id = ${run.id}
    where id = ${await entityId(tx, run.id, 'tutorialConversationId')}
      and tutorial_run_id is distinct from ${run.id}
  `;

  const roots = await tx`
    select 1
    where exists (
      select 1 from "group"
      where id = ${await entityId(tx, run.id, 'initiativeGroupId')}
        and tutorial_run_id = ${run.id}
    )
    and exists (
      select 1 from event
      where id = ${await entityId(tx, run.id, 'firstEventId')}
        and tutorial_run_id = ${run.id}
    )
    and exists (
      select 1 from amendment
      where id = ${await entityId(tx, run.id, 'amendmentId')}
        and tutorial_run_id = ${run.id}
    )
    and exists (
      select 1 from todo
      where id = ${await entityId(tx, run.id, 'networkTodoId')}
        and tutorial_run_id = ${run.id}
    )
    and exists (
      select 1 from conversation
      where id = ${await entityId(tx, run.id, 'tutorialConversationId')}
        and tutorial_run_id = ${run.id}
    )
  `;
  if (!roots[0]) {
    throw new Error('Tutorial sandbox cannot be repaired; restart required');
  }
  await ensureTutorialSearchAliases(tx, run.id);
}

export async function getAppTutorialRun(userId: string): Promise<PublicAppTutorialRun | null> {
  const sql = getAppTutorialSql();
  return sql.begin(async tx => {
    const run = await loadOpenRun(tx, userId);
    if (!run) return null;
    if (run.expires_at.getTime() <= Date.now()) {
      await cleanupRun(tx, run.id);
      return null;
    }
    if (run.fixture_version !== APP_TUTORIAL_FIXTURE_VERSION) {
      await cleanupRun(tx, run.id);
      return null;
    }
    await assertFixtureIntegrity(tx, run);
    return publicRun(tx, run);
  });
}

export async function startOrResumeAppTutorial(
  userId: string,
  restart = false
): Promise<PublicAppTutorialRun> {
  const sql = getAppTutorialSql();
  return sql.begin(async tx => {
    await lockUser(tx, userId);
    let run: RunRow | null = await loadOpenRun(tx, userId, true);
    const expired = run ? run.expires_at.getTime() <= Date.now() : false;
    if (run && (restart || expired || run.fixture_version !== APP_TUTORIAL_FIXTURE_VERSION)) {
      await cleanupRun(tx, run.id);
      run = null;
    }

    if (run) {
      await assertFixtureIntegrity(tx, run);
      const rows = await tx<RunRow[]>`
        update app_tutorial_run
        set status = 'active',
            last_activity_at = now(),
            expires_at = now() + ${RUN_LIFETIME_INTERVAL}::interval
        where id = ${run.id}
        returning id, user_id, status, current_checkpoint_id, fixture_version,
                  revision, expires_at
      `;
      return publicRun(tx, rows[0]);
    }

    const runId = randomUUID();
    const rows = await tx<RunRow[]>`
      insert into app_tutorial_run (
        id, user_id, status, current_checkpoint_id, fixture_version,
        revision, expires_at
      ) values (
        ${runId}, ${userId}, 'active', ${APP_TUTORIAL_CHECKPOINT_IDS[0]},
        ${APP_TUTORIAL_FIXTURE_VERSION}, 0,
        now() + ${RUN_LIFETIME_INTERVAL}::interval
      )
      returning id, user_id, status, current_checkpoint_id, fixture_version,
                revision, expires_at
    `;
    await createFixtures(tx, runId, userId);
    await ensureTutorialSearchAliases(tx, runId);
    return publicRun(tx, rows[0]);
  });
}

export async function pauseAppTutorial(
  userId: string,
  expectedRevision: number
): Promise<PublicAppTutorialRun> {
  const sql = getAppTutorialSql();
  return sql.begin(async tx => {
    const run = await loadOpenRun(tx, userId, true);
    if (!run) throw new Error('No tutorial run found');
    if (run.revision !== expectedRevision) throw new Error('Tutorial revision conflict');
    const rows = await tx<RunRow[]>`
      update app_tutorial_run
      set status = 'paused', last_activity_at = now(),
          expires_at = now() + ${RUN_LIFETIME_INTERVAL}::interval
      where id = ${run.id}
      returning id, user_id, status, current_checkpoint_id, fixture_version,
                revision, expires_at
    `;
    return publicRun(tx, rows[0]);
  });
}

async function validateEvidence(
  tx: Transaction,
  run: RunRow,
  completion: AppTutorialCompletion,
  anchor: string,
  evidence: TutorialAdvanceEvidence
) {
  switch (completion.type) {
    case 'action':
      if (
        evidence.type !== 'action' ||
        evidence.event !== completion.event ||
        (completion.expectedInputKey &&
          !matchesAppTutorialExpectedInput(evidence.value ?? '', completion.expectedInputKey))
      ) {
        throw new Error('Expected tutorial action did not succeed');
      }
      return;
    case 'acknowledge':
      if (evidence.type !== 'acknowledge') throw new Error('Acknowledgement required');
      return;
    case 'horizontal-scroll':
      if (!horizontalScrollEvidenceIsValid(completion.minimumPixels, evidence)) {
        throw new Error('Horizontal navigation scroll required');
      }
      return;
    case 'click':
      if (evidence.type !== 'click' || evidence.anchor !== anchor) {
        throw new Error('Expected tutorial control was not selected');
      }
      return;
    case 'input':
      if (
        evidence.type !== 'input' ||
        !matchesAppTutorialExpectedInput(evidence.value ?? '', completion.expectedInputKey)
      ) {
        throw new Error('Expected tutorial input was not provided');
      }
      return;
    case 'entity-selection':
      if (
        evidence.type !== 'entity-selection' ||
        !evidence.entityId ||
        evidence.entityId !== (await entityId(tx, run.id, completion.expectedEntityAlias))
      ) {
        throw new Error('Expected tutorial entity was not selected');
      }
      return;
    case 'drop':
      if (evidence.type !== 'drop' || evidence.event !== completion.event) {
        throw new Error('Expected drag and drop action did not succeed');
      }
      return;
    case 'mutation':
      if (evidence.type !== 'mutation' || evidence.event !== completion.event) {
        throw new Error('Expected mutation did not succeed');
      }
      return;
    case 'view':
      if (evidence.type !== 'view') throw new Error('Tutorial target must be visible');
      return;
    case 'automatic':
      return;
  }
}

async function verifyMutation(tx: Transaction, run: RunRow, event: string, attempt = 0) {
  const initiativeId = async () => entityId(tx, run.id, 'initiativeGroupId');
  const amendmentId = async () => entityId(tx, run.id, 'amendmentId');
  const networkTodoId = async () => entityId(tx, run.id, 'networkTodoId');
  const firstEventId = async () => entityId(tx, run.id, 'firstEventId');
  let rows: readonly unknown[];

  if (event === 'subscriber.created') {
    rows = await tx`
      select 1 from subscriber
      where subscriber_id = ${run.user_id}
        and group_id = ${await initiativeId()}
      limit 1
    `;
  } else if (event === 'group-membership.requested') {
    rows = await tx`
      select 1 from group_membership
      where user_id = ${run.user_id}
        and group_id = ${await initiativeId()}
        and status = 'requested'
      limit 1
    `;
  } else if (event === 'notification.read') {
    rows = await tx`
      select 1
      from notification n
      left join notification_user_state state
        on state.notification_id = n.id and state.user_id = ${run.user_id}
      where n.tutorial_run_id = ${run.id}
        and n.recipient_id = ${run.user_id}
        and (n.is_read = true or state.read_at is not null)
      limit 1
    `;
  } else if (event === 'group-connection.requested') {
    const councilId = await entityId(tx, run.id, 'climateCouncilGroupId');
    const [groupA, groupB] = uuidPair(await initiativeId(), councilId);
    const initiativeGroupId = await initiativeId();
    rows = await tx`
      select 1
      from group_connection_request request
      where request.group_a_id = ${groupA}
        and request.group_b_id = ${groupB}
        and request.desired_connection_type = 'hierarchy'
        and request.desired_parent_group_id = ${councilId}
        and request.desired_child_group_id = ${initiativeGroupId}
        and request.status in ('pending', 'partially_approved')
        and (
          select count(distinct rights.right_key)
          from group_right_grant_request rights
          where rights.connection_request_id = request.id
            and rights.operation = 'upsert'
            and rights.right_key in ('informationRight', 'amendmentRight')
            and rights.holder_group_id = ${initiativeGroupId}
            and rights.scope_group_id = ${councilId}
            and rights.status = 'pending'
        ) = 2
        and not exists (
          select 1
          from group_right_grant_request rights
          where rights.connection_request_id = request.id
            and rights.operation = 'upsert'
            and (
              rights.right_key not in ('informationRight', 'amendmentRight')
              or rights.holder_group_id <> ${initiativeGroupId}
              or rights.scope_group_id <> ${councilId}
            )
        )
      limit 1
    `;
  } else if (event === 'todo.completed') {
    rows = await tx`
      select 1 from todo
      where id = ${await networkTodoId()}
        and status in ('completed', 'done')
      limit 1
    `;
  } else if (event === 'amendment.text-updated') {
    rows = await tx`
      select 1
      from amendment a
      join document d on d.id = a.document_id
      where a.id = ${await amendmentId()}
        and d.content::text ilike '%Zusätzliche entsiegelte Flächen verbessern die Versickerung bei Starkregen.%'
      limit 1
    `;
  } else if (event === 'amendment.mode.suggest_internal') {
    rows = await tx`
      select 1
      from amendment a join document d on d.id = a.document_id
      where a.id = ${await amendmentId()} and d.editing_mode = 'suggest_internal'
      limit 1
    `;
  } else if (event === 'city-design.tree-row-added') {
    // Placement is real editor state and is intentionally persisted by the
    // immediately following save checkpoint.
    rows = [{ verified: true }];
  } else if (event === 'city-design.saved') {
    rows = await tx`
      select 1
      from amendment_city_design design
      where design.amendment_id = ${await amendmentId()}
        and design.design_state::text ilike '%tree%'
      union all
      select 1
      from change_request request
      where request.amendment_id = ${await amendmentId()}
        and request.source_type = 'city_design_object'
        and request.change_type = 'insert'
        and request.new_properties::text ilike '%tree%'
      limit 1
    `;
  } else if (event === 'amendment.mode.vote_internal') {
    rows = await tx`
      select 1
      from amendment a join document d on d.id = a.document_id
      where a.id = ${await amendmentId()} and d.editing_mode = 'vote_internal'
      limit 1
    `;
  } else if (event === 'change-request.voted') {
    rows = await tx`
      select 1
      from change_request_vote vote
      join change_request request on request.id = vote.change_request_id
      where request.amendment_id = ${await amendmentId()}
        and vote.user_id = ${run.user_id}
      limit 1
    `;
  } else if (event === 'amendment-process.started') {
    rows = await tx`
      select 1 from amendment_process_run
      where amendment_id = ${await amendmentId()}
      limit 1
    `;
  } else if (event === 'event.started') {
    rows = await tx`
      select 1 from event
      where id = ${await firstEventId()}
        and status in ('active', 'live', 'started', 'in_progress')
      limit 1
    `;
  } else if (event === 'agenda-amendment.voted') {
    rows = await tx`
      select 1
      from final_voter_participation participation
      join voter on voter.id = participation.voter_id
      join vote on vote.id = participation.vote_id
      where voter.user_id = ${run.user_id}
        and vote.amendment_id = ${await amendmentId()}
      limit 1
    `;
  } else if (event === 'agenda-election.voted') {
    rows = await tx`
      select 1
      from final_elector_participation participation
      join elector on elector.id = participation.elector_id
      join election on election.id = participation.election_id
      join agenda_item item on item.id = election.agenda_item_id
      where elector.user_id = ${run.user_id}
        and item.event_id = ${await firstEventId()}
      limit 1
    `;
  } else if (event === 'todo.in-progress') {
    const assistantTodo = await entityId(tx, run.id, 'assistantTodoId');
    rows = await tx`
      select 1 from todo
      where id = ${assistantTodo}
        and status in ('in_progress', 'in-progress', 'doing')
      limit 1
    `;
  } else {
    throw new Error(`Unsupported tutorial mutation: ${event}`);
  }

  if (!rows[0] && attempt < 39) {
    await new Promise(resolve => setTimeout(resolve, 125));
    return verifyMutation(tx, run, event, attempt + 1);
  }
  if (!rows[0]) throw new Error('Expected tutorial mutation was not found');
}

async function claimEffect(
  tx: Transaction,
  runId: string,
  checkpointId: string,
  effect: AppTutorialEffect
) {
  const rows = await tx`
    insert into app_tutorial_checkpoint_effect (
      run_id, checkpoint_id, effect_key
    ) values (${runId}, ${checkpointId}, ${effect})
    on conflict do nothing
    returning effect_key
  `;
  return rows.length > 0;
}

async function entityId(tx: Transaction, runId: string, alias: AppTutorialRouteAlias) {
  const rows = await tx<{ entity_id: string }[]>`
    select entity_id from app_tutorial_entity
    where run_id = ${runId} and alias = ${alias}
  `;
  if (!rows[0]) throw new Error(`Missing tutorial entity: ${alias}`);
  return rows[0].entity_id;
}

async function applyEffect(
  tx: Transaction,
  run: RunRow,
  checkpointId: AppTutorialCheckpointId,
  effect: AppTutorialEffect
) {
  if (!(await claimEffect(tx, run.id, checkpointId, effect))) return;

  if (effect === 'accept-membership') {
    const groupId = await entityId(tx, run.id, 'initiativeGroupId');
    const updated = await tx`
      update group_membership
      set status = 'active'
      where group_id = ${groupId}
        and user_id = ${run.user_id}
        and status not in ('active', 'member', 'admin')
      returning id
    `;
    if (!updated[0]) {
      throw new AppTutorialEffectPendingError('Membership request is still being processed');
    }
    await tx`
      insert into notification (
        id, recipient_id, title, message, type, action_url, is_read,
        related_entity_type, related_group_id, category, tutorial_run_id
      ) values (
        ${randomUUID()}, ${run.user_id}, 'Mitgliedschaft bestätigt',
        'Deine Mitgliedschaft in der Initiative Klimafitte Euckenstraße wurde bestätigt.',
        'membership_accepted', ${`/group/${groupId}`}, false,
        'group', ${groupId}, 'groups', ${run.id}
      )
    `;
    return;
  }

  if (effect === 'confirm-network-rights') {
    // Fixture v1+ lets the simulated counterparty approve through the normal
    // optimistic Zero mutator. The accepted relationship is therefore visible
    // immediately while the queued mutation persists and reconciles it.
    if (run.fixture_version >= 1) return;

    const initiativeId = await entityId(tx, run.id, 'initiativeGroupId');
    const councilId = await entityId(tx, run.id, 'climateCouncilGroupId');
    const [groupA, groupB] = uuidPair(initiativeId, councilId);
    const requestRows = await tx<
      {
        id: string;
        proposed_connection_id: string;
        desired_connection_type: string;
        desired_parent_group_id: string | null;
        desired_child_group_id: string | null;
      }[]
    >`
      select id, proposed_connection_id, desired_connection_type,
             desired_parent_group_id, desired_child_group_id
      from group_connection_request
      where group_a_id = ${groupA} and group_b_id = ${groupB}
      order by updated_at desc
      limit 1
    `;
    const request = requestRows[0];
    if (!request) {
      throw new AppTutorialEffectPendingError(
        'Network connection request is still being processed'
      );
    }

    const connectionRows = await tx<{ id: string }[]>`
      select id from group_connection
      where group_a_id = ${groupA} and group_b_id = ${groupB}
      limit 1
    `;
    const connectionId = connectionRows[0]?.id ?? request.proposed_connection_id;
    if (!connectionRows[0]) {
      await tx`
        insert into group_connection (
          id, group_a_id, group_b_id, connection_type, connection_kind,
          parent_group_id, child_group_id, from_group_id, to_group_id,
          status, created_by_id
        ) values (
          ${connectionId}, ${groupA}, ${groupB}, ${request.desired_connection_type},
          'hierarchy', ${request.desired_parent_group_id},
          ${request.desired_child_group_id}, ${initiativeId}, ${councilId},
          'active', ${run.user_id}
        )
      `;
    } else {
      await tx`
        update group_connection
        set connection_type = ${request.desired_connection_type},
            connection_kind = 'hierarchy',
            parent_group_id = ${request.desired_parent_group_id},
            child_group_id = ${request.desired_child_group_id},
            from_group_id = ${initiativeId},
            to_group_id = ${councilId},
            status = 'active'
        where id = ${connectionId}
      `;
    }
    await tx`
      insert into group_hierarchy_path (
        id, ancestor_group_id, descendant_group_id, direct_child_group_id,
        base_group_id, depth, path_group_ids, status, connection_id
      ) values (
        ${randomUUID()}, ${councilId}, ${initiativeId}, ${initiativeId},
        ${initiativeId}, 1, ${tx.array([councilId, initiativeId])}::uuid[],
        'active', ${connectionId}
      )
      on conflict (
        ancestor_group_id, descendant_group_id, base_group_id, path_group_ids
      ) do update set status = 'active', connection_id = excluded.connection_id
    `;
    const membershipRequests = await tx<
      {
        id: string;
        existing_membership_rule_id: string | null;
        operation: string;
        member_source_group_id: string | null;
        member_target_group_id: string | null;
        membership_mode: string | null;
        required_source_role_id: string | null;
      }[]
    >`
      select id, existing_membership_rule_id, operation,
             member_source_group_id, member_target_group_id,
             membership_mode, required_source_role_id
      from group_membership_rule_request
      where connection_request_id = ${request.id}
      order by updated_at desc
      limit 1
    `;
    const membershipRequest = membershipRequests[0];
    if (
      membershipRequest?.operation === 'upsert' &&
      membershipRequest.member_source_group_id &&
      membershipRequest.member_target_group_id &&
      membershipRequest.membership_mode
    ) {
      await tx`
        insert into group_membership_rule (
          id, connection_id, member_source_group_id, member_target_group_id,
          membership_mode, required_source_role_id
        ) values (
          ${membershipRequest.existing_membership_rule_id ?? randomUUID()},
          ${connectionId}, ${membershipRequest.member_source_group_id},
          ${membershipRequest.member_target_group_id},
          ${membershipRequest.membership_mode},
          ${membershipRequest.required_source_role_id}
        )
        on conflict (connection_id) do update
          set member_source_group_id = excluded.member_source_group_id,
              member_target_group_id = excluded.member_target_group_id,
              membership_mode = excluded.membership_mode,
              required_source_role_id = excluded.required_source_role_id
      `;
      await tx`
        update group_membership_rule_request
        set status = 'approved'
        where id = ${membershipRequest.id}
      `;
    }
    for (const rightKey of ['informationRight', 'amendmentRight']) {
      const grantRows = await tx<{ id: string }[]>`
        insert into group_right_grant (
          id, connection_id, right_key, holder_group_id, scope_group_id,
          status, initiator_group_id
        ) values (
          ${randomUUID()}, ${connectionId}, ${rightKey}, ${initiativeId},
          ${councilId}, 'active', ${initiativeId}
        )
        on conflict (connection_id, right_key, holder_group_id, scope_group_id)
        do update set status = 'active'
        returning id
      `;
      await tx`
        insert into group_effective_right (
          id, holder_group_id, scope_group_id, right_key,
          source_connection_id, source_grant_id, status
        ) values (
          ${randomUUID()}, ${initiativeId}, ${councilId}, ${rightKey},
          ${connectionId}, ${grantRows[0].id}, 'active'
        )
        on conflict (
          holder_group_id, scope_group_id, right_key,
          source_connection_id, source_grant_id
        ) do update set status = 'active'
      `;
    }
    await tx`
      update group_right_grant_request
      set status = 'approved'
      where connection_request_id = ${request.id}
        and right_key in ('informationRight', 'amendmentRight')
    `;
    await tx`
      update group_connection_request
      set active_connection_id = ${connectionId},
          proposed_connection_id = ${connectionId},
          structure_status = 'approved',
          status = 'approved'
      where id = ${request.id}
    `;
    return;
  }

  if (effect === 'accept-reviewed-change-request') {
    const amendmentId = await entityId(tx, run.id, 'amendmentId');
    const votedRequests = await tx<{ id: string; suggestion_id: string | null }[]>`
      select request.id, request.suggestion_id
      from change_request_vote vote
      join change_request request on request.id = vote.change_request_id
      where request.amendment_id = ${amendmentId}
        and vote.user_id = ${run.user_id}
        and vote.vote = 'accept'
      order by vote.created_at desc
      limit 1
    `;
    const votedRequest = votedRequests[0];
    if (!votedRequest) {
      throw new AppTutorialEffectPendingError(
        'The accepted change-request vote is still being processed'
      );
    }

    await tx`
      update change_request
      set status = 'accepted',
          voting_status = 'completed',
          resolved_in_mode = 'vote_internal',
          resolution_method = 'internal_vote',
          votes_for = greatest(coalesce(votes_for, 0), 1),
          updated_at = now()
      where id = ${votedRequest.id}
    `;
    await tx`
      update amendment amendment_row
      set discussions = (
        select coalesce(
          jsonb_agg(
            case
              when discussion.value ->> 'changeRequestEntityId' = ${votedRequest.id}
                or discussion.value ->> 'id' = ${votedRequest.suggestion_id ?? ''}
              then discussion.value
                || jsonb_build_object(
                  'status', 'accepted',
                  'changeRequestStatus', 'accepted',
                  'votingStatus', 'completed',
                  'resolvedInMode', 'vote_internal',
                  'resolutionMethod', 'internal_vote',
                  'votesFor', 1
                )
              else discussion.value
            end
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(
          coalesce(amendment_row.discussions, '[]'::jsonb)
        ) discussion(value)
      ),
      updated_at = now()
      where amendment_row.id = ${amendmentId}
    `;
    return;
  }

  if (effect === 'assistant-todo-fallback') {
    const todoRows = await tx<{ id: string }[]>`
      select id from todo
      where creator_id = ${run.user_id}
        and title = ${APP_TUTORIAL_ASSISTANT_TODO_TITLE}
        and (tutorial_run_id = ${run.id} or tutorial_run_id is null)
      order by created_at desc
      limit 1
    `;
    const todoId = todoRows[0]?.id ?? randomUUID();
    if (todoRows[0]) {
      await tx`
        update todo set tutorial_run_id = ${run.id}, visibility = 'authenticated'
        where id = ${todoId}
      `;
    } else {
      await tx`
        insert into todo (
          id, title, status, priority, visibility, creator_id, tutorial_run_id
        ) values (
          ${todoId}, ${APP_TUTORIAL_ASSISTANT_TODO_TITLE}, 'pending',
          'medium', 'authenticated', ${run.user_id}, ${run.id}
        )
      `;
      await tx`
        insert into todo_assignment (id, todo_id, user_id, role)
        values (${randomUUID()}, ${todoId}, ${run.user_id}, 'assignee')
      `;
    }
    await addEntity(tx, run.id, 'assistantTodoId', 'todo', todoId);

    const tutorialConversationId = await entityId(tx, run.id, 'tutorialConversationId');
    const currentTurnRows = await tx<{ created_at: Date }[]>`
      select created_at
      from message
      where conversation_id = ${tutorialConversationId}
        and sender_id = ${run.user_id}
        and deleted_at is null
      order by created_at desc, id desc
      limit 1
    `;
    const currentTurnFilter = currentTurnRows[0]
      ? tx`and created_at >= ${currentTurnRows[0].created_at}`
      : tx``;
    const assistantMessages = await tx<{ id: string; context_json: string | null }[]>`
      select id, context_json
      from message
      where conversation_id = ${tutorialConversationId}
        and sender_id = ${ARIA_KAI_USER_ID}
        and deleted_at is null
        ${currentTurnFilter}
      order by created_at desc, id desc
    `;

    if (
      assistantMessages.some(message =>
        hasAppTutorialAssistantTodoOutput(message.context_json, todoId)
      )
    ) {
      return;
    }

    const assistantMessage =
      assistantMessages.find(message =>
        hasAppTutorialAssistantTodoAttachment(message.context_json, todoId)
      ) ?? assistantMessages[0];
    const contextJson = mergeAppTutorialAssistantTodoOutput(
      assistantMessage?.context_json ?? null,
      todoId
    );

    if (assistantMessage) {
      await tx`
        update message
        set context_json = ${contextJson}, updated_at = now()
        where id = ${assistantMessage.id}
      `;
    } else {
      await tx`
        insert into message (
          id, conversation_id, sender_id, content, context_json, is_read
        ) values (
          ${randomUUID()}, ${tutorialConversationId}, ${ARIA_KAI_USER_ID},
          'Die Aufgabe wurde erstellt.', ${contextJson}, false
        )
      `;
    }
    return;
  }

  if (effect === 'cast-simulated-amendment-votes') {
    const amendmentId = await entityId(tx, run.id, 'amendmentId');
    const voteId = await entityId(tx, run.id, 'amendmentVoteId');
    const acceptChoiceId = await entityId(tx, run.id, 'amendmentAcceptChoiceId');
    const firstAgendaItemId = await entityId(tx, run.id, 'firstAgendaItemId');
    const firstEventId = await entityId(tx, run.id, 'firstEventId');
    const secondEventId = await entityId(tx, run.id, 'secondEventId');
    const syntheticVoters = await tx<{ user_id: string; voter_id: string }[]>`
      select tutorial_user.id as user_id, voter.id as voter_id
      from "user" tutorial_user
      join voter on voter.user_id = tutorial_user.id
      where tutorial_user.tutorial_run_id = ${run.id}
        and voter.vote_id = ${voteId}
      order by tutorial_user.created_at, tutorial_user.id
    `;
    for (const voter of syntheticVoters) {
      const participationId = randomUUID();
      await tx`
        insert into final_voter_participation (id, vote_id, voter_id)
        values (${participationId}, ${voteId}, ${voter.voter_id})
        on conflict (vote_id, voter_id) do nothing
      `;
      const participationRows = await tx<{ id: string }[]>`
        select id from final_voter_participation
        where vote_id = ${voteId} and voter_id = ${voter.voter_id}
      `;
      await tx`
        insert into final_choice_decision (
          id, vote_id, choice_id, voter_participation_id
        ) values (
          ${randomUUID()}, ${voteId}, ${acceptChoiceId},
          ${participationRows[0].id}
        )
      `;
    }
    await tx`
      update vote
      set status = 'closed', closed_reason = 'all_voters_cast',
          closed_at = now(), closed_by_id = ${run.user_id}
      where id = ${voteId}
    `;
    await tx`
      update agenda_item
      set status = 'completed', voting_phase = 'closed',
          completed_at = now(), end_time = now(),
          forwarding_status = 'forwarded'
      where id = ${firstAgendaItemId}
    `;
    await tx`
      update amendment
      set event_id = ${secondEventId}
      where id = ${amendmentId}
    `;

    const forwardedRows = await tx<{ id: string }[]>`
      select id from agenda_item
      where event_id = ${secondEventId} and amendment_id = ${amendmentId}
      order by created_at
      limit 1
    `;
    if (!forwardedRows[0]) {
      const forwardedAgendaItemId = randomUUID();
      await tx`
        insert into agenda_item (
          id, event_id, amendment_id, creator_id, title, description,
          type, status, forwarding_status, order_index, duration,
          majority_type, voting_phase
        ) values (
          ${forwardedAgendaItemId}, ${secondEventId}, ${amendmentId},
          ${run.user_id}, 'Klimafitte Euckenstraße weiterberaten',
          'Automatisch aus dem ersten Event chronologisch weitergeleitet.',
          'amendment', 'scheduled', 'received', 0, 30, 'relative', 'final'
        )
      `;
    }

    const electionAgendaItemId = randomUUID();
    const electionId = randomUUID();
    const syntheticCandidates = syntheticVoters.slice(0, 2);
    await tx`
      insert into agenda_item (
        id, event_id, creator_id, title, description, type, status,
        order_index, duration, majority_type, voting_phase, activated_at,
        start_time
      ) values (
        ${electionAgendaItemId}, ${firstEventId}, ${run.user_id},
        ${APP_TUTORIAL_ELECTION_AGENDA_TITLE},
        ${APP_TUTORIAL_ELECTION_AGENDA_DESCRIPTION},
        'election', 'in-progress', 1, 20, 'relative', 'final', now(), now()
      )
    `;
    await tx`
      insert into election (
        id, agenda_item_id, title, description, status, majority_type,
        closing_type, visibility, ballot_visibility, election_mode,
        seat_count, max_votes, electorate_snapshotted_at
      ) values (
        ${electionId}, ${electionAgendaItemId},
        ${APP_TUTORIAL_ELECTION_TITLE},
        ${APP_TUTORIAL_ELECTION_DESCRIPTION},
        'final', 'relative', 'moderator', 'authenticated', 'named',
        'single', 1, 1, now()
      )
    `;
    for (let index = 0; index < syntheticCandidates.length; index += 1) {
      await tx`
        insert into election_candidate (
          id, election_id, user_id, name, description, status, order_index
        ) values (
          ${randomUUID()}, ${electionId}, ${syntheticCandidates[index].user_id},
          ${index === 0 ? 'Leonie Brandt' : 'Murat Demir'},
          'Simulierte Kandidatur im Live-Tutorial.', 'nominated', ${index}
        )
      `;
    }
    for (const electorUserId of [run.user_id, ...syntheticVoters.map(voter => voter.user_id)]) {
      await tx`
        insert into elector (
          id, election_id, user_id, participation_channel
        ) values (
          ${randomUUID()}, ${electionId}, ${electorUserId}, 'online'
        )
      `;
    }
    await tx`
      update event
      set current_agenda_item_id = ${electionAgendaItemId}, status = 'active'
      where id = ${firstEventId}
    `;
    await addEntity(tx, run.id, 'electionAgendaItemId', 'agenda_item', electionAgendaItemId);
    await addEntity(tx, run.id, 'electionId', 'election', electionId);
    return;
  }

  if (effect === 'forward-amendment') {
    // The forwarding is part of the controlled participant reaction so the
    // result is already visible when this checkpoint is reached.
    return;
  }

  if (effect === 'cast-simulated-election-votes') {
    const electionId = await entityId(tx, run.id, 'electionId');
    const electionAgendaItemId = await entityId(tx, run.id, 'electionAgendaItemId');
    const candidateRows = await tx<{ id: string }[]>`
      select id from election_candidate
      where election_id = ${electionId}
      order by order_index, created_at
      limit 1
    `;
    const syntheticElectors = await tx<{ elector_id: string }[]>`
      select elector.id as elector_id
      from elector
      join "user" tutorial_user on tutorial_user.id = elector.user_id
      where elector.election_id = ${electionId}
        and tutorial_user.tutorial_run_id = ${run.id}
      order by tutorial_user.created_at, tutorial_user.id
    `;
    for (const elector of syntheticElectors) {
      const participationId = randomUUID();
      await tx`
        insert into final_elector_participation (
          id, election_id, elector_id
        ) values (
          ${participationId}, ${electionId}, ${elector.elector_id}
        )
        on conflict (election_id, elector_id) do nothing
      `;
      const participationRows = await tx<{ id: string }[]>`
        select id from final_elector_participation
        where election_id = ${electionId} and elector_id = ${elector.elector_id}
      `;
      await tx`
        insert into final_candidate_selection (
          id, election_id, candidate_id, elector_participation_id
        ) values (
          ${randomUUID()}, ${electionId}, ${candidateRows[0].id},
          ${participationRows[0].id}
        )
      `;
    }
    await tx`
      update election
      set status = 'closed', closing_end_time = now()
      where id = ${electionId}
    `;
    await tx`
      update agenda_item
      set status = 'completed', voting_phase = 'closed',
          completed_at = now(), end_time = now()
      where id = ${electionAgendaItemId}
    `;
    const firstEventId = await entityId(tx, run.id, 'firstEventId');
    await tx`
      update event
      set current_agenda_item_id = null
      where id = ${firstEventId}
    `;
    return;
  }
}

export async function advanceAppTutorial(
  userId: string,
  expectedRevision: number,
  checkpointId: AppTutorialCheckpointId,
  evidence: TutorialAdvanceEvidence
): Promise<TutorialAdvanceResult> {
  const sql = getAppTutorialSql();
  return sql.begin(async tx => {
    const run = await loadOpenRun(tx, userId, true);
    if (!run) throw new Error('No tutorial run found');
    if (run.status !== 'active') throw new Error('Tutorial run is paused');
    if (run.revision !== expectedRevision) throw new Error('Tutorial revision conflict');
    if (run.current_checkpoint_id !== checkpointId) {
      throw new Error('Tutorial checkpoint conflict');
    }
    const checkpoint = getAppTutorialCheckpoint(checkpointId);
    await validateEvidence(tx, run, checkpoint.completion, checkpoint.anchor, evidence);
    if (checkpoint.completion.type === 'mutation') {
      await verifyMutation(tx, run, checkpoint.completion.event);
    }
    if (checkpoint.effect && checkpoint.effect !== 'complete-and-cleanup') {
      await applyEffect(tx, run, checkpointId, checkpoint.effect);
      await ensureTutorialSearchAliases(tx, run.id);
    }

    if (checkpoint.effect === 'complete-and-cleanup') {
      await tx`
        insert into user_preference (id, user_id, app_tutorial_completed_at)
        values (${randomUUID()}, ${userId}, now())
        on conflict (user_id) do update
          set app_tutorial_completed_at = coalesce(
                user_preference.app_tutorial_completed_at,
                excluded.app_tutorial_completed_at
              ),
              updated_at = now()
      `;
      await cleanupRun(tx, run.id);
      return { completed: true, route: '/home' };
    }

    const nextCheckpoint = getNextAppTutorialCheckpoint(checkpointId);
    if (!nextCheckpoint) throw new Error('Tutorial has no next checkpoint');
    const rows = await tx<RunRow[]>`
      update app_tutorial_run
      set current_checkpoint_id = ${nextCheckpoint.id},
          revision = revision + 1,
          last_activity_at = now(),
          expires_at = now() + ${RUN_LIFETIME_INTERVAL}::interval
      where id = ${run.id}
      returning id, user_id, status, current_checkpoint_id, fixture_version,
                revision, expires_at
    `;
    const nextRun = await publicRun(tx, rows[0]);
    return { completed: false, route: nextRun.route, run: nextRun };
  });
}

export async function cleanupAppTutorial(userId: string, expectedRevision?: number) {
  const sql = getAppTutorialSql();
  await sql.begin(async tx => {
    const run = await loadOpenRun(tx, userId, true);
    if (!run) return;
    if (expectedRevision !== undefined && run.revision !== expectedRevision) {
      throw new Error('Tutorial revision conflict');
    }
    await cleanupRun(tx, run.id);
  });
}

export async function cleanupExpiredAppTutorialRuns() {
  const sql = getAppTutorialSql();
  const rows = await sql<{ cleanup_expired_app_tutorial_runs: number }[]>`
    select public.cleanup_expired_app_tutorial_runs()
  `;
  return rows[0]?.cleanup_expired_app_tutorial_runs ?? 0;
}

export function isAppTutorialCheckpointId(value: string): value is AppTutorialCheckpointId {
  return (APP_TUTORIAL_CHECKPOINT_IDS as readonly string[]).includes(value);
}

export function appTutorialCatalogSnapshot() {
  return APP_TUTORIAL_CHECKPOINTS;
}
