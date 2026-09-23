import type PptxGenJS from 'pptxgenjs';
import type { CanvasScene } from '../../src/features/communication-studio/logic/canvas-schema';

/** Return false for drawing effects that PowerPoint cannot reproduce faithfully. */
export function addEditableCanvasElement(
  ppt: PptxGenJS,
  slide: PptxGenJS.Slide,
  e: CanvasScene['elements'][number]
) {
  if (e.isDeleted) return true;
  if (
    Number(e.roughness ?? 0) !== 0 ||
    e.frameId ||
    (e.fillStyle && e.fillStyle !== 'solid' && e.backgroundColor !== 'transparent')
  )
    return false;
  const color = (value: unknown, fallback: string) =>
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : fallback;
  const box = {
    x: e.x / 144,
    y: e.y / 144,
    w: e.width / 144,
    h: e.height / 144,
    rotate: (e.angle * 180) / Math.PI,
    transparency: 100 - Number(e.opacity ?? 100),
  };
  if (e.type === 'text' && typeof e.text === 'string') {
    slide.addText(e.text, {
      ...box,
      fontFace: Number(e.fontFamily) === 3 ? 'Consolas' : 'Arial',
      fontSize: Number(e.fontSize ?? 20) / 2,
      color: color(e.strokeColor, '12362D'),
      margin: 0,
      breakLine: false,
      align: e.textAlign === 'center' ? 'center' : e.textAlign === 'right' ? 'right' : 'left',
      valign: 'top',
      lineSpacingMultiple: Number(e.lineHeight ?? 1.25),
    });
    return true;
  }
  if (['rectangle', 'ellipse', 'diamond'].includes(e.type)) {
    slide.addShape(
      e.type === 'ellipse'
        ? ppt.ShapeType.ellipse
        : e.type === 'diamond'
          ? ppt.ShapeType.diamond
          : e.roundness
            ? ppt.ShapeType.roundRect
            : ppt.ShapeType.rect,
      {
        ...box,
        fill: {
          color: color(e.backgroundColor, 'FFFFFF'),
          transparency: e.backgroundColor === 'transparent' ? 100 : box.transparency,
        },
        line: {
          color: color(e.strokeColor, '12362D'),
          width: Number(e.strokeWidth ?? 1) / 2,
          transparency: e.strokeColor === 'transparent' ? 100 : box.transparency,
          dashType:
            e.strokeStyle === 'dashed' ? 'dash' : e.strokeStyle === 'dotted' ? 'sysDot' : 'solid',
        },
      }
    );
    return true;
  }
  return false;
}
