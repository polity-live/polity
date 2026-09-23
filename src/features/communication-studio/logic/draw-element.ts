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
    align = 'left',
    bold = e.bold
  ) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px "${e.font}"`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(text).width;
    ctx.fillText(
      text,
      x + (align === 'center' ? (w - tw) / 2 : align === 'right' ? w - tw : 0),
      y,
      w
    );
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
        const edges = cell.borders ?? { top: true, right: true, bottom: true, left: true };
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
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 4, r * height + 4, w - 8, height - 8);
        ctx.clip();
        ctx.translate(x + 6, r * height + 6);
        drawStudioElement(ctx, {
          ...e,
          type: 'text',
          width: w - 12,
          height: height - 12,
          text: cell.text,
          richText: [],
          bold: cell.bold,
          fill: cell.color,
          align: cell.align,
          verticalAlign: 'top',
          fontSize: Math.max(8, Math.min(e.fontSize, height - 12)),
          flipX: false,
          flipY: false,
        });
        ctx.restore();
        x += w;
      });
    });
  } else if (e.type === 'chart' && e.chart) {
    const c = e.chart,
      pad = 40,
      legend = c.legend ? 32 : 0,
      w = e.width - pad * 2,
      h = e.height - pad * 2 - legend;
    const palette = c.colors ?? ['#B88A3B', '#12362D', '#588DB2', '#9A597F', '#75965D', '#D46E48'];
    if (c.kind === 'pie') {
      const values = c.series[0].values,
        total = values.reduce((a, b) => a + b, 0),
        radius = Math.max(1, Math.min(w, h) / 2);
      let a = -Math.PI / 2;
      values.forEach((v, i) => {
        const end = a + (v / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.width / 2, pad + h / 2);
        ctx.arc(e.width / 2, pad + h / 2, radius, a, end);
        ctx.closePath();
        ctx.fillStyle = palette[i % palette.length];
        ctx.fill();
        const mid = (a + end) / 2;
        text(
          c.labels[i],
          e.width / 2 + Math.cos(mid) * radius * 0.6 - 35,
          pad + h / 2 + Math.sin(mid) * radius * 0.6 - 10,
          70,
          14,
          '#FFFFFF',
          'center'
        );
        a = end;
      });
    } else {
      const values = c.series.flatMap(s => s.values),
        min = Math.min(0, ...values),
        max = Math.max(1, ...values),
        range = max - min,
        yy = (v: number) => pad + h - ((v - min) / range) * h,
        step = w / c.labels.length;
      ctx.strokeStyle = e.fill;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, pad);
      ctx.lineTo(pad, pad + h);
      ctx.lineTo(pad + w, pad + h);
      ctx.stroke();
      text(String(max), 0, pad, 35, 12);
      text(String(min), 0, pad + h - 14, 35, 12);
      c.labels.forEach((label, i) =>
        text(label, pad + i * step, pad + h + 8, step, 12, e.fill, 'center')
      );
      c.series.forEach((s, j) => {
        ctx.fillStyle = s.color;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        s.values.forEach((v, i) => {
          const x = pad + step * (i + 0.5),
            y = yy(v);
          if (c.kind === 'bar') {
            const width = (step * 0.75) / c.series.length;
            ctx.fillRect(
              pad + i * step + step * 0.125 + j * width,
              Math.min(y, yy(0)),
              width - 2,
              Math.abs(y - yy(0))
            );
          } else {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
        if (c.kind === 'line') ctx.stroke();
      });
    }
    if (c.legend) {
      const items = c.kind === 'pie' ? c.labels : c.series.map(s => s.name);
      items.forEach((name, i) => {
        const width = e.width / items.length;
        ctx.fillStyle = c.kind === 'pie' ? palette[i % palette.length] : c.series[i].color;
        ctx.fillRect(i * width + 4, e.height - 20, 12, 12);
        text(name, i * width + 22, e.height - 22, width - 26, 12);
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
