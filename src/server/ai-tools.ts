import { tool } from 'ai';
import { z } from 'zod';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import {
  AI_DOCS_LANGUAGES,
  AI_DOCS_PAGE_SLUGS,
  readPolityDocs,
} from '@/features/docs/logic/aiDocsIndex';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import {
  buildTimelineCardProps,
  type TimelineCardItem,
} from '@/features/search/logic/buildTimelineCardProps';
import { type AiAttachmentEntity, type AiChatAttachment } from '@/lib/ai/schemas';
import { aiFindingToneSchema } from '@/lib/ai/messageContext';
import { buildAiEntityHref } from '@/lib/ai/entityHref';
import { executeZeroRead, type ZeroTransaction } from '@/server/zero-mutate';
import { zql } from '@/zero/schema';
import { buildAiCreateTools } from './ai-create-tools';
import { buildAiUpdateTools } from './ai-update-tools';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { formatCurrencyMajor, type CurrencyCode } from '@/features/shared/logic/currency';

const SEARCH_ENTITY_TYPES = [
  'user',
  'group',
  'statement',
  'blog',
  'amendment',
  'event',
  'todo',
  'election',
  'vote',
] as const;

const GROUP_RESOURCE_TYPES = [
  'payments',
  'todos',
  'links',
  'amendments',
  'events',
  'blogs',
  'files',
] as const;

const EVENT_RESOURCE_TYPES = ['agenda_items', 'amendments', 'elections', 'votes'] as const;

const CREATE_FLOW_TYPES = [
  'group',
  'event',
  'amendment',
  'blog-entry',
  'todo',
  'statement',
  'payment',
  'agenda-item',
  'election-candidate',
] as const;

const AGENDA_ITEM_TYPES = ['election', 'vote', 'speech', 'discussion', 'accreditation'] as const;

const searchEntityTypeSchema = z.enum(SEARCH_ENTITY_TYPES);
const docsPageSlugSchema = z.enum(AI_DOCS_PAGE_SLUGS);
const aiDocsLanguageSchema = z.enum(AI_DOCS_LANGUAGES);
const groupResourceTypeSchema = z.enum(GROUP_RESOURCE_TYPES);
const eventResourceTypeSchema = z.enum(EVENT_RESOURCE_TYPES);
const createFlowTypeSchema = z.enum(CREATE_FLOW_TYPES);
const agendaItemTypeSchema = z.enum(AGENDA_ITEM_TYPES);

const presentFindingsInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(800).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(800),
        badge: z.string().trim().min(1).max(48).optional(),
        tone: aiFindingToneSchema.default('neutral'),
      })
    )
    .min(2)
    .max(12),
});

const createFlowMetadata: Record<
  CreateFlowType,
  {
    title: string;
    description: string;
    route: string;
  }
> = {
  group: {
    title: translateText('generated.inline.0596_gruppe_erstellen_0b899239'),
    description: translateText(
      'generated.inline.0632_ffnet_den_gruppen_flow_im_create_bereich_7ff1dac5'
    ),
    route: '/create/group',
  },
  event: {
    title: translateText('generated.inline.0598_event_erstellen_de6406f8'),
    description: translateText(
      'generated.inline.0633_ffnet_den_event_flow_im_create_bereich_ec7e5039'
    ),
    route: '/create/event',
  },
  amendment: {
    title: translateText('generated.inline.0634_nderungsantrag_erstellen_03731c1e'),
    description: translateText(
      'generated.inline.0635_ffnet_den_amendment_flow_im_create_bereich_c3ae7d5e'
    ),
    route: '/create/amendment',
  },
  'blog-entry': {
    title: translateText('generated.inline.0602_blogeintrag_erstellen_68a9822b'),
    description: translateText(
      'generated.inline.0636_ffnet_den_blog_entry_flow_im_create_bereich_d7967488'
    ),
    route: '/create/blog-entry',
  },
  todo: {
    title: translateText('generated.inline.0604_todo_erstellen_867691bd'),
    description: translateText(
      'generated.inline.0637_ffnet_den_todo_flow_im_create_bereich_dc52c505'
    ),
    route: '/create/todo',
  },
  statement: {
    title: translateText('generated.inline.0606_statement_erstellen_6bbac81c'),
    description: translateText(
      'generated.inline.0638_ffnet_den_statement_flow_im_create_bereich_3a58104f'
    ),
    route: '/create/statement',
  },
  payment: {
    title: translateText('generated.inline.0639_zahlung_erfassen_2f753f11'),
    description: translateText(
      'generated.inline.0640_ffnet_den_payment_flow_im_create_bereich_d0f3ed00'
    ),
    route: '/create/payment',
  },
  'agenda-item': {
    title: translateText('generated.inline.0610_agenda_punkt_erstellen_108bf657'),
    description: translateText(
      'generated.inline.0641_ffnet_den_agenda_item_flow_im_create_bereich_f2d7b7b1'
    ),
    route: '/create/agenda-item',
  },
  'election-candidate': {
    title: translateText('generated.inline.0612_kandidatur_erstellen_ee2830d6'),
    description: translateText(
      'generated.inline.0642_ffnet_den_election_candidate_flow_im_create_b_0e828af7'
    ),
    route: '/create/election-candidate',
  },
};

type GroupResourceType = z.infer<typeof groupResourceTypeSchema>;
type EventResourceType = z.infer<typeof eventResourceTypeSchema>;
type CreateFlowType = z.infer<typeof createFlowTypeSchema>;
type AgendaItemType = z.infer<typeof agendaItemTypeSchema>;

interface RelationshipSets {
  groupIds: Set<string>;
  eventIds: Set<string>;
  todoIds: Set<string>;
  amendmentIds: Set<string>;
  blogIds: Set<string>;
}

interface UserSearchRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
  bio: string | null;
  visibility: string | null;
}

interface GroupSearchRow {
  id: string;
  name: string | null;
  description: unknown;
  visibility: string | null;
  member_count: number | null;
}

interface StatementSearchRow {
  id: string;
  text: string | null;
  visibility: string | null;
  user_id: string;
  updated_at: number | null;
}

interface BlogSearchRow {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  updated_at: number | null;
}

