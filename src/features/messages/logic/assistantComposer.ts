import { buildTimelineCardProps } from '@/features/search/logic/buildTimelineCardProps';
import { toDate } from '@/features/search/logic/searchMappers';
import type { SearchContentItem } from '@/features/search/types/search.types';
import type { AiAttachmentEntity, AiChatAttachment } from '@/lib/ai/schemas';
import type { CardType } from '@/features/timeline/ui/LazyCardComponents';
import type { VoteWithDetailsRow } from '@/zero/votes/queries';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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

export interface ActiveToolCommand {
  start: number;
  end: number;
  raw: string;
  searchText: string;
}

export interface SuggestionAnchorPosition {
  left: number;
  top: number;
  width: number;
}

export const ASSISTANT_ATTACHMENT_TYPE_OPTIONS = [
  {
    entityType: 'user',
    token: '@user@',
    label: translateText('generated.inline.0177_people_b37554f6'),
  },
  {
    entityType: 'group',
    token: '@group@',
    label: translateText('generated.inline.0024_groups_ae9629f4'),
  },
  {
    entityType: 'statement',
    token: '@statement@',
    label: translateText('generated.inline.0178_statements_5653cebc'),
  },
  {
    entityType: 'event',
    token: '@event@',
    label: translateText('generated.inline.0026_events_c5497bca'),
  },
  {
    entityType: 'amendment',
    token: '@amendment@',
    label: translateText('generated.inline.0179_amendments_90086687'),
  },
  {
    entityType: 'blog',
    token: '@blog@',
    label: translateText('generated.inline.0030_blogs_5ef44397'),
  },
  {
    entityType: 'todo',
    token: '@todo@',
    label: translateText('generated.inline.0180_todos_a4114a83'),
  },
  {
    entityType: 'vote',
    token: '@vote@',
    label: translateText('generated.inline.0181_votes_b66c4b27'),
  },
  {
    entityType: 'election',
    token: '@election@',
    label: translateText('generated.inline.0182_elections_7213288b'),
  },
] as const satisfies readonly {
  entityType: AiAttachmentEntity;
  token: string;
  label: string;
}[];

type AssistantSearchAttachmentEntity =
  (typeof ASSISTANT_ATTACHMENT_TYPE_OPTIONS)[number]['entityType'];

const AI_ATTACHMENT_ENTITY_SET = new Set<AssistantSearchAttachmentEntity>([
  'user',
  'group',
  'statement',
  'blog',
  'amendment',
  'event',
  'todo',
  'vote',
  'election',
]);

function isAiAttachmentEntity(value: string): value is AssistantSearchAttachmentEntity {
  return AI_ATTACHMENT_ENTITY_SET.has(value as AssistantSearchAttachmentEntity);
}

