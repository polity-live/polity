import { expect, it, vi } from 'vitest';
import { drawStudioElement } from '../draw-element';
import { element, type StudioElement } from '../document';
import { createTableData } from '../table-operations';
function context() {
  return Object.assign(
    Object.fromEntries(
      [
        'save',
        'restore',
        'translate',
        'scale',
        'rotate',
        'beginPath',
        'rect',
        'clip',
        'fillText',
        'moveTo',
        'lineTo',
        'bezierCurveTo',
        'stroke',
        'fillRect',
        'arc',
        'closePath',
        'fill',
        'ellipse',
      ].map(name => [name, vi.fn()])
    ),
    { globalAlpha: 1, measureText: vi.fn((text: string) => ({ width: text.length * 10 })) }
  ) as unknown as CanvasRenderingContext2D;
}
function render(value: StudioElement) {
  const ctx = context();
  drawStudioElement(ctx, value);
  return ctx;
}
it('keeps every cell visible in a 50-row imported table', () => {
  const table = createTableData({ rowCount: 50, colCount: 1 });
  table.rows.forEach((row, i) => {
    row.cells[0].text = `Row${i}`;
  });
  const ctx = render(element('table', { table, width: 900, height: 600, fontSize: 8 }));
  const values = vi.mocked(ctx.fillText).mock.calls.map(c => c[0]);
  expect(values).toEqual(table.rows.map(r => r.cells[0].text));
});
it.each(['line', 'area'] as const)(
  'breaks %s paths at missing values and renders grid and axis labels',
  kind => {
    const ctx = render(
      element('chart', {
        chart: {
          kind,
          legend: false,
          grid: true,
          xAxisLabel: 'Year',
          yAxisLabel: 'People',
          labels: ['A', 'B', 'C'],
          series: [
            { id: crypto.randomUUID(), name: 'Series', color: '#12362D', values: [10, null, 20] },
          ],
        },
      })
    );
    // The two isolated points are visible, with no curve bridging the missing category.
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Year',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      'People',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(ctx.fill).toHaveBeenCalledTimes(kind === 'area' ? 4 : 2);
  }
);
it('renders a transparent donut hole with reversed inner arcs', () => {
  const ctx = render(
    element('chart', {
      chart: {
        kind: 'pie',
        legend: false,
        donut: true,
        labels: ['A', 'B'],
        series: [{ id: crypto.randomUUID(), name: 'Series', color: '#12362D', values: [1, 2] }],
      },
    })
  );
  expect(ctx.arc).toHaveBeenCalledTimes(4);
  expect(vi.mocked(ctx.arc).mock.calls.filter(c => c[5] === true)).toHaveLength(2);
  expect(ctx.moveTo).not.toHaveBeenCalled();
});
it('shows readable options, exact phase counts and percentages in presentation result bars', () => {
  const ctx = render(
    element('chart', {
      width: 1720,
      height: 420,
      fill: '#12362D',
      chart: {
        kind: 'bar',
        layout: 'results',
        eligible: 20,
        pageLabel: '1/1',
        labels: ['Yes', 'No'],
        legend: true,
        series: [
          { id: crypto.randomUUID(), name: 'Indicative', color: '#B88A3B', values: [10, 5] },
          { id: crypto.randomUUID(), name: 'Final', color: '#12362D', values: [12, 8] },
        ],
      },
    })
  );
  const labels = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
  expect(labels).toEqual(
    expect.arrayContaining(['Yes', 'No', '12 · 60%', '8 · 40%', 'Indicative', 'Final', '1/1'])
  );
  expect(labels.filter(label => label === 'Indicative')).toHaveLength(1);
  expect(labels.filter(label => label === 'Final')).toHaveLength(1);
});
it('omits hidden objects and reflects visible geometry without leaking canvas state', () => {
  const hidden = render(element('rect', { visible: false }));
  expect(hidden.save).not.toHaveBeenCalled();
  const visible = render(element('ellipse', { flipX: true, flipY: true, width: 100, height: 80 }));
  expect(visible.translate).toHaveBeenCalledWith(100, 80);
  expect(visible.scale).toHaveBeenCalledWith(-1, -1);
  expect(visible.ellipse).toHaveBeenCalledWith(50, 40, 50, 40, 0, 0, Math.PI * 2);
  expect(visible.fill).toHaveBeenCalledOnce();
  expect(visible.restore).toHaveBeenCalledOnce();
});
it.each(['rect', 'line', 'arrow', 'image'] as const)(
  'renders %s paths with filled shapes and stroked lines',
  type => {
    const ctx = render(element(type, { width: 100, height: 80, strokeWidth: 0 }));
    if (type === 'rect') {
      expect(ctx.fill).toHaveBeenCalledOnce();
      expect(ctx.stroke).not.toHaveBeenCalled();
    } else {
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalledTimes(type === 'line' || type === 'arrow' ? 1 : 0);
    }
    expect(ctx.lineWidth).toBe(2);
    if (type === 'arrow') expect(ctx.lineTo).toHaveBeenCalledTimes(3);
  }
);
it.each(['left', 'center', 'right', 'justify'] as const)(
  'wraps and %s-aligns text without dropping whitespace or long words',
  align => {
    const ctx = render(
      element('text', {
        text: 'First second enormousword\nLast',
        width: 95,
        height: 300,
        fontSize: 20,
        align,
        verticalAlign: 'middle',
        bold: true,
        italic: true,
        underline: true,
        strikethrough: true,
      })
    );
    const calls = vi.mocked(ctx.fillText).mock.calls;
    expect(calls.map(([text]) => text).join('')).toBe('First second enormouswordLast');
    expect(new Set(calls.map(([, , y]) => y)).size).toBeGreaterThan(3);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.font).toBe('italic bold 20px "Manrope"');
    expect(ctx.clip).toHaveBeenCalledOnce();
  }
);
it('renders list markers, run-specific typography and links while preserving explicit false styles', () => {
  const ctx = render(
    element('text', {
      width: 400,
      height: 120,
      fontSize: 20,
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      verticalAlign: 'bottom',
      richText: [
        {
          id: crypto.randomUUID(),
          type: 'p',
          list: 'bullet',
          align: 'center',
          children: [
            {
              text: 'Bullet',
              bold: false,
              italic: false,
              underline: false,
              strikethrough: false,
              fontSize: 30,
              fontFamily: 'Inter',
              color: '#FF0000',
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          type: 'p',
          list: 'number',
          align: 'right',
          children: [{ text: 'Link', url: 'https://example.org' }],
        },
        { id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] },
      ],
    })
  );
  expect(
    vi
      .mocked(ctx.fillText)
      .mock.calls.map(([text]) => text)
      .join('')
  ).toBe('• Bullet2. Link');
  expect(ctx.fillText).toHaveBeenCalledWith('Bullet', expect.any(Number), expect.any(Number));
  expect(ctx.stroke).toHaveBeenCalled();
});
it('wraps rich-text paragraphs that inherit the element alignment', () => {
  const ctx = render(
    element('text', {
      width: 50,
      height: 100,
      align: 'right',
      richText: [{ id: crypto.randomUUID(), type: 'p', children: [{ text: 'long text wraps' }] }],
    })
  );
  expect(
    vi
      .mocked(ctx.fillText)
      .mock.calls.map(([text]) => text)
      .join('')
  ).toBe('long text wraps');
  expect(new Set(vi.mocked(ctx.fillText).mock.calls.map(([, , y]) => y)).size).toBeGreaterThan(1);
});
it('draws table cell boundaries and clips independent left-, center- and right-aligned content', () => {
  const table = element('table', { width: 300, height: 160 });
  const cells = table.table!.rows.flatMap(row => row.cells);
  cells.forEach((cell, index) => {
    cell.text = `Cell ${index}`;
    cell.align = ['left', 'center', 'right'][index % 3] as 'left' | 'center' | 'right';
    cell.bold = index === 1;
    cell.borders = {
      top: index % 2 === 0,
      left: index % 2 !== 0,
      right: index === 0,
      bottom: index !== 0,
    };
  });
  const ctx = render(table);
  expect(ctx.fillRect).toHaveBeenCalledTimes(cells.length);
  expect(
    vi
      .mocked(ctx.fillText)
      .mock.calls.map(([text]) => text)
      .join('')
  ).toContain('Cell 0');
  expect(ctx.clip).toHaveBeenCalledTimes(1 + 2 * cells.length);
});
it.each(['bar', 'line', 'pie'] as const)(
  'renders native %s chart values, labels and optional legends',
  kind => {
    const chart = element('chart', { width: 400, height: 300, bold: kind === 'bar' });
    chart.chart!.kind = kind;
    chart.chart!.colors = ['#FF0000', '#0000FF'];
    chart.chart!.series[0].values = kind === 'pie' ? [3, 7, 5] : [-3, 7, 5];
    const withLegend = render(chart);
    const labels = vi.mocked(withLegend.fillText).mock.calls.map(([text]) => text);
    expect(labels).toEqual(expect.arrayContaining(chart.chart!.labels));
    if (kind === 'pie') expect(withLegend.arc).toHaveBeenCalledTimes(3);
    if (kind === 'line') {
      expect(withLegend.bezierCurveTo).toHaveBeenCalledTimes(2);
      expect(withLegend.arc).toHaveBeenCalledTimes(3);
    }
    chart.chart!.legend = false;
    chart.chart!.colors = undefined;
    const withoutLegend = render(chart);
    expect(vi.mocked(withLegend.fillRect).mock.calls.length).toBeGreaterThan(
      vi.mocked(withoutLegend.fillRect).mock.calls.length
    );
  }
);

function dataChart(values = [6105, 3300, 140, 2900]) {
  return element('chart', {
    width: 700,
    height: 380,
    chart: {
      kind: 'line',
      labels: ['-260', '-116', '-9', '-220'],
      legend: true,
      grid: true,
      xAxisLabel: 'Veränderung zum Vorjahr',
      yAxisLabel: 'Arbeitslose',
      series: ['Dez 2023', 'Dez 2024', 'Dez 2025'].map((name, i) => ({
        id: crypto.randomUUID(),
        name,
        color: ['#2662FF', '#009F94', '#8037FF'][i],
        values,
      })),
    },
  });
}

it('shows all five rounded Y ticks and reserves room for both axis titles', () => {
  const ctx = render(dataChart());
  const calls = vi.mocked(ctx.fillText).mock.calls;
  const ticks = calls.filter(([label]) => ['0', '2000', '4000', '6000', '8000'].includes(label));
  expect(ticks.map(([label]) => label)).toEqual(['0', '2000', '4000', '6000', '8000']);
  expect(ticks.every(([, x, y]) => x >= 12 && y >= 0 && y < 330)).toBe(true);
  expect(calls.map(([label]) => label)).toEqual(
    expect.arrayContaining(['Arbeitslose', 'Veränderung zum Vorjahr'])
  );
  expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
});

it('centers a compact legend by text width rather than distributing entries across the chart', () => {
  const ctx = render(dataChart());
  const markers = vi.mocked(ctx.fillRect).mock.calls;
  const labels = vi.mocked(ctx.fillText).mock.calls.filter(([label]) => label.startsWith('Dez'));
  expect(labels).toHaveLength(3);
  expect(new Set(labels.map(([, , y]) => y)).size).toBe(1);
  const left = markers[0][0];
  const right = labels.at(-1)![1] + labels.at(-1)![3]!;
  expect((left + right) / 2).toBeCloseTo(350);
  expect(left).toBeGreaterThan(150);
  expect(right).toBeLessThan(550);
});

it('wraps long legends below the plot without dropping any entries', () => {
  const chart = dataChart();
  chart.chart!.series.forEach((series, i) => {
    series.name = `Sehr lange Serienbezeichnung ${i + 1}`;
  });
  const ctx = render(chart);
  const labels = vi.mocked(ctx.fillText).mock.calls.filter(([label]) => label.startsWith('Sehr'));
  expect(labels).toHaveLength(3);
  expect(new Set(labels.map(([, , y]) => y)).size).toBeGreaterThan(1);
  expect(
    labels.every(([, x, y, width]) => x >= 0 && x + width! <= chart.width && y < chart.height)
  ).toBe(true);
  const plotBottom = Math.max(...vi.mocked(ctx.arc).mock.calls.map(([, y]) => y));
  expect(Math.min(...labels.map(([, , y]) => y))).toBeGreaterThan(plotBottom);
});

it.each([
  [-10, 20, -3, 0],
  [0, 0, 0, 0],
  [0.0001, 0.0003, 0.0002, 0.0004],
])('handles negative, zero and fractional domains without invalid coordinates: %j', (...values) => {
  const ctx = render(dataChart(values));
  const coordinates = [ctx.moveTo, ctx.lineTo, ctx.bezierCurveTo, ctx.arc].flatMap(fn =>
    vi
      .mocked(fn)
      .mock.calls.flat()
      .filter(value => typeof value === 'number')
  );
  expect(coordinates.every(Number.isFinite)).toBe(true);
  expect(ctx.bezierCurveTo).toHaveBeenCalled();
});

it('renders monotone curves with all point markers and scales the legend with the element', () => {
  const chart = dataChart();
  const original = render(chart);
  const larger = context();
  vi.mocked(larger.measureText).mockImplementation(
    label => ({ width: label.length * 20 }) as TextMetrics
  );
  drawStudioElement(larger, { ...chart, width: chart.width * 2, height: chart.height * 2 });
  expect(original.bezierCurveTo).toHaveBeenCalledTimes(9);
  expect(original.arc).toHaveBeenCalledTimes(12);
  const marker = vi.mocked(original.fillRect).mock.calls[0];
  const biggerMarker = vi.mocked(larger.fillRect).mock.calls[0];
  expect(biggerMarker).toEqual(marker.map(value => value * 2));
  // The export browser can evaluate this renderer without any imported runtime helpers.
  const isolated = (0, eval)(`(${drawStudioElement.toString()})`) as typeof drawStudioElement;
  const exportContext = context();
  isolated(exportContext, chart);
  expect(vi.mocked(exportContext.fillText).mock.calls).toEqual(
    vi.mocked(original.fillText).mock.calls
  );
  expect(vi.mocked(exportContext.bezierCurveTo).mock.calls).toEqual(
    vi.mocked(original.bezierCurveTo).mock.calls
  );
});