interface AmendmentSearchRow {
  id: string;
  title: string | null;
  reason: string | null;
  preamble: string | null;
  visibility: string | null;
  updated_at: number | null;
}

interface EventSearchRow {
  id: string;
  title: string | null;
  description: unknown;
  visibility: string | null;
  start_date: number | null;
  end_date: number | null;
  location_name: string | null;
  status: string | null;
}

interface TodoSearchRow {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  status: string | null;
  priority: string | null;
  due_date: number | null;
  creator_id: string;
  updated_at: number | null;
}

interface GroupMembershipRoleRow {
  id: string;
  group_id: string;
  created_at: number;
}

interface EventParticipantRoleRow {
  id: string;
  event_id: string;
  created_at: number;
}

interface GroupMembershipRoleLinkRow {
  group_membership_id: string;
  role_id: string;
}

interface EventParticipantRoleLinkRow {
  event_participant_id: string;
  role_id: string;
}

interface AmendmentCollaboratorRoleRow {
  amendment_id: string;
  role_id: string | null;
  created_at: number;
}

interface BlogBloggerRoleRow {
  blog_id: string;
  role_id: string | null;
  created_at: number;
}

interface CurrentUserScopeRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
}

interface ElectionSearchRow {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  status: string | null;
  updated_at: number | null;
}

interface VoteSearchRow {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  status: string | null;
  updated_at: number | null;
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
}

interface PaymentRow {
  id: string;
  label: string | null;
  type: string | null;
  amount: number | null;
  currency: string | null;
  payer_group_id: string | null;
  receiver_group_id: string | null;
  created_at: number;
}

interface LinkRow {
  id: string;
  label: string | null;
  url: string | null;
  created_at: number;
}

interface GroupTodoRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: number | null;
  updated_at: number;
}

interface GroupAmendmentRow {
  id: string;
  title: string | null;
  reason: string | null;
  preamble: string | null;
  updated_at: number;
  document_id: string | null;
}

interface GroupEventRow {
  id: string;
  title: string | null;
  description: unknown;
  status: string | null;
  start_date: number | null;
  end_date: number | null;
  location_name: string | null;
  updated_at: number;
}

interface GroupBlogRow {
  id: string;
  title: string | null;
  description: string | null;
  updated_at: number;
}

interface DocumentRow {
  id: string;
  amendment_id: string | null;
  updated_at: number;
}

interface AgendaItemRow {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  status: string | null;
  scheduled_time: string | null;
  order_index: number | null;
  duration: number | null;
  amendment_id: string | null;
  created_at: number;
  updated_at: number;
}

interface EventAmendmentRow {
  id: string;
  title: string | null;
  reason: string | null;
  preamble: string | null;
  updated_at: number;
}

interface EventElectionRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  updated_at: number;
}

interface EventVoteRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  updated_at: number;
}

interface ToolItemSummary {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
}

type BlogAttachmentRow = BlogSearchRow | GroupBlogRow;
type AmendmentAttachmentRow = AmendmentSearchRow | GroupAmendmentRow | EventAmendmentRow;
type EventAttachmentRow = EventSearchRow | GroupEventRow;
type TodoAttachmentRow = TodoSearchRow | GroupTodoRow;
type ElectionAttachmentRow = ElectionSearchRow | EventElectionRow;
type VoteAttachmentRow = VoteSearchRow | EventVoteRow;

function clampLimit(value: number | undefined, fallback: number, min = 1, max = 12): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value as number)));
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toSearchPattern(query: string): string {
  const normalized = query.trim().replace(/[,%]/g, ' ').replace(/\s+/g, '%');

  return `%${normalized}%`;
}

function toPreviewText(value: unknown): string | null {
  const text = richTextToPlainText(value);
  return text.length > 0 ? text : null;
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

function formatDate(value: number | null | undefined): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value as number));
}

function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode = 'EUR'
): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return formatCurrencyMajor(value as number, currency, 'de', { currencyDisplay: 'code' });
}

function toOptionalDate(value: number | null | undefined): Date | undefined {
  return Number.isFinite(value) ? new Date(value as number) : undefined;
}

function toRequiredDate(...values: (number | null | undefined)[]): Date {
  for (const value of values) {
    const resolved = toOptionalDate(value);
    if (resolved) {
      return resolved;
    }
  }

  return new Date(0);
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
    href: buildAiEntityHref(entityType, entityId),
  };
}

function buildUserAttachment(row: UserSearchRow): AiChatAttachment {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const title = fullName || row.handle || 'Profil';
  const subtitle = row.handle ? `@${row.handle}` : null;
  const description = row.bio?.trim() || null;

  return buildAttachment('user', row.id, title, subtitle, truncate(row.bio), {
    id: row.id,
    type: 'user',
    title,
    description,
    handle: row.handle ?? undefined,
    subtitle,
    createdAt: new Date(0),
  });
}

function buildGroupAttachment(row: GroupSearchRow): AiChatAttachment {
  const title = row.name || 'Gruppe';
  const description = toPreviewText(row.description);
  const memberCount = row.member_count ?? undefined;

  return buildAttachment(
    'group',
    row.id,
    title,
    row.member_count ? `${row.member_count} Mitglieder` : null,
    truncate(description),
    {
      id: row.id,
      type: 'group',
      title,
      description,
      createdAt: new Date(0),
      memberCount,
      stats: memberCount ? { members: memberCount } : undefined,
    }
  );
}

function buildStatementAttachment(row: StatementSearchRow): AiChatAttachment {
  const title = truncate(row.text, 90) || 'Statement';
  const description = row.text?.trim() || title;
  const updatedAt = toOptionalDate(row.updated_at);

  return buildAttachment(
    'statement',
    row.id,
    title,
    formatDate(row.updated_at),
    truncate(row.text),
    {
      id: row.id,
      type: 'statement',
      title,
      description,
      authorId: row.user_id,
      createdAt: updatedAt ?? new Date(0),
      updatedAt,
    }
  );
}

function buildBlogAttachment(row: BlogAttachmentRow): AiChatAttachment {
  const title = row.title || 'Blog';
  const description = row.description?.trim() || null;
  const updatedAt = toOptionalDate(row.updated_at);

  return buildAttachment(
    'blog',
    row.id,
    title,
    formatDate(row.updated_at),
    truncate(row.description),
    {
      id: row.id,
      type: 'blog',
      title,
      description,
      createdAt: updatedAt ?? new Date(0),
      updatedAt,
    }
  );
}

