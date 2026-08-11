import { describe, expect, it } from 'vitest';

import type { EurostatDimension } from '../../types';
import {
  canApplyEurostatChartPreset,
  countMissingEurostatFilters,
  createDefaultEurostatFilters,
  createEurostatChartPresetRoles,
  createEurostatEditableTable,
  createEurostatPreviewRows,
  createEurostatPreviewTable,
  createEurostatProjectionPreviewKey,
  formatEurostatDimensionValue,
  getDefaultEurostatXDimension,
  getEurostatValueFields,
  getRequiredEurostatFilterIds,
  normalizeEurostatJsonRecord,
  normalizeEurostatProjectionFilters,
} from '../eurostatChartPreview';

const dimensions: EurostatDimension[] = [
  {
    id: 'geo',
    label: 'Geography',
    position: 0,
    values: [
      { id: 'DE', label: 'Germany' },
      { id: 'FR', label: 'France' },
    ],
  },
  {
    id: 'unit',
    label: 'Unit',
    position: 1,
    values: [{ id: 'PC_GDP' }],
  },
  {
    id: 'TIME_PERIOD',
    label: 'Time',
    position: 2,
    values: [{ id: '2024' }],
  },
];

describe('eurostatChartPreview', () => {
  it('formats value IDs with labels and falls back to the ID', () => {
    expect(formatEurostatDimensionValue(dimensions[0], 'DE')).toBe('DE · Germany');
    expect(formatEurostatDimensionValue(dimensions[1], 'PC_GDP')).toBe('PC_GDP');
    expect(formatEurostatDimensionValue(dimensions[0], null)).toBe('');
    expect(
      formatEurostatDimensionValue(
        { ...dimensions[0], values: [{ id: 'DE', label: '   ' }] },
        ' DE '
      )
    ).toBe('DE');
  });

  it('normalizes record-shaped JSON values and rejects arrays and primitives', () => {
    expect(normalizeEurostatJsonRecord(null)).toEqual({});
    expect(normalizeEurostatJsonRecord([])).toEqual({});
    expect(normalizeEurostatJsonRecord('value')).toEqual({});
    expect(
      normalizeEurostatJsonRecord({ zero: 0, no: false, empty: '', nil: null, missing: undefined })
    ).toEqual({ zero: '0', no: 'false' });
  });

  it('creates a five-row preview with dimension labels and compact attributes', () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `row-${index}`,
      value: index + 1,
      dimensions: {
        geo: index % 2 === 0 ? 'DE' : 'FR',
        unit: 'PC_GDP',
        TIME_PERIOD: '2024',
      },
      attributes: { OBS_STATUS: 'A' },
    }));

    const preview = createEurostatPreviewRows(rows, dimensions);

    expect(preview).toHaveLength(5);
    expect(preview[0].dimensionValues.geo).toBe('DE · Germany');
    expect(preview[0].dimensionValues.unit).toBe('PC_GDP');
    expect(preview[0].attributesText).toBe('OBS_STATUS: A');
  });

  it('uses positional preview IDs and tolerates malformed dimension and attribute records', () => {
    expect(
      createEurostatPreviewRows(
        [{ value: 42, dimensions: ['invalid'], attributes: 'invalid' }],
        dimensions
      )
    ).toEqual([
      {
        id: '0',
        dimensionValues: { geo: '', unit: '', TIME_PERIOD: '' },
        value: '42',
        attributesText: '',
      },
    ]);
  });

  it('creates labeled preview tables with optional attributes and empty dimension values', () => {
    const table = createEurostatPreviewTable(
      [
        {
          value: 1,
          dimensions: { geo: 'DE' },
          attributes: { OBS_STATUS: 'A' },
        },
      ],
      [dimensions[0], { ...dimensions[1], label: '' }]
    );
    expect(table.columns).toEqual(['geo · Geography', 'unit', 'OBS_VALUE', 'Attributes']);
    expect(table.rows[0]).toEqual({
      'geo · Geography': 'DE · Germany',
      unit: '',
      OBS_VALUE: '1',
      Attributes: 'OBS_STATUS: A',
    });

    expect(createEurostatPreviewTable([{ value: 2, dimensions: {} }], []).columns).toEqual([
      'OBS_VALUE',
    ]);
  });

  it('defaults X to TIME_PERIOD and fills all non-X filters', () => {
    const xDimension = getDefaultEurostatXDimension(dimensions);
    const filters = createDefaultEurostatFilters(dimensions, xDimension, null);

    expect(xDimension).toBe('TIME_PERIOD');
    expect(filters).toEqual({ geo: 'DE', unit: 'PC_GDP' });
    expect(countMissingEurostatFilters(dimensions, xDimension, null, filters)).toBe(0);
    expect(countMissingEurostatFilters(dimensions, xDimension, null, { geo: 'DE' })).toBe(1);
    expect(getRequiredEurostatFilterIds(dimensions, 'geo', 'unit')).toEqual(['TIME_PERIOD']);
    expect(getDefaultEurostatXDimension(dimensions.slice(0, 2))).toBe('unit');
    expect(getDefaultEurostatXDimension([])).toBe('');
    expect(getEurostatValueFields()).toContain('OBS_VALUE');
  });

  it('removes role dimensions from filters while preserving remaining values', () => {
    const filters = createDefaultEurostatFilters(dimensions, 'geo', null, {
      geo: 'FR',
      unit: 'PC_GDP',
      TIME_PERIOD: '2024',
    });

    expect(filters).toEqual({ unit: 'PC_GDP', TIME_PERIOD: '2024' });
    expect(createDefaultEurostatFilters(dimensions, 'geo', null, { unit: 'CUSTOM' })).toEqual({
      unit: 'CUSTOM',
      TIME_PERIOD: '2024',
    });
    expect(
      createDefaultEurostatFilters([{ ...dimensions[0], values: [] }], 'missing', null, {})
    ).toEqual({ geo: '' });
  });

  it('creates stable preview keys and includes chart type for staleness', () => {
    const filters = normalizeEurostatProjectionFilters({ unit: 'PC_GDP', geo: 'DE', empty: '' });
    expect(Object.keys(filters)).toEqual(['geo', 'unit']);

    const barKey = createEurostatProjectionPreviewKey({
      datasetId: 'dataset-1',
      filters,
      xDimension: 'TIME_PERIOD',
      seriesDimension: 'geo',
      valueField: 'OBS_VALUE',
      chartType: 'bar',
    });
    const lineKey = createEurostatProjectionPreviewKey({
      datasetId: 'dataset-1',
      filters: { geo: 'DE', unit: 'PC_GDP' },
      xDimension: 'TIME_PERIOD',
      seriesDimension: 'geo',
      valueField: 'OBS_VALUE',
      chartType: 'line',
    });
    const otherValueKey = createEurostatProjectionPreviewKey({
      datasetId: 'dataset-1',
      filters,
      xDimension: 'TIME_PERIOD',
      seriesDimension: 'geo',
      valueField: 'OTHER_VALUE',
      chartType: 'bar',
    });

    expect(barKey).toContain('"geo":"DE"');
    expect(barKey).toContain('"valueField":"OBS_VALUE"');
    expect(barKey).not.toBe(lineKey);
    expect(barKey).not.toBe(otherValueKey);

    const defaults = createEurostatProjectionPreviewKey({
      datasetId: null,
      filters: { empty: '' },
      xDimension: '',
      chartType: 'pie',
    });
    expect(defaults).toContain('"seriesDimension":null');
    expect(defaults).toContain('"valueField":"OBS_VALUE"');
  });

  it('creates shortcut role presets for country comparison and country time series', () => {
    expect(canApplyEurostatChartPreset(dimensions, 'compareCountriesInYear')).toBe(true);
    expect(canApplyEurostatChartPreset(dimensions, 'showTimeSeriesForCountry')).toBe(true);

    const countryComparison = createEurostatChartPresetRoles(dimensions, 'compareCountriesInYear');
    expect(countryComparison).toEqual({
      xDimension: 'geo',
      seriesDimension: null,
      filters: { unit: 'PC_GDP', TIME_PERIOD: '2024' },
    });

    const timeSeries = createEurostatChartPresetRoles(dimensions, 'showTimeSeriesForCountry');
    expect(timeSeries).toEqual({
      xDimension: 'TIME_PERIOD',
      seriesDimension: null,
      filters: { geo: 'DE', unit: 'PC_GDP' },
    });

    expect(canApplyEurostatChartPreset(dimensions.slice(1), 'compareCountriesInYear')).toBe(false);
    expect(canApplyEurostatChartPreset(dimensions.slice(0, 2), 'showTimeSeriesForCountry')).toBe(
      false
    );
    expect(
      createEurostatChartPresetRoles(dimensions.slice(0, 2), 'showTimeSeriesForCountry', {
        geo: 'FR',
      })
    ).toEqual({
      xDimension: 'unit',
      seriesDimension: null,
      filters: { geo: 'FR' },
    });
  });

  it('materializes projection points into an editable chart table', () => {
    const table = createEurostatEditableTable({
      points: [
        { x: '2020', value: 100, series: 'DE' },
        { x: '2021', value: 110, series: 'DE' },
      ],
      xDimension: 'TIME_PERIOD',
      valueField: 'OBS_VALUE',
      seriesDimension: 'geo',
    });

    expect(table).toEqual({
      columns: ['TIME_PERIOD', 'OBS_VALUE', 'geo'],
      rows: [
        { TIME_PERIOD: '2020', OBS_VALUE: '100', geo: 'DE' },
        { TIME_PERIOD: '2021', OBS_VALUE: '110', geo: 'DE' },
      ],
    });

    expect(
      createEurostatEditableTable({
        points: [{ x: '2024', value: 5 }],
        xDimension: 'TIME_PERIOD',
        valueField: '',
        seriesDimension: '',
      })
    ).toEqual({
      columns: ['TIME_PERIOD', 'OBS_VALUE'],
      rows: [{ TIME_PERIOD: '2024', OBS_VALUE: '5' }],
    });
    expect(
      createEurostatEditableTable({
        points: [{ x: '2024', value: 5, series: undefined }],
        xDimension: 'TIME_PERIOD',
        seriesDimension: 'geo',
      }).rows[0]?.geo
    ).toBe('');
  });
});
