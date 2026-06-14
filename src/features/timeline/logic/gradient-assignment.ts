import { featureThemeClassName } from '@/features/shared/theme';
import { ContentType, getContentTypeGradient } from '../constants/content-type-config';

/**
 * Extended gradients array with 15 total gradients for visual variety
 * Includes warm, cool, and neutral spectrum options
 */
export const EXTENDED_GRADIENTS = [
  // Warm Spectrum
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurface'), // Soft Bloom
  featureThemeClassName('timelineGradientAssignmentWarningGradientSurface'), // Sunrise (using orange/amber fallback)
  featureThemeClassName('timelineGradientAssignmentWarningGradientSurfaceAlpha'), // Citrus
  featureThemeClassName('timelineGradientAssignmentDangerAccentGradientSurface'), // Rose

  // Cool Spectrum
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceAlpha'), // Twilight
  featureThemeClassName('timelineGradientAssignmentInfoTealGradientSurface'), // Ocean
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurface'), // Forest
  featureThemeClassName('timelineGradientAssignmentSuccessTealGradientSurface'), // Sage

  // Neutral/Earth Spectrum
  featureThemeClassName('timelineGradientAssignmentNeutralGradientSurface'), // Cloud
  featureThemeClassName('timelineGradientAssignmentWarningNeutralGradientSurface'), // Sand
  featureThemeClassName('timelineGradientAssignmentAccentNeutralGradientSurface'), // Night

  // Additional variety
  featureThemeClassName('timelineGradientAssignmentAccentGradientSurface'), // Lavender
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurfaceAlpha'), // Spring
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceBeta'), // Azure
  featureThemeClassName('timelineGradientAssignmentDangerWarningGradientSurface'), // Sunset
] as const;

/**
 * Get gradient by index (deterministic but varied)
 */
export function getGradientByIndex(index: number): string {
  return EXTENDED_GRADIENTS[index % EXTENDED_GRADIENTS.length];
}

/**
 * Get gradient for a specific content type
 * Uses the content type's default gradient
 */
export function getGradientForContentType(type: ContentType): string {
  return getContentTypeGradient(type);
}

/**
 * Get gradient by entity ID (deterministic based on ID hash)
 * This ensures the same entity always gets the same gradient
 */
export function getGradientByEntityId(entityId: string): string {
  // Simple hash function to convert ID to a number
  let hash = 0;
  for (let i = 0; i < entityId.length; i++) {
    const char = entityId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % EXTENDED_GRADIENTS.length;
  return EXTENDED_GRADIENTS[index];
}

/**
 * Get gradient for timeline card based on content type and entity ID
 * Uses content type gradient as primary, falls back to entity-based for variety
 */
export function getTimelineCardGradient(
  contentType: ContentType,
  entityId?: string,
  useContentTypeDefault = true
): string {
  if (useContentTypeDefault) {
    return getGradientForContentType(contentType);
  }

  if (entityId) {
    return getGradientByEntityId(entityId);
  }

  return EXTENDED_GRADIENTS[0];
}

/**
 * Timeline card shadow classes
 */
export const CARD_SHADOWS = {
  default: 'shadow-sm',
  hover: 'hover:shadow-md',
  elevated: 'shadow-md hover:shadow-lg',
  transition: 'transition-shadow duration-300',
} as const;

/**
 * Get combined shadow classes for timeline cards
 */
export function getCardShadowClasses(elevated = false): string {
  if (elevated) {
    return `${CARD_SHADOWS.elevated} ${CARD_SHADOWS.transition}`;
  }
  return `${CARD_SHADOWS.default} ${CARD_SHADOWS.hover} ${CARD_SHADOWS.transition}`;
}

/**
 * Card rounded corner standards
 */
export const CARD_RADIUS = {
  card: 'rounded-2xl',
  inner: 'rounded-xl',
  badge: 'rounded-full',
} as const;

/**
 * Card aspect ratios for different content types
 */
export const CARD_ASPECT_RATIOS = {
  video: 'aspect-video', // 16:9
  image: 'aspect-auto', // Flexible based on image
  default: 'aspect-auto', // Flexible with minimum heights
} as const;

/**
 * Badge-sized gradients — more vibrant than card backgrounds, with
 * white text in light mode and light text in dark mode.
 */
export const BADGE_GRADIENTS = [
  featureThemeClassName('timelineGradientAssignmentDangerAccentGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentAccentGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentInfoGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentSuccessTealGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurfaceBeta'),
  featureThemeClassName('timelineGradientAssignmentWarningGradientSurfaceBeta'),
  featureThemeClassName('timelineGradientAssignmentDangerWarningGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentAccentGradientSurfaceBeta'),
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceGamma'),
  featureThemeClassName('timelineGradientAssignmentInfoTealGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurfaceGamma'),
  featureThemeClassName('timelineGradientAssignmentDangerWarningGradientSurfaceBeta'),
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceDelta'),
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurfaceDelta'),
  featureThemeClassName('timelineGradientAssignmentDangerAccentGradientSurfaceBeta'),
] as const;

/**
 * Get a deterministic badge gradient for a hashtag string.
 * Same tag always returns the same gradient.
 */
export function getHashtagGradient(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % BADGE_GRADIENTS.length;
  return BADGE_GRADIENTS[index];
}