function buildAmendmentAttachment(row: AmendmentAttachmentRow): AiChatAttachment {
  const title = row.title || translateText('generated.inline.0189_nderungsantrag_16c2b7bf');
  const description = (row.reason || row.preamble)?.trim() || null;
  const updatedAt = toOptionalDate(row.updated_at);

  return buildAttachment(
    'amendment',
    row.id,
    title,
    formatDate(row.updated_at),
    truncate(row.reason || row.preamble),
    {
      id: row.id,
      type: 'amendment',
      title,
      description,
      createdAt: updatedAt ?? new Date(0),
      updatedAt,
    }
  );
}

function buildEventAttachment(row: EventAttachmentRow): AiChatAttachment {
  const title = row.title || 'Event';
  const description = toPreviewText(row.description);
  const startDate = toOptionalDate(row.start_date);
  const endDate = toOptionalDate(row.end_date);
  const updatedAt = 'updated_at' in row ? toOptionalDate(row.updated_at) : undefined;

  return buildAttachment(
    'event',
    row.id,
    title,
    [formatDate(row.start_date), row.location_name, row.status].filter(Boolean).join(' · ') || null,
    truncate(description),
    {
      id: row.id,
      type: 'event',
      title,
      description,
      createdAt: toRequiredDate(row.start_date, 'updated_at' in row ? row.updated_at : undefined),
      updatedAt,
      startDate,
      endDate,
      location: row.location_name ?? null,
      status: row.status,
    }
  );
}

function buildTodoAttachment(row: TodoAttachmentRow): AiChatAttachment {
  const title = row.title || 'Todo';
  const description = row.description?.trim() || null;
  const updatedAt = toOptionalDate(row.updated_at);
  const dueDate = toOptionalDate(row.due_date);

  return buildAttachment(
    'todo',
    row.id,
    title,
    [row.status, row.priority, formatDate(row.due_date)].filter(Boolean).join(' · ') || null,
    truncate(row.description),
    {
      id: row.id,
      type: 'todo',
      title,
      description,
      createdAt: toRequiredDate(row.updated_at, row.due_date),
      updatedAt,
      dueDate,
      status: row.status,
      isCompleted: row.status === 'completed',
    }
  );
}

function buildElectionAttachment(row: ElectionAttachmentRow): AiChatAttachment {
  const title = row.title || 'Wahl';
  const description = row.description?.trim() || null;
  const updatedAt = toOptionalDate(row.updated_at);

  return buildAttachment(
    'election',
    row.id,
    title,
    [row.status, formatDate(row.updated_at)].filter(Boolean).join(' · ') || null,
    truncate(row.description),
    {
      id: row.id,
      type: 'election',
      title,
      description,
      createdAt: updatedAt ?? new Date(0),
      updatedAt,
      status: row.status,
    }
  );
}

function buildVoteAttachment(row: VoteAttachmentRow): AiChatAttachment {
  const title = row.title || 'Abstimmung';
  const description = row.description?.trim() || null;
  const updatedAt = toOptionalDate(row.updated_at);

  return buildAttachment(
    'vote',
    row.id,
    title,
    [row.status, formatDate(row.updated_at)].filter(Boolean).join(' · ') || null,
    truncate(row.description),
    {
      id: row.id,
      type: 'vote',
      title,
      description,
      createdAt: updatedAt ?? new Date(0),
      updatedAt,
      status: row.status,
    }
  );
}

function toItemSummary(attachment: AiChatAttachment): ToolItemSummary {
  return {
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    title: attachment.title,
    subtitle: attachment.subtitle ?? null,
  };
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function formatCurrentUserDisplayName(user: CurrentUserScopeRow | null, userId: string): string {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();

  if (fullName) {
    return user?.handle ? `${fullName} (@${user.handle})` : fullName;
  }

  if (user?.handle) {
    return `@${user.handle}`;
  }

  return userId;
}

function formatCurrentUserScopeSection(
  label: string,
  attachments: readonly AiChatAttachment[]
): string {
  if (attachments.length === 0) {
    return `${label}: none`;
  }

  return [
    `${label}:`,
    ...attachments.map(attachment => `- ${attachment.title} (id: ${attachment.entityId})`),
  ].join('\n');
}

function dedupeAttachments(attachments: readonly AiChatAttachment[]): AiChatAttachment[] {
  const unique = new Map<string, AiChatAttachment>();

  for (const attachment of attachments) {
    unique.set(`${attachment.entityType}:${attachment.entityId}`, attachment);
  }

  return [...unique.values()];
}

function filterAttachmentsByQuery(
  attachments: readonly AiChatAttachment[],
  query?: string | null
): AiChatAttachment[] {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...attachments];
  }

  return attachments.filter(attachment => {
    const haystack = [attachment.title, attachment.subtitle ?? '', attachment.prompt_context ?? '']
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function buildToolSummary(prefix: string, attachments: readonly AiChatAttachment[]): string {
  if (attachments.length === 0) {
    return `${prefix}: keine Treffer.`;
  }

  return `${prefix}: ${attachments.length} Treffer.`;
}

async function loadRelationshipSets(userId: string): Promise<RelationshipSets> {
  return executeZeroRead(async tx => {
    const [groupsData, eventsData, todosData, amendmentsData, blogsData] = await Promise.all([
      tx.run(zql.group_membership.where('user_id', userId)),
      tx.run(zql.event_participant.where('user_id', userId)),
      tx.run(zql.todo_assignment.where('user_id', userId)),
      tx.run(zql.amendment_collaborator.where('user_id', userId)),
      tx.run(zql.blog_blogger.where('user_id', userId)),
    ]);

    return {
      groupIds: new Set(asRows<{ group_id: string }>(groupsData).map(row => row.group_id)),
      eventIds: new Set(asRows<{ event_id: string }>(eventsData).map(row => row.event_id)),
      todoIds: new Set(asRows<{ todo_id: string }>(todosData).map(row => row.todo_id)),
      amendmentIds: new Set(
        asRows<{ amendment_id: string }>(amendmentsData).map(row => row.amendment_id)
      ),
      blogIds: new Set(asRows<{ blog_id: string }>(blogsData).map(row => row.blog_id)),
    };
  });
}

async function assertGroupAccessInTx(
  tx: ZeroTransaction,
  userId: string,
  groupId: string
): Promise<GroupAccessRow> {
  const [groupData, membershipData] = await Promise.all([
    tx.run(zql.group.where('id', groupId).one()),
    tx.run(zql.group_membership.where('group_id', groupId).where('user_id', userId).limit(1)),
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

async function assertEventAccessInTx(
  tx: ZeroTransaction,
  userId: string,
  eventId: string
): Promise<EventAccessRow> {
  const [eventData, participantData] = await Promise.all([
    tx.run(zql.event.where('id', eventId).one()),
    tx.run(zql.event_participant.where('event_id', eventId).where('user_id', userId).limit(1)),
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

async function searchUsers(
  userId: string,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.user
        .where(({ cmp, or }) =>
          or(
            cmp('first_name', 'ILIKE', pattern),
            cmp('last_name', 'ILIKE', pattern),
            cmp('handle', 'ILIKE', pattern)
          )
        )
        .limit(limit)
    );

    return asRows<UserSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, row.id === userId))
      .map(buildUserAttachment);
  });
}

async function searchGroups(
  relationships: RelationshipSets,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(zql.group.where('name', 'ILIKE', pattern).limit(limit));

    return asRows<GroupSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, relationships.groupIds.has(row.id)))
      .map(buildGroupAttachment);
  });
}

