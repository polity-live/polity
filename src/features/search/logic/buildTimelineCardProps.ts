import {
  normalizeAmendmentStatus,
  normalizeElectionStatus,
  normalizeVotePhase,
} from './searchNormalizers';
import type { SearchContentItem } from '../types/search.types';
import type { CardType } from '@/features/timeline/ui/LazyCardComponents';

interface PaymentTimelineCardItem {
  id: string;
  type: 'payment';
  title: string;
  description?: string | null;
  createdAt: Date;
  amount?: number | null;
  currency?: string | null;
  paymentType?: string | null;
  paymentDirection?: 'income' | 'expense' | null;
  groupId?: string | null;
  groupName?: string | null;
  counterpartyLabel?: string | null;
  href?: string | null;
}

interface AgendaItemTimelineCardItem {
  id: string;
  type: 'agenda_item';
  title: string;
  description?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  status?: string | null;
  agendaItemType?: string | null;
  orderIndex?: number | null;
  scheduledTime?: string | Date | null;
  durationMinutes?: number | null;
  eventId?: string | null;
  eventName?: string | null;
  href?: string | null;
}

export type TimelineCardItem =
  SearchContentItem | PaymentTimelineCardItem | AgendaItemTimelineCardItem;

export function buildTimelineCardProps(item: TimelineCardItem): {
  cardType: CardType | null;
  cardProps: Record<string, unknown> | null;
} {
  let cardType: CardType | null = item.type as CardType;
  let cardProps: Record<string, unknown> | null = null;

  switch (item.type) {
    case 'group':
      cardProps = {
        href: item.href,
        group: {
          id: item.groupId ?? item.id,
          name: item.title,
          description: item.description,
          memberCount: item.memberCount ?? item.stats?.members,
          eventCount: item.eventCount,
          amendmentCount: item.amendmentCount,
          topics: item.tags,
          isFollowing: false,
        },
      };
      break;
    case 'event':
      cardProps = {
        href: item.href,
        event: {
          id: item.eventId ?? item.id,
          title: item.title,
          description: item.description,
          startDate: item.startDate ?? item.createdAt,
          endDate: item.endDate,
          location: item.location,
          city: item.city,
          postcode: item.postcode,
          attendeeCount: item.attendeeCount,
          electionsCount: item.electionsCount,
          amendmentsCount: item.amendmentsCount,
          hashtags: (item.tags ?? []).map(tag => ({ id: tag, tag })),
          organizerName: item.authorName ?? item.authorId ?? undefined,
          organizerId: item.authorId ?? undefined,
          groupName: item.groupName,
          groupId: item.groupId,
          archived: item.archived,
          isAttending: false,
        },
      };
      break;
    case 'amendment':
      cardProps = {
        href: item.href,
        amendment: {
          id: item.id,
          title: item.title,
          description: item.description,
          status: normalizeAmendmentStatus(item.status ?? undefined),
          groupName: item.groupName,
          collaboratorCount: item.collaboratorCount,
          supportingGroupsCount: item.supportingGroupsCount,
          changeRequestCount: item.changeRequestCount,
          hashtags: (item.tags ?? []).map(tag => ({ id: tag, tag })),
        },
      };
      break;
    case 'agenda_item':
      cardProps = {
        href: item.href,
        agendaItem: {
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.agendaItemType,
          status: item.status,
          orderIndex: item.orderIndex,
          scheduledTime: item.scheduledTime,
          durationMinutes: item.durationMinutes,
          eventId: item.eventId,
          eventName: item.eventName,
          createdAt: item.createdAt,
        },
      };
      break;
    case 'blog':
      cardProps = {
        href: item.href,
        blog: {
          id: item.id,
          title: item.title,
          excerpt: item.description,
          coverImageUrl: item.imageUrl,
          authorName: item.authorName,
          authorAvatar: item.authorAvatar,
          authorId: item.authorId,
          groupId: item.groupId,
          publishedAt: item.createdAt,
          hashtags: (item.tags ?? []).map(tag => ({ id: tag, tag })),
          commentCount: item.commentCount ?? item.stats?.comments,
        },
      };
      break;
    case 'statement':
      cardProps = {
        href: item.href,
        statement: {
          id: item.id,
          title: item.title,
          content: item.description || item.title,
          authorName: item.authorName || item.authorId || '',
          authorAvatar: item.authorAvatar,
          imageUrl: item.imageUrl,
          videoUrl: item.videoUrl,
          groupName: item.groupName,
          groupAvatar: item.groupImageUrl,
          groupId: item.groupId,
          supportCount: item.upvotes ?? 0,
          opposeCount: item.downvotes ?? 0,
          commentCount: item.commentCount ?? item.stats?.comments,
          surveyQuestion: item.surveyQuestion,
          surveyOptions: item.surveyOptions,
          hashtags: (item.tags ?? []).map(tag => ({ id: tag, tag })),
        },
      };
      break;
    case 'todo':
      cardProps = {
        href: item.href,
        todo: {
          id: item.id,
          title: item.title,
          description: item.description,
          isCompleted: item.isCompleted,
          dueDate: item.dueDate,
          assigneeCount: item.assigneeCount,
          groupName: item.groupName,
          groupId: item.groupId,
        },
      };
      break;
    case 'payment':
      cardProps = {
        href: item.href,
        payment: {
          id: item.id,
          label: item.title,
          description: item.description,
          amount: item.amount,
          currency: item.currency,
          type: item.paymentType,
          direction: item.paymentDirection,
          createdAt: item.createdAt,
          groupId: item.groupId,
          groupName: item.groupName,
          counterpartyLabel: item.counterpartyLabel,
        },
      };
      break;
    case 'user':
      cardProps = {
        href: item.href,
        user: {
          id: item.id,
          name: item.title,
          handle: item.handle,
          bio: item.description,
          subtitle: item.subtitle,
          avatarUrl: item.authorAvatar,
          location: item.location,
          groupCount: item.groupCount,
          amendmentCount: item.amendmentCount,
          hashtags: (item.tags ?? []).map(tag => ({ id: tag, tag })),
        },
      };
      break;
    case 'vote': {
      const supportCount = item.stats?.reactions ?? 0;
      const opposeCount = item.stats?.comments ?? 0;
      const totalVotes = supportCount + opposeCount;
      const supportPercentage = totalVotes > 0 ? Math.round((supportCount / totalVotes) * 100) : 0;

      cardProps = {
        href: item.href,
        vote: {
          id: item.id,
          amendmentId: item.id,
          amendmentTitle: item.title,
          question: item.description,
          status: normalizeVotePhase(item.status ?? undefined),
          endTime: item.endDate ?? item.updatedAt ?? item.createdAt,
          supportPercentage,
          supportCount,
          opposeCount,
          agendaEventId: item.agendaEventId,
          agendaItemId: item.agendaItemId,
        },
      };
      break;
    }
    case 'election':
      cardProps = {
        href: item.href,
        election: {
          id: item.id,
          title: item.title,
          roleName: item.title,
          groupId: item.groupId,
          groupName: item.groupName,
          status: normalizeElectionStatus(item.status ?? undefined),
          candidates: item.candidates || [],
          totalCandidates: item.totalCandidates || 0,
          votingEndDate: item.endDate,
          agendaEventId: item.agendaEventId,
          agendaItemId: item.agendaItemId,
        },
      };
      break;
    case 'video':
      cardProps = {
        href: item.href,
        video: {
          id: item.id,
          title: item.title,
          thumbnailUrl: item.imageUrl,
          videoUrl: item.videoUrl,
          views: item.stats?.views,
          likes: item.stats?.reactions,
          authorName: item.authorName,
          authorAvatar: item.authorAvatar,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceName: item.groupName,
        },
      };
      break;
    case 'image':
      if (!item.imageUrl) {
        cardType = null;
        break;
      }

      cardProps = {
        href: item.href,
        image: {
          id: item.id,
          imageUrl: item.imageUrl,
          caption: item.description,
          location: item.location,
          likes: item.stats?.reactions,
          comments: item.stats?.comments,
          authorName: item.authorName,
          authorAvatar: item.authorAvatar,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceName: item.groupName,
        },
      };
      break;
    default:
      cardType = null;
  }

  return { cardType, cardProps };
}