function safeText(value: string | number | Date): string {
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

function buildSubtitle(
  item: SearchContentItem,
  entityType: AssistantSearchAttachmentEntity
): string | null {
  switch (entityType) {
    case 'user':
      return item.handle ? `@${item.handle}` : (item.location ?? null);
    case 'group':
      return formatCount('members', item.memberCount ?? item.stats?.members);
    case 'statement':
      return [item.authorName, item.groupName].filter(Boolean).join(' · ') || null;
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
  }
}

function buildPromptContext(
  item: SearchContentItem,
  entityType: AssistantSearchAttachmentEntity
): string | null {
  const lines: string[] = [];

  if (item.description) {
    lines.push(item.description);
  }

  switch (entityType) {
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
    case 'statement':
      lines.push(
        [item.authorName, item.groupName, item.surveyQuestion].filter(Boolean).join(' | ')
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
  }

  const result = lines
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
  return result || null;
}

function toAttachmentEntity(
  itemType: SearchContentItem['type']
): AssistantSearchAttachmentEntity | null {
  switch (itemType) {
    case 'user':
    case 'group':
    case 'statement':
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

const SUGGESTION_PANEL_MAX_WIDTH = 360;

export function getSuggestionAnchorPosition(
  textarea: HTMLTextAreaElement,
  value: string,
  anchorIndex: number
): SuggestionAnchorPosition | null {
  if (anchorIndex < 0 || anchorIndex > value.length) {
    return null;
  }

  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.left = '-9999px';
  mirror.style.top = '0';
  mirror.style.boxSizing = computedStyle.boxSizing;
  mirror.style.width = `${textarea.offsetWidth}px`;
  mirror.style.paddingTop = computedStyle.paddingTop;
  mirror.style.paddingRight = computedStyle.paddingRight;
  mirror.style.paddingBottom = computedStyle.paddingBottom;
  mirror.style.paddingLeft = computedStyle.paddingLeft;
  mirror.style.borderTopWidth = computedStyle.borderTopWidth;
  mirror.style.borderRightWidth = computedStyle.borderRightWidth;
  mirror.style.borderBottomWidth = computedStyle.borderBottomWidth;
  mirror.style.borderLeftWidth = computedStyle.borderLeftWidth;
  mirror.style.borderTopStyle = computedStyle.borderTopStyle;
  mirror.style.borderRightStyle = computedStyle.borderRightStyle;
  mirror.style.borderBottomStyle = computedStyle.borderBottomStyle;
  mirror.style.borderLeftStyle = computedStyle.borderLeftStyle;
  mirror.style.fontFamily = computedStyle.fontFamily;
  mirror.style.fontSize = computedStyle.fontSize;
  mirror.style.fontWeight = computedStyle.fontWeight;
  mirror.style.fontStyle = computedStyle.fontStyle;
  mirror.style.letterSpacing = computedStyle.letterSpacing;
  mirror.style.lineHeight = computedStyle.lineHeight;
  mirror.style.textTransform = computedStyle.textTransform;
  mirror.style.textIndent = computedStyle.textIndent;
  mirror.style.textAlign = computedStyle.textAlign;
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordBreak = 'break-word';
  mirror.style.overflowWrap = 'break-word';

  const prefixText = value.slice(0, anchorIndex);
  mirror.textContent = prefixText;

  const marker = document.createElement('span');
  marker.textContent = value.slice(anchorIndex, anchorIndex + 1) || '@';
  mirror.append(marker);
  document.body.append(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  const availableWidth = Math.max(textarea.clientWidth - 16, 0);
  if (availableWidth === 0) {
    return null;
  }

  const width = Math.min(SUGGESTION_PANEL_MAX_WIDTH, availableWidth);
  const maxLeft = Math.max(8, textarea.clientWidth - width - 8);
  const left = Math.min(
    Math.max(markerRect.left - mirrorRect.left - textarea.scrollLeft, 8),
    maxLeft
  );

  return {
    left,
    top: markerRect.top - mirrorRect.top - textarea.scrollTop,
    width,
  };
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

export function parseActiveToolCommand(
  value: string,
  caretPosition: number
): ActiveToolCommand | null {
  const beforeCaret = value.slice(0, caretPosition);
  const toolMatch = /(?:^|[\s(])(#[^\s\n]*)$/.exec(beforeCaret);

  if (!toolMatch) {
    return null;
  }

  const raw = toolMatch[1];
  const hashIndex = beforeCaret.length - raw.length;
  return {
    start: hashIndex,
    end: caretPosition,
    raw,
    searchText: raw.slice(1).trim().toLowerCase(),
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

  const subtitle = buildSubtitle(item, entityType);
  const promptContext = buildPromptContext(item, entityType);
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
    readonly { choice?: { id?: string | null } | null; choice_id?: string | null }[] | undefined
): number {
  if (!choiceId || !decisions) {
    return 0;
  }

  return decisions.filter(
    decision => decision.choice?.id === choiceId || decision.choice_id === choiceId
  ).length;
}

export function buildVoteSearchItem(vote: VoteWithDetailsRow): SearchContentItem {
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
    title: vote.title || vote.amendment?.title || translateText('common.entities.vote'),
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
