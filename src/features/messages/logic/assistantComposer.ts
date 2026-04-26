import { buildTimelineCardProps } from '@/features/search/logic/buildTimelineCardProps';
import { toDate } from '@/features/search/logic/searchMappers';
import type { SearchContentItem } from '@/features/search/types/search.types';
import type { AiAttachmentEntity, AiChatAttachment } from '@/server/ai-types';
import type { CardType } from '@/features/timeline/ui/LazyCardComponents';
import type { VoteWithDetailsRow } from '@/zero/votes/queries';

export interface AssistantCardPayload {
  cardType: CardType;
  cardProps: Record<string, unknown>;
}

export interface AssistantAttachmentOption {
  key: string;
  entityType: AiAttachmentEntity;
  label: string;
  subtitle?: string | null;
  searchText: string;
  attachment: AiChatAttachment;
}

export interface ActiveMentionQuery {
  start: number;
  end: number;
  raw: string;
  entityType?: AiAttachmentEntity;
  searchText: string;
}

export interface ActiveSkillCommand {
  start: number;
  end: number;
  raw: string;
  searchText: string;
}

export const ASSISTANT_ATTACHMENT_TYPE_OPTIONS: readonly {
  entityType: AiAttachmentEntity;
  token: string;
  label: string;
}[] = [
  { entityType: 'user', token: '@user@', label: 'People' },
  { entityType: 'group', token: '@group@', label: 'Groups' },
  { entityType: 'event', token: '@event@', label: 'Events' },
  { entityType: 'amendment', token: '@amendment@', label: 'Amendments' },
  { entityType: 'blog', token: '@blog@', label: 'Blogs' },
  { entityType: 'todo', token: '@todo@', label: 'Todos' },
  { entityType: 'vote', token: '@vote@', label: 'Votes' },
  { entityType: 'election', token: '@election@', label: 'Elections' },
] as const;

const AI_ATTACHMENT_ENTITY_SET = new Set<AiAttachmentEntity>([
  'user',
  'group',
  'blog',
  'amendment',
  'event',
  'todo',
  'vote',
  'election',
]);

function isAiAttachmentEntity(value: string): value is AiAttachmentEntity {
  return AI_ATTACHMENT_ENTITY_SET.has(value as AiAttachmentEntity);
}

