import { tool } from 'ai';
import { z } from 'zod';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import {
  buildTimelineCardProps,
  type TimelineCardItem,
} from '@/features/search/logic/buildTimelineCardProps';
import type { AiAttachmentEntity, AiChatAttachment } from '@/lib/ai/schemas';
import {
  notifyAgendaItemCreated,
  notifyPaymentCreated,
  notifyTodoAssigned,
} from '@/features/notifications/utils/notification-helpers';
import {
  createZeroContext,
  executeZeroTransaction,
  runZeroMutator,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { mutators } from '@/zero/mutators';
import { serverMutators } from '@/zero/server-mutators';
import { zql } from '@/zero/schema';
import { VOTE_PURPOSE } from '@/zero/votes/vote-workflow';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const visibilitySchema = z.enum(['public', 'authenticated', 'private']);
const groupTypeSchema = z.enum(['base', 'hierarchical', 'sibling']);
const groupMembershipModeSchema = z.enum(['none', 'all_members', 'role_members']);
const membershipFlowSchema = z.enum(['current_members_to_partner', 'partner_members_to_current']);
const relationshipDirectionSchema = z.enum([
  'none',
  'current_grants_right_to_partner',
  'partner_grants_right_to_current',
  'mutual',
]);
const eventTypeSchema = z.enum(['delegate_assembly', 'general_assembly', 'open', 'on_invite']);
const locationTypeSchema = z.enum(['physical', 'online']);
const todoPrioritySchema = z.enum(['low', 'medium', 'high']);
const todoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
const paymentDirectionSchema = z.enum(['income', 'expense']);
const paymentTypeSchema = z.enum([
  'membership_fee',
  'donation',
  'subsidies',
  'campaign',
  'material',
  'events',
  'others',
]);
const agendaItemTypeSchema = z.enum(['election', 'vote', 'speech', 'discussion', 'accreditation']);
const majorityTypeSchema = z.enum(['simple', 'absolute', 'two_thirds']);

const groupReferenceDescription = translateText(
  'generated.inline.0185_use_an_accessible_group_uuid_or_the_exact_gro_27923581'
);
const eventReferenceDescription = translateText(
  'generated.inline.0186_use_an_accessible_event_uuid_or_the_exact_eve_3dd2504d'
);

interface ToolItemSummary {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
}

interface GroupAccessRow {
  id: string;
  name: string | null;
  visibility: string | null;
  owner_id: string | null;
}

interface EventAccessRow {
  id: string;
  title: string | null;
  visibility: string | null;
  creator_id: string;
  group_id: string | null;
}

interface ElectionAccessRow {
  id: string;
  title: string | null;
  agenda_item_id: string | null;
}

interface AgendaEventRow {
  event_id: string | null;
}

interface OrderIndexRow {
  order_index: number | null;
}

interface GroupMembershipLookupRow {
  group_id: string;
}

interface EventParticipantLookupRow {
  event_id: string;
}

interface ExistingCandidateRow {
  id: string;
}

interface CreateEventArgs {
  id: string;
  title: string;
  description?: string | null;
  event_type: z.infer<typeof eventTypeSchema>;
  group_id?: string | null;
  visibility: z.infer<typeof visibilitySchema>;
  location_type: z.infer<typeof locationTypeSchema>;
  location_name?: string | null;
  location_url?: string | null;
  country?: string | null;
  region?: string | null;
  post_code?: string | null;
  city?: string | null;
  street?: string | null;
  house_number?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: number | null;
  end_date?: number | null;
  capacity?: number | null;
  image_url?: string | null;
  has_delegates?: boolean;
  total_delegate_seats?: number | null;
  delegates_nomination_deadline?: number | null;
  amendment_deadline?: number | null;
  invited_user_ids?: string[];
}

function formatDate(value: number | null | undefined): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value ?? 0));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function truncate(value: string | null | undefined, maxLength = 240): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function parseOptionalTimestamp(value?: string | null): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date/time value: ${normalized}`);
  }

  return parsed;
}

function normalizeStringList(values?: readonly string[] | null): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))];
}

function normalizeReference(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isUuidReference(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toRichText(
  value?: string | null
): { type: string; children: { text: string }[] }[] | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return [{ type: 'p', children: [{ text: normalized }] }];
}

function buildAttachment(
  entityType: AiAttachmentEntity,
  entityId: string,
  title: string,
  subtitle?: string | null,
  promptContext?: string | null,
  searchItem?: TimelineCardItem | null
): AiChatAttachment {
  const cardDataJson = (() => {
    if (!searchItem) {
      return null;
    }

    const { cardType, cardProps } = buildTimelineCardProps(searchItem);
    if (!cardType || !cardProps) {
      return null;
    }

    return JSON.stringify({ cardType, cardProps });
  })();

  return {
    entityType,
    entityId,
    title,
    subtitle: subtitle ?? null,
    prompt_context: promptContext ?? null,
    card_data_json: cardDataJson,
  };
}

function toItemSummary(attachment: AiChatAttachment): ToolItemSummary {
  return {
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    title: attachment.title,
    subtitle: attachment.subtitle ?? null,
  };
}

function buildCreatedResult(summary: string, attachment: AiChatAttachment, route: string) {
  return {
    summary,
    route,
    items: [toItemSummary(attachment)],
    attachments: [attachment],
  };
}

async function assertGroupAccess(
  tx: ZeroTransaction,
  userId: string,
  groupReference: string
): Promise<GroupAccessRow> {
  const normalizedReference = normalizeReference(groupReference);
  if (!normalizedReference) {
    throw new Error(
      'Missing group reference. Ask the user for the exact group ID or exact group name.'
    );
  }

  if (isUuidReference(normalizedReference)) {
    const [groupData, membershipData] = await Promise.all([
      tx.run(zql.group.where('id', normalizedReference).one()),
      tx.run(
        zql.group_membership
          .where('group_id', normalizedReference)
          .where('user_id', userId)
          .limit(1)
      ),
    ]);

    const group = (groupData as GroupAccessRow | null) ?? null;
    if (!group) {
      throw new Error('Group not found.');
    }

    const hasRelationship = group.owner_id === userId || (membershipData?.length ?? 0) > 0;
    if (!checkEntityAccess(group.visibility, true, hasRelationship)) {
      throw new Error('You do not have access to this group.');
    }

    return group;
  }

  const exactNameMatches = ((await tx.run(
    zql.group.where('name', normalizedReference).limit(25)
  )) ?? []) as GroupAccessRow[];
  const candidateGroups =
    exactNameMatches.length > 0
      ? exactNameMatches
      : (((await tx.run(zql.group.where('name', 'ILIKE', normalizedReference).limit(25))) ??
          []) as GroupAccessRow[]);

  if (candidateGroups.length === 0) {
    throw new Error(
      `No accessible group matches "${normalizedReference}". Ask the user for the exact group ID or exact group name.`
    );
  }

  const membershipData =
    candidateGroups.length > 0
      ? await tx.run(
          zql.group_membership
            .where(
              'group_id',
              'IN',
              candidateGroups.map(group => group.id)
            )
            .where('user_id', userId)
        )
      : [];
  const membershipGroupIds = new Set(
    ((membershipData ?? []) as GroupMembershipLookupRow[]).map(row => row.group_id)
  );

  const accessibleGroups = candidateGroups.filter(group => {
    const hasRelationship = group.owner_id === userId || membershipGroupIds.has(group.id);
    return checkEntityAccess(group.visibility, true, hasRelationship);
  });

  if (accessibleGroups.length === 1) {
    return accessibleGroups[0];
  }

  if (accessibleGroups.length > 1) {
    throw new Error(
      `Multiple accessible groups match "${normalizedReference}". Ask the user for the exact group ID.`
    );
  }

  throw new Error(
    `No accessible group matches "${normalizedReference}". Ask the user for the exact group ID or exact group name.`
  );
}

async function assertGroupRoleReference(
  tx: ZeroTransaction,
  groupId: string,
  roleReference: string
) {
  const normalizedReference = normalizeReference(roleReference);
  if (!normalizedReference) {
    throw new Error(
      'Missing role reference. Ask the user for the exact role ID or exact role name.'
    );
  }

  if (isUuidReference(normalizedReference)) {
    const role = await tx.run(zql.role.where('id', normalizedReference).one());
    if (!role || role.group_id !== groupId || role.scope !== 'group') {
      throw new Error('Role not found in the connected group.');
    }
    return role;
  }

  const exactNameMatches = await tx.run(
    zql.role.where('group_id', groupId).where('scope', 'group').where('name', normalizedReference)
  );

  if ((exactNameMatches?.length ?? 0) === 1) {
    return exactNameMatches[0];
  }

  if ((exactNameMatches?.length ?? 0) > 1) {
    throw new Error(
      `Multiple roles named "${normalizedReference}" exist in the connected group. Ask the user for the exact role ID.`
    );
  }

  const fuzzyMatches = await tx.run(
    zql.role
      .where('group_id', groupId)
      .where('scope', 'group')
      .where('name', 'ILIKE', normalizedReference)
  );

  if ((fuzzyMatches?.length ?? 0) === 1) {
    return fuzzyMatches[0];
  }

  if ((fuzzyMatches?.length ?? 0) > 1) {
    throw new Error(
      `Multiple roles match "${normalizedReference}" in the connected group. Ask the user for the exact role ID.`
    );
  }

  throw new Error(`No group role matches "${normalizedReference}".`);
}

async function assertEventAccess(
  tx: ZeroTransaction,
  userId: string,
  eventReference: string
): Promise<EventAccessRow> {
  const normalizedReference = normalizeReference(eventReference);
  if (!normalizedReference) {
    throw new Error(
      'Missing event reference. Ask the user for the exact event ID or exact event title.'
    );
  }

  if (isUuidReference(normalizedReference)) {
    const [eventData, participantData] = await Promise.all([
      tx.run(zql.event.where('id', normalizedReference).one()),
      tx.run(
        zql.event_participant
          .where('event_id', normalizedReference)
          .where('user_id', userId)
          .limit(1)
      ),
    ]);

    const event = (eventData as EventAccessRow | null) ?? null;
    if (!event) {
      throw new Error('Event not found.');
    }

    const hasRelationship = event.creator_id === userId || (participantData?.length ?? 0) > 0;
    if (!checkEntityAccess(event.visibility, true, hasRelationship)) {
      throw new Error('You do not have access to this event.');
    }

    return event;
  }

  const exactTitleMatches = ((await tx.run(
    zql.event.where('title', normalizedReference).limit(25)
  )) ?? []) as EventAccessRow[];
  const candidateEvents =
    exactTitleMatches.length > 0
      ? exactTitleMatches
      : (((await tx.run(zql.event.where('title', 'ILIKE', normalizedReference).limit(25))) ??
          []) as EventAccessRow[]);

  if (candidateEvents.length === 0) {
    throw new Error(
      `No accessible event matches "${normalizedReference}". Ask the user for the exact event ID or exact event title.`
    );
  }

  const participantData =
    candidateEvents.length > 0
      ? await tx.run(
          zql.event_participant
            .where(
              'event_id',
              'IN',
              candidateEvents.map(event => event.id)
            )
            .where('user_id', userId)
        )
      : [];
  const participantEventIds = new Set(
    ((participantData ?? []) as EventParticipantLookupRow[]).map(row => row.event_id)
  );

  const accessibleEvents = candidateEvents.filter(event => {
    const hasRelationship = event.creator_id === userId || participantEventIds.has(event.id);
    return checkEntityAccess(event.visibility, true, hasRelationship);
  });

  if (accessibleEvents.length === 1) {
    return accessibleEvents[0];
  }

  if (accessibleEvents.length > 1) {
    throw new Error(
      `Multiple accessible events match "${normalizedReference}". Ask the user for the exact event ID.`
    );
  }

  throw new Error(
    `No accessible event matches "${normalizedReference}". Ask the user for the exact event ID or exact event title.`
  );
}

async function assertElectionAccess(
  tx: ZeroTransaction,
  userId: string,
  electionId: string
): Promise<ElectionAccessRow & { eventId: string | null }> {
  const election =
    ((await tx.run(zql.election.where('id', electionId).one())) as ElectionAccessRow | null) ??
    null;
  if (!election) {
    throw new Error('Election not found.');
  }

  let eventId: string | null = null;
  if (election.agenda_item_id) {
    const agendaData =
      ((await tx.run(
        zql.agenda_item.where('id', election.agenda_item_id).one()
      )) as AgendaEventRow | null) ?? null;

    eventId = agendaData?.event_id ?? null;
    if (eventId) {
      await assertEventAccess(tx, userId, eventId);
    }
  }

  return {
    ...election,
    eventId,
  };
}

async function linkEntityHashtags(
  tx: ZeroTransaction,
  entityType: 'group' | 'event' | 'amendment' | 'blog' | 'statement',
  entityId: string,
  hashtags?: readonly string[] | null
) {
  const normalizedTags = normalizeStringList(hashtags);
  if (normalizedTags.length === 0) {
    return;
  }

  const now = Date.now();
  const existingHashtags = await tx.run(zql.hashtag.where('tag', 'IN', normalizedTags));
  const hashtagsByTag = new Map(existingHashtags.map(row => [row.tag, row.id]));

  for (const tag of normalizedTags) {
    if (hashtagsByTag.has(tag)) {
      continue;
    }

    const hashtagId = crypto.randomUUID();
    hashtagsByTag.set(tag, hashtagId);
    await tx.mutate.hashtag.insert({
      id: hashtagId,
      tag,
      created_at: now,
    });
  }

  for (const tag of normalizedTags) {
    const hashtagId = hashtagsByTag.get(tag);
    if (!hashtagId) {
      continue;
    }

    const junctionId = crypto.randomUUID();
    switch (entityType) {
      case 'group':
        await tx.mutate.group_hashtag.insert({
          id: junctionId,
          group_id: entityId,
          hashtag_id: hashtagId,
          created_at: now,
        });
        break;
      case 'event':
        await tx.mutate.event_hashtag.insert({
          id: junctionId,
          event_id: entityId,
          hashtag_id: hashtagId,
          created_at: now,
        });
        break;
      case 'amendment':
        await tx.mutate.amendment_hashtag.insert({
          id: junctionId,
          amendment_id: entityId,
          hashtag_id: hashtagId,
          created_at: now,
        });
        break;
      case 'blog':
        await tx.mutate.blog_hashtag.insert({
          id: junctionId,
          blog_id: entityId,
          hashtag_id: hashtagId,
          created_at: now,
        });
        break;
      case 'statement':
        await tx.mutate.statement_hashtag.insert({
          id: junctionId,
          statement_id: entityId,
          hashtag_id: hashtagId,
          created_at: now,
        });
        break;
    }
  }
}

async function getNextAgendaOrder(tx: ZeroTransaction, eventId: string): Promise<number> {
  const data = await tx.run(
    zql.agenda_item.where('event_id', eventId).orderBy('order_index', 'desc').limit(1)
  );

  const highestOrder = (((data ?? []) as OrderIndexRow[])[0]?.order_index ?? 0) || 0;
  return highestOrder + 1;
}

function buildEventCreateArgs(args: CreateEventArgs) {
  return {
    id: args.id,
    title: args.title,
    description: toRichText(args.description),
    status: null,
    event_type: args.event_type,
    location_type: args.location_type,
    location_name: args.location_type === 'physical' ? (args.location_name ?? null) : null,
    country: args.location_type === 'physical' ? (args.country ?? null) : null,
    region: args.location_type === 'physical' ? (args.region ?? null) : null,
    post_code: args.location_type === 'physical' ? (args.post_code ?? null) : null,
    city: args.location_type === 'physical' ? (args.city ?? null) : null,
    street: args.location_type === 'physical' ? (args.street ?? null) : null,
    house_number: args.location_type === 'physical' ? (args.house_number ?? null) : null,
    latitude: args.location_type === 'physical' ? (args.latitude ?? null) : null,
    longitude: args.location_type === 'physical' ? (args.longitude ?? null) : null,
    location_url: args.location_type === 'online' ? (args.location_url ?? null) : null,
    location_coordinates: null,
    visibility: args.visibility,
    start_date: args.start_date ?? null,
    end_date: args.end_date ?? null,
    timezone: null,
    capacity: args.capacity ?? null,
    agenda_management: null,
    meeting_type: null,
    is_bookable: false,
    max_bookings: null,
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_rule: null,
    recurrence_interval: null,
    recurrence_days: null,
    recurrence_end_date: null,
    original_event_id: null,
    x: null,
    youtube: null,
    linkedin: null,
    website: null,
    stream_url: null,
    image_url: args.image_url ?? null,
    has_delegates: args.has_delegates ?? false,
    delegate_distribution_method: null,
    delegate_distribution_status: null,
    delegate_seat_allocation_type: null,
    total_delegate_seats: args.total_delegate_seats ?? null,
    delegate_quorum_percentage: null,
    delegate_vote_weight_type: null,
    delegate_vote_threshold_percentage: null,
    delegate_accepted_states: null,
    delegate_finalized_at: null,
    delegate_approval_type: null,
    delegate_check_mode: null,
    main_group_delegate_allocation_mode: null,
    current_agenda_item_id: null,
    amendment_deadline: args.amendment_deadline ?? null,
    registration_deadline: null,
    candidacy_deadline: null,
    delegates_nomination_deadline: args.delegates_nomination_deadline ?? null,
    group_id: args.group_id ?? null,
    invited_user_ids: normalizeStringList(args.invited_user_ids),
  };
}

async function createEventWithDefaults(
  tx: ZeroTransaction,
  ctx: ReturnType<typeof createZeroContext>,
  args: CreateEventArgs
) {
  await runZeroMutator(tx, serverMutators.events.create(buildEventCreateArgs(args)), ctx);
}

export function buildAiCreateTools(userId: string) {
  const zeroContext = createZeroContext(userId);

  return {
    create_group: tool({
      description: translateText(
        'generated.inline.0615_create_a_real_polity_group_only_use_this_when_566bf6f0'
      ),
      parameters: z.object({
        name: z.string().trim().min(1),
        description: z.string().trim().optional(),
        groupType: groupTypeSchema.default('base'),
        connectedGroupId: z.string().trim().optional().describe(groupReferenceDescription),
        membershipMode: groupMembershipModeSchema.default('none'),
        membershipFlow: membershipFlowSchema.optional(),
        requiredSourceRoleId: z.string().trim().optional(),
        relationshipRights: z
          .object({
            informationRight: relationshipDirectionSchema.default('none'),
            amendmentRight: relationshipDirectionSchema.default('none'),
            rightToSpeak: relationshipDirectionSchema.default('none'),
            activeVotingRight: relationshipDirectionSchema.default('none'),
            passiveVotingRight: relationshipDirectionSchema.default('none'),
          })
          .default({
            informationRight: 'none',
            amendmentRight: 'none',
            rightToSpeak: 'none',
            activeVotingRight: 'none',
            passiveVotingRight: 'none',
          }),
        visibility: visibilitySchema.default('public'),
        email: z.string().trim().email().optional(),
        country: z.string().trim().optional(),
        region: z.string().trim().optional(),
        postCode: z.string().trim().optional(),
        city: z.string().trim().optional(),
        street: z.string().trim().optional(),
        houseNumber: z.string().trim().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        imageUrl: z.string().trim().url().optional(),
        hashtags: z.array(z.string().trim().min(1)).default([]),
        invitedUserIds: z.array(z.string().trim().min(1)).default([]),
        constitutionalEvent: z
          .object({
            title: z.string().trim().min(1),
            location: z.string().trim().optional(),
            startsAt: z.string().trim().optional(),
          })
          .optional(),
      }),
      execute: async ({
        name,
        description,
        groupType,
        connectedGroupId,
        membershipMode,
        membershipFlow,
        requiredSourceRoleId,
        relationshipRights,
        visibility,
        email,
        country,
        region,
        postCode,
        city,
        street,
        houseNumber,
        latitude,
        longitude,
        imageUrl,
        hashtags,
        invitedUserIds,
        constitutionalEvent,
      }) => {
        const groupId = crypto.randomUUID();
        const now = Date.now();
        const normalizedInviteUserIds = normalizeStringList(invitedUserIds).filter(
          invitedUserId => invitedUserId !== userId
        );
        let resolvedConnectedGroupId: string | null = null;
        let resolvedRequiredSourceRoleId: string | null = null;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          if (groupType === 'sibling') {
            if (!connectedGroupId) {
              throw new Error('connectedGroupId is required for sibling groups.');
            }

            const connectedGroup = await assertGroupAccess(tx, userId, connectedGroupId);
            resolvedConnectedGroupId = connectedGroup.id;

            if (membershipMode !== 'none' && !membershipFlow) {
              throw new Error('membershipFlow is required when a membership rule is configured.');
            }

            if (membershipMode === 'role_members') {
              if (!requiredSourceRoleId) {
                throw new Error('requiredSourceRoleId is required for role_members.');
              }
              const roleSourceGroupId =
                membershipFlow === 'current_members_to_partner' ? groupId : connectedGroup.id;
              resolvedRequiredSourceRoleId = (
                await assertGroupRoleReference(tx, roleSourceGroupId, requiredSourceRoleId)
              ).id;
            }
          }

          await runZeroMutator(
            tx,
            serverMutators.groups.create({
              id: groupId,
              name,
              description: toRichText(description),
              email: email ?? null,
              country: country ?? null,
              region: region ?? null,
              post_code: postCode ?? null,
              city: city ?? null,
              street: street ?? null,
              house_number: houseNumber ?? null,
              latitude: latitude ?? null,
              longitude: longitude ?? null,
              image_url: imageUrl ?? null,
              x: null,
              youtube: null,
              linkedin: null,
              website: null,
              whatsapp: null,
              instagram: null,
              twitter: null,
              facebook: null,
              snapchat: null,
              tiktok: null,
              visibility,
              group_type: groupType,
              owner_id: userId,
            }),
            ctx
          );

          await linkEntityHashtags(tx, 'group', groupId, hashtags);

          if (groupType !== 'sibling' || membershipMode === 'none') {
            for (const invitedUserId of normalizedInviteUserIds) {
              await runZeroMutator(
                tx,
                serverMutators.groups.inviteMember({
                  id: crypto.randomUUID(),
                  group_id: groupId,
                  user_id: invitedUserId,
                  status: 'invited',
                  visibility,
                }),
                ctx
              );
            }
          }

          if (groupType === 'sibling' && resolvedConnectedGroupId) {
            const partnerGroupId = resolvedConnectedGroupId;
            const grants = Object.entries(relationshipRights).flatMap(([right, direction]) => {
              if (direction === 'none') {
                return [];
              }

              const directions =
                direction === 'mutual'
                  ? ([
                      'current_grants_right_to_partner',
                      'partner_grants_right_to_current',
                    ] as const)
                  : [direction];

              return directions.map(grantDirection => ({
                id: crypto.randomUUID(),
                existing_grant_id: null,
                operation: 'upsert' as const,
                right_key: right as
                  | 'informationRight'
                  | 'amendmentRight'
                  | 'rightToSpeak'
                  | 'activeVotingRight'
                  | 'passiveVotingRight',
                holder_group_id:
                  grantDirection === 'current_grants_right_to_partner' ? partnerGroupId : groupId,
                scope_group_id:
                  grantDirection === 'current_grants_right_to_partner' ? groupId : partnerGroupId,
              }));
            });
            const [groupAId, groupBId] = [groupId, partnerGroupId].sort();
            const memberSourceGroupId =
              membershipFlow === 'current_members_to_partner' ? groupId : partnerGroupId;
            const memberTargetGroupId =
              membershipFlow === 'current_members_to_partner' ? partnerGroupId : groupId;

            await runZeroMutator(
              tx,
              serverMutators.network.proposeGroupConnectionChange({
                id: crypto.randomUUID(),
                active_connection_id: null,
                proposed_connection_id: crypto.randomUUID(),
                group_a_id: groupAId,
                group_b_id: groupBId,
                desired_connection_type: 'peer',
                desired_parent_group_id: null,
                desired_child_group_id: null,
                initiator_group_id: groupId,
                grants,
                membership_rule:
                  membershipMode !== 'none' && membershipFlow
                    ? {
                        id: crypto.randomUUID(),
                        existing_membership_rule_id: null,
                        operation: 'upsert',
                        member_source_group_id: memberSourceGroupId,
                        member_target_group_id: memberTargetGroupId,
                        membership_mode: membershipMode,
                        required_source_role_id: resolvedRequiredSourceRoleId,
                        eligible_origin_group_ids: [],
                      }
                    : null,
              }),
              ctx
            );
          }

          if (constitutionalEvent?.title) {
            await createEventWithDefaults(tx, ctx, {
              id: crypto.randomUUID(),
              title: constitutionalEvent.title,
              event_type: 'general_assembly',
              group_id: groupId,
              visibility,
              location_type: 'physical',
              location_name: constitutionalEvent.location ?? null,
              start_date: parseOptionalTimestamp(constitutionalEvent.startsAt),
              invited_user_ids: normalizedInviteUserIds,
            });
          }
        });

        const attachment = buildAttachment(
          'group',
          groupId,
          name,
          [groupType, visibility].join(' · '),
          truncate(description),
          {
            id: groupId,
            type: 'group',
            title: name,
            description: description?.trim() || '',
            createdAt: new Date(now),
            memberCount: 1,
            eventCount: constitutionalEvent?.title ? 1 : 0,
            amendmentCount: 0,
            tags: normalizeStringList(hashtags),
            stats: {
              members: 1,
            },
          }
        );

        return buildCreatedResult(`Gruppe „${name}“ erstellt.`, attachment, `/group/${groupId}`);
      },
    }),

    create_event: tool({
      description: translateText(
        'generated.inline.0616_create_a_real_polity_event_if_the_user_wants__5aef4dda'
      ),
      parameters: z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().optional(),
        eventType: eventTypeSchema.default('open'),
        groupId: z.string().trim().min(1).optional().describe(groupReferenceDescription),
        visibility: visibilitySchema.default('public'),
        locationType: locationTypeSchema.default('physical'),
        locationName: z.string().trim().optional(),
        locationUrl: z.string().trim().url().optional(),
        country: z.string().trim().optional(),
        region: z.string().trim().optional(),
        postCode: z.string().trim().optional(),
        city: z.string().trim().optional(),
        street: z.string().trim().optional(),
        houseNumber: z.string().trim().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        startsAt: z.string().trim().optional(),
        endsAt: z.string().trim().optional(),
        capacity: z.number().int().positive().optional(),
        imageUrl: z.string().trim().url().optional(),
        hashtags: z.array(z.string().trim().min(1)).default([]),
        invitedUserIds: z.array(z.string().trim().min(1)).default([]),
        delegatesNominationDeadline: z.string().trim().optional(),
        amendmentDeadline: z.string().trim().optional(),
        totalDelegateSeats: z.number().int().positive().optional(),
      }),
      execute: async ({
        title,
        description,
        eventType,
        groupId,
        visibility,
        locationType,
        locationName,
        locationUrl,
        country,
        region,
        postCode,
        city,
        street,
        houseNumber,
        latitude,
        longitude,
        startsAt,
        endsAt,
        capacity,
        imageUrl,
        hashtags,
        invitedUserIds,
        delegatesNominationDeadline,
        amendmentDeadline,
        totalDelegateSeats,
      }) => {
        const eventId = crypto.randomUUID();
        const startTimestamp = parseOptionalTimestamp(startsAt);
        const endTimestamp = parseOptionalTimestamp(endsAt);
        let resolvedGroupId: string | null = null;
        let groupName: string | undefined;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleGroup = groupId ? await assertGroupAccess(tx, userId, groupId) : null;
          resolvedGroupId = accessibleGroup?.id ?? null;
          groupName = accessibleGroup?.name ?? undefined;
          await createEventWithDefaults(tx, ctx, {
            id: eventId,
            title,
            description,
            event_type: eventType,
            group_id: resolvedGroupId,
            visibility,
            location_type: locationType,
            location_name: locationName ?? null,
            location_url: locationUrl ?? null,
            country: country ?? null,
            region: region ?? null,
            post_code: postCode ?? null,
            city: city ?? null,
            street: street ?? null,
            house_number: houseNumber ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            start_date: startTimestamp,
            end_date: endTimestamp,
            capacity: capacity ?? null,
            image_url: imageUrl ?? null,
            has_delegates: eventType === 'delegate_assembly',
            total_delegate_seats:
              eventType === 'delegate_assembly' ? (totalDelegateSeats ?? null) : null,
            delegates_nomination_deadline: parseOptionalTimestamp(delegatesNominationDeadline),
            amendment_deadline: parseOptionalTimestamp(amendmentDeadline),
            invited_user_ids: normalizeStringList(invitedUserIds),
          });

          await linkEntityHashtags(tx, 'event', eventId, hashtags);
        });

        const attachment = buildAttachment(
          'event',
          eventId,
          title,
          [formatDate(startTimestamp), locationName, eventType].filter(Boolean).join(' · ') || null,
          truncate(description),
          {
            id: eventId,
            type: 'event',
            title,
            description: description?.trim() || '',
            createdAt: startTimestamp ? new Date(startTimestamp) : new Date(),
            startDate: startTimestamp ? new Date(startTimestamp) : new Date(),
            endDate: endTimestamp ? new Date(endTimestamp) : undefined,
            location: locationName ?? null,
            city: city ?? null,
            postcode: postCode ?? null,
            groupId: resolvedGroupId,
            groupName,
            attendeeCount: normalizeStringList(invitedUserIds).length,
            electionsCount: 0,
            amendmentsCount: 0,
            tags: normalizeStringList(hashtags),
          }
        );

        return buildCreatedResult(`Event „${title}“ erstellt.`, attachment, `/event/${eventId}`);
      },
    }),

    create_amendment: tool({
      description: translateText(
        'generated.inline.0617_create_a_real_polity_amendment_if_the_amendme_639231cd'
      ),
      parameters: z.object({
        title: z.string().trim().min(1),
        code: z.string().trim().optional(),
        reason: z.string().trim().optional(),
        groupId: z.string().trim().min(1).optional().describe(groupReferenceDescription),
        eventId: z.string().trim().min(1).optional().describe(eventReferenceDescription),
        visibility: visibilitySchema.default('public'),
        hashtags: z.array(z.string().trim().min(1)).default([]),
        imageUrl: z.string().trim().url().optional(),
        workflowId: z.string().trim().optional(),
        pathSegments: z
          .array(
            z.object({
              groupId: z.string().trim().optional().describe(groupReferenceDescription),
              eventId: z.string().trim().optional().describe(eventReferenceDescription),
              forwardingStatus: z.string().trim().optional(),
            })
          )
          .default([]),
      }),
      execute: async ({
        title,
        code,
        reason,
        groupId,
        eventId,
        visibility,
        hashtags,
        imageUrl,
        workflowId,
        pathSegments,
      }) => {
        const documentId = crypto.randomUUID();
        const amendmentId = crypto.randomUUID();
        const now = Date.now();
        let resolvedGroupId: string | null = null;
        let resolvedEventId: string | null = null;
        let groupName: string | undefined;

        const normalizedPathSegments = pathSegments.map(segment => ({
          groupId: segment.groupId?.trim() || null,
          eventId: segment.eventId?.trim() || null,
          forwardingStatus: segment.forwardingStatus?.trim() || 'pending',
        }));

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleGroup = groupId ? await assertGroupAccess(tx, userId, groupId) : null;
          resolvedGroupId = accessibleGroup?.id ?? null;
          groupName = accessibleGroup?.name ?? undefined;

          if (eventId) {
            resolvedEventId = (await assertEventAccess(tx, userId, eventId)).id;
          }

          await runZeroMutator(
            tx,
            serverMutators.amendments.create({
              id: amendmentId,
              code: code ?? null,
              title,
              reason: reason ?? null,
              category: null,
              preamble: null,
              group_id: resolvedGroupId,
              event_id: resolvedEventId,
              clone_source_id: null,
              document_id: null,
              tags: normalizeStringList(hashtags),
              visibility,
              discussions: null,
              image_url: imageUrl ?? null,
              x: null,
              youtube: null,
              linkedin: null,
              website: null,
            }),
            ctx
          );

          await runZeroMutator(
            tx,
            serverMutators.documents.create({
              id: documentId,
              amendment_id: amendmentId,
              content: [
                { type: 'h1', children: [{ text: title }] },
                { type: 'p', children: [{ text: '' }] },
              ],
              editing_mode: 'edit',
            }),
            ctx
          );

          await tx.mutate.amendment.update({
            id: amendmentId,
            document_id: documentId,
          });

          await tx.mutate.document_collaborator.insert({
            id: crypto.randomUUID(),
            document_id: documentId,
            user_id: userId,
            role_id: null,
            status: 'active',
            visibility: 'public',
            created_at: now,
          });

          if (normalizedPathSegments.length > 0) {
            const pathId = crypto.randomUUID();

            await runZeroMutator(
              tx,
              serverMutators.amendments.createPath({
                id: pathId,
                amendment_id: amendmentId,
                title: '',
                workflow_id: workflowId?.trim() || null,
              }),
              ctx
            );

            for (let index = 0; index < normalizedPathSegments.length; index += 1) {
              const segment = normalizedPathSegments[index];
              const resolvedSegmentGroupId = segment.groupId
                ? (await assertGroupAccess(tx, userId, segment.groupId)).id
                : null;
              const resolvedSegmentEventId = segment.eventId
                ? (await assertEventAccess(tx, userId, segment.eventId)).id
                : null;

              if (resolvedSegmentEventId) {
                const agendaItemId = crypto.randomUUID();

                await runZeroMutator(
                  tx,
                  serverMutators.agendas.createAgendaItem({
                    id: agendaItemId,
                    event_id: resolvedSegmentEventId,
                    amendment_id: amendmentId,
                    title: translateText('generated.inline.0618_amendment_title_b8a8a16f', {
                      title: title,
                    }),
                    description: reason?.trim() || '',
                    type: 'amendment',
                    status: 'pending',
                    forwarding_status: segment.forwardingStatus,
                    order_index: 999,
                    duration: 0,
                    scheduled_time: '',
                    start_time: null,
                    end_time: null,
                    activated_at: null,
                    completed_at: null,
                    majority_type: null,
                    time_limit: null,
                    voting_phase: null,
                  }),
                  ctx
                );

                await runZeroMutator(
                  tx,
                  serverMutators.votes.createVote({
                    id: crypto.randomUUID(),
                    agenda_item_id: agendaItemId,
                    amendment_id: amendmentId,
                    title: translateText('generated.inline.0618_amendment_title_b8a8a16f', {
                      title: title,
                    }),
                    description: reason?.trim() || null,
                    status: 'indicative',
                    purpose: VOTE_PURPOSE.closing,
                    majority_type: 'relative',
                    closing_type: 'moderator',
                    closing_duration_seconds: null,
                    closing_end_time: null,
                    visibility: 'public',
                  }),
                  ctx
                );
              }

              await runZeroMutator(
                tx,
                serverMutators.amendments.createPathSegment({
                  id: crypto.randomUUID(),
                  path_id: pathId,
                  group_id: resolvedSegmentGroupId,
                  event_id: resolvedSegmentEventId,
                  order_index: index,
                  status: segment.forwardingStatus,
                }),
                ctx
              );
            }
          }

          await linkEntityHashtags(tx, 'amendment', amendmentId, hashtags);
        });

        const attachment = buildAttachment(
          'amendment',
          amendmentId,
          title,
          [code, visibility].filter(Boolean).join(' · ') || null,
          truncate(reason),
          {
            id: amendmentId,
            type: 'amendment',
            title,
            description: reason?.trim() || '',
            createdAt: new Date(now),
            status: 'edit',
            groupId: resolvedGroupId,
            groupName,
            collaboratorCount: 1,
            supportingGroupsCount: 0,
            changeRequestCount: 0,
            tags: normalizeStringList(hashtags),
          }
        );

        return buildCreatedResult(
          `Änderungsantrag „${title}“ erstellt.`,
          attachment,
          `/amendment/${amendmentId}`
        );
      },
    }),

    create_blog_entry: tool({
      description: translateText(
        'generated.inline.0619_create_a_real_polity_blog_entry_only_use_this_5c1ab8c3'
      ),
      parameters: z.object({
        title: z.string().trim().min(1),
        date: z.string().trim().optional(),
        visibility: visibilitySchema.default('public'),
        hashtags: z.array(z.string().trim().min(1)).default([]),
        imageUrl: z.string().trim().url().optional(),
        groupId: z.string().trim().min(1).optional().describe(groupReferenceDescription),
      }),
      execute: async ({ title, date, visibility, hashtags, imageUrl, groupId }) => {
        const blogId = crypto.randomUUID();
        const now = Date.now();
        const publishedAt = (() => {
          const resolved = date?.trim() ? new Date(date.trim()) : new Date(now);
          return Number.isNaN(resolved.getTime()) ? new Date(now) : resolved;
        })();
        let resolvedGroupId: string | null = null;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          if (groupId) {
            resolvedGroupId = (await assertGroupAccess(tx, userId, groupId)).id;
          }

          await runZeroMutator(
            tx,
            serverMutators.blogs.create({
              id: blogId,
              title,
              description: '',
              content: null,
              date: date?.trim() || new Date().toISOString().split('T')[0],
              image_url: imageUrl ?? '',
              visibility,
              like_count: 0,
              comment_count: 0,
              upvotes: 0,
              downvotes: 0,
              editing_mode: '',
              discussions: null,
              group_id: resolvedGroupId,
            }),
            ctx
          );

          await linkEntityHashtags(tx, 'blog', blogId, hashtags);
        });

        const attachment = buildAttachment(
          'blog',
          blogId,
          title,
          [date?.trim() || new Date().toISOString().split('T')[0], visibility].join(' · '),
          null,
          {
            id: blogId,
            type: 'blog',
            title,
            description: '',
            imageUrl: imageUrl ?? null,
            createdAt: publishedAt,
            authorId: userId,
            groupId: resolvedGroupId,
            commentCount: 0,
            tags: normalizeStringList(hashtags),
          }
        );

        const route = resolvedGroupId
          ? `/group/${resolvedGroupId}/blog/${blogId}`
          : `/user/${userId}/blog/${blogId}`;
        return buildCreatedResult(`Blogeintrag „${title}“ erstellt.`, attachment, route);
      },
    }),

    create_todo: tool({
      description: translateText(
        'generated.inline.0620_create_a_real_polity_todo_only_use_this_when__94618ff3'
      ),
      parameters: z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().optional(),
        priority: todoPrioritySchema.default('medium'),
        status: todoStatusSchema.default('pending'),
        dueDate: z.string().trim().optional(),
        visibility: visibilitySchema.default('private'),
        tags: z.array(z.string().trim().min(1)).default([]),
        assigneeId: z.string().trim().min(1).optional(),
        groupId: z.string().trim().min(1).optional().describe(groupReferenceDescription),
        eventId: z.string().trim().min(1).optional().describe(eventReferenceDescription),
        amendmentId: z.string().trim().min(1).optional(),
      }),
      execute: async ({
        title,
        description,
        priority,
        status,
        dueDate,
        visibility,
        tags,
        assigneeId,
        groupId,
        eventId,
        amendmentId,
      }) => {
        const todoId = crypto.randomUUID();
        const now = Date.now();
        const assignedUserId = assigneeId?.trim() || userId;
        const dueTimestamp = parseOptionalTimestamp(dueDate);
        let resolvedEventId: string | null = null;
        let notificationGroupId: string | null = null;
        let groupName: string | undefined;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleGroup = groupId ? await assertGroupAccess(tx, userId, groupId) : null;
          notificationGroupId = accessibleGroup?.id ?? null;
          groupName = accessibleGroup?.name ?? undefined;
          if (eventId) {
            resolvedEventId = (await assertEventAccess(tx, userId, eventId)).id;
          }

          await runZeroMutator(
            tx,
            mutators.todos.create({
              id: todoId,
              title,
              description: description?.trim() || '',
              status,
              priority,
              due_date: dueTimestamp,
              completed_at: status === 'completed' ? now : null,
              tags: normalizeStringList(tags),
              visibility,
              group_id: notificationGroupId,
              event_id: resolvedEventId,
              amendment_id: amendmentId ?? null,
            }),
            ctx
          );

          await runZeroMutator(
            tx,
            mutators.todos.assign({
              id: crypto.randomUUID(),
              todo_id: todoId,
              user_id: assignedUserId,
              role: 'assignee',
            }),
            ctx
          );
        });

        if (notificationGroupId && assignedUserId !== userId) {
          await notifyTodoAssigned({
            senderId: userId,
            recipientUserId: assignedUserId,
            groupId: notificationGroupId,
            groupName: groupName ?? 'Group',
            todoTitle: title,
          });
        }

        const attachment = buildAttachment(
          'todo',
          todoId,
          title,
          [status, priority, formatDate(dueTimestamp)].filter(Boolean).join(' · ') || null,
          truncate(description),
          {
            id: todoId,
            type: 'todo',
            title,
            description: description?.trim() || '',
            createdAt: new Date(now),
            updatedAt: new Date(now),
            dueDate: dueTimestamp ? new Date(dueTimestamp) : undefined,
            status,
            isCompleted: status === 'completed',
            groupId: notificationGroupId,
            groupName,
            assigneeCount: 1,
            tags: normalizeStringList(tags),
          }
        );

        return buildCreatedResult(`Todo „${title}“ erstellt.`, attachment, '/todos');
      },
    }),

    create_statement: tool({
      description: translateText(
        'generated.inline.0621_create_a_real_polity_statement_only_use_this__93f2d1c4'
      ),
      parameters: z.object({
        text: z.string().trim().min(1).max(280),
        groupId: z.string().trim().min(1).optional().describe(groupReferenceDescription),
        imageUrl: z.string().trim().url().optional(),
        videoUrl: z.string().trim().url().optional(),
        visibility: visibilitySchema.default('public'),
        hashtags: z.array(z.string().trim().min(1)).default([]),
        surveyQuestion: z.string().trim().optional(),
        surveyOptions: z.array(z.string().trim().min(1)).max(4).default([]),
        surveyDurationHours: z.number().int().min(1).max(168).default(24),
      }),
      execute: async ({
        text,
        groupId,
        imageUrl,
        videoUrl,
        visibility,
        hashtags,
        surveyQuestion,
        surveyOptions,
        surveyDurationHours,
      }) => {
        const statementId = crypto.randomUUID();
        const now = Date.now();
        const validSurveyOptions = normalizeStringList(surveyOptions);
        let resolvedGroupId: string | null = null;
        let groupName: string | undefined;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleGroup = groupId ? await assertGroupAccess(tx, userId, groupId) : null;
          resolvedGroupId = accessibleGroup?.id ?? null;
          groupName = accessibleGroup?.name ?? undefined;

          await runZeroMutator(
            tx,
            serverMutators.statements.create({
              id: statementId,
              group_id: resolvedGroupId,
              text,
              image_url: imageUrl ?? null,
              video_url: videoUrl ?? null,
              visibility,
            }),
            ctx
          );

          await linkEntityHashtags(tx, 'statement', statementId, hashtags);

          if (surveyQuestion?.trim() && validSurveyOptions.length >= 2) {
            const surveyId = crypto.randomUUID();

            await runZeroMutator(
              tx,
              serverMutators.statements.createSurvey({
                id: surveyId,
                statement_id: statementId,
                question: surveyQuestion.trim(),
                ends_at: now + surveyDurationHours * 60 * 60 * 1000,
              }),
              ctx
            );

            for (let index = 0; index < validSurveyOptions.length; index += 1) {
              await runZeroMutator(
                tx,
                serverMutators.statements.createSurveyOption({
                  id: crypto.randomUUID(),
                  survey_id: surveyId,
                  label: validSurveyOptions[index],
                  position: index,
                }),
                ctx
              );
            }
          }
        });

        const attachment = buildAttachment(
          'statement',
          statementId,
          truncate(text, 90) || 'Statement',
          visibility,
          truncate(text),
          {
            id: statementId,
            type: 'statement',
            title: truncate(text, 90) || 'Statement',
            description: text,
            imageUrl: imageUrl ?? null,
            videoUrl: videoUrl ?? null,
            createdAt: new Date(now),
            groupId: resolvedGroupId,
            groupName,
            commentCount: 0,
            upvotes: 0,
            downvotes: 0,
            tags: normalizeStringList(hashtags),
            surveyQuestion: surveyQuestion?.trim() || null,
            surveyOptions: validSurveyOptions.map(option => ({ label: option, voteCount: 0 })),
          }
        );

        return buildCreatedResult(`Statement erstellt.`, attachment, `/statement/${statementId}`);
      },
    }),

    create_payment: tool({
      description: translateText(
        'generated.inline.0622_create_a_real_polity_payment_only_use_this_wh_b0a4119b'
      ),
      parameters: z.object({
        groupId: z.string().trim().min(1).describe(groupReferenceDescription),
        direction: paymentDirectionSchema.default('income'),
        label: z.string().trim().min(1),
        type: paymentTypeSchema.default('donation'),
        amount: z.number().positive(),
        counterpartyUserId: z.string().trim().min(1).optional(),
        counterpartyGroupId: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(groupReferenceDescription),
      }),
      execute: async ({
        groupId,
        direction,
        label,
        type,
        amount,
        counterpartyUserId,
        counterpartyGroupId,
      }) => {
        if (!counterpartyUserId && !counterpartyGroupId) {
          throw new Error('Either counterpartyUserId or counterpartyGroupId is required.');
        }

        if (counterpartyUserId && counterpartyGroupId) {
          throw new Error('Specify only one counterparty: a user or a group.');
        }

        const paymentId = crypto.randomUUID();
        let notificationGroupId: string = groupId;
        let groupName = 'Group';
        let resolvedCounterpartyGroupId: string | null = null;
        let counterpartyLabel: string | null = null;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleGroup = await assertGroupAccess(tx, userId, groupId);
          notificationGroupId = accessibleGroup.id;
          groupName = accessibleGroup.name ?? 'Group';

          if (counterpartyGroupId) {
            const accessibleCounterpartyGroup = await assertGroupAccess(
              tx,
              userId,
              counterpartyGroupId
            );
            resolvedCounterpartyGroupId = accessibleCounterpartyGroup.id;
            counterpartyLabel = accessibleCounterpartyGroup.name ?? null;
          }

          await runZeroMutator(
            tx,
            mutators.payments.createPayment({
              id: paymentId,
              label,
              type,
              amount,
              payer_user_id: direction === 'income' ? (counterpartyUserId ?? null) : null,
              payer_group_id:
                direction === 'income' ? resolvedCounterpartyGroupId : notificationGroupId,
              receiver_user_id: direction === 'expense' ? (counterpartyUserId ?? null) : null,
              receiver_group_id:
                direction === 'expense' ? resolvedCounterpartyGroupId : notificationGroupId,
            }),
            ctx
          );
        });

        await notifyPaymentCreated({
          senderId: userId,
          groupId: notificationGroupId,
          groupName,
          paymentDescription: label,
        });

        const attachment = buildAttachment(
          'payment',
          paymentId,
          label,
          [direction, type, formatCurrency(amount)].join(' · '),
          null,
          {
            id: paymentId,
            type: 'payment',
            title: label,
            createdAt: new Date(),
            amount,
            paymentType: type,
            paymentDirection: direction,
            groupId: notificationGroupId,
            groupName,
            counterpartyLabel,
          }
        );

        return buildCreatedResult(
          `Zahlung „${label}“ erstellt.`,
          attachment,
          `/group/${notificationGroupId}`
        );
      },
    }),

    create_agenda_item: tool({
      description: translateText(
        'generated.inline.0623_create_a_real_polity_agenda_item_only_use_thi_46f29630'
      ),
      parameters: z.object({
        eventId: z.string().trim().min(1).describe(eventReferenceDescription),
        title: z.string().trim().min(1),
        description: z.string().trim().optional(),
        type: agendaItemTypeSchema.default('discussion'),
        orderIndex: z.number().int().min(1).optional(),
        durationMinutes: z.number().int().min(1).optional(),
        amendmentId: z.string().trim().min(1).optional(),
        roleId: z.string().trim().min(1).optional(),
        majorityType: majorityTypeSchema.default('simple'),
        timeLimitMinutes: z.number().int().min(1).optional(),
      }),
      execute: async ({
        eventId,
        title,
        description,
        type,
        orderIndex,
        durationMinutes,
        amendmentId,
        roleId,
        majorityType,
        timeLimitMinutes,
      }) => {
        const agendaItemId = crypto.randomUUID();
        let resolvedEventId = eventId;
        let eventTitle = 'Event';
        let resolvedOrder = orderIndex ?? 1;
        const isVotable = type === 'election' || type === 'vote';

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const accessibleEvent = await assertEventAccess(tx, userId, eventId);
          resolvedEventId = accessibleEvent.id;
          eventTitle = accessibleEvent.title ?? 'Event';
          resolvedOrder = orderIndex ?? (await getNextAgendaOrder(tx, eventId));

          await runZeroMutator(
            tx,
            serverMutators.agendas.createAgendaItem({
              id: agendaItemId,
              event_id: resolvedEventId,
              amendment_id: amendmentId ?? null,
              title,
              description: description?.trim() || '',
              type,
              status: 'pending',
              forwarding_status: '',
              order_index: resolvedOrder,
              duration: durationMinutes ?? 0,
              scheduled_time: '',
              start_time: null,
              end_time: null,
              activated_at: null,
              completed_at: null,
              majority_type: isVotable ? majorityType : null,
              time_limit: isVotable && timeLimitMinutes ? timeLimitMinutes * 60 : null,
              voting_phase: isVotable ? 'indicative' : null,
            }),
            ctx
          );

          if (type === 'election') {
            await runZeroMutator(
              tx,
              serverMutators.elections.createElection({
                id: crypto.randomUUID(),
                agenda_item_id: agendaItemId,
                role_id: roleId ?? null,
                title,
                description: description?.trim() || null,
                status: 'indicative',
                majority_type: majorityType,
                closing_type: null,
                closing_duration_seconds: null,
                closing_end_time: null,
                visibility: 'public',
                max_votes: 1,
              }),
              ctx
            );
          }

          if (type === 'vote') {
            const voteId = crypto.randomUUID();

            await runZeroMutator(
              tx,
              serverMutators.votes.createVote({
                id: voteId,
                agenda_item_id: agendaItemId,
                amendment_id: amendmentId ?? null,
                title,
                description: description?.trim() || null,
                status: 'indicative',
                purpose: VOTE_PURPOSE.closing,
                majority_type: majorityType,
                closing_type: 'moderator',
                closing_duration_seconds: null,
                closing_end_time: null,
                visibility: 'public',
              }),
              ctx
            );

            const defaultChoices = ['Yes', 'No', 'Abstain'] as const;
            for (let index = 0; index < defaultChoices.length; index += 1) {
              await runZeroMutator(
                tx,
                serverMutators.votes.createVoteChoice({
                  id: crypto.randomUUID(),
                  vote_id: voteId,
                  label: defaultChoices[index],
                  order_index: index + 1,
                }),
                ctx
              );
            }
          }
        });

        await notifyAgendaItemCreated({
          senderId: userId,
          eventId: resolvedEventId,
          eventTitle,
          agendaItemTitle: title,
        });

        const attachment = buildAttachment(
          'agenda_item',
          agendaItemId,
          title,
          [type, `#${resolvedOrder}`].join(' · '),
          truncate(description),
          {
            id: agendaItemId,
            type: 'agenda_item',
            title,
            description: description?.trim() || null,
            createdAt: new Date(),
            status: 'pending',
            agendaItemType: type,
            orderIndex: resolvedOrder,
            durationMinutes: durationMinutes ?? null,
            eventId: resolvedEventId,
            eventName: eventTitle,
          }
        );

        return buildCreatedResult(
          `Agenda-Punkt „${title}“ erstellt.`,
          attachment,
          `/event/${resolvedEventId}/agenda`
        );
      },
    }),

    create_election_candidate: tool({
      description: translateText(
        'generated.inline.0624_create_a_real_polity_election_candidate_entry_ee7cb9cb'
      ),
      parameters: z.object({
        electionId: z.string().trim().min(1),
        statement: z.string().trim().optional(),
        imageUrl: z.string().trim().url().optional(),
      }),
      execute: async ({ electionId, statement, imageUrl }) => {
        const candidateId = crypto.randomUUID();
        let electionTitle: string | null = null;
        let electionRoute = `/election/${electionId}`;

        await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const election = await assertElectionAccess(tx, userId, electionId);
          electionTitle = election.title ?? null;
          electionRoute = election.eventId
            ? `/event/${election.eventId}/agenda`
            : `/election/${electionId}`;
          const existingCandidateData = await tx.run(
            zql.election_candidate
              .where('election_id', electionId)
              .where('user_id', userId)
              .limit(1)
          );

          if (((existingCandidateData ?? []) as ExistingCandidateRow[]).length > 0) {
            throw new Error('You are already listed as a candidate in this election.');
          }

          await runZeroMutator(
            tx,
            serverMutators.elections.addCandidate({
              id: candidateId,
              election_id: electionId,
              user_id: userId,
              name: '',
              description: statement?.trim() || '',
              image_url: imageUrl ?? '',
              status: 'pending',
              order_index: 0,
            }),
            ctx
          );
        });

        const attachment = buildAttachment(
          'election_candidate',
          candidateId,
          electionTitle ? `Candidate for ${electionTitle}` : 'Election candidate',
          'pending',
          truncate(statement)
        );

        return buildCreatedResult('Kandidatur erstellt.', attachment, electionRoute);
      },
    }),
  };
}
