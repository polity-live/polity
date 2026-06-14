import { Info, Star, TrendingUp, User, Users } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

export type ReasonCategory = 'trending' | 'popular_topic' | 'similar_groups' | 'your_content';

export function getReasonConfig(category: ReasonCategory) {
  switch (category) {
    case 'trending':
      return {
        Icon: TrendingUp,
        labelKey: 'timeline.explore.reasons.trending',
        colorClass: featureThemeClassName('discussionsCommentTreeWarningText'),
        bgClass: featureThemeClassName('timelineReasonDisplayWarningBackground'),
      };
    case 'popular_topic':
      return {
        Icon: Star,
        labelKey: 'timeline.explore.reasons.popularTopic',
        colorClass: featureThemeClassName('notificationNotificationWarningTextAlpha'),
        bgClass: featureThemeClassName('decisionterminalFlashRowWarningBackground'),
        contextPrefix: 'in ',
      };
    case 'similar_groups':
      return {
        Icon: Users,
        labelKey: 'timeline.explore.reasons.similarGroups',
        colorClass: featureThemeClassName('discussionsCommentTreeInfoText'),
        bgClass: featureThemeClassName('timelineReasonDisplayInfoBackground'),
      };
    case 'your_content':
      return {
        Icon: User,
        labelKey: 'timeline.explore.reasons.yourContent',
        colorClass: featureThemeClassName('notificationNotificationSuccessText'),
        bgClass: featureThemeClassName('decisionterminalFlashRowSuccessBackground'),
      };
    default:
      return {
        Icon: Info,
        labelKey: 'timeline.explore.reasons.default',
        colorClass: featureThemeClassName('timelineReasonDisplayNeutralText'),
        bgClass: featureThemeClassName('timelineReasonDisplayNeutralBackground'),
      };
  }
}

export interface ReasonBadgeProps {
  category: ReasonCategory;
  context?: string;
  className?: string;
}

export function ReasonBadge({ category, context, className }: ReasonBadgeProps) {
  const { t } = useTranslation();
  const config = getReasonConfig(category);
  const Icon = config.Icon;

  let reasonText = t(config.labelKey);
  if (context && config.contextPrefix) {
    reasonText = `${reasonText} ${config.contextPrefix}${context}`;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
        config.bgClass,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', config.colorClass)} />
      <span className="text-muted-foreground">{reasonText}</span>
    </div>
  );
}