function safeText(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

function formatCount(label: string, value?: number | null): string {
  if (!value) {
    return '';
  }

  return `${value} ${label}`;
}

function buildSubtitle(item: SearchContentItem): string | null {
  switch (item.type) {
    case 'user':
      return item.handle ? `@${item.handle}` : (item.location ?? null);
    case 'group':
      return formatCount('members', item.memberCount ?? item.stats?.members);
    case 'event':
      return [item.groupName, item.location].filter(Boolean).join(' · ') || null;
    case 'amendment':
      return [item.groupName, item.status].filter(Boolean).join(' · ') || null;
    case 'blog':
      return [item.authorName, item.groupName].filter(Boolean).join(' · ') || null;
    case 'todo':
      return (
        [item.groupName, item.dueDate ? safeText(item.dueDate) : ''].filter(Boolean).join(' · ') ||
        null
      );
    case 'vote':
      return item.status ?? null;
    case 'election':
      return [item.groupName, item.status].filter(Boolean).join(' · ') || null;
    default:
      return null;
  }
}

function buildPromptContext(item: SearchContentItem): string | null {
  const lines: string[] = [];

  if (item.description) {
    lines.push(item.description);
  }

  switch (item.type) {
    case 'group':
      lines.push(
        [
          formatCount('members', item.memberCount ?? item.stats?.members),
          formatCount('events', item.eventCount),
          formatCount('amendments', item.amendmentCount),
        ]
          .filter(Boolean)
          .join(', ')
      );
      break;
    case 'event':
      lines.push(
        [
          item.groupName,
          item.startDate ? `Starts ${safeText(item.startDate)}` : '',
          item.location,
          formatCount('agenda elections', item.electionsCount),
          formatCount('agenda amendments', item.amendmentsCount),
        ]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    case 'amendment':
      lines.push(
        [
          item.groupName,
          formatCount('collaborators', item.collaboratorCount),
          formatCount('change requests', item.changeRequestCount),
        ]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    case 'blog':
      lines.push([item.authorName, item.groupName].filter(Boolean).join(' | '));
      break;
    case 'todo':
      lines.push(
        [
          item.groupName,
          item.dueDate ? `Due ${safeText(item.dueDate)}` : '',
          formatCount('assignees', item.assigneeCount),
        ]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    case 'user':
      lines.push(
        [
          item.handle ? `@${item.handle}` : '',
          item.location,
          formatCount('groups', item.groupCount),
          formatCount('amendments', item.amendmentCount),
        ]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    case 'vote':
      lines.push(
        [
          item.status,
          formatCount('support', item.stats?.reactions),
          formatCount('oppose', item.stats?.comments),
        ]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    case 'election':
      lines.push(
        [item.groupName, item.status, formatCount('candidates', item.totalCandidates)]
          .filter(Boolean)
          .join(' | ')
      );
      break;
    default:
      break;
  }

  const result = lines
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
  return result || null;
}

function toAttachmentEntity(itemType: SearchContentItem['type']): AiAttachmentEntity | null {
  switch (itemType) {
    case 'user':
    case 'group':
    case 'blog':
    case 'amendment':
    case 'event':
    case 'todo':
    case 'vote':
    case 'election':
      return itemType;
    default:
      return null;
  }
}

export function replaceTextRange(
  value: string,
  start: number,
  end: number,
  nextValue: string
): string {
  return `${value.slice(0, start)}${nextValue}${value.slice(end)}`;
}

export function parseActiveMentionQuery(
  value: string,
  caretPosition: number
): ActiveMentionQuery | null {
  const beforeCaret = value.slice(0, caretPosition);
  const mentionMatch = /(?:^|[\s(])(@[^\s\n]*)$/.exec(beforeCaret);

  if (!mentionMatch) {
    return null;
  }

  const raw = mentionMatch[1];
  const atIndex = beforeCaret.length - raw.length;
  if (raw.includes('\n')) {
    return null;
  }

  const withoutAt = raw.slice(1);
  const secondAtIndex = withoutAt.indexOf('@');
  if (secondAtIndex === -1) {
    return {
      start: atIndex,
      end: caretPosition,
      raw,
      searchText: withoutAt.trim().toLowerCase(),
    };
  }

  const candidateType = withoutAt.slice(0, secondAtIndex).trim().toLowerCase();
  const entityType = isAiAttachmentEntity(candidateType) ? candidateType : undefined;

  return {
    start: atIndex,
    end: caretPosition,
    raw,
    entityType,
    searchText: withoutAt
      .slice(secondAtIndex + 1)
      .trim()
      .toLowerCase(),
  };
}

export function parseActiveSkillCommand(
  value: string,
  caretPosition: number
): ActiveSkillCommand | null {
  const beforeCaret = value.slice(0, caretPosition);

  if (!beforeCaret.startsWith('/')) {
    return null;
  }

  const commandEnd = beforeCaret.indexOf(' ');
  if (commandEnd !== -1) {
    return null;
  }

  return {
    start: 0,
    end: caretPosition,
    raw: beforeCaret,
    searchText: beforeCaret.slice(1).trim().toLowerCase(),
  };
}

export function slugifySkillName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildAssistantAttachmentOption(
  item: SearchContentItem
): AssistantAttachmentOption | null {
  const entityType = toAttachmentEntity(item.type);
  if (!entityType) {
    return null;
  }

  const { cardType, cardProps } = buildTimelineCardProps(item);
  if (!cardType || !cardProps) {
    return null;
  }

  const subtitle = buildSubtitle(item);
  const promptContext = buildPromptContext(item);
  const cardPayload: AssistantCardPayload = { cardType, cardProps };

  return {
    key: `${entityType}:${item.id}`,
    entityType,
    label: item.title,
    subtitle,
    searchText: [
      item.title,
      subtitle,
      item.description,
      item.groupName,
      item.location,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    attachment: {
      entityType,
      entityId: item.id,
      title: item.title,
      subtitle,
      prompt_context: promptContext,
      card_data_json: JSON.stringify(cardPayload),
    },
  };
}

function countDecisionsForChoice(
  choiceId: string | undefined,
  decisions:
    | readonly { choice?: { id?: string | null } | null; choice_id?: string | null }[]
    | undefined
): number {
  if (!choiceId || !decisions) {
    return 0;
  }

  return decisions.filter(
    decision => decision.choice?.id === choiceId || decision.choice_id === choiceId
  ).length;
}

export function buildVoteSearchItem(vote: VoteWithDetailsRow[number]): SearchContentItem {
  const firstChoiceId = vote.choices?.[0]?.id;
  const secondChoiceId = vote.choices?.[1]?.id;
  const supportCount =
    countDecisionsForChoice(firstChoiceId, vote.final_decisions) ||
    countDecisionsForChoice(firstChoiceId, vote.indicative_decisions);
  const opposeCount =
    countDecisionsForChoice(secondChoiceId, vote.final_decisions) ||
    countDecisionsForChoice(secondChoiceId, vote.indicative_decisions);

  return {
    id: vote.id,
    type: 'vote',
    title: vote.title || vote.amendment?.title || 'Vote',
    description: vote.description || vote.amendment?.reason || vote.amendment?.preamble,
    createdAt: toDate(vote.created_at),
    updatedAt: vote.updated_at ? toDate(vote.updated_at) : undefined,
    endDate: vote.closing_end_time ? toDate(vote.closing_end_time) : undefined,
    status: vote.status,
    agendaEventId: vote.agenda_item?.event?.id,
    agendaItemId: vote.agenda_item?.id,
    stats: {
      reactions: supportCount,
      comments: opposeCount,
      members: vote.voters?.length,
    },
  };
}