async function searchStatements(
  userId: string,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(zql.statement.where('text', 'ILIKE', pattern).limit(limit));

    return asRows<StatementSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, row.user_id === userId))
      .map(buildStatementAttachment);
  });
}

async function searchBlogs(
  relationships: RelationshipSets,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.blog
        .where(({ cmp, or }) =>
          or(cmp('title', 'ILIKE', pattern), cmp('description', 'ILIKE', pattern))
        )
        .limit(limit)
    );

    return asRows<BlogSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, relationships.blogIds.has(row.id)))
      .map(buildBlogAttachment);
  });
}

async function searchAmendments(
  relationships: RelationshipSets,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.amendment
        .where(({ cmp, or }) =>
          or(
            cmp('title', 'ILIKE', pattern),
            cmp('reason', 'ILIKE', pattern),
            cmp('preamble', 'ILIKE', pattern)
          )
        )
        .limit(limit)
    );

    return asRows<AmendmentSearchRow>(data)
      .filter(row =>
        checkEntityAccess(row.visibility, true, relationships.amendmentIds.has(row.id))
      )
      .map(buildAmendmentAttachment);
  });
}

async function searchEvents(
  relationships: RelationshipSets,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.event
        .where(({ cmp, or }) =>
          or(cmp('title', 'ILIKE', pattern), cmp('location_name', 'ILIKE', pattern))
        )
        .limit(limit)
    );

    return asRows<EventSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, relationships.eventIds.has(row.id)))
      .map(buildEventAttachment);
  });
}

async function searchTodos(
  userId: string,
  relationships: RelationshipSets,
  query: string,
  limit: number
): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.todo
        .where(({ cmp, or }) =>
          or(cmp('title', 'ILIKE', pattern), cmp('description', 'ILIKE', pattern))
        )
        .limit(limit)
    );

    return asRows<TodoSearchRow>(data)
      .filter(row =>
        checkEntityAccess(
          row.visibility,
          true,
          row.creator_id === userId || relationships.todoIds.has(row.id)
        )
      )
      .map(buildTodoAttachment);
  });
}

async function searchElections(query: string, limit: number): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.election
        .where(({ cmp, or }) =>
          or(cmp('title', 'ILIKE', pattern), cmp('description', 'ILIKE', pattern))
        )
        .limit(limit)
    );

    return asRows<ElectionSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, false))
      .map(buildElectionAttachment);
  });
}

async function searchVotes(query: string, limit: number): Promise<AiChatAttachment[]> {
  const pattern = toSearchPattern(query);

  return executeZeroRead(async tx => {
    const data = await tx.run(
      zql.vote
        .where(({ cmp, or }) =>
          or(cmp('title', 'ILIKE', pattern), cmp('description', 'ILIKE', pattern))
        )
        .limit(limit)
    );

    return asRows<VoteSearchRow>(data)
      .filter(row => checkEntityAccess(row.visibility, true, false))
      .map(buildVoteAttachment);
  });
}

async function findMyTodos(
  userId: string,
  status?: string | null,
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);

  return executeZeroRead(async tx => {
    const [createdData, assignedIdsData] = await Promise.all([
      tx.run(zql.todo.where('creator_id', userId).limit(totalLimit * 2)),
      tx.run(zql.todo_assignment.where('user_id', userId)),
    ]);

    const assignedIds = dedupeStrings(
      asRows<{ todo_id: string }>(assignedIdsData).map(row => row.todo_id)
    );
    const createdRows = asRows<TodoSearchRow>(createdData);
    const existingIds = new Set(createdRows.map(row => row.id));
    const missingAssignedIds = assignedIds.filter(id => !existingIds.has(id));

    const assignedRows =
      missingAssignedIds.length > 0
        ? asRows<TodoSearchRow>(
            await tx.run(zql.todo.where('id', 'IN', missingAssignedIds).limit(totalLimit * 2))
          )
        : [];

    const requestedStatus = status?.trim();
    const uniqueRows = new Map<string, TodoSearchRow>();

    for (const row of [...createdRows, ...assignedRows]) {
      if (!requestedStatus || row.status === requestedStatus) {
        uniqueRows.set(row.id, row);
      }
    }

    return [...uniqueRows.values()]
      .sort((left, right) => {
        const leftDue = left.due_date ?? Number.MAX_SAFE_INTEGER;
        const rightDue = right.due_date ?? Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }

        return (right.updated_at ?? 0) - (left.updated_at ?? 0);
      })
      .slice(0, totalLimit)
      .map(buildTodoAttachment);
  });
}

