import { expect, it } from 'vitest';
import { CHART_PALETTE } from '../chartPalette';
import { featureThemeValue } from '@/features/shared/theme';

it('uses the shared theme colors for every chart series', () => {
  expect(CHART_PALETTE).toEqual([
    featureThemeValue('chartChartRendererInfoColor'),
    featureThemeValue('chartChartRendererInfoColorAlpha'),
    featureThemeValue('chartChartRendererAccentColor'),
    featureThemeValue('chartChartRendererThemeValue'),
    featureThemeValue('chartChartRendererAccentColorAlpha'),
    featureThemeValue('chartChartRendererThemeValueAlpha'),
    featureThemeValue('chartChartRendererInfoColorBeta'),
    featureThemeValue('chartChartRendererDangerColor'),
  ]);
  expect(CHART_PALETTE.every(color => color.length > 0)).toBe(true);
});
