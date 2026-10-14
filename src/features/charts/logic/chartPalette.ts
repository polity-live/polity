import { featureThemeValue } from '@/features/shared/theme';
export const CHART_PALETTE = [
  featureThemeValue('chartChartRendererInfoColor'),
  featureThemeValue('chartChartRendererInfoColorAlpha'),
  featureThemeValue('chartChartRendererAccentColor'),
  featureThemeValue('chartChartRendererThemeValue'),
  featureThemeValue('chartChartRendererAccentColorAlpha'),
  featureThemeValue('chartChartRendererThemeValueAlpha'),
  featureThemeValue('chartChartRendererInfoColorBeta'),
  featureThemeValue('chartChartRendererDangerColor'),
] as const;
