import { richTextToPlainText } from '@/features/shared/logic/richText';
import {
  buildTimelineCardProps,
  type TimelineCardItem,
} from '@/features/search/logic/buildTimelineCardProps';

interface AttachmentCardDataOption {
  key: string;
  attachment: {
    card_data_json?: string | null;
  };
}

export interface AgendaItemCardDataSource {
  id: string;
  title?: string | null;
  description?: unknown;
  type?: string | null;
  status?: string | null;
  order_index?: number | null;
  scheduled_time?: string | null;
  duration?: number | null;
  event_id?: string | null;
  event?: {
    title?: string | null;
  } | null;
  created_at?: number | string | Date | null;
  updated_at?: number | string | Date | null;
}

function toDate(value?: number | string | Date | null): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

function toDescription(value: AgendaItemCardDataSource['description']): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  const text = richTextToPlainText(value);
  return text.length > 0 ? text : null;
}

function buildAgendaItemCardData(agendaItem: AgendaItemCardDataSource): string | null {
  const createdAt = toDate(agendaItem.updated_at) ?? toDate(agendaItem.created_at) ?? new Date(0);
  const updatedAt = toDate(agendaItem.updated_at);
  const searchItem: TimelineCardItem = {
    id: agendaItem.id,
    type: 'agenda_item',
    title: agendaItem.title || agendaItem.type || 'Agenda Item',
    description: toDescription(agendaItem.description),
    createdAt,
    updatedAt,
    status: agendaItem.status,
    agendaItemType: agendaItem.type,
    orderIndex: agendaItem.order_index,
    scheduledTime: agendaItem.scheduled_time,
    durationMinutes: agendaItem.duration,
    eventId: agendaItem.event_id,
    eventName: agendaItem.event?.title ?? undefined,
  };

  const { cardType, cardProps } = buildTimelineCardProps(searchItem);
  if (!cardType || !cardProps) {
    return null;
  }

  return JSON.stringify({ cardType, cardProps });
}

export function buildAttachmentCardDataIndex({
  attachmentOptions,
  agendaItems,
}: {
  attachmentOptions: readonly AttachmentCardDataOption[];
  agendaItems: readonly AgendaItemCardDataSource[];
}): Map<string, string> {
  const cardDataByKey = new Map<string, string>();

  for (const option of attachmentOptions) {
    if (option.attachment.card_data_json) {
      cardDataByKey.set(option.key, option.attachment.card_data_json);
    }
  }

  for (const agendaItem of agendaItems) {
    const key = `agenda_item:${agendaItem.id}`;
    if (cardDataByKey.has(key)) {
      continue;
    }

    const cardDataJson = buildAgendaItemCardData(agendaItem);
    if (cardDataJson) {
      cardDataByKey.set(key, cardDataJson);
    }
  }

  return cardDataByKey;
}
