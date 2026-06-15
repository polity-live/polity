import { getEntityGradientClasses } from '@/features/shared/theme';
/**
 * Base gradients array for visual variety
 * Used for gradient cards throughout the application
 * Extended to 15 gradients for the Pinterest-style timeline
 */
export const GRADIENTS = [
  getEntityGradientClasses('group'),
  getEntityGradientClasses('event'),
  getEntityGradientClasses('amendment'),
  getEntityGradientClasses('blog'),
  getEntityGradientClasses('user'),
  getEntityGradientClasses('info'),
  getEntityGradientClasses('success'),
  getEntityGradientClasses('warning'),
  getEntityGradientClasses('danger'),
  getEntityGradientClasses('accent'),
  getEntityGradientClasses('neutral'),
  getEntityGradientClasses('group'),
  getEntityGradientClasses('event'),
  getEntityGradientClasses('amendment'),
  getEntityGradientClasses('blog'),
];
