import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import Konva from 'konva';
import { ChartRenderer } from '@/features/charts/ui/ChartRenderer';
import type { ChartDataViewProjection } from '@/features/charts/types';
import { configuration } from '@/test/studio-data-view.fixture';
import KonvaStudioCanvas from '../KonvaStudioCanvas';
import {
  createFrameNode,
  createStudioDocumentV5,
  studioDocumentV3Schema,
} from '../../logic/document-v3';
import { insertStudioDataView } from '../../logic/data-view-import';
import { paintStudioDocumentFrame } from '../../logic/paint-v5';
import '@/font-faces.css';
import '@/styles.css';

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1280, 900);
});

it('preserves the three-series preview in an editable canvas, PNG export and resized saved document', async () => {
  await page.viewport(1280, 1500);
  await document.fonts.ready;
  const config = configuration('line');
  config.presentation = {
    title: 'Dez 2023 by Veränderung zum Vorjahr',
    xAxisLabel: 'Veränderung zum Vorjahr',
    yAxisLabel: 'Arbeitslose',
    showLegend: true,
    showGrid: true,
    showTooltip: false,
  };
  config.source.provider = 'GOVDATA';
  config.source.publisher = 'Recklinghausen';
  const labels = ['-260', '-116', '-144', '-170', '-10', '-9', '-52', '31', '-220'];
  const series = [
    { name: 'Dez 2023', values: [5810, 3140, 2640, 2220, 450, 105, 510, 1440, 2700] },
    { name: 'Dez 2024', values: [6105, 3320, 2820, 2400, 510, 110, 560, 1440, 2960] },
    { name: 'Dez 2025', values: [5850, 3200, 2660, 2220, 520, 130, 520, 1520, 2730] },
  ];
  const projection: ChartDataViewProjection = {
    view: 'chart',
    snapshotId: 'snapshot',
    rowCount: labels.length,
    points: series.flatMap(s => labels.map((x, i) => ({ x, value: s.values[i], series: s.name }))),
  };
  const stored = createStudioDocumentV5('Arbeitslose');
  const frame = createFrameNode('widescreen');
  frame.style.fill = '#F8F7F2';
  stored.nodes.push(frame);
  const ids = insertStudioDataView(stored, frame.id, config, projection, 'de');
  const chart = stored.nodes.find(node => ids.includes(node.id) && node.type === 'chart');
  if (chart?.type !== 'chart') throw new Error('Chart was not inserted');
  expect(chart.data.series.map(s => s.values)).toEqual(series.map(s => s.values));
  expect(new Set(stored.nodes.filter(n => ids.includes(n.id)).map(n => n.groupIds[0])).size).toBe(
    1
  );

  const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
  const r = render(
    <div style={{ width: 1150, padding: 24, background: '#F8F7F2' }}>
      <div data-testid="preview">
        <ChartRenderer
          chartType="line"
          points={projection.points}
          presentation={config.presentation}
        />
      </div>
      <div data-testid="native" style={{ width: 1100, height: 620 }}>
        <KonvaStudioCanvas
          document={stored}
          activeFrameId={frame.id}
          selected={[]}
          assets={[]}
          editable
          fit="contain"
          guides={false}
        />
      </div>
    </div>
  );
  const tickLabels = ['0', '2000', '4000', '6000', '8000'];
  const chartLabels = [
    ...tickLabels,
    ...series.map(s => s.name),
    ...labels,
    'Arbeitslose',
    'Veränderung zum Vorjahr',
  ];
  const firstCalls = () =>
    chartLabels.map(label => fillText.mock.calls.filter(([text]) => text === label).at(-1));
  await waitFor(() => expect(firstCalls().every(Boolean)).toBe(true));
  await document.fonts.ready;
  const stage = Konva.stages.find(s => s.findOne(`#${chart.id}`));
  stage?.draw();
  await waitFor(() => {
    const preview = within(screen.getByTestId('preview'));
    for (const label of tickLabels) expect(preview.getByText(label, { exact: true })).toBeVisible();
    for (const s of series) expect(preview.getByText(s.name, { exact: true })).toBeVisible();
  });
  // Recharts animates the stroke even after all dots and axis labels are present.
  await waitFor(
    () => {
      const paths = screen
        .getByTestId('preview')
        .querySelectorAll<SVGPathElement>('.recharts-line-curve');
      expect(paths).toHaveLength(3);
      for (const path of paths) {
        const dash = path.getAttribute('stroke-dasharray');
        if (dash) expect(Number.parseFloat(dash)).toBeGreaterThanOrEqual(path.getTotalLength() - 1);
      }
    },
    { timeout: 5000 }
  );
  const nativeCalls = firstCalls();
  const nativeLegend = series.map(s => nativeCalls[chartLabels.indexOf(s.name)]!);
  expect(new Set(nativeLegend.map(([, , y]) => y)).size).toBe(1);
  await page.screenshot({
    element: screen.getByTestId('preview'),
    path: '../../../../../output/playwright/data-chart-preview.png',
  });
  await page.screenshot({
    element: screen.getByTestId('native'),
    path: '../../../../../output/playwright/data-chart-canvas.png',
  });

  // The export renderer chooses the first DOM canvas. Give it a separate surface.
  const scratch = document.createElement('canvas');
  scratch.style.display = 'none';
  document.body.prepend(scratch);
  let png: string;
  try {
    fillText.mockClear();
    png = await paintStudioDocumentFrame(stored, frame.id, {});
    expect(firstCalls()).toEqual(nativeCalls);
  } finally {
    scratch.remove();
  }
  expect(png).toMatch(/^data:image\/png;base64,/);
  r.unmount();
  const exported = render(
    <img data-testid="export" src={png} alt="Exported data chart" style={{ width: 1100 }} />
  );
  await waitFor(() =>
    expect((screen.getByTestId('export') as HTMLImageElement).naturalWidth).toBe(
      frame.transform.width
    )
  );
  await page.screenshot({
    element: screen.getByTestId('export'),
    path: '../../../../../output/playwright/data-chart-export.png',
  });
  exported.unmount();

  // Resize the editable chart and reload its complete document through the saved schema.
  chart.transform.width *= 0.7;
  chart.transform.height *= 0.7;
  chart.data.series[0].values[0] = 6000;
  const restored = studioDocumentV3Schema.parse(JSON.parse(JSON.stringify(stored)));
  fillText.mockClear();
  render(
    <div data-testid="resized" style={{ width: 1100, height: 620 }}>
      <KonvaStudioCanvas
        document={restored}
        activeFrameId={frame.id}
        selected={[chart.id]}
        assets={[]}
        editable
        fit="contain"
        guides={false}
      />
    </div>
  );
  await waitFor(() => expect(firstCalls().every(Boolean)).toBe(true));
  const group = Konva.stages.map(stage => stage.findOne<Konva.Group>(`#${chart.id}`)).find(Boolean);
  expect(group?.findOne('Shape')?.width()).toBeCloseTo(chart.transform.width);
  const savedChart = restored.nodes.find(n => n.id === chart.id);
  expect(savedChart?.type === 'chart' && savedChart.data.series[0].values[0]).toBe(6000);
  expect(savedChart?.liveBinding).toBeUndefined();
  await page.screenshot({
    element: screen.getByTestId('resized'),
    path: '../../../../../output/playwright/data-chart-resized.png',
  });
}, 30_000);

