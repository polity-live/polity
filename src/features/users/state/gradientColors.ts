import { featureThemeClassName } from '@/features/shared/theme';
/**
 * Base gradients array for visual variety
 * Used for gradient cards throughout the application
 * Extended to 15 gradients for the Pinterest-style timeline
 */
export const GRADIENTS = [
  // Warm Spectrum
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentWarningGradientSurfaceAlpha'),
  featureThemeClassName('timelineGradientAssignmentDangerAccentGradientSurface'),
  featureThemeClassName('userGradientColorsWarningGradientSurface'),

  // Cool Spectrum
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceAlpha'),
  featureThemeClassName('userGradientColorsSuccessInfoGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentInfoTealGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentSuccessGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentSuccessTealGradientSurface'),

  // Neutral/Earth Spectrum
  featureThemeClassName('userGradientColorsAccentGradientSurface'),
  featureThemeClassName('userGradientColorsDangerWarningGradientSurface'),
  featureThemeClassName('userGradientColorsSuccessTealGradientSurface'),

  // Additional variety
  featureThemeClassName('timelineGradientAssignmentAccentGradientSurface'),
  featureThemeClassName('timelineGradientAssignmentInfoAccentGradientSurfaceBeta'),
  featureThemeClassName('timelineGradientAssignmentDangerWarningGradientSurface'),
];
