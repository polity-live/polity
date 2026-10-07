import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFrameNode,
  richTextNodeSchema,
  type RichTextNode,
  type StudioPlateElement,
} from '../document-v3';
import { paintStudioRichText } from '../rich-text-paint';

let ctx: CanvasRenderingContext2D;
let drawn: { text: string; x: number; y: number; font: string; color: string }[];
let backgrounds: { x: number; y: number; width: number; height: number; color: string }[];
beforeEach(() => {
  drawn = [];
  backgrounds = [];
  ctx = Object.fromEntries(
    ['save', 'restore', 'beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'stroke'].map(name => [
      name,
      vi.fn(),
    ])
  ) as unknown as CanvasRenderingContext2D;
  ctx.measureText = vi.fn(text => ({ width: text.length * 10 }) as TextMetrics);
  ctx.fillText = vi.fn((text, x, y) =>
    drawn.push({ text, x, y, font: ctx.font, color: ctx.fillStyle as string })
  );
  ctx.fillRect = vi.fn((x, y, width, height) =>
    backgrounds.push({ x, y, width, height, color: ctx.fillStyle as string })
  );
});
const leaf = (text: string, properties = {}) => ({ id: crypto.randomUUID(), text, ...properties });
const paragraph = (
  text: string,
  properties: Partial<StudioPlateElement> = {}
): StudioPlateElement => ({
  id: crypto.randomUUID(),
  type: 'p',
  children: [leaf(text)],
  ...properties,
});
function node(
  content: StudioPlateElement[],
  typography: Partial<RichTextNode['typography']> = {},
  width = 100,
  height = 100
) {
  return richTextNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'richText',
    content,
    transform: { x: 0, y: 0, width, height },
    style: { fill: '#112233' },
    typography: { fontSize: 20, lineHeight: 1, ...typography },
  });
}
describe('Durable rich text canvas export', () => {
  it.each(['top', 'middle', 'bottom'] as const)(
    'positions text at the %s of its bounds and clips its drawing',
    verticalAlign => {
      paintStudioRichText(ctx, node([paragraph('Hello')], { verticalAlign }));
      expect(drawn).toEqual([
        {
          text: 'Hello',
          x: 0,
          y: { top: 0, middle: 40, bottom: 80 }[verticalAlign],
          font: '20px "Manrope"',
          color: '#112233',
        },
      ]);
      expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(ctx.clip).toHaveBeenCalledOnce();
      expect(ctx.save).toHaveBeenCalledOnce();
      expect(ctx.restore).toHaveBeenCalledOnce();
      expect(ctx.textBaseline).toBe('top');
    }
  );
  it.each(['left', 'center', 'right'] as const)(
    'uses paragraph %s alignment before the document alignment',
    align => {
      paintStudioRichText(ctx, node([paragraph('word', { align })], { horizontalAlign: 'right' }));
      expect(drawn[0].x).toBe({ left: 0, center: 30, right: 60 }[align]);
    }
  );
  it('uses document alignment on every wrapped line and keeps overflowing vertical text at the top', () => {
    paintStudioRichText(
      ctx,
      node(
        [paragraph('one two three')],
        { horizontalAlign: 'right', verticalAlign: 'middle' },
        40,
        10
      )
    );
    expect(drawn.filter(run => run.text.trim())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'one', x: 0, y: 0 }),
        expect.objectContaining({ text: 'two', x: 0, y: 20 }),
      ])
    );
    expect(drawn.find(run => run.text === 't' && run.y === 40)).toBeDefined();
    expect(drawn.every(run => run.y >= 0)).toBe(true);
  });
  it('wraps long unbroken text by character while preserving letter spacing and empty paragraphs', () => {
    paintStudioRichText(ctx, node([paragraph('ABCDE'), paragraph('')], { letterSpacing: 2 }, 25));
    expect(drawn.map(run => [run.text, run.x, run.y])).toEqual([
      ['A', 0, 0],
      ['B', 10, 0],
      ['C', 0, 20],
      ['D', 10, 20],
      ['E', 0, 40],
    ]);
    drawn = [];
    paintStudioRichText(ctx, node([paragraph('AB CD')], { letterSpacing: 2 }, 100));
    expect(drawn.map(run => [run.text, run.x])).toEqual([
      ['AB', 0],
      [' ', 22],
      ['CD', 32],
    ]);
  });
  it('numbers list paragraphs by document position and paints bullet prefixes', () => {
    paintStudioRichText(
      ctx,
      node([paragraph('First', { list: 'bullet' }), paragraph('Next', { list: 'number' })], {}, 200)
    );
    expect(drawn.map(run => run.text).join('')).toBe('• First2. Next');
    expect(drawn.find(run => run.text === 'Next')?.y).toBe(20);
  });
  it('inherits links through nested inline elements while allowing explicit link overrides', () => {
    paintStudioRichText(
      ctx,
      node([
        paragraph('', {
          url: 'https://example.com/parent',
          children: [
            {
              id: crypto.randomUUID(),
              type: 'span',
              children: [
                leaf('A'),
                {
                  id: crypto.randomUUID(),
                  type: 'a',
                  url: 'https://example.com/child',
                  children: [leaf('B')],
                },
              ],
            },
          ],
        }),
      ])
    );
    expect(drawn.map(run => run.text)).toEqual(['A', 'B']);
    expect(ctx.moveTo).toHaveBeenNthCalledWith(1, 0, 19);
    expect(ctx.moveTo).toHaveBeenNthCalledWith(2, 10, 19);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });
  it('uses leaf font overrides and marks while computing line height from the tallest run', () => {
    const value = node([
      paragraph('', {
        children: [
          leaf('A', {
            italic: true,
            bold: true,
            fontSize: 30,
            fontFamily: 'Inter',
            color: '#ABCDEF',
          }),
        ],
      }),
      paragraph('B'),
    ]);
    paintStudioRichText(ctx, value);
    expect(drawn[0]).toMatchObject({ font: 'italic bold 30px "Inter"', color: '#ABCDEF', y: 0 });
    expect(drawn[1]).toMatchObject({ font: '20px "Manrope"', color: '#112233', y: 30 });
  });
  it('uses the default text color for an unfilled node and restores it after marked backgrounds', () => {
    const value = node([
      paragraph('', {
        children: [
          leaf('A', { backgroundColor: '#FF0000', color: '#00FF00' }),
          leaf('B', { highlight: true }),
          leaf('C', { code: true }),
          leaf('D'),
        ],
      }),
    ]);
    value.style.fill = null;
    paintStudioRichText(ctx, value);
    expect(backgrounds).toEqual([
      { x: 0, y: 0, width: 10, height: 20, color: '#FF0000' },
      { x: 10, y: 0, width: 10, height: 20, color: '#FFF0A8' },
      { x: 20, y: 0, width: 10, height: 20, color: '#E7E7E7' },
    ]);
    expect(drawn.map(run => run.color)).toEqual(['#00FF00', '#12362D', '#12362D', '#12362D']);
  });
  it('paints underline and strikethrough at their font-relative positions', () => {
    paintStudioRichText(
      ctx,
      node([paragraph('', { children: [leaf('AB', { underline: true, strikethrough: true })] })])
    );
    expect(ctx.moveTo).toHaveBeenNthCalledWith(1, 0, 19);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 20, 19);
    expect(ctx.moveTo).toHaveBeenNthCalledWith(2, 0, 10);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 20, 10);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.lineWidth).toBeCloseTo(20 / 18);
  });
  it('justifies only wrapped lines containing whitespace and leaves the final line unstretched', () => {
    paintStudioRichText(ctx, node([paragraph('one two three', { align: 'justify' })], {}, 85));
    expect(drawn.find(run => run.text === 'two')).toMatchObject({ x: 42.5, y: 0 });
    expect(drawn.find(run => run.text === 'three')).toMatchObject({ x: 0, y: 20 });
    drawn = [];
    paintStudioRichText(ctx, node([paragraph('ABCDE', { align: 'justify' })], {}, 20));
    expect(drawn.map(run => run.x)).toEqual([0, 10, 0, 10, 0]);
  });
});
