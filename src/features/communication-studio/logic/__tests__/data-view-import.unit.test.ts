import { configuration, projection } from '@/test/studio-data-view.fixture';
import { describe, expect, it } from 'vitest';
import type { DataViewProjection } from '@/features/charts/types';
import { createFrameNode, createStudioDocumentV5, studioDocumentV3Schema } from '../document-v3';
import {
  createStudioDataViewNodes,
  insertStudioDataView,
  updateStudioDataView,
  validateStudioDataProjection,
} from '../data-view-import';

const frame = createFrameNode('widescreen');

describe('resolved Studio data import', () => {
  it.each(['2026', undefined])('retains update and period attribution with end %s', end => {
    const config = configuration();
    config.source.sourceUpdatedAt = '2026-10-01T00:00:00.000Z';
    config.source.dataPeriod = { start: '2024', end };
    const nodes = createStudioDataViewNodes(config, projection, frame);
    expect(JSON.stringify(nodes)).toContain('01.10.2026');
    expect(JSON.stringify(nodes)).toContain(`2024–${end ?? 2024}`);
  });

  it('rejects replacing deleted nodes or root nodes without a frame before mutating the document', () => {
    const document = createStudioDocumentV5('Missing representation');
    document.nodes = [frame];
    const before = structuredClone(document);
    expect(() =>
      updateStudioDataView(document, ['missing'], configuration(), projection)
    ).toThrow();
    expect(() => updateStudioDataView(document, [frame.id], configuration(), projection)).toThrow();
    expect(document).toEqual(before);
  });
  it('retains the exact snapshot configuration after saving and replaces one representation within its existing bounds', () => {
    const document = createStudioDocumentV5('Snapshot identity');
    document.nodes.push(frame);
    const config = configuration('line');
    config.source.providerDatasetId = '13211-0002';
    config.query = {
      filters: { DINSGF: '__total__:DINSGF', value_variable_code: 'ERW006', value_unit: 'Anzahl' },
      dimensionColumn: 'observation_period',
      measureColumn: 'value',
      aggregation: 'none',
      timeRange: { column: 'observation_period', startYear: 2025, endYear: 2025 },
    };
    const ids = insertStudioDataView(document, frame.id, config, projection);
    const restored = studioDocumentV3Schema.parse(JSON.parse(JSON.stringify(document)));
    expect(restored.nodes.find(node => node.id === ids[0])?.dataView).toEqual(config);
    const old = restored.nodes.filter(node => ids.includes(node.id));
    old.forEach(node => {
      node.transform.x += 100;
      node.transform.y += 50;
      node.transform.width *= 0.8;
    });
    const replacement = updateStudioDataView(restored, ids, config, projection);
    expect(restored.nodes.filter(node => replacement.includes(node.id))).toHaveLength(old.length);
    expect(restored.nodes.some(node => ids.includes(node.id))).toBe(false);
    expect(restored.nodes.find(node => node.id === replacement[0])?.transform.x).toBeCloseTo(
      old[0].transform.x
    );
    expect(restored.nodes.find(node => node.id === replacement[0])?.groupIds).toEqual(
      old[0].groupIds
    );
  });
  it('keeps imported text readable on dark frames', () => {
    const dark = createFrameNode('widescreen');
    dark.style.fill = '#12362D';
    const document = createStudioDocumentV5('Dark data');
    document.nodes.push(dark);
    const ids = insertStudioDataView(document, dark.id, configuration(), projection);
    expect(
      document.nodes
        .filter(n => ids.includes(n.id) && n.type === 'richText')
        .every(n => n.style.fill === '#FFFFFF')
    ).toBe(true);
  });
  it.each(['bar', 'line', 'area'] as const)(
    'preserves %s options, multiple series and value gaps',
    kind => {
      const nodes = createStudioDataViewNodes(configuration(kind), projection, frame);
      const chart = nodes.find(n => n.type === 'chart');
      expect(chart?.type).toBe('chart');
      if (chart?.type !== 'chart') throw Error('missing chart');
      expect(chart.data).toMatchObject({
        kind,
        grid: true,
        legend: true,
        xAxisLabel: 'Year',
        yAxisLabel: 'People',
        labels: ['2024', '2025', '2026'],
      });
      expect(chart.data.series.map(s => s.values)).toEqual([
        [10, null, 30],
        [null, 20, null],
      ]);
      expect(new Set(nodes.map(n => n.groupIds[0])).size).toBe(1);
      for (const n of nodes) {
        expect(n.parentFrameId).toBe(frame.id);
        expect(n.liveBinding).toBeUndefined();
        expect(n.transform.x + n.transform.width).toBeLessThanOrEqual(frame.transform.width);
        expect(n.transform.y + n.transform.height).toBeLessThanOrEqual(frame.transform.height);
      }
      const text = nodes
        .filter(n => n.type === 'richText')
        .map(n =>
          n.content.flatMap(p => p.children.map(c => ('text' in c ? c.text : ''))).join(' ')
        )
        .join(' ');
      expect(text).toContain('Population by year');
      expect(text).toContain('Selected regions');
      expect(text).toContain('Eurostat');
      expect(text).toContain('2026');
      expect(text).toContain('https://example.org/data');
    }
  );
  it.each([false, true])('imports pie slices with donut=%s', donut => {
    const config = configuration('pie');
    config.presentation.donut = donut;
    const node = createStudioDataViewNodes(config, projection, frame).find(n => n.type === 'chart');
    expect(node?.type === 'chart' && node.data).toMatchObject({
      kind: 'pie',
      donut,
      labels: ['2024 · North', '2025 · South', '2026 · North'],
    });
  });
  it('inserts editable table headers and the displayed rows without truncation', () => {
    const table: DataViewProjection = {
      view: 'table',
      snapshotId: 'snapshot',
      columns: ['Year', 'Value'],
      rows: [
        { Year: '2024', Value: '10' },
        { Year: '2025', Value: '' },
      ],
      rowCount: 300,
    };
    const node = createStudioDataViewNodes(
      { ...configuration(), view: 'table' },
      table,
      frame
    ).find(n => n.type === 'table');
    expect(
      node?.type === 'table' &&
        node.data.rows.map(r => r.cells.map(c => ('text' in c ? c.text : '')))
    ).toEqual([
      ['Year', 'Value'],
      ['2024', '10'],
      ['2025', ''],
    ]);
  });
  it('inserts stat value and label as editable text', () => {
    const stat: DataViewProjection = {
      view: 'stat',
      snapshotId: 'snapshot',
      value: 1234,
      label: 'Residents',
      aggregation: 'sum',
      rowCount: 1,
    };
    const nodes = createStudioDataViewNodes(
      { ...configuration(), view: 'stat' },
      stat,
      frame,
      0,
      'en'
    );
    expect(nodes.every(n => n.type === 'richText')).toBe(true);
    expect(JSON.stringify(nodes)).toContain('1,234');
    expect(JSON.stringify(nodes)).toContain('Residents');
  });
  it('stores resolved nodes through schema roundtrips; repeated imports form new groups', () => {
    const document = createStudioDocumentV5('Data preview');
    document.nodes = [frame];
    const ids = insertStudioDataView(document, frame.id, configuration('area'), projection);
    const secondIds = insertStudioDataView(document, frame.id, configuration(), projection);
    const restored = studioDocumentV3Schema.parse(JSON.parse(JSON.stringify(document)));
    expect(ids.every(id => restored.nodes.some(n => n.id === id))).toBe(true);
    expect(new Set([...ids, ...secondIds]).size).toBe(ids.length + secondIds.length);
    expect(restored.nodes.find(n => n.id === ids[0])?.groupIds).not.toEqual(
      restored.nodes.find(n => n.id === secondIds[0])?.groupIds
    );
    expect(restored.nodes.find(node => node.id === secondIds[0])?.dataView?.source.snapshotId).toBe(
      'snapshot'
    );
    expect(restored.nodes.every(node => !node.liveBinding)).toBe(true);
  });
  it('accepts the exact table boundary and rejects additional rows or columns', () => {
    const table: DataViewProjection = {
      view: 'table',
      snapshotId: 'snapshot',
      columns: Array.from({ length: 20 }, (_, i) => String(i)),
      rows: Array.from({ length: 49 }, () => ({})),
      rowCount: 49,
    };
    expect(validateStudioDataProjection(table, 'bar')).toBeNull();
    expect(
      validateStudioDataProjection({ ...table, rows: [...table.rows, {}] }, 'bar')
    ).not.toBeNull();
    expect(
      validateStudioDataProjection({ ...table, columns: [...table.columns, 'extra'] }, 'bar')
    ).not.toBeNull();
  });
  it('accepts chart boundaries and rejects extra categories, series and pie slices', () => {
    const chart: typeof projection = {
      ...projection,
      points: Array.from({ length: 100 }, (_, i) => ({ x: String(i), value: 1 })),
    };
    expect(validateStudioDataProjection(chart, 'line')).toBeNull();
    expect(
      validateStudioDataProjection(
        { ...chart, points: [...chart.points, { x: 'extra', value: 1 }] },
        'line'
      )
    ).not.toBeNull();
    expect(
      validateStudioDataProjection(
        {
          ...chart,
          points: Array.from({ length: 11 }, (_, i) => ({ x: 'A', series: String(i), value: 1 })),
        },
        'bar'
      )
    ).not.toBeNull();
    expect(
      validateStudioDataProjection(
        { ...chart, points: [...chart.points, { x: '0', series: 'extra', value: 1 }] },
        'pie'
      )
    ).not.toBeNull();
  });
  it('rejects empty, invalid and negative pie projections without mutating the document', () => {
    const document = createStudioDocumentV5('Data preview');
    document.nodes = [frame];
    const before = structuredClone(document);
    for (const points of [[], [{ x: 'A', value: NaN }], [{ x: 'A', value: -1 }]]) {
      expect(() =>
        insertStudioDataView(document, frame.id, configuration('pie'), { ...projection, points })
      ).toThrow();
      expect(document).toEqual(before);
    }
  });

  it('rejects malformed table headers and cells before creating editable content', () => {
    const table: Extract<DataViewProjection, { view: 'table' }> = {
      view: 'table',
      snapshotId: 'snapshot',
      columns: ['Value'],
      rows: [{ Value: 'valid' }],
      rowCount: 1,
    };
    for (const invalid of [
      { ...table, rows: [] },
      { ...table, columns: [] },
      { ...table, columns: ['Value', 'Value'] },
      { ...table, columns: ['A'.repeat(10001)] },
      { ...table, rows: [{ Value: 'A'.repeat(10001) }] },
    ])
      expect(validateStudioDataProjection(invalid, 'bar')).not.toBeNull();
    expect(validateStudioDataProjection({ ...table, rows: [{}] }, 'bar')).toBeNull();
    const config = { ...configuration(), view: 'table' as const };
    expect(() => createStudioDataViewNodes(config, projection, frame)).toThrow();
    expect(() =>
      insertStudioDataView(
        createStudioDocumentV5('Missing frame'),
        crypto.randomUUID(),
        configuration(),
        projection
      )
    ).toThrow();
  });

  it('rejects zero pie totals, invalid labels and excessive repeated slices', () => {
    for (const points of [
      [{ x: 'A', value: 0 }],
      [{ x: 'A'.repeat(10001), value: 1 }],
      [{ x: 'A', series: 'A'.repeat(10001), value: 1 }],
      Array.from({ length: 101 }, () => ({ x: 'same', value: 1 })),
    ])
      expect(validateStudioDataProjection({ ...projection, points }, 'pie')).not.toBeNull();
    const stat: Extract<DataViewProjection, { view: 'stat' }> = {
      view: 'stat',
      snapshotId: 'snapshot',
      value: 1,
      label: 'Value',
      aggregation: 'sum',
      rowCount: 0,
    };
    expect(validateStudioDataProjection(stat, 'bar')).not.toBeNull();
    expect(
      validateStudioDataProjection({ ...stat, rowCount: 1, value: NaN }, 'bar')
    ).not.toBeNull();
  });

  it('imports missing values with default chart settings and without optional attribution text', () => {
    const config = configuration();
    delete config.chartType;
    config.presentation.title = '';
    config.source.title = '';
    delete config.presentation.description;
    config.presentation.showLegend = false;
    config.presentation.showGrid = false;
    delete config.source.sourceUrl;
    delete config.source.snapshotTakenAt;
    const single = { ...projection, points: [{ x: 'Year', value: 2 }] };
    const nodes = createStudioDataViewNodes(config, single, frame);
    const chart = nodes.find(n => n.type === 'chart');
    expect(chart?.type === 'chart' && chart.data).toMatchObject({
      kind: 'bar',
      legend: false,
      grid: false,
      labels: ['Year'],
      series: [{ name: 'value', values: [2] }],
    });
    expect(nodes.filter(n => n.type === 'richText')).toHaveLength(1);
    const pie = createStudioDataViewNodes({ ...config, chartType: 'pie' }, single, frame).find(
      n => n.type === 'chart'
    );
    expect(pie?.type === 'chart' && pie.data.labels).toEqual(['Year']);
    const mixed = createStudioDataViewNodes(
      { ...config, chartType: 'pie' },
      {
        ...projection,
        points: [
          { x: 'Year', value: 2 },
          { x: 'Year', series: 'Named', value: 3 },
        ],
      },
      frame
    ).find(n => n.type === 'chart');
    expect(mixed?.type === 'chart' && mixed.data.labels).toEqual(['Year · value', 'Year · Named']);
    const document = createStudioDocumentV5('Background import');
    const plainFrame = structuredClone(frame);
    plainFrame.style.fillBinding = null;
    plainFrame.style.fill = null;
    document.nodes.push(plainFrame);
    expect(insertStudioDataView(document, plainFrame.id, config, single)).not.toHaveLength(0);
    plainFrame.style.fillBinding = 'background';
    expect(insertStudioDataView(document, plainFrame.id, config, single)).not.toHaveLength(0);
    const tableConfig = { ...config, view: 'table' as const };
    const tableNodes = createStudioDataViewNodes(
      tableConfig,
      { view: 'table', snapshotId: 'snapshot', columns: ['Missing'], rows: [{}], rowCount: 1 },
      frame
    );
    const table = tableNodes.find(n => n.type === 'table');
    expect(table?.type === 'table' && table.data.rows[1].cells[0].text).toBe('');
  });
});