it('redraws standalone diagrams when their own font finishes loading', async () => {
  const stored = createStudioDocumentV5('Delayed chart font');
  const frame = createFrameNode('widescreen');
  stored.nodes.push(frame);
  const config = configuration('line');
  const projection: ChartDataViewProjection = {
    view: 'chart',
    snapshotId: 'snapshot',
    rowCount: 3,
    points: [
      { x: 'A', value: 10 },
      { x: 'B', value: 20 },
      { x: 'C', value: 5 },
    ],
  };
  const ids = insertStudioDataView(stored, frame.id, config, projection);
  stored.nodes = stored.nodes.filter(n => !ids.includes(n.id) || n.type === 'chart');
  const chart = stored.nodes.find(n => n.type === 'chart');
  if (chart?.type !== 'chart') throw new Error('Chart missing');
  chart.data.fontFamily = 'Work Sans';
  const original = document.fonts.load.bind(document.fonts);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const load = vi.spyOn(document.fonts, 'load').mockImplementation(async (...args) => {
    await gate;
    return original(...args);
  });
  render(
    <div style={{ width: 1100, height: 620 }}>
      <KonvaStudioCanvas
        document={stored}
        activeFrameId={frame.id}
        selected={[]}
        assets={[]}
        editable={false}
        fit="contain"
        guides={false}
      />
    </div>
  );
  await waitFor(() => expect(load).toHaveBeenCalledWith('400 12px "Work Sans"'));
  expect(load).toHaveBeenCalledWith('700 12px "Work Sans"');
  const shape = Konva.stages
    .map(stage => stage.findOne<Konva.Group>(`#${chart.id}`))
    .find(Boolean)
    ?.findOne('Shape');
  const layer = shape?.getLayer();
  if (!layer) throw new Error('Chart layer missing');
  const redraw = vi.spyOn(layer, 'batchDraw');
  await act(async () => {
    release();
    await Promise.all(load.mock.results.map(result => result.value));
  });
  expect(redraw).toHaveBeenCalled();
});
