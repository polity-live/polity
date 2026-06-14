import { ENTITY_COLORS } from '@/features/shared/utils/entity-colors';

export type SearchCardGradientEntity = 'group' | 'event' | 'amendment' | 'blog' | 'user';

export const SEARCH_CARD_GRADIENTS: Record<SearchCardGradientEntity, string> = {
  group: `bg-gradient-to-br ${ENTITY_COLORS.group.gradient} ${ENTITY_COLORS.group.gradientDark}`,
  event: `bg-gradient-to-br ${ENTITY_COLORS.event.gradient} ${ENTITY_COLORS.event.gradientDark}`,
  amendment: `bg-gradient-to-br ${ENTITY_COLORS.amendment.gradient} ${ENTITY_COLORS.amendment.gradientDark}`,
  blog: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950',
  user: `bg-gradient-to-br ${ENTITY_COLORS.user.gradient} ${ENTITY_COLORS.user.gradientDark}`,
};