async function findMyCalendar(
  userId: string,
  timeframe: 'upcoming' | 'past' | 'all',
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);
  const now = Date.now();

  return executeZeroRead(async tx => {
    const [participantIdsData, createdData] = await Promise.all([
      tx.run(zql.event_participant.where('user_id', userId)),
      tx.run(zql.event.where('creator_id', userId).limit(totalLimit * 2)),
    ]);

    const participantIds = dedupeStrings(
      asRows<{ event_id: string }>(participantIdsData).map(row => row.event_id)
    );
    const createdRows = asRows<EventSearchRow>(createdData);
    const missingParticipantIds = participantIds.filter(
      eventId => !createdRows.some(row => row.id === eventId)
    );

    const participantRows =
      missingParticipantIds.length > 0
        ? asRows<EventSearchRow>(
            await tx.run(zql.event.where('id', 'IN', missingParticipantIds).limit(totalLimit * 2))
          )
        : [];

    const uniqueRows = new Map<string, EventSearchRow>();
    for (const row of [...createdRows, ...participantRows]) {
      uniqueRows.set(row.id, row);
    }

    return [...uniqueRows.values()]
      .filter(row => {
        const startsAt = row.start_date ?? 0;
        if (timeframe === 'upcoming') {
          return startsAt >= now;
        }

        if (timeframe === 'past') {
          return startsAt > 0 && startsAt < now;
        }

        return true;
      })
      .sort((left, right) => {
        if (timeframe === 'past') {
          return Number(right.start_date) - Number(left.start_date);
        }

        return (
          (left.start_date ?? Number.MAX_SAFE_INTEGER) -
          (right.start_date ?? Number.MAX_SAFE_INTEGER)
        );
      })
      .slice(0, totalLimit)
      .map(buildEventAttachment);
  });
}

async function findMyGroups(
  userId: string,
  query?: string | null,
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);

  return executeZeroRead(async tx => {
    const membershipRows = asRows<GroupMembershipRoleRow>(
      await tx.run(zql.group_membership.where('user_id', userId).orderBy('created_at', 'desc'))
    );

    const membershipIds = membershipRows.map(row => row.id);
    const roleRows =
      membershipIds.length > 0
        ? asRows<GroupMembershipRoleLinkRow>(
            await tx.run(
              zql.group_membership_role.where('group_membership_id', 'IN', membershipIds)
            )
          )
        : [];
    const membershipIdsWithRoles = new Set(roleRows.map(row => row.group_membership_id));
    const groupIds = dedupeStrings(
      membershipRows.filter(row => membershipIdsWithRoles.has(row.id)).map(row => row.group_id)
    );

    if (groupIds.length === 0) {
      return [];
    }

    const groupRows = asRows<GroupSearchRow>(await tx.run(zql.group.where('id', 'IN', groupIds)));
    const groupsById = new Map(groupRows.map(row => [row.id, row]));

    const attachments = groupIds
      .map(groupId => groupsById.get(groupId))
      .filter((row): row is GroupSearchRow => Boolean(row))
      .filter(row => checkEntityAccess(row.visibility, true, true))
      .map(buildGroupAttachment);

    return filterAttachmentsByQuery(attachments, query).slice(0, totalLimit);
  });
}

async function findMyAmendments(
  userId: string,
  query?: string | null,
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);

  return executeZeroRead(async tx => {
    const collaboratorRows = asRows<AmendmentCollaboratorRoleRow>(
      await tx.run(
        zql.amendment_collaborator.where('user_id', userId).orderBy('created_at', 'desc')
      )
    );

    const amendmentIds = dedupeStrings(
      collaboratorRows.filter(row => Boolean(row.role_id)).map(row => row.amendment_id)
    );

    if (amendmentIds.length === 0) {
      return [];
    }

    const amendmentRows = asRows<AmendmentSearchRow>(
      await tx.run(zql.amendment.where('id', 'IN', amendmentIds))
    );
    const amendmentsById = new Map(amendmentRows.map(row => [row.id, row]));

    const attachments = amendmentIds
      .map(amendmentId => amendmentsById.get(amendmentId))
      .filter((row): row is AmendmentSearchRow => Boolean(row))
      .filter(row => checkEntityAccess(row.visibility, true, true))
      .map(buildAmendmentAttachment);

    return filterAttachmentsByQuery(attachments, query).slice(0, totalLimit);
  });
}

async function findMyRoleEvents(
  userId: string,
  query?: string | null,
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);

  return executeZeroRead(async tx => {
    const participantRows = asRows<EventParticipantRoleRow>(
      await tx.run(zql.event_participant.where('user_id', userId).orderBy('created_at', 'desc'))
    );

    const participantIds = participantRows.map(row => row.id);
    const roleRows =
      participantIds.length > 0
        ? asRows<EventParticipantRoleLinkRow>(
            await tx.run(
              zql.event_participant_role.where('event_participant_id', 'IN', participantIds)
            )
          )
        : [];
    const participantIdsWithRoles = new Set(roleRows.map(row => row.event_participant_id));
    const eventIds = dedupeStrings(
      participantRows.filter(row => participantIdsWithRoles.has(row.id)).map(row => row.event_id)
    );

    if (eventIds.length === 0) {
      return [];
    }

    const eventRows = asRows<EventSearchRow>(await tx.run(zql.event.where('id', 'IN', eventIds)));
    const eventsById = new Map(eventRows.map(row => [row.id, row]));

    const attachments = eventIds
      .map(eventId => eventsById.get(eventId))
      .filter((row): row is EventSearchRow => Boolean(row))
      .filter(row => checkEntityAccess(row.visibility, true, true))
      .map(buildEventAttachment);

    return filterAttachmentsByQuery(attachments, query).slice(0, totalLimit);
  });
}

async function findMyBlogs(
  userId: string,
  query?: string | null,
  limit?: number
): Promise<AiChatAttachment[]> {
  const totalLimit = clampLimit(limit, 6);

  return executeZeroRead(async tx => {
    const bloggerRows = asRows<BlogBloggerRoleRow>(
      await tx.run(zql.blog_blogger.where('user_id', userId).orderBy('created_at', 'desc'))
    );

    const blogIds = dedupeStrings(
      bloggerRows.filter(row => Boolean(row.role_id)).map(row => row.blog_id)
    );

    if (blogIds.length === 0) {
      return [];
    }

    const blogRows = asRows<BlogSearchRow>(await tx.run(zql.blog.where('id', 'IN', blogIds)));
    const blogsById = new Map(blogRows.map(row => [row.id, row]));

    const attachments = blogIds
      .map(blogId => blogsById.get(blogId))
      .filter((row): row is BlogSearchRow => Boolean(row))
      .filter(row => checkEntityAccess(row.visibility, true, true))
      .map(buildBlogAttachment);

    return filterAttachmentsByQuery(attachments, query).slice(0, totalLimit);
  });
}

