import { getContentTypeToneClasses, getEntityGradientClasses } from '@/features/shared/theme';
import {
  Building2,
  Calendar,
  ScrollText,
  Vote,
  Award,
  Video,
  Image,
  Quote,
  CheckSquare,
  BookOpen,
  Zap,
  User,
  ListOrdered,
  Wallet,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';

/**
 * Content type configuration for the Pinterest-style timeline
 * Each content type has an icon, label key, default gradient, and accent color
 */

export type ContentType =
  | 'group'
  | 'event'
  | 'meetup'
  | 'amendment'
  | 'agenda_item'
  | 'vote'
  | 'election'
  | 'video'
  | 'image'
  | 'statement'
  | 'todo'
  | 'blog'
  | 'payment'
  | 'action'
  | 'workflow'
  | 'user';

export interface ContentTypeConfig {
  icon: LucideIcon;
  labelKey: string;
  gradient: string;
  gradientDark: string;
  accentColor: string;
  borderColor: string;
}

function createContentTypeConfig(
  type: ContentType,
  icon: LucideIcon,
  labelKey: string
): ContentTypeConfig {
  const tone = getContentTypeToneClasses(type);

  return {
    icon,
    labelKey,
    gradient: getEntityGradientClasses(type),
    gradientDark: '',
    accentColor: tone.text,
    borderColor: tone.border,
  };
}

export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
  group: createContentTypeConfig('group', Building2, 'features.timeline.contentTypes.group'),
  event: createContentTypeConfig('event', Calendar, 'features.timeline.contentTypes.event'),
  meetup: createContentTypeConfig('meetup', Video, 'features.timeline.contentTypes.meetup'),
  amendment: createContentTypeConfig(
    'amendment',
    ScrollText,
    'features.timeline.contentTypes.amendment'
  ),
  agenda_item: createContentTypeConfig(
    'agenda_item',
    ListOrdered,
    'features.timeline.contentTypes.agendaItem'
  ),
  vote: createContentTypeConfig('vote', Vote, 'features.timeline.contentTypes.vote'),
  election: createContentTypeConfig('election', Award, 'features.timeline.contentTypes.election'),
  video: createContentTypeConfig('video', Video, 'features.timeline.contentTypes.video'),
  image: createContentTypeConfig('image', Image, 'features.timeline.contentTypes.image'),
  statement: createContentTypeConfig(
    'statement',
    Quote,
    'features.timeline.contentTypes.statement'
  ),
  todo: createContentTypeConfig('todo', CheckSquare, 'features.timeline.contentTypes.todo'),
  blog: createContentTypeConfig('blog', BookOpen, 'features.timeline.contentTypes.blog'),
  payment: createContentTypeConfig('payment', Wallet, 'features.timeline.contentTypes.payment'),
  action: createContentTypeConfig('action', Zap, 'features.timeline.contentTypes.action'),
  workflow: createContentTypeConfig(
    'workflow',
    GitBranch,
    'features.timeline.contentTypes.workflow'
  ),
  user: createContentTypeConfig('user', User, 'features.timeline.contentTypes.user'),
};

/**
 * Get the full gradient class for a content type
 */
export function getContentTypeGradient(type: ContentType): string {
  return getEntityGradientClasses(type);
}

/**
 * Content type labels for i18n
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  group: 'features.timeline.contentTypes.group',
  event: 'features.timeline.contentTypes.event',
  meetup: 'features.timeline.contentTypes.meetup',
  amendment: 'features.timeline.contentTypes.amendment',
  agenda_item: 'features.timeline.contentTypes.agendaItem',
  vote: 'features.timeline.contentTypes.vote',
  election: 'features.timeline.contentTypes.election',
  video: 'features.timeline.contentTypes.video',
  image: 'features.timeline.contentTypes.image',
  statement: 'features.timeline.contentTypes.statement',
  todo: 'features.timeline.contentTypes.todo',
  blog: 'features.timeline.contentTypes.blog',
  payment: 'features.timeline.contentTypes.payment',
  action: 'features.timeline.contentTypes.action',
  workflow: 'features.timeline.contentTypes.workflow',
  user: 'features.timeline.contentTypes.user',
};
