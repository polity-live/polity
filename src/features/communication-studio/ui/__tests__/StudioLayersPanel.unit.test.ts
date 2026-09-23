import { describe, expect, it } from 'vitest';
import type { StudioDocumentV3, StudioNode } from '../../logic/document-v3';
import { getStudioRootFramesInLayerOrder } from '../../logic/frame-order';
import { buildStudioLayerTree } from '../StudioLayersPanel';

function node(
  id: string,
  name: string,
  type: StudioNode['type'],
  parentFrameId: string | null,
  zIndex: number
) {
  return {
    id,
    name,
    type,
    parentFrameId,
    zIndex,
    ...(type === 'shape' ? { shape: 'rectangle' } : {}),
  } as StudioNode;
}

function documentWith(nodes: StudioNode[], masterFrameId: string | null = null) {
  return {
    nodes,
    masterLayout: { frameId: masterFrameId, placements: {} },
  } as StudioDocumentV3;
}

describe('Studio Layers tree', () => {
  it('lists frame branches first and unframed layers afterwards with stable depth', () => {
    const document = documentWith([
      node('frame-a', 'Frame A', 'frame', null, 2),
      node('a-back', 'A back', 'shape', 'frame-a', 1),
      node('a-front', 'A front', 'shape', 'frame-a', 5),
      node('frame-b', 'Frame B', 'frame', null, 0),
      node('b-text', 'B text', 'richText', 'frame-b', 1),
      node('free', 'Free layer', 'shape', null, 99),
    ]);

    expect(
      buildStudioLayerTree(document).map(entry => [entry.node.id, entry.depth, entry.rootFrameId])
    ).toEqual([
      ['frame-b', 0, 'frame-b'],
      ['b-text', 1, 'frame-b'],
      ['frame-a', 0, 'frame-a'],
      ['a-front', 1, 'frame-a'],
      ['a-back', 1, 'frame-a'],
      ['free', 0, null],
    ]);
    expect(getStudioRootFramesInLayerOrder(document).map(frame => frame.id)).toEqual([
      'frame-b',
      'frame-a',
    ]);
  });

  it('keeps matching ancestors and excludes the master-layout branch', () => {
    const document = documentWith(
      [
        node('frame', 'Campaign frame', 'frame', null, 0),
        node('needle', 'Needle headline', 'richText', 'frame', 1),
        node('other', 'Other layer', 'shape', 'frame', 0),
        node('free', 'Free shape', 'shape', null, 2),
        node('master', 'Master layout', 'frame', null, -1),
        node('master-child', 'Needle master', 'richText', 'master', 1),
      ],
      'master'
    );

    expect(buildStudioLayerTree(document, 'needle').map(entry => entry.node.id)).toEqual([
      'frame',
      'needle',
    ]);
    expect(getStudioRootFramesInLayerOrder(document).map(frame => frame.id)).toEqual(['frame']);
    expect(buildStudioLayerTree(document, 'SHAPE').map(entry => entry.node.id)).toEqual([
      'frame',
      'other',
      'free',
    ]);
  });
});
