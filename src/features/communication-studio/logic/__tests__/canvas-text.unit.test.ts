import { it, expect } from 'vitest';
import { canFormatNativeText, formatNativeText } from '../canvas-text';
import { createDocument } from '../templates';
import { polityProjection } from '../canvas-adapter';
import { diffStudio, inverseChanges, mergeStudio } from '../operations';
import { canvasElementSchema } from '../canvas-schema';

const text = {
  id: 'sdk-text',
  type: 'text' as const,
  x: 125,
  y: 250,
  width: 300,
  height: 50,
  angle: Math.PI / 4,
  isDeleted: false,
  text: 'Hello\nWorld',
  strokeColor: '#12362D',
  fontSize: 20,
  fontFamily: 2,
  textAlign: 'center',
  lineHeight: 1.25,
  opacity: 75,
  customData: { polityOrder: 4 },
};
it('formats native text without moving it and undo restores its complete SDK source', () => {
  const original = createDocument('whiteboard', 'Text');
  original.pages[0].canvas = { version: 1, elements: [text], files: {} };
  const result = formatNativeText(original.pages[0], text.id, 'bold');
  expect(result.text).toMatchObject({
    text: 'Hello\nWorld',
    bold: true,
    font: 'Manrope',
    opacity: 0.75,
    order: 4,
    align: 'center',
  });
  const geometry = polityProjection(result.text);
  expect(geometry.x).toBeCloseTo(text.x);
  expect(geometry.y).toBeCloseTo(text.y);
  expect(geometry.angle).toBeCloseTo(text.angle);
  const next = { ...original, pages: [result.page] };
  const restored = mergeStudio(next, inverseChanges(diffStudio(original, next)));
  expect(restored.conflicts).toEqual([]);
  expect(restored.value).toEqual(original);
});
it('refuses rich-text conversion that would detach a binding, group, frame or link', () => {
  for (const extra of [
    { containerId: 'box' },
    { boundElements: [{ id: 'arrow', type: 'arrow' }] },
    { groupIds: ['group'] },
    { frameId: 'frame' },
    { link: '#anchor' },
    { locked: true },
  ]) {
    expect(canFormatNativeText(canvasElementSchema.parse({ ...text, ...extra }))).toBe(false);
  }
});
