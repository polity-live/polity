import type { StudioElement } from './document';
// Self-contained: this function is also installed in the isolated export browser.
export function drawStudioElement(ctx: CanvasRenderingContext2D, e: StudioElement) {
  if (e.visible === false) return;
  ctx.save();
  ctx.translate(e.flipX ? e.width : 0, e.flipY ? e.height : 0);
  ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
  ctx.beginPath();
  ctx.rect(0, 0, e.width, e.height);
  ctx.clip();
  const text = (
    text: string,
    x: number,
    y: number,
    w: number,
    size = e.fontSize,
    color = e.fill,
    align: 'left' | 'center' = 'left',
    bold = e.bold
  ) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px "${e.chart?.fontFamily ?? e.font}"`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const tw = Math.min(w, ctx.measureText(text).width);
    ctx.fillText(text, x + (align === 'center' ? (w - tw) / 2 : 0), y, w);
  };
  if (e.type === 'text') {
    interface Run {
      text: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      color?: string;
      fontSize?: number;
      fontFamily?: string;
      url?: string;
    }
    interface Token {
      run: Run;
      width: number;
    }
    interface Line {
      tokens: Token[];
      width: number;
      height: number;
      align: string;
      last: boolean;
    }
    const lines: Line[] = [];
    const paragraphs = e.richText?.length
      ? e.richText
      : e.text.split('\n').map(text => ({ children: [{ text }], align: e.align, list: undefined }));
    const font = (r: Run) =>
      `${(r.italic ?? e.italic) ? 'italic ' : ''}${(r.bold ?? e.bold) ? 'bold ' : ''}${r.fontSize ?? e.fontSize}px "${r.fontFamily ?? e.font}"`;
    paragraphs.forEach((p, index) => {
      let line: Line = {
        tokens: [],
        width: 0,
        height: e.fontSize * e.lineHeight,
        align: p.align ?? e.align,
        last: false,
      };
      const runs: Run[] = p.list
        ? [{ text: p.list === 'bullet' ? '• ' : `${index + 1}. ` }, ...p.children]
        : p.children;
      const push = () => {
        lines.push(line);
        line = {
          tokens: [],
          width: 0,
          height: e.fontSize * e.lineHeight,
          align: p.align ?? e.align,
          last: false,
        };
      };
      for (const run of runs)
        for (const part of run.text.split(/(\s+)/)) {
          if (!part) continue;
          ctx.font = font(run);
          const width = ctx.measureText(part).width;
          const chunks = width > e.width ? Array.from(part) : [part];
          for (const chunk of chunks) {
            ctx.font = font(run);
            const width = ctx.measureText(chunk).width;
            if (line.width + width > e.width && line.tokens.length) push();
            line.tokens.push({ run: { ...run, text: chunk }, width });
            line.width += width;
            line.height = Math.max(line.height, (run.fontSize ?? e.fontSize) * e.lineHeight);
          }
        }
      line.last = true;
      lines.push(line);
    });
    const total = lines.reduce((n, l) => n + l.height, 0);
    let y =
      e.verticalAlign === 'middle'
        ? (e.height - total) / 2
        : e.verticalAlign === 'bottom'
          ? e.height - total
          : 0;
    y = Math.max(0, y);
    for (const l of lines) {
      let x =
        l.align === 'center'
          ? (e.width - l.width) / 2
          : l.align === 'right'
            ? e.width - l.width
            : 0;
      const spaces = l.tokens.filter(t => /^\s+$/.test(t.run.text)).length;
      const extra = l.align === 'justify' && !l.last && spaces ? (e.width - l.width) / spaces : 0;
      for (const { run, width } of l.tokens) {
        const size = run.fontSize ?? e.fontSize;
        ctx.font = font(run);
        ctx.textBaseline = 'top';
        ctx.fillStyle = run.color ?? e.fill;
        ctx.fillText(run.text, x, y);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, size / 18);
        for (const pos of [
          (run.underline ?? e.underline) || run.url ? 0.95 : -1,
          (run.strikethrough ?? e.strikethrough) ? 0.5 : -1,
        ])
          if (pos >= 0) {
            ctx.beginPath();
            ctx.moveTo(x, y + size * pos);
            ctx.lineTo(x + width, y + size * pos);
            ctx.stroke();
          }
        x += width + (/^\s+$/.test(run.text) ? extra : 0);
      }
      y += l.height;
    }
  } else if (e.type === 'table' && e.table) {
    const t = e.table,
      sum = t.widths.reduce((a, b) => a + b, 0),
      height = e.height / t.rows.length;
    t.rows.forEach((row, r) => {
      let x = 0;
      row.cells.forEach((cell, c) => {
        const w = (e.width * t.widths[c]) / sum;
        ctx.fillStyle = cell.fill;
        ctx.fillRect(x, r * height, w, height);
        ctx.strokeStyle = t.border;
        ctx.lineWidth = 1;
        const edges = cell.borders;
        const y = r * height;
        ctx.beginPath();
        if (r === 0 && edges.top) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y);
        }
        if (c === 0 && edges.left) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + height);
        }
        if (edges.right) {
          ctx.moveTo(x + w, y);
          ctx.lineTo(x + w, y + height);
        }
        if (edges.bottom) {
          ctx.moveTo(x, y + height);
          ctx.lineTo(x + w, y + height);
        }
        ctx.stroke();
        const inset = Math.min(6, Math.max(0, (height - 10) / 2), Math.max(0, (w - 10) / 2));
        const clipInset = Math.min(4, inset);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + clipInset, r * height + clipInset, w - clipInset * 2, height - clipInset * 2);
        ctx.clip();
        ctx.translate(x + inset, r * height + inset);
        drawStudioElement(ctx, {
          ...e,
          type: 'text',
          width: w - inset * 2,
          height: height - inset * 2,
          text: cell.text,
          richText: [],
          bold: cell.bold,
          fill: cell.color,
          align: cell.align,
          verticalAlign: 'top',
          fontSize: Math.max(8, Math.min(e.fontSize, height - inset * 2)),
          flipX: false,
          flipY: false,
        });
        ctx.restore();
        x += w;
      });
    });
  } else if (e.type === 'chart' && e.chart) {
    const c = e.chart;
    const scale = Math.max(0.1, Math.min(e.width / 700, e.height / 380));
    const fontSize = 12 * scale;
    const fontFamily = c.fontFamily ?? e.font;
    const measure = (label: string, size = fontSize) => {
      ctx.font = `${e.bold ? 'bold ' : ''}${size}px "${fontFamily}"`;
      return ctx.measureText(label).width;
    };
    const legendItems = c.legend ? (c.kind === 'pie' ? c.labels : c.series.map(s => s.name)) : [];
    const legendRows: { index: number; width: number }[][] = [];
    const legendGap = 16 * scale;
    const legendMarker = 8 * scale;
    const legendWidth = Math.max(1, e.width - 24 * scale);
    for (const [index, name] of legendItems.entries()) {
      const width = Math.min(legendWidth, measure(name) + legendMarker + 6 * scale);
      const row = legendRows.at(-1);
      if (
        !row ||
        row.reduce((total, item) => total + item.width + legendGap, 0) + width > legendWidth
      )
        legendRows.push([{ index, width }]);
      else row.push({ index, width });
    }
    const legendHeight = legendRows.length ? (legendRows.length * 24 + 8) * scale : 0;
    const xTitleHeight = c.kind !== 'pie' && c.xAxisLabel?.trim() ? 20 * scale : 0;
    // Pie geometry is independent of the Cartesian axes, but shares the compact legend.
    const pad = 24 * scale;
    const w = Math.max(1, e.width - pad * 2);
    const h = Math.max(1, e.height - pad * 2 - legendHeight);
    const palette = c.colors ?? ['#B88A3B', '#12362D', '#588DB2', '#9A597F', '#75965D', '#D46E48'];
    if (c.layout === 'results' && c.kind === 'bar') {
      const alpha = ctx.globalAlpha;
      const rowHeight = (e.height - 56) / c.labels.length;
      const font = Math.max(20, Math.min(36, rowHeight / 3));
      const labelWidth = e.width * 0.32;
      const countWidth = Math.max(150, e.width * 0.16);
      const barWidth = e.width - labelWidth - countWidth - 30;
      const maximum = Math.max(
        1,
        ...c.series.flatMap(s => s.values).filter((v): v is number => v !== null)
      );
      c.labels.forEach((label, i) => {
        const y = i * rowHeight;
        text(label, 0, y + 8, labelWidth - 24, font, e.fill, 'left');
        c.series.forEach((series, j) => {
          const value = series.values[i];
          if (value === null) return;
          const barY = y + 8 + (j * (rowHeight - 16)) / c.series.length;
          const height = Math.max(8, (rowHeight - 28) / c.series.length);
          ctx.globalAlpha = alpha * 0.12;
          ctx.fillStyle = series.color;
          ctx.fillRect(labelWidth, barY, barWidth, height);
          ctx.globalAlpha = alpha;
          ctx.fillRect(labelWidth, barY, (barWidth * value) / maximum, height);
          text(
            `${Math.round(value)}${c.eligible ? ` · ${Math.round((value / c.eligible) * 100)}%` : ''}`,
            labelWidth + barWidth + 12,
            barY,
            countWidth,
            font * 0.8,
            e.fill,
            'left'
          );
        });
      });
      if (c.legend)
        c.series.forEach((series, i) => {
          ctx.fillStyle = series.color;
          ctx.fillRect((i * e.width) / 3, e.height - 30, 20, 20);
          text(
            series.name,
            (i * e.width) / 3 + 32,
            e.height - 34,
            e.width / 3 - 40,
            24,
            e.fill,
            'left'
          );
        });
      if (c.pageLabel) text(c.pageLabel, e.width - 120, e.height - 34, 120, 24, e.fill, 'left');
    } else if (c.kind === 'pie') {
      const values = c.series[0].values.map(v => v ?? 0),
        total = values.reduce((a, b) => a + b, 0),
        radius = Math.max(1, Math.min(w, h) / 2);
      let a = -Math.PI / 2;
      const sliceLabels: { label: string; x: number; y: number; width: number }[] = [];
      values.forEach((v, i) => {
        if (v <= 0) return;
        const end = a + (v / total) * Math.PI * 2;
        ctx.beginPath();
        if (c.donut) {
          ctx.arc(e.width / 2, pad + h / 2, radius, a, end);
          ctx.arc(e.width / 2, pad + h / 2, radius * 0.52, end, a, true);
        } else {
          ctx.moveTo(e.width / 2, pad + h / 2);
          ctx.arc(e.width / 2, pad + h / 2, radius, a, end);
        }
        ctx.closePath();
        ctx.fillStyle = palette[i % palette.length];
        ctx.fill();
        const mid = (a + end) / 2;
        const labelWidth = Math.min(120, radius * 0.65);
        sliceLabels.push({
          label: c.labels[i],
          x: e.width / 2 + Math.cos(mid) * radius * (c.donut ? 0.76 : 0.6) - labelWidth / 2,
          y: pad + h / 2 + Math.sin(mid) * radius * (c.donut ? 0.76 : 0.6) - 10,
          width: labelWidth,
        });
        a = end;
      });
      // Paint labels after every slice, so neighboring slices cannot cover their text.
      for (const label of sliceLabels)
        text(label.label, label.x, label.y, label.width, 14, '#FFFFFF', 'center');
    } else {
      const values = c.series.flatMap(s => s.values).filter((v): v is number => v !== null);
      const minimum = Math.min(0, ...values);
      const maximum = Math.max(0, ...values);
      // Match Recharts' five-tick adaptive scale, including a zero baseline.
      const roughStep = (maximum - minimum) / 4;
      const digits = roughStep > 0 ? Math.floor(Math.log10(roughStep)) + 1 : 1;
      const quantum = Math.pow(10, digits) * (digits === 1 ? 0.1 : 0.05);
      let tickStep = roughStep > 0 ? Math.ceil(roughStep / quantum - 1e-10) * quantum : 1;
      let below = Math.ceil(-minimum / tickStep - 1e-10);
      let above = Math.ceil(maximum / tickStep - 1e-10);
      while (below + above > 4) {
        tickStep += quantum;
        below = Math.ceil(-minimum / tickStep - 1e-10);
        above = Math.ceil(maximum / tickStep - 1e-10);
      }
      if (maximum <= 0 && minimum < 0) below = 4 - above;
      const ticks = Array.from({ length: 5 }, (_, i) =>
        Number(((i - below) * tickStep).toPrecision(12))
      );
      const min = ticks[0];
      const max = ticks[4];
      const tickWidth = Math.max(...ticks.map(value => measure(String(value))));
      const left = tickWidth + (c.yAxisLabel?.trim() ? 26 : 8) * scale;
      const right = Math.max(left + 1, e.width - 16 * scale);
      const top = 12 * scale;
      const bottom = Math.max(top + 1, e.height - legendHeight - xTitleHeight - 28 * scale);
      const plotWidth = right - left;
      const plotHeight = bottom - top;
      const yy = (v: number) => bottom - ((v - min) / (max - min)) * plotHeight;
      const step = plotWidth / c.labels.length;
      const xx = (i: number) =>
        c.kind === 'bar'
          ? left + step * (i + 0.5)
          : left +
            (c.labels.length === 1 ? plotWidth / 2 : (plotWidth * i) / (c.labels.length - 1));
      if (c.grid) {
        ctx.save();
        ctx.strokeStyle = e.fill;
        ctx.globalAlpha *= 0.15;
        ctx.lineWidth = scale;
        for (const tick of ticks) {
          const y = yy(tick);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (c.xAxisLabel?.trim())
        text(c.xAxisLabel, left, e.height - 14 * scale, plotWidth, fontSize, e.fill, 'center');
      if (c.yAxisLabel?.trim()) {
        ctx.save();
        ctx.translate(0, top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        text(c.yAxisLabel, -plotHeight / 2, 0, plotHeight, fontSize, e.fill, 'center');
        ctx.restore();
      }
      for (const tick of ticks) {
        const label = String(tick);
        text(
          label,
          left - 8 * scale - measure(label),
          yy(tick) - fontSize / 2,
          tickWidth,
          fontSize
        );
      }
      // Keep end labels inside the element's clipping bounds and avoid overlaps.
      let labelEnd = -Infinity;
      c.labels.forEach((label, i) => {
        const labelWidth = Math.min(e.width, measure(label));
        const x = Math.max(0, Math.min(e.width - labelWidth, xx(i) - labelWidth / 2));
        if (x < labelEnd + 10 * scale) return;
        text(label, x, bottom + 8 * scale, labelWidth, fontSize);
        labelEnd = x + labelWidth;
      });
      c.series.forEach((s, j) => {
        ctx.fillStyle = s.color;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2 * scale;
        let segment: [number, number][] = [];
        const traceSegment = () => {
          ctx.beginPath();
          ctx.moveTo(segment[0][0], segment[0][1]);
          if (segment.length === 2) ctx.lineTo(segment[1][0], segment[1][1]);
          else if (segment.length > 2) {
            // Shape-preserving cubic Hermite interpolation, like curveMonotoneX.
            const slopes = segment
              .slice(1)
              .map(([x, y], i) => (y - segment[i][1]) / (x - segment[i][0]));
            const tangents = segment.map((_, i) => {
              if (i === 0 || i === segment.length - 1) return 0;
              const before = slopes[i - 1];
              const after = slopes[i];
              const h0 = segment[i][0] - segment[i - 1][0];
              const h1 = segment[i + 1][0] - segment[i][0];
              const weighted = (before * h1 + after * h0) / (h0 + h1);
              return (
                (Math.sign(before) + Math.sign(after)) *
                Math.min(Math.abs(before), Math.abs(after), Math.abs(weighted) / 2)
              );
            });
            tangents[0] = (3 * slopes[0] - tangents[1]) / 2;
            tangents[tangents.length - 1] =
              (3 * slopes[slopes.length - 1] - tangents[tangents.length - 2]) / 2;
            for (let i = 1; i < segment.length; i++) {
              const [x0, y0] = segment[i - 1];
              const [x1, y1] = segment[i];
              const dx = (x1 - x0) / 3;
              ctx.bezierCurveTo(
                x0 + dx,
                y0 + dx * tangents[i - 1],
                x1 - dx,
                y1 - dx * tangents[i],
                x1,
                y1
              );
            }
          }
        };
        const finish = () => {
          if (!segment.length) return;
          traceSegment();
          if (c.kind === 'area') {
            ctx.save();
            ctx.lineTo(segment[segment.length - 1][0], yy(0));
            ctx.lineTo(segment[0][0], yy(0));
            ctx.closePath();
            ctx.globalAlpha *= 0.18;
            ctx.fill();
            ctx.restore();
            // Stroke only the upper curve, not the baseline of the filled area.
            traceSegment();
          }
          ctx.stroke();
          if (c.kind === 'line' || segment.length === 1) {
            for (const [x, y] of segment) {
              ctx.beginPath();
              ctx.arc(x, y, 2 * scale, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.stroke();
            }
            ctx.fillStyle = s.color;
          }
          segment = [];
        };
        s.values.forEach((v, i) => {
          if (v === null) {
            finish();
            return;
          }
          const x = xx(i),
            y = yy(v);
          if (c.kind === 'bar') {
            const width = (step * 0.75) / c.series.length;
            ctx.fillRect(
              left + i * step + step * 0.125 + j * width,
              Math.min(y, yy(0)),
              Math.max(scale, width - 2 * scale),
              Math.abs(y - yy(0))
            );
          } else segment.push([x, y]);
        });
        finish();
      });
    }
    if (c.layout !== 'results') {
      legendRows.forEach((row, rowIndex) => {
        const rowWidth =
          row.reduce((total, item) => total + item.width, 0) + (row.length - 1) * legendGap;
        let x = (e.width - rowWidth) / 2;
        const y = e.height - legendHeight - xTitleHeight + (8 + rowIndex * 24) * scale;
        for (const { index, width } of row) {
          ctx.fillStyle =
            c.kind === 'pie' ? palette[index % palette.length] : c.series[index].color;
          ctx.fillRect(x, y + 2 * scale, legendMarker, legendMarker);
          text(
            legendItems[index],
            x + legendMarker + 6 * scale,
            y,
            Math.max(1, width - legendMarker - 6 * scale),
            fontSize
          );
          x += width + legendGap;
        }
      });
    }
  } else {
    ctx.fillStyle = e.fill;
    ctx.strokeStyle = e.stroke;
    ctx.lineWidth = e.strokeWidth || 2;
    ctx.beginPath();
    if (e.type === 'rect') ctx.rect(0, 0, e.width, e.height);
    else if (e.type === 'ellipse')
      ctx.ellipse(e.width / 2, e.height / 2, e.width / 2, e.height / 2, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(2, 2);
      ctx.lineTo(e.width - 2, e.height - 2);
      if (e.type === 'arrow') {
        const a = Math.atan2(e.height - 4, e.width - 4),
          s = 18;
        ctx.moveTo(e.width - 2 - s * Math.cos(a - 0.5), e.height - 2 - s * Math.sin(a - 0.5));
        ctx.lineTo(e.width - 2, e.height - 2);
        ctx.lineTo(e.width - 2 - s * Math.cos(a + 0.5), e.height - 2 - s * Math.sin(a + 0.5));
      }
    }
    if (e.type === 'rect' || e.type === 'ellipse') ctx.fill();
    if (e.strokeWidth || e.type === 'line' || e.type === 'arrow') ctx.stroke();
  }
  ctx.restore();
}