export async function buildCurrentUserScopePrompt(userId: string): Promise<string> {
  try {
    const [currentUser, groups, amendments, events, blogs] = await Promise.all([
      executeZeroRead(
        async tx => (await tx.run(zql.user.where('id', userId).one())) as CurrentUserScopeRow | null
      ),
      findMyGroups(userId, null, 12),
      findMyAmendments(userId, null, 12),
      findMyRoleEvents(userId, null, 12),
      findMyBlogs(userId, null, 12),
    ]);

    return [
      `Current user: ${formatCurrentUserDisplayName(currentUser, userId)} (id: ${userId})`,
      formatCurrentUserScopeSection('Role-scoped groups', groups),
      formatCurrentUserScopeSection('Role-scoped amendments', amendments),
      formatCurrentUserScopeSection('Role-scoped events', events),
      formatCurrentUserScopeSection('Role-scoped blogs', blogs),
    ].join('\n\n');
  } catch (error) {
    console.error('Failed to build current user AI scope:', error);
    return `Current user: ${userId}`;
  }
}

async function findGroupResources(
  userId: string,
  groupId: string,
  resourceTypes: readonly GroupResourceType[],
  limit?: number,
  query?: string | null
): Promise<AiChatAttachment[]> {
  const fetchLimit = Math.max(clampLimit(limit, 6) * 4, 20);
  return executeZeroRead(async tx => {
    const group = await assertGroupAccessInTx(tx, userId, groupId);
    const attachments: AiChatAttachment[] = [];

    if (resourceTypes.includes('payments')) {
      const data = await tx.run(
        zql.payment
          .where(({ cmp, or }) =>
            or(cmp('payer_group_id', groupId), cmp('receiver_group_id', groupId))
          )
          .orderBy('created_at', 'desc')
          .limit(fetchLimit)
      );

      attachments.push(
        ...asRows<PaymentRow>(data).map(row => {
          const direction =
            row.receiver_group_id === groupId
              ? 'income'
              : row.payer_group_id === groupId
                ? 'expense'
                : null;

          return buildAttachment(
            'payment',
            row.id,
            row.label || 'Zahlung',
            [
              row.type,
              formatCurrency(row.amount, row.currency ?? 'EUR'),
              formatDate(row.created_at),
            ]
              .filter(Boolean)
              .join(' · '),
            group.name ? `Gruppe: ${group.name}` : null,
            {
              id: row.id,
              type: 'payment',
              title: row.label || 'Zahlung',
              createdAt: toRequiredDate(row.created_at),
              amount: row.amount,
              currency: row.currency ?? 'EUR',
              paymentType: row.type,
              paymentDirection: direction,
              groupId,
              groupName: group.name,
            }
          );
        })
      );
    }

    if (resourceTypes.includes('todos')) {
      const data = await tx.run(
        zql.todo.where('group_id', groupId).orderBy('updated_at', 'desc').limit(fetchLimit)
      );

      attachments.push(...asRows<GroupTodoRow>(data).map(buildTodoAttachment));
    }

    if (resourceTypes.includes('links')) {
      const data = await tx.run(
        zql.link.where('group_id', groupId).orderBy('created_at', 'desc').limit(fetchLimit)
      );

      attachments.push(
        ...asRows<LinkRow>(data).map(row =>
          buildAttachment(
            'link',
            row.id,
            row.label || row.url || 'Link',
            formatDate(row.created_at),
            truncate(row.url)
          )
        )
      );
    }

    if (resourceTypes.includes('amendments') || resourceTypes.includes('files')) {
      const amendmentData = await tx.run(
        zql.amendment.where('group_id', groupId).orderBy('updated_at', 'desc').limit(fetchLimit)
      );

      const amendments = asRows<GroupAmendmentRow>(amendmentData);

      if (resourceTypes.includes('amendments')) {
        attachments.push(...amendments.map(buildAmendmentAttachment));
      }

      if (resourceTypes.includes('files')) {
        const documentIds = dedupeStrings(
          amendments.map(row => row.document_id).filter((value): value is string => Boolean(value))
        );

        if (documentIds.length > 0) {
          const documentData = await tx.run(
            zql.document
              .where('id', 'IN', documentIds)
              .orderBy('updated_at', 'desc')
              .limit(fetchLimit)
          );

          const amendmentByDocumentId = new Map(
            amendments
              .filter((row): row is GroupAmendmentRow & { document_id: string } =>
                Boolean(row.document_id)
              )
              .map(row => [row.document_id, row])
          );

          attachments.push(
            ...asRows<DocumentRow>(documentData).map(row => {
              const amendment = amendmentByDocumentId.get(row.id);
              return buildAttachment(
                'document',
                row.id,
                amendment?.title ? `Datei zu ${amendment.title}` : 'Datei',
                formatDate(row.updated_at),
                amendment?.reason
                  ? truncate(amendment.reason)
                  : group.name
                    ? `Gruppe: ${group.name}`
                    : null
              );
            })
          );
        }
      }
    }

    if (resourceTypes.includes('events')) {
      const data = await tx.run(
        zql.event.where('group_id', groupId).orderBy('start_date', 'asc').limit(fetchLimit)
      );

      attachments.push(...asRows<GroupEventRow>(data).map(buildEventAttachment));
    }

    if (resourceTypes.includes('blogs')) {
      const data = await tx.run(
        zql.blog.where('group_id', groupId).orderBy('updated_at', 'desc').limit(fetchLimit)
      );

      attachments.push(...asRows<GroupBlogRow>(data).map(buildBlogAttachment));
    }

    return filterAttachmentsByQuery(dedupeAttachments(attachments), query).slice(
      0,
      clampLimit(limit, 6)
    );
  });
}

