import { afterEach, expect, it } from 'vitest';
import {
  createFrameNode,
  createStudioDocumentV5,
  mediaNodeSchema,
  shapeNodeSchema,
} from '../document-v3';
import { paintStudioDocumentFrame } from '../paint-v5';

afterEach(() => {
  for (const canvas of document.querySelectorAll('canvas')) canvas.remove();
});
function fixture() {
  const value = createStudioDocumentV5('Pixel export');
  const frame = createFrameNode('custom', {
    transform: { x: 0, y: 0, width: 100, height: 100 },
    style: {
      fill: '#FFFFFF',
      fillBinding: null,
      stroke: null,
      strokeBinding: null,
      strokeWidth: 0,
      strokeStyle: 'solid',
      opacity: 1,
      cornerRadius: 0,
      roughness: 0,
    },
  });
  value.nodes.push(frame);
  return { value, frame };
}
function rectangle(
  parentFrameId: string,
  fill: string,
  zIndex: number,
  x = 0,
  y = 0,
  width = 100,
  height = 100
) {
  return shapeNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'shape',
    parentFrameId,
    shape: 'rectangle',
    transform: { x, y, width, height },
    zIndex,
    style: { fill, stroke: null, strokeWidth: 0 },
  });
}
async function decoded(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas fixture unavailable');
  context.drawImage(image, 0, 0);
  return { image, pixel: (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data] };
}
it('exports actual PNG pixels in sibling and master-layout order while excluding hidden nodes', async () => {
  const { value, frame } = fixture();
  const master = createFrameNode('custom', { transform: { x: 0, y: 0, width: 50, height: 50 } });
  const background = rectangle(master.id, '#FF0000', 1, 0, 0, 50, 50);
  const foreground = rectangle(master.id, '#00FF00', 2, 0, 0, 5, 5);
  const blue = rectangle(frame.id, '#0000FF', 3, 20, 20, 40, 40);
  const hidden = rectangle(frame.id, '#000000', 4);
  hidden.visible = false;
  value.masterLayout = {
    frameId: master.id,
    placements: { [background.id]: 'background', [foreground.id]: 'foreground' },
  };
  value.nodes.push(master, hidden, foreground, blue, background);
  const result = await decoded(await paintStudioDocumentFrame(value, frame.id, {}));
  expect([result.image.naturalWidth, result.image.naturalHeight]).toEqual([100, 100]);
  expect(result.pixel(80, 80)).toEqual([255, 0, 0, 255]);
  expect(result.pixel(40, 40)).toEqual([0, 0, 255, 255]);
  expect(result.pixel(5, 5)).toEqual([0, 255, 0, 255]);
});
it('decodes an image into the exported frame with centered cover cropping', async () => {
  const { value, frame } = fixture();
  const source = document.createElement('canvas');
  source.width = 200;
  source.height = 100;
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Source canvas unavailable');
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = '#0000FF';
  ctx.fillRect(100, 0, 100, 100);
  const image = mediaNodeSchema.parse({
    ...rectangle(frame.id, '#FFFFFF', 1),
    type: 'media',
    mediaType: 'image',
    assetId: crypto.randomUUID(),
    fit: 'cover',
  });
  value.nodes.push(image);
  const result = await decoded(
    await paintStudioDocumentFrame(value, frame.id, {
      [image.assetId]: source.toDataURL('image/png'),
    })
  );
  expect(result.pixel(20, 50)).toEqual([255, 0, 0, 255]);
  expect(result.pixel(80, 50)).toEqual([0, 0, 255, 255]);
});
