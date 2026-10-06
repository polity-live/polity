import { expect, it, vi } from 'vitest';
import { drawStudioElement } from '../draw-element';
import { element, type StudioElement } from '../document';
function context() {
  return Object.assign(
    Object.fromEntries(
      [
        'save',
        'restore',
        'translate',
        'scale',
        'beginPath',
        'rect',
        'clip',
        'fillText',
        'moveTo',
        'lineTo',
        'stroke',
        'fillRect',
        'arc',
        'closePath',
        'fill',
        'ellipse',
      ].map(name => [name, vi.fn()])
    ),
    { measureText: vi.fn((text: string) => ({ width: text.length * 10 })) }
  ) as unknown as CanvasRenderingContext2D;
}
function render(value: StudioElement) {
  const ctx = context();
  drawStudioElement(ctx, value);
  return ctx;
}
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
    if (kind === 'line') expect(withLegend.stroke).toHaveBeenCalledTimes(2);
    chart.chart!.legend = false;
    chart.chart!.colors = undefined;
    const withoutLegend = render(chart);
    expect(vi.mocked(withLegend.fillRect).mock.calls.length).toBeGreaterThan(
      vi.mocked(withoutLegend.fillRect).mock.calls.length
    );
  }
);