async function findEventResources(
  userId: string,
  eventId: string,
  resourceTypes: readonly EventResourceType[],
  limit?: number,
  query?: string | null
): Promise<AiChatAttachment[]> {
  const fetchLimit = Math.max(clampLimit(limit, 6) * 4, 20);
  return executeZeroRead(async tx => {
    const event = await assertEventAccessInTx(tx, userId, eventId);
    const attachments: AiChatAttachment[] = [];

    const agendaData = await tx.run(
      zql.agenda_item.where('event_id', eventId).orderBy('order_index', 'asc').limit(fetchLimit)
    );

    const agendaItems = asRows<AgendaItemRow>(agendaData);

    if (resourceTypes.includes('agenda_items')) {
      attachments.push(
        ...agendaItems.map(row =>
          buildAttachment(
            'agenda_item',
            row.id,
            row.title || row.type || 'Agenda-Punkt',
            [row.type, row.status, row.scheduled_time].filter(Boolean).join(' · ') || null,
            truncate(row.description),
            {
              id: row.id,
              type: 'agenda_item',
              title: row.title || row.type || 'Agenda-Punkt',
              description: row.description,
              createdAt: toRequiredDate(row.updated_at, row.created_at),
              updatedAt: toOptionalDate(row.updated_at),
              status: row.status,
              agendaItemType: row.type,
              orderIndex: row.order_index,
              scheduledTime: row.scheduled_time,
              durationMinutes: row.duration,
              eventId,
              eventName: event.title,
            }
          )
        )
      );
    }

    if (resourceTypes.includes('amendments')) {
      const amendmentIds = dedupeStrings(
        agendaItems.map(row => row.amendment_id).filter((value): value is string => Boolean(value))
      );

      const [eventAmendments, agendaAmendments] = await Promise.all([
        tx.run(
          zql.amendment.where('event_id', eventId).orderBy('updated_at', 'desc').limit(fetchLimit)
        ),
        amendmentIds.length > 0
          ? tx.run(
              zql.amendment
                .where('id', 'IN', amendmentIds)
                .orderBy('updated_at', 'desc')
                .limit(fetchLimit)
            )
          : Promise.resolve([]),
      ]);

      attachments.push(
        ...[
          ...asRows<EventAmendmentRow>(eventAmendments),
          ...asRows<EventAmendmentRow>(agendaAmendments),
        ].map(buildAmendmentAttachment)
      );
    }

    const agendaItemIds = agendaItems.map(row => row.id);

    if (resourceTypes.includes('elections') && agendaItemIds.length > 0) {
      const data = await tx.run(
        zql.election
          .where('agenda_item_id', 'IN', agendaItemIds)
          .orderBy('updated_at', 'desc')
          .limit(fetchLimit)
      );

      attachments.push(...asRows<EventElectionRow>(data).map(buildElectionAttachment));
    }

    if (resourceTypes.includes('votes') && agendaItemIds.length > 0) {
      const data = await tx.run(
        zql.vote
          .where('agenda_item_id', 'IN', agendaItemIds)
          .orderBy('updated_at', 'desc')
          .limit(fetchLimit)
      );

      attachments.push(...asRows<EventVoteRow>(data).map(buildVoteAttachment));
    }

    const filtered = filterAttachmentsByQuery(dedupeAttachments(attachments), query).slice(
      0,
      clampLimit(limit, 6)
    );

    if (filtered.length === 0 && event.title) {
      return [
        buildAttachment(
          'event',
          event.id,
          event.title,
          null,
          'Für dieses Event wurden in den gewählten Kategorien keine passenden Ressourcen gefunden.'
        ),
      ];
    }

    return filtered;
  });
}

function buildCreateFlowRoute(
  flow: CreateFlowType,
  eventId?: string | null,
  agendaItemType?: AgendaItemType | null
): string {
  const metadata = createFlowMetadata[flow];
  if (flow !== 'agenda-item') {
    return metadata.route;
  }

  const searchParams = new URLSearchParams();
  if (eventId) {
    searchParams.set('eventId', eventId);
  }
  if (agendaItemType) {
    searchParams.set('type', agendaItemType);
  }

  const query = searchParams.toString();
  return query ? `${metadata.route}?${query}` : metadata.route;
}

