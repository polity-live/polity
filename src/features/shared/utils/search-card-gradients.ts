import { getEntityGradientClasses } from '@/features/shared/theme';

export type SearchCardGradientEntity = 'group' | 'event' | 'amendment' | 'blog' | 'user';

export const SEARCH_CARD_GRADIENTS: Record<SearchCardGradientEntity, string> = {
  group: getEntityGradientClasses('group'),
  event: getEntityGradientClasses('event'),
  amendment: getEntityGradientClasses('amendment'),
  blog: getEntityGradientClasses('blog'),
  user: getEntityGradientClasses('user'),
};
