import Konva from 'konva';
import { expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import { collectStudioCanvasTransforms, restoreStudioCanvasTransforms } from '../canvas-transforms';

it.each([false, true])(
  'restores actual Konva groups with mirrored geometry %s and skips deleted nodes',
  mirrored => {
    const document = createStudioTemplateDocumentV5('single', 'Cancelled transform', defaultBrand);
    const shape = document.nodes.find(node => node.type === 'shape')!;
    shape.transform.flipX = mirrored;
    shape.transform.flipY = mirrored;
    shape.transform.rotation = 30;
    const group = new Konva.Group({ id: shape.id, x: 1, y: 2, rotation: 90, scaleX: 3, scaleY: 4 });
    const deleted = new Konva.Group({ id: crypto.randomUUID(), x: 11, y: 12 });
    try {
      restoreStudioCanvasTransforms(studioDocumentV3Schema.parse(document), [group, deleted]);
      expect(group.position()).toEqual({
        x: shape.transform.x + shape.transform.width / 2,
        y: shape.transform.y + shape.transform.height / 2,
      });
      expect(group.rotation()).toBe(30);
      expect(group.scale()).toEqual({ x: mirrored ? -1 : 1, y: mirrored ? -1 : 1 });
      expect(deleted.position()).toEqual({ x: 11, y: 12 });
    } finally {
      group.destroy();
      deleted.destroy();
    }
  }
);

it.each([false, true])(
  'collects an actual mirrored %s resize in a rotated frame without changing the document',
  mirrored => {
    const document = createStudioTemplateDocumentV5('single', 'Resize projection', defaultBrand);
    const shape = document.nodes.find(node => node.type === 'shape')!;
    const frame = document.nodes.find(node => node.id === shape.parentFrameId)!;
    frame.transform.rotation = 90;
    shape.transform = { ...shape.transform, x: 10, y: 20, width: 100, height: 80 };
    const validated = studioDocumentV3Schema.parse(document);
    const before = structuredClone(validated);
    const group = new Konva.Group({
      id: shape.id,
      x: 120,
      y: 155,
      rotation: 45,
      scaleX: mirrored ? -2 : 2,
      scaleY: mirrored ? -3 : 3,
    });
    try {
      const [change] = collectStudioCanvasTransforms(validated, [group]);
      expect(change.nodeId).toBe(shape.id);
      expect(change.transform).toMatchObject({
        width: 200,
        height: 240,
        rotation: 45,
        flipX: mirrored,
        flipY: mirrored,
      });
      expect(change.transform!.dx).toBeCloseTo(-15);
      expect(change.transform!.dy).toBeCloseTo(10);
      expect(group.scale()).toEqual({ x: mirrored ? -1 : 1, y: mirrored ? -1 : 1 });
      expect(validated).toEqual(before);
    } finally {
      group.destroy();
    }
  }
);

it('collects root node transforms, clamps collapsed dimensions, and ignores deleted SDK nodes', () => {
  const document = createStudioTemplateDocumentV5('single', 'Root resize', defaultBrand);
  const shape = document.nodes.find(node => node.type === 'shape')!;
  shape.parentFrameId = null;
  shape.transform = { ...shape.transform, x: 10, y: 20, width: 100, height: 80 };
  const group = new Konva.Group({ id: shape.id, x: 15.5, y: 27.5, scaleX: 0, scaleY: 0 });
  const deleted = new Konva.Group({ id: crypto.randomUUID() });
  try {
    expect(
      collectStudioCanvasTransforms(studioDocumentV3Schema.parse(document), [group, deleted])
    ).toEqual([
      {
        nodeId: shape.id,
        transform: { dx: 5, dy: 7, width: 1, height: 1, rotation: 0, flipX: false, flipY: false },
      },
    ]);
  } finally {
    group.destroy();
    deleted.destroy();
  }
});