export function buildAiTools(userId: string, timeZone = 'UTC') {
  return {
    ...buildAiCreateTools(userId, timeZone),
    ...buildAiUpdateTools(userId, timeZone),

    present_findings: tool({
      description:
        'Present two or more synthesized findings, comparisons, or research conclusions as structured UI cards. Do not use this for Polity entities returned by other tools; those already render as entity cards. This tool is presentation-only and does not change data.',
      inputSchema: presentFindingsInputSchema,
      execute: async ({ title, summary, items }) => {
        const presentationId = crypto.randomUUID();
        return {
          summary: `${title}: ${items.length} strukturierte Ergebnisse.`,
          attachments: [] as AiChatAttachment[],
          presentations: [
            {
              type: 'findings' as const,
              id: presentationId,
              title,
              summary: summary ?? null,
              items: items.map((item, index) => ({
                ...item,
                id: `${presentationId}:${index + 1}`,
                badge: item.badge ?? null,
              })),
            },
          ],
        };
      },
    }),

    find_my_todos: tool({
      description: translateText(
        'generated.inline.0643_find_the_current_user_s_own_todos_from_the_to_b7da1691'
      ),
      inputSchema: z.object({
        status: z
          .enum(['pending', 'in_progress', 'completed', 'cancelled'])
          .optional()
          .describe('Optional exact todo status filter.'),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ status, limit }) => {
        const attachments = await findMyTodos(userId, status, limit);
        return {
          summary: buildToolSummary('Eigene Todos', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_my_calendar: tool({
      description: translateText(
        'generated.inline.0644_find_the_current_user_s_calendar_events_simil_bca8cd75'
      ),
      inputSchema: z.object({
        timeframe: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ timeframe, limit }) => {
        const attachments = await findMyCalendar(userId, timeframe, limit);
        return {
          summary: buildToolSummary('Eigener Kalender', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_my_groups: tool({
      description: translateText(
        'generated.inline.0645_find_the_current_user_s_groups_where_they_hav_30902b45'
      ),
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ query, limit }) => {
        const attachments = await findMyGroups(userId, query, limit);
        return {
          summary: buildToolSummary('Eigene Gruppen', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_my_amendments: tool({
      description: translateText(
        'generated.inline.0646_find_the_current_user_s_amendments_where_they_452b78e7'
      ),
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ query, limit }) => {
        const attachments = await findMyAmendments(userId, query, limit);
        return {
          summary: buildToolSummary('Eigene Anträge', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_my_role_events: tool({
      description: translateText(
        'generated.inline.0647_find_the_current_user_s_events_where_they_hav_c150d211'
      ),
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ query, limit }) => {
        const attachments = await findMyRoleEvents(userId, query, limit);
        return {
          summary: buildToolSummary('Eigene Rollen-Events', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_my_blogs: tool({
      description: translateText(
        'generated.inline.0648_find_the_current_user_s_blogs_where_they_have_20345b7a'
      ),
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ query, limit }) => {
        const attachments = await findMyBlogs(userId, query, limit);
        return {
          summary: buildToolSummary('Eigene Blogs', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    search_polity_entities: tool({
      description: translateText(
        'generated.inline.0649_search_across_main_polity_entities_such_as_us_20899de1'
      ),
      inputSchema: z.object({
        query: z.string().trim().min(1),
        entityTypes: z.array(searchEntityTypeSchema).default([...SEARCH_ENTITY_TYPES]),
        limit: z.number().int().min(1).max(12).default(6),
      }),
      execute: async ({ query, entityTypes, limit }) => {
        const relationships = await loadRelationshipSets(userId);
        const totalLimit = clampLimit(limit, 6);
        const resolvedTypes = entityTypes.length > 0 ? entityTypes : [...SEARCH_ENTITY_TYPES];
        const perTypeLimit = Math.max(1, Math.ceil(totalLimit / resolvedTypes.length));
        const attachments = dedupeAttachments(
          (
            await Promise.all(
              resolvedTypes.map(async entityType => {
                switch (entityType) {
                  case 'user':
                    return searchUsers(userId, query, perTypeLimit);
                  case 'group':
                    return searchGroups(relationships, query, perTypeLimit);
                  case 'statement':
                    return searchStatements(userId, query, perTypeLimit);
                  case 'blog':
                    return searchBlogs(relationships, query, perTypeLimit);
                  case 'amendment':
                    return searchAmendments(relationships, query, perTypeLimit);
                  case 'event':
                    return searchEvents(relationships, query, perTypeLimit);
                  case 'todo':
                    return searchTodos(userId, relationships, query, perTypeLimit);
                  case 'election':
                    return searchElections(query, perTypeLimit);
                  case 'vote':
                    return searchVotes(query, perTypeLimit);
                }
              })
            )
          ).flat()
        ).slice(0, totalLimit);

        return {
          summary: buildToolSummary(`Polity-Suche für „${query}”`, attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    read_polity_docs: tool({
      description: translateText('generated.inline.ai_read_polity_docs_tool_description'),
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Optional search query across the docs text.'),
        page: docsPageSlugSchema
          .optional()
          .describe('Optional exact docs page slug. Returns the complete page.'),
        section: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Optional section id to read from an exact page.'),
        language: aiDocsLanguageSchema.default('de'),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, page, section, language, limit }) => {
        const result = readPolityDocs({ query, page, section, language, limit });
        const queryLabel = result.query ? ` für "${result.query}"` : '';
        const returnedCount = result.pages.length + result.matches.length;

        return {
          summary:
            returnedCount === 0
              ? `Polity Docs${queryLabel}: keine Treffer.`
              : `Polity Docs${queryLabel}: ${returnedCount} Treffer.`,
          ...result,
          items: [
            ...result.pages.map(item => ({
              entityType: 'docs_topic',
              entityId: String(item.slug),
              title: item.title,
              subtitle: item.route,
            })),
            ...result.matches.map(item => ({
              entityType: 'docs_topic',
              entityId: `${item.pageSlug}:${item.sectionId ?? 'page'}`,
              title: item.sectionTitle ?? item.pageTitle,
              subtitle: item.route,
            })),
          ],
          attachments: [] as AiChatAttachment[],
        };
      },
    }),

    find_group_resources: tool({
      description: translateText(
        'generated.inline.0650_find_payments_todos_links_amendments_events_b_6f648ebb'
      ),
      inputSchema: z.object({
        groupId: z.string().trim().min(1),
        resourceTypes: z.array(groupResourceTypeSchema).default([...GROUP_RESOURCE_TYPES]),
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).default(6),
      }),
      execute: async ({ groupId, resourceTypes, query, limit }) => {
        const attachments = await findGroupResources(userId, groupId, resourceTypes, limit, query);
        return {
          summary: buildToolSummary('Gruppen-Ressourcen', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    find_event_resources: tool({
      description: translateText(
        'generated.inline.0651_find_agenda_items_amendments_elections_and_vo_61e5ad2b'
      ),
      inputSchema: z.object({
        eventId: z.string().trim().min(1),
        resourceTypes: z.array(eventResourceTypeSchema).default([...EVENT_RESOURCE_TYPES]),
        query: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(12).default(6),
      }),
      execute: async ({ eventId, resourceTypes, query, limit }) => {
        const attachments = await findEventResources(userId, eventId, resourceTypes, limit, query);
        return {
          summary: buildToolSummary('Event-Ressourcen', attachments),
          items: attachments.map(toItemSummary),
          attachments,
        };
      },
    }),

    open_create_flow: tool({
      description: translateText(
        'generated.inline.0652_open_one_of_the_existing_polity_create_flows__cecbfcc1'
      ),
      inputSchema: z.object({
        flow: createFlowTypeSchema,
        eventId: z.string().trim().min(1).optional(),
        agendaItemType: agendaItemTypeSchema.optional(),
      }),
      execute: async ({ flow, eventId, agendaItemType }) => {
        const metadata = createFlowMetadata[flow];
        const route = buildCreateFlowRoute(flow, eventId, agendaItemType);

        return {
          summary: `${metadata.title}: ${route}`,
          flow: {
            key: flow,
            title: metadata.title,
            description: metadata.description,
            route,
          },
          route,
          attachments: [] as AiChatAttachment[],
        };
      },
    }),
  };
}
