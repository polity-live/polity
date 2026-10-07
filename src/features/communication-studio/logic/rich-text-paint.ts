import type { RichTextNode, StudioPlateChild } from './document-v3';

type Leaf = Extract<StudioPlateChild, { text: string }>;
type Run = Leaf & { url?: string };
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

function leaves(children: StudioPlateChild[], url?: string): Run[] {
  return children.flatMap(child =>
    'text' in child
      ? [{ ...child, ...(url ? { url } : {}) }]
      : leaves(child.children, child.url ?? url)
  );
}

/** Paint Plate's durable text runs directly into a 2D context; no bitmap projection is stored. */
export function paintStudioRichText(ctx: CanvasRenderingContext2D, node: RichTextNode): void {
  const { width, height } = node.transform;
  const { typography } = node;
  const baseSize = typography.fontSize;
  const baseColor = node.style.fill ?? '#12362D';
  const font = (run: Run) =>
    `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${run.fontSize ?? baseSize}px "${run.fontFamily ?? typography.fontFamily}"`;
  const lines: Line[] = [];

  node.content.forEach((paragraph, index) => {
    let line: Line = {
      tokens: [],
      width: 0,
      height: baseSize * typography.lineHeight,
      align: paragraph.align ?? typography.horizontalAlign,
      last: false,
    };
    const push = () => {
      lines.push(line);
      line = {
        tokens: [],
        width: 0,
        height: baseSize * typography.lineHeight,
        align: paragraph.align ?? typography.horizontalAlign,
        last: false,
      };
    };
    const runs: Run[] = [
      ...(paragraph.list
        ? [{ id: paragraph.id, text: paragraph.list === 'bullet' ? '• ' : `${index + 1}. ` }]
        : []),
      ...leaves(paragraph.children, paragraph.url),
    ];
    for (const run of runs) {
      for (const part of run.text.split(/(\s+)/)) {
        if (!part) continue;
        ctx.font = font(run);
        const chunks = ctx.measureText(part).width > width ? Array.from(part) : [part];
        for (const chunk of chunks) {
          ctx.font = font(run);
          const measured = ctx.measureText(chunk).width;
          const tokenWidth = measured + Math.max(0, chunk.length - 1) * typography.letterSpacing;
          if (line.width + tokenWidth > width && line.tokens.length) push();
          line.tokens.push({ run: { ...run, text: chunk }, width: tokenWidth });
          line.width += tokenWidth;
          line.height = Math.max(line.height, (run.fontSize ?? baseSize) * typography.lineHeight);
        }
      }
    }
    line.last = true;
    lines.push(line);
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  const totalHeight = lines.reduce((sum, line) => sum + line.height, 0);
  let y =
    typography.verticalAlign === 'middle'
      ? (height - totalHeight) / 2
      : typography.verticalAlign === 'bottom'
        ? height - totalHeight
        : 0;
  y = Math.max(0, y);
  ctx.textBaseline = 'top';
  for (const line of lines) {
    let x =
      line.align === 'center'
        ? (width - line.width) / 2
        : line.align === 'right'
          ? width - line.width
          : 0;
    const spaces = line.tokens.filter(token => /^\s+$/.test(token.run.text)).length;
    const justify =
      line.align === 'justify' && !line.last && spaces ? (width - line.width) / spaces : 0;
    for (const { run, width: tokenWidth } of line.tokens) {
      const size = run.fontSize ?? baseSize;
      ctx.font = font(run);
      ctx.fillStyle = run.color ?? baseColor;
      if (run.backgroundColor || run.highlight || run.code) {
        ctx.fillStyle = run.backgroundColor ?? (run.highlight ? '#FFF0A8' : '#E7E7E7');
        ctx.fillRect(x, y, tokenWidth, size * typography.lineHeight);
        ctx.fillStyle = run.color ?? baseColor;
      }
      ctx.fillText(run.text, x, y);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, size / 18);
      for (const position of [run.underline || run.url ? 0.95 : -1, run.strikethrough ? 0.5 : -1]) {
        if (position < 0) continue;
        ctx.beginPath();
        ctx.moveTo(x, y + size * position);
        ctx.lineTo(x + tokenWidth, y + size * position);
        ctx.stroke();
      }
      x += tokenWidth + (/^\s+$/.test(run.text) ? justify : 0);
    }
    y += line.height;
  }
  ctx.restore();
}
