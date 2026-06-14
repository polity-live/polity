import { featureThemeClassName } from '@/features/shared/theme';
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

export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
  group: {
    icon: Building2,
    labelKey: 'features.timeline.contentTypes.group',
    gradient: featureThemeClassName('timelineContentTypeConfigSuccessInfoGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigSuccessInfoGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('authNameStepSuccessText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigSuccessBorder'),
  },
  event: {
    icon: Calendar,
    labelKey: 'features.timeline.contentTypes.event',
    gradient: featureThemeClassName('timelineContentTypeConfigWarningGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigWarningGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('decisionterminalCountdownTimerWarningText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigWarningBorder'),
  },
  meetup: {
    icon: Video,
    labelKey: 'features.timeline.contentTypes.meetup',
    gradient: featureThemeClassName('timelineContentTypeConfigInfoAccentGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigInfoAccentGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigInfoText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigInfoBorder'),
  },
  amendment: {
    icon: ScrollText,
    labelKey: 'features.timeline.contentTypes.amendment',
    gradient: featureThemeClassName('timelineContentTypeConfigInfoAccentGradientSurfaceBeta'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigInfoAccentGradientSurfaceGamma'),
    accentColor: featureThemeClassName('timelineContentTypeConfigAccentText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigAccentBorder'),
  },
  agenda_item: {
    icon: ListOrdered,
    labelKey: 'features.timeline.contentTypes.agendaItem',
    gradient: featureThemeClassName('timelineContentTypeConfigInfoGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigInfoGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigInfoText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigInfoBorder'),
  },
  vote: {
    icon: Vote,
    labelKey: 'features.timeline.contentTypes.vote',
    gradient: featureThemeClassName('timelineContentTypeConfigDangerWarningGradientSurface'),
    gradientDark: featureThemeClassName(
      'timelineContentTypeConfigDangerWarningGradientSurfaceAlpha'
    ),
    accentColor: featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha'),
    borderColor: featureThemeClassName('timelineContentTypeConfigDangerBorder'),
  },
  election: {
    icon: Award,
    labelKey: 'features.timeline.contentTypes.election',
    gradient: featureThemeClassName('timelineContentTypeConfigDangerAccentGradientSurface'),
    gradientDark: featureThemeClassName(
      'timelineContentTypeConfigDangerAccentGradientSurfaceAlpha'
    ),
    accentColor: featureThemeClassName('timelineContentTypeConfigDangerText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigDangerBorderAlpha'),
  },
  video: {
    icon: Video,
    labelKey: 'features.timeline.contentTypes.video',
    gradient: featureThemeClassName('timelineContentTypeConfigDangerAccentGradientSurfaceBeta'),
    gradientDark: featureThemeClassName(
      'timelineContentTypeConfigDangerAccentGradientSurfaceGamma'
    ),
    accentColor: featureThemeClassName('timelineContentTypeConfigDangerText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigDangerBorderAlpha'),
  },
  image: {
    icon: Image,
    labelKey: 'features.timeline.contentTypes.image',
    gradient: featureThemeClassName('timelineContentTypeConfigInfoGradientSurfaceBeta'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigInfoGradientSurfaceGamma'),
    accentColor: featureThemeClassName('timelineContentTypeConfigInfoTextAlpha'),
    borderColor: featureThemeClassName('timelineContentTypeConfigInfoBorder'),
  },
  statement: {
    icon: Quote,
    labelKey: 'features.timeline.contentTypes.statement',
    gradient: featureThemeClassName('timelineContentTypeConfigAccentGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigAccentGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigAccentTextAlpha'),
    borderColor: featureThemeClassName('timelineContentTypeConfigAccentBorderAlpha'),
  },
  todo: {
    icon: CheckSquare,
    labelKey: 'features.timeline.contentTypes.todo',
    gradient: featureThemeClassName('timelineContentTypeConfigSuccessGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigSuccessGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigThemedText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigThemedBorder'),
  },
  blog: {
    icon: BookOpen,
    labelKey: 'features.timeline.contentTypes.blog',
    gradient: featureThemeClassName('timelineContentTypeConfigSuccessTealGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigSuccessTealGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigTealText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigTealBorder'),
  },
  payment: {
    icon: Wallet,
    labelKey: 'features.timeline.contentTypes.payment',
    gradient: featureThemeClassName('timelineContentTypeConfigSuccessTealGradientSurfaceBeta'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigSuccessTealGradientSurfaceGamma'),
    accentColor: featureThemeClassName('timelineContentTypeConfigSuccessText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigSuccessBorder'),
  },
  action: {
    icon: Zap,
    labelKey: 'features.timeline.contentTypes.action',
    gradient: featureThemeClassName('timelineContentTypeConfigNeutralGradientSurface'),
    gradientDark: featureThemeClassName('timelineContentTypeConfigNeutralGradientSurfaceAlpha'),
    accentColor: featureThemeClassName('timelineContentTypeConfigNeutralText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigNeutralBorder'),
  },
  workflow: {
    icon: GitBranch,
    labelKey: 'features.timeline.contentTypes.workflow',
    gradient: featureThemeClassName('timelineContentTypeConfigDangerAccentGradientSurfaceDelta'),
    gradientDark: featureThemeClassName(
      'timelineContentTypeConfigDangerAccentGradientSurfaceEpsilon'
    ),
    accentColor: featureThemeClassName('timelineContentTypeConfigAccentTextBeta'),
    borderColor: featureThemeClassName('timelineContentTypeConfigAccentBorderBeta'),
  },
  user: {
    icon: User,
    labelKey: 'features.timeline.contentTypes.user',
    gradient: featureThemeClassName('timelineContentTypeConfigInfoAccentGradientSurfaceDelta'),
    gradientDark: featureThemeClassName(
      'timelineContentTypeConfigInfoAccentGradientSurfaceEpsilon'
    ),
    accentColor: featureThemeClassName('decisionterminalDecisionSummaryInfoText'),
    borderColor: featureThemeClassName('timelineContentTypeConfigInfoBorderAlpha'),
  },
};

/**
 * Get the full gradient class for a content type
 */
export function getContentTypeGradient(type: ContentType): string {
  const config = CONTENT_TYPE_CONFIG[type];
  return [
    featureThemeClassName('timelineContentTypeConfigThemedGradientSurface'),
    config.gradient,
    config.gradientDark,
  ].join(' ');
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
